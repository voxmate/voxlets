import {ISocketPacketHandler, SocketActivity, SocketConnection, SocketError} from "./SocketActivity";
import {ControllablePromise, currentTimeMillis} from "../utility/common";

import {
    CancellationToken,
    IRPCErrorResponse,
    IRPCEventMessage,
    IRPCMessage,
    IRPCRequest,
    IRPCRequestCancellation,
    IRPCResponse,
    isRPCErrorResponse,
    isRPCEventMessage,
    isRPCInitMessage,
    isRPCRequest,
    isRPCRequestCancellation,
    isRPCResponse
} from "./RPCUtility";
import {TaskQueue} from "./RichActivity";

type RPCHandler = (cancellationToken: CancellationToken, data: any | null) => Promise<any | void>;

const SECOND = 1000;

const RPC_UPGRADE_NORMAL = 5 * 60 * SECOND;
const RPC_UPGRADE_QUICK = 10 * SECOND;

const RPC_OPERATION_TIMEOUT = 5000;

interface IRPCTask {
    requestId?: string;
    protocol: "event" | "rpc",
    blocking: boolean;
    handler: RPCHandler;
    data: any | null;
    timeout?: number;
    method: string;
}

const registerServerEventHandler = Symbol("registerServerEventHandler");
const registerClientRPCHandler = Symbol("registerClientRPCHandler");
const blockingProperty = Symbol("blocking");

export function extractNestedObject(src: any, prop: string): any {

    let node = Object.getPrototypeOf(src);

    let all = {};
    while (node) {
        const nodeHandlers = node[prop] || {};
        all = {...all, ...nodeHandlers};
        node = Object.getPrototypeOf(node);
    }

    return all;
}

export function extractNestedObjectList(src: any, prop: string): any {

    let node = Object.getPrototypeOf(src);

    let all = {};
    while (node) {
        const nodeHandlers = node[prop] || {};
        for (let key in nodeHandlers) {
            const nodeValues = nodeHandlers[key];
            if (all.hasOwnProperty(key)) {
                all[key].concat(nodeValues);
            } else {
                all[key] = nodeValues;
            }
        }
        node = Object.getPrototypeOf(node);
    }

    return all;
}

export function assignNestedObject(target: any, prop: string, key: string, value: any) {
    if (!target.hasOwnProperty(prop))
        target[prop] = {};
    target[prop][key] = value;
}

export function getNestedObject(target: any, prop: string) {
    if (!target.hasOwnProperty(prop))
        target[prop] = {};

    return target[prop];
}

export function subscribe(event: string, blocking: boolean = true) {
    return function (target: RPCSocketActivity, propertyKey: string) {
        const handler = target[propertyKey];
        handler[blockingProperty] = blocking;
        target[registerServerEventHandler](event, handler);
    };
}

export function clientRPC(method: string, blocking: boolean = true) {
    return function (target: RPCSocketActivity, propertyKey: string) {
        const handler = target[propertyKey];
        handler[blockingProperty] = blocking;
        target[registerClientRPCHandler](method, handler);
    };
}

export class RPCError extends SocketError {
}

export class RPCConnectionLost extends RPCError {
}

export class RPCProtocolError extends RPCError {
    constructor(readonly message: string) {
        super();
    }
}

export class SocketUpgradeFail extends RPCError {
    constructor(readonly message: string) {
        super();
    }
}

export class RPCUseError extends RPCError {
    constructor(readonly message: string) {
        super();
    }
}

export class RPCSocketConnection {

    signaledReady: boolean = false;

    constructor(readonly socket: SocketConnection) {

    }

    async send(request: IRPCRequest | IRPCMessage | IRPCResponse) {
        const json = JSON.stringify(request);
        await this.socket.sendTextMessage(json);
    }

    close() {
        this.socket.close();
    }
}

export abstract class RPCSocketActivity<T = any> extends SocketActivity<T> {

    private static EVENTS_PROPERTY = "___voxmate_rpc_events";
    private static CLIENT_RPC_PROPERTY = "___voxmate_rpc_client";

    private _requestId = 1;
    private readonly _requests: { [requestId: number]: ControllablePromise } = {};

    private readonly _events: { [event: string]: RPCHandler[] } = {};
    private readonly _clientRPCHandlers: { [method: string]: RPCHandler } = {};
    private readonly _cancellationTokens: { [requestId: string]: ControllablePromise } = {};

    private _sequentialTaskDispatchQueue: TaskQueue<IRPCTask>;
    private _taskDispatchQueue: TaskQueue<IRPCTask>;

    private readonly _constructed: boolean = false;
    private readonly _connectionPacket = new ControllablePromise<string>();
    private readonly _socketError = new ControllablePromise<string>();
    private readonly _socketConnectionLossError = new ControllablePromise<RPCConnectionLost>();

    private _connection: RPCSocketConnection = null;

    private scheduleSocketInterleave(normal: boolean) {
        this.setTimeout(async () => {
            await this.beginUpgradingSocket();
        }, normal ? RPC_UPGRADE_NORMAL : RPC_UPGRADE_QUICK);
    }

