/* import voxmate, {
    ISocketEvent,
    ISocketInfo,
    SocketEventHandler,
    SocketEventKind,
    SocketId,
    SocketState
} from "../voxmate";
import {removeArrayElement} from "../utility/array";


export type OnSocketCloseHandler = ((this: WebSocket, ev: CloseEvent) => any) | null;
export type OnSocketErrorHandler = ((this: WebSocket, ev: Event) => any) | null;
export type OnSocketMessageHandler = ((this: WebSocket, ev: MessageEvent) => any) | null;
export type OnSocketOpenHandler = ((this: WebSocket, ev: Event) => any) | null;

interface ISocketEventHandlerRegistration {
    handler: SocketEventHandler;
    kind: SocketEventKind;
    isDefault: boolean;
}

export class NotImplementedSocketFeature extends Error {
    constructor(msg?: string) {
        super(msg);
    }
}

export abstract class VoxmateWebSocketBase  {

    readonly CONNECTING = SocketState.Connecting;
    readonly OPEN = SocketState.Open;
    readonly CLOSING = SocketState.Closing;
    readonly CLOSED = SocketState.Closed;

    protected _onopen: OnSocketOpenHandler = null;
    protected _onmessage: OnSocketMessageHandler = null;
    protected _onclose: OnSocketCloseHandler = null;
    protected _onerror: OnSocketErrorHandler = null;
    protected _finalized = false;

    get onopen() {
        return this._onopen;
    }

    get onmessage() {
        return this._onmessage;
    }

    get onclose() {
        return this._onclose;
    }

    get onerror() {
        return this._onerror;
    }

    readonly extensions: string = "";
    binaryType: "blob" | "arraybuffer" = 'arraybuffer';

    dispatchEvent(event: Event): boolean {
        throw new NotImplementedSocketFeature();
    }

    addEventListener<K extends keyof WebSocketEventMap>(
        type: K, listener: (this: VoxmateWebSocket, ev: WebSocketEventMap[K]) => any): void {
        throw new NotImplementedSocketFeature();
    }

    removeEventListener<K extends keyof WebSocketEventMap>(
        type: K, listener: (this: VoxmateWebSocket, ev: WebSocketEventMap[K]) => any): void {
        throw new NotImplementedSocketFeature();
    }

    abstract get websocket(): VoxmateWebSocket;
}

export abstract class VoxmateWebSocketPipe extends VoxmateWebSocketBase {

    readonly origin: string;
    protected readonly socketId: SocketId;

    private _handlers: ISocketEventHandlerRegistration[] = [];
    private _socketInfo: ISocketInfo = {
        bufferedAmount: 0,
        extensions: "",
        protocol: "",
        state: SocketState.Connecting
    };

    private applySocketInfo(info: ISocketInfo) {
        this._socketInfo = info;
    }

    private addHandler(kind: SocketEventKind, isDefault: boolean, handler: () => void) {

        if (isDefault) {
            const registration = this._handlers.find((h) => h.isDefault && h.kind === kind);
            if (registration) {
                removeArrayElement(this._handlers, registration);
            }
        }

        const wrapper: SocketEventHandler = (info, evt) => {
            this.applySocketInfo(info);
            this.processSocketEvent(kind, evt, handler);
        };

        this.registerHandler(kind, wrapper, isDefault);
    }

    private registerHandler(kind: SocketEventKind, handler: SocketEventHandler, isDefault: boolean) {
        this._handlers.push({
            handler: handler,
            kind: kind,
            isDefault: isDefault
        });
    }

    private processSocketEvent(kind: SocketEventKind, event: ISocketEvent, handler: () => void) {

        if (kind !== event.kind)
            return;

        handler.call(this, new VoxmateSocketBaseEvent(this.websocket));
    }

    private broadcast(info: ISocketInfo, event: ISocketEvent) {
        this._socketInfo = info;
        for (let handler of this._handlers) {
            if (handler.kind === event.kind) {
                handler.handler(info, event);
            }
        }
    }

    protected get socketInfo(): ISocketInfo {
        return this._socketInfo;
    }

    get bufferedAmount(): number {
        return this.socketInfo.bufferedAmount;
    }

    get protocol(): string {
        return this.socketInfo.protocol;
    }

    get readyState(): number {
        return this.socketInfo.state;
    }

    set onclose(handler: OnSocketCloseHandler) {
        this._onclose = handler;
    }

    set onerror(handler: OnSocketErrorHandler) {
        this.addHandler(SocketEventKind.Error, true, handler as any);
        this._onerror = handler;
    }

    set onmessage(value: OnSocketMessageHandler) {
        this._onmessage = value;
    }

    set onopen(value: OnSocketOpenHandler) {
        this._onopen = value;
    }

    constructor(readonly url: string, protocols?: string | string[]) {
        super();

        this.origin = url.replace(/^((\w+:)?\/\/[^\/]+\/?).*$/, '$1');

        let protocolList: string[] = [];
        if (typeof protocols === "string")
            protocolList = [protocols];
        else if (protocols)
            protocolList = protocols;

        this.socketId = voxmate.sockets.openSocket(url, protocolList, {}, (info, evt) => {
            this.broadcast(info, evt);
        });
    }
}

export class VoxmateWebSocket extends VoxmateWebSocketPipe implements WebSocket {

    send(data: string | ArrayBufferLike | ArrayBufferView): void {
        if (typeof data === "string")
            voxmate.sockets.sendData(this.socketId, data);

        else if (data instanceof ArrayBuffer)
            voxmate.sockets.sendData(this.socketId, data);

        else throw new NotImplementedSocketFeature("Can only send string or ArrayBuffers");
    }

    close(code?: number, reason?: string): void {
        voxmate.sockets.closeSocket(this.socketId, code ?? 1005);
    }

    get websocket(): VoxmateWebSocket {
        return this;
    }
}

export class VoxmateEvent {
    readonly NONE = 0;
    readonly CAPTURING_PHASE = 1;
    readonly AT_TARGET = 2;
    readonly BUBBLING_PHASE = 3;
}

export class VoxmateSocketBaseEvent extends VoxmateEvent {

    // These are probably always static
    readonly bubbles = false;
    readonly cancelable = false;
    readonly composed = false;
    readonly defaultPrevented = false;
    readonly eventPhase = 0;
    readonly isTrusted = true;
    readonly lastEventId = "";

    cancelBubble = false;
    returnValue = true;

    initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void {
        throw "Do not use this constructor";
    }

    preventDefault(): void {

    }

    stopImmediatePropagation(): void {

    }

    stopPropagation(): void {

    }

    // Set this on construction from voxmate.system.now()
    readonly timeStamp: number; // 60339.8749998305


    readonly target: EventTarget;
    readonly currentTarget: EventTarget;
    readonly srcElement: EventTarget;
    readonly origin: string;

    constructor(private readonly socket: VoxmateWebSocket) {
        super();
        this.target = this.currentTarget = this.srcElement = socket;

        this.origin = socket.origin;
        this.timeStamp = 0.0123;
    }
}

export class VoxmateSocketMessageEvent extends VoxmateSocketBaseEvent implements MessageEvent {

    readonly type = "message";
    readonly ports: ReadonlyArray<MessagePort> = [];
    readonly source: MessageEventSource = null;

    // These are set and relevant
    readonly data: any; // string with JSON, or Binary Buffer?

}


 */