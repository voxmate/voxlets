import voxmate, {ISocketEvent, ISocketInfo, SocketEventKind, SocketId, SocketState, Sound} from "../voxmate";
import {RichActivity} from "./RichActivity";
import {ControllablePromise} from "../utility/common";
import {Activity} from "./orc";

export interface ISocketPacketHandler {
    onSocketMessage(message: string);

    onSocketError(error: string);

    onSocketConnectionLoss();
}

export class SocketError {
    constructor(private readonly error?: string) {

    }
}

export class UnableToConnectSocketError extends SocketError {
    constructor(error: string) {
        super(error);
    }
}

export class SocketConnection {
    private readonly _socketId: SocketId;
    private readonly _openedSuccessfully = new ControllablePromise<boolean>();
    private readonly _criticalError = new ControllablePromise<Error>();

    private _state: SocketState = SocketState.Connecting;
    private _clientInitiatedClose = false;
    private _latestError: string = "Unknown Error";
    private _hasBeenClosed: boolean = false;

    private notifySocketClosing() {
        if (!this._clientInitiatedClose) {
            console.info("Server closed connected socket.");
            this.handler.onSocketConnectionLoss();
        }
    }

    private handleSocketCriticalError(err: Error) {

        this._criticalError.reject(err);
        this._openedSuccessfully.reject(err);
        this.notifySocketClosing();
        this.close();
    }

    private handleSocketEvent(info: ISocketInfo, evt: ISocketEvent) {

        if (!this.isSocketActive)
            return;

        try {
            if (this._state === SocketState.Connecting) {
                if (evt.kind === SocketEventKind.Open) {
                    this._openedSuccessfully.resolve(true);
                } else {
                    this._latestError = evt.error || "Unknown Connection Error";
                    this._openedSuccessfully.resolve(false);
                }
            } else if (this._state === SocketState.Open && evt.kind === SocketEventKind.TextMessage) {
                this.handler.onSocketMessage(evt.text);
            } else if (evt.kind === SocketEventKind.Error) {
                const error = evt.error ?? "General Error";
                this._latestError = error;
                this.handler.onSocketError(error);

            } else if (evt.kind === SocketEventKind.Closing) {
                this.notifySocketClosing();
            }

            this._state = info.state;

        } catch (err) {
            this.handleSocketCriticalError(err);
        }
    }

    private async guard() {
        // Will throw, if error is set
        if (this._criticalError.completed)
            await this._criticalError;
    }

    get isSocketActive(): boolean {

        if (this._criticalError.completed)
            return false;

        if (this._clientInitiatedClose)
            return false;

        return this._state == SocketState.Connecting || this._state == SocketState.Open;
    }

    get isOpen(): boolean {
        if (this._criticalError.completed)
            return false;
        return this._state === SocketState.Open;
    }

    get socketId(): SocketId {
        return this._socketId;
    }

    get state(): SocketState {
        return this._state;
    }

    get latestError(): string {
        return this._latestError;
    }


    constructor(readonly url: string, public handler: ISocketPacketHandler, readonly headers: {}, activity: Activity) {
        this._socketId = voxmate.sockets.openSocket(this.url, [], headers, async (info, evt) => {
            await activity.bindContext(() => {
                this.handleSocketEvent(info, evt);
            });
        });
    }

    async openedSuccessfully(): Promise<boolean> {
        await this.guard();
        return this._openedSuccessfully;
    }

    async replaceHandler(handler: ISocketPacketHandler) {
        await this.guard();
        this.handler = handler;
    }

    async sendTextMessage(text: string) {
        if (!this.isOpen) {
            return;
        }

        await this.guard();
        voxmate.sockets.sendData(this.socketId, text);
    }

    close() {
        this._clientInitiatedClose = true;
        if (!this._hasBeenClosed) {
            this._hasBeenClosed = true;
            if (this.isOpen)
                this._state = SocketState.Closed;
            voxmate.sockets.closeSocket(this.socketId);
        }
    }
}

export abstract class SocketActivity<T = any> extends RichActivity<T> implements ISocketPacketHandler {

    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
    constructor(private readonly url: string, private readonly headers: {}) {
        super({
            loadingErrorPrompt: "Error connecting",
            loadingPrompt: "Connecting, please wait...",
        });
    }

    protected async init(): Promise<void> {
        await super.init();

        const connection = this.openSocketConnection();

        this.onEnd(() => {
            connection.close();
        });

        const opened = await connection.openedSuccessfully();

        if (this.ended) {
            connection.close();
            return;
        }

        if (!opened) {
            this.sound(Sound.Bad);
            voxmate.system.telemetry.error("SOCKET ERR", connection.latestError);
            console.error("SOCKET ERROR", connection.latestError);
            throw new UnableToConnectSocketError(connection.latestError);
        }

        await this.haltIfEnded();
        this.onSocketConnectionEstablished(connection);
    }

    protected openSocketConnection(handler: ISocketPacketHandler = null): SocketConnection {
        return new SocketConnection(this.url, handler ?? this, this.headers, this);
    }

    protected async run(): Promise<void | any> {
        return await this.onSocketConnected();
    }

    abstract onSocketMessage(message: string): any | undefined;

    abstract onSocketError(error: string);

    abstract onSocketConnectionLoss();

    abstract onSocketConnectionEstablished(connection: SocketConnection);

    abstract onSocketConnected(): Promise<any>;

}