    private async handleRPCProtocolTask(task: IRPCTask) {

        if (this.ended)
            return;

        try {

            const cancellationToken = this._cancellationTokens[task.requestId];
            const args = task.protocol === "event" ? [task.data] : [cancellationToken, task.data];
            const result = await task.handler.apply(this, args);

            if (cancellationToken && cancellationToken.resolved)
                return;

            if (task.protocol == "rpc") {
                await this._connection.send({
                    data: result,
                    method: "response",
                    protocol: "response",
                    requestId: task.requestId
                });
            }
        } catch (e) {
            //TODO: Test this error path.
            console.error("RPC PROTO ERROR", e);
            this.endWithError(e);
        } finally {
            delete this._cancellationTokens[task.requestId];
        }
    }

    private async beginUpgradingSocket() {

        try {
            const task = this.upgradeSocket();
            const success = await this.withTimeout(false, 10000, task);

            if (success) {
                this.scheduleSocketInterleave(true);
            } else {
                console.error("Unable to upgrade socket");
                this.scheduleSocketInterleave(false);
            }

        } catch (e) {

            if (this.ended)
                return;

            console.log("Upgrade Exception", JSON.stringify(e));

            if (e instanceof SocketUpgradeFail)
                this.onSocketConnectionLoss();

            this.scheduleSocketInterleave(false);
        }
    }

    private sayErrorInBackgroundAndQuit(text: string) {
        this.setTimeout(async () => {
            await this.runSubActivityInIsolation(async (activity) => {
                await activity.sayInfo(text);
            });
            this.end(undefined);
        });
    }

    private handleDispatcherTask(task: IRPCTask) {
        if (task.requestId && task.protocol == "rpc") {

            const promise = new ControllablePromise();
            if (task.timeout)
                promise["timeout"] = currentTimeMillis() + task.timeout;

            this._cancellationTokens[task.requestId] = promise;
        }

        if (task.blocking) {
            this._sequentialTaskDispatchQueue.enqueue(task);
        } else {
            this.setTimeout(async () => {
                await this.handleRPCProtocolTask(task);
            });
        }
    }

    protected async init() {

        this._sequentialTaskDispatchQueue = this.startTaskQueue<IRPCTask>(async (task) => {
            await this.handleRPCProtocolTask(task);
        });

        this._taskDispatchQueue = this.startTaskQueue<IRPCTask>((task) => {
            this.handleDispatcherTask(task);
        });

        await super.init();

        this.onEnd(() => {
            this._connection?.close();
        });
        await this._connectionPacket;
    }

    onSocketError(error: string) {
        if (this.ended)
            return;

        console.error("SOCKET ERROR", error);
        this._socketError.reject(error);

        this.sayErrorInBackgroundAndQuit("Encountered an Error");
    }

    onSocketMessage(message: any): any | undefined {

        if (this.ended)
            return;

        try {
            const msg = JSON.parse(message) as IRPCMessage;

            if (isRPCResponse(msg)) {
                this.onRPCResponse(msg);
            } else if (isRPCRequest(msg)) {
                this.onRPCRequest(msg);
            } else if (isRPCEventMessage(msg)) {
                this.onRPCEventMessage(msg);
            } else if (isRPCErrorResponse(msg)) {
                this.onRPCErrorResponse(msg);
            } else if (isRPCInitMessage(msg)) {
                this._connectionPacket.resolve(msg.connectionId);
            } else if (isRPCRequestCancellation(msg)) {
                this.onRPCRequestCancellation(msg);
            }

        } catch (e) {
            console.error("INVALID RPC MESSAGE", e);
            this.onSocketConnectionLoss();
        }
    }

    onSocketConnectionLoss() {
        if (this.ended)
            return;
        this.sayErrorInBackgroundAndQuit("Server closed the connection");
    }

    onSocketConnectionEstablished(connection: SocketConnection) {
        this._connection = new RPCSocketConnection(connection);
    }

    async onSocketConnected(): Promise<any> {
        await this.signalReady();
        this.scheduleSocketInterleave(true);
        return await this.runConnected();
    }

