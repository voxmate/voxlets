import {ControllablePromise} from "./common";

class CloseError extends Error {
    reason: any;

    constructor(reason: string) {
        super("Channel closed");
        this.reason = reason;
    }
}


class ChannelValue<T> {

    private deferred = new ControllablePromise<void>();

    constructor(readonly value: T) {
        this.value = value;
    }

    get promise(): Promise<void> {
        return this.deferred;
    }

    resolve() {
        this.deferred.resolve();
    }

    reject(e) {
        this.deferred.reject(e);
    }
}

export class Channel<T> {

    private readonly _reads: ControllablePromise<T>[] = [];
    private readonly _writes: ChannelValue<T>[] = [];
    private readonly _onClose = new ControllablePromise<any>();
    private _open = true;

    get isOpen(): boolean {
        return this._open;
    }

    get onClose(): Promise<any> {
        return this._onClose;
    }

    close(reason?: any): Promise<void> {
        this._open = false;

        this._onClose.resolve(reason);

        let e = new CloseError(reason);

        for (let pending of this._reads)
            pending.reject(e);

        for (let pending of this._writes)
            pending.reject(e);

        return this._onClose;
    }

    next(): Promise<T> {

        if (!this._open)
            return Promise.reject(new CloseError("Read while closed"));

        if (this._writes.length) {
            let write = this._writes.shift();
            let value = write.value;
            write.resolve();

            return Promise.resolve(value);
        }

        let read = new ControllablePromise<T>();
        this._reads.push(read);
        return read;
    }

    write(value: T): Promise<void> {

        if (!this._open)
            return Promise.reject(new CloseError("Write while closed"));

        if (this._reads.length) {
            let read = this._reads.shift();
            read.resolve(value);

            return Promise.resolve();
        }

        const write = new ChannelValue<T>(value);

        this._writes.push(write);

        return write.promise;
    }

}

export class SimpleChannel<T> {

    private _pendingRead: ControllablePromise<T> | null = null;
    private readonly _writes: ChannelValue<T>[] = [];
    private readonly _onClose = new ControllablePromise<any>();
    private _open = true;

    get isOpen(): boolean {
        return this._open;
    }

    get onClose(): Promise<any> {
        return this._onClose;
    }

    get haveItems(): boolean {
        return this._writes.length > 0;
    }

    close(reason?: any): Promise<void> {
        this._open = false;

        this._onClose.resolve(reason);

        for (let pending of this._writes)
            pending.resolve();

        return this._onClose;
    }

    next(): Promise<T> {

        if (!this._open)
            return Promise.reject(new CloseError("Read while closed"));

        if (this._writes.length) {
            let write = this._writes.shift();
            let value = write.value;
            write.resolve();

            return Promise.resolve(value);
        }

        if (this._pendingRead)
            return this._pendingRead;

        let read = new ControllablePromise<T>();
        this._pendingRead = read;
        return read;
    }

    // write returns sync object for rendezvous channel sync
    write(value: T): Promise<void> {

        if (!this._open)
            return Promise.reject(new CloseError("Write while closed"));

        if (this._pendingRead) {
            this._pendingRead.resolve(value);
            this._pendingRead = null;
            return Promise.resolve();
        }

        const write = new ChannelValue<T>(value);
        this._writes.push(write);
        return write.promise;
    }

    clear() {
        for (let write of this._writes)
            write.resolve();
        this._writes.length = 0;
    }

}