    private async upgradeSocket(): Promise<boolean> {

        const handler = new class implements ISocketPacketHandler {

            upgrade = new ControllablePromise<string>();

            onSocketConnectionLoss() {
                this.upgrade.reject(new SocketUpgradeFail("Lost connection while upgrading..."));
            }

            onSocketError(error: string) {
                console.error("SOCKET ERROR", error);
                this.upgrade.reject(new SocketUpgradeFail(`While Upgrading Got Socket Error: ${error}`));
            }

            onSocketMessage(json: string) {
                const message = JSON.parse(json) as IRPCMessage;
                if (isRPCInitMessage(message)) {
                    this.upgrade.resolve(message.connectionId);
                } else {
                    throw new RPCProtocolError("Expected an init message");
                }
            }
        };

        const connection: SocketConnection = this.openSocketConnection(handler);

        const cancelExtraOnEndHandler = this.onEnd(() => {
            connection.close();
        });

        const openedOk = await this.resolveOrTimeout<boolean>(RPC_OPERATION_TIMEOUT, connection.openedSuccessfully(),
            new SocketUpgradeFail("Unable to open socket in time"));

        if (!openedOk)
            throw new SocketUpgradeFail("Unable to open socket");

        const connectionId = await this.resolveOrTimeout(RPC_OPERATION_TIMEOUT, handler.upgrade,
            new SocketUpgradeFail("Unable to get connection id"));

        console.log("ConnectionId", connectionId);

        class NOOPHandler implements ISocketPacketHandler {
            onSocketConnectionLoss() {
                console.log("Parent Connection Closed");
            }

            onSocketError(error: string) {
                console.log("Parent Connection Error: " + error);
            }

            onSocketMessage(message: string) {
                console.log("Parent Connection MSG: " + message);
            }
        }

        const oldConnection = this._connection;
        await oldConnection.socket.replaceHandler(new NOOPHandler());

        const newConnection = this._connection = new RPCSocketConnection(connection);
        await newConnection.socket.replaceHandler(this);

        oldConnection.close();

        cancelExtraOnEndHandler();
        await this.signalReady();

        return true;
    }

    private onRPCRequestCancellation(cancellation: IRPCRequestCancellation) {
        const token = this._cancellationTokens[cancellation.requestId];
        if (token)
            token.resolve(true);
    }

    private onRPCResponse(response: IRPCResponse) {
        const cp = this._requests[response.requestId];
        if (cp)
            cp.resolve(response.data);
        delete this._requests[response.requestId];
    }

    private onRPCErrorResponse(response: IRPCErrorResponse) {
        const cp = this._requests[response.requestId];
        if (cp)
            cp.reject(response.message);
        delete this._requests[response.requestId];
    }

    private onRPCEventMessage(event: IRPCEventMessage) {

        const handlers = this._events[event.channel] ?? [];

        if (handlers.length === 0)
            console.warn("No handlers for", event.channel);

        for (let handler of handlers) {
            const blocking = !!handler[blockingProperty];
            this._taskDispatchQueue.enqueue({
                protocol: "event",
                data: event.data,
                handler: handler,
                blocking: blocking,
                method: event.channel
            });
        }
    }

    private onRPCRequest(request: IRPCRequest) {

        const handler = this._clientRPCHandlers[request.method];

        if (!handler) {
            console.error("No client RPC handler for method", request.method);
            throw new RPCProtocolError(`No RPC handler for method: ${request.method}`);
        }

        const blocking = !!handler[blockingProperty];

        this._taskDispatchQueue.enqueue({
            protocol: "rpc",
            handler: handler,
            blocking: blocking,
            requestId: request.requestId,
            data: request.data,
            timeout: request.timeout,
            method: request.method,
        });
    }

    private async wrapRPC(promise: Promise<any>): Promise<any> {
        const possibilities = this.race(
            promise,
            this._socketError,
            this._socketConnectionLossError);

        const response = await this.wrapAny(possibilities);

        await this.haltIfEnded();

        return response;
    }

    private getResponse(payload: IRPCRequest): Promise<any> {
        const promise = new ControllablePromise();
        this._requests[payload.requestId] = promise;
        return this.wrapRPC(promise);
    }

    constructor(url: string, service: string, roomId: string) {
        super(url, {
            "Service": service,
            "Service-Room-Id": roomId,
            "Voxmate-User-Id": "***"
        });

        const events = this._events = {};

        const staticEventHandlers = extractNestedObjectList(this, RPCSocketActivity.EVENTS_PROPERTY);
        for (let event in staticEventHandlers)
            events[event] = [...staticEventHandlers[event]];

        this._clientRPCHandlers = extractNestedObject(this, RPCSocketActivity.CLIENT_RPC_PROPERTY);
        this._constructed = true;
    }

    // Implementors

    [registerServerEventHandler](event: string, handler: RPCHandler) {

        // Event handlers can be added dynamically, or with @subscribe('event') decorator.

        let events;
        if (this._constructed) {
            events = this._events;
        } else {
            events = getNestedObject(this, RPCSocketActivity.EVENTS_PROPERTY);
        }

        const handlers = events[event] = events[event] ?? [];
        handlers.push(handler);
    }

    [registerClientRPCHandler](method: string, handler: RPCHandler) {

        if (this._constructed)
            throw new RPCUseError("Can't add Server RPC method, after construction");

        assignNestedObject(this, RPCSocketActivity.CLIENT_RPC_PROPERTY, method, handler);
    }

    protected async signalReady() {

        if (this._connection.signaledReady)
            return;

        this._connection.signaledReady = true;
        await this._connection.send({protocol: "ready"});
    }

    protected async rpc(method: string, data: any = null) {

        const request: IRPCRequest = {
            requestId: (this._requestId++).toString(),
            protocol: "rpc",
            method: method,
            data: data
        };

        const responseTask = this.getResponse(request);
        await this._connection.send(request);
        return await responseTask;
    }

    abstract runConnected(): Promise<any>;

}
