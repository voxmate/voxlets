export function regexGetFirstGroup(regex: RegExp, str: string): string | null {
    let m: RegExpExecArray | null;

    // noinspection LoopStatementThatDoesntLoopJS
    while ((m = regex.exec(str)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }

        return m[1] || null;
    }

    return null;
}

export function toArray<T>(item: T | T[] | undefined | null): T[] {

    if (!item)
        return [];

    let result: T[];
    if (!Array.isArray(item))
        result = [item];
    else result = item;
    return result;
}


export class ControllablePromise<T = any> implements Promise<T> {

    readonly resolve: (value?: T) => void;
    readonly reject: (reason?: any) => void;

    private readonly promise: Promise<T>;

    private _resolved = false;
    private _rejected = false;

    private _resolvedValue: T | undefined = undefined;
    private _rejectValue: any | undefined = undefined;


    constructor() {

        let resolveFunction: ((value?: T | PromiseLike<T>) => void) | null = null;
        let rejectFunction: ((reason?: any) => void) | null = null;

        this.promise = new Promise<T>((resolve, reject) => {
            resolveFunction = resolve as any;
            rejectFunction = reject;
        });

        this.resolve = (value?: T) => {
            this._resolved = true;
            this._resolvedValue = value;

            if (resolveFunction)
                resolveFunction(value);
        };

        this.reject = (reason?: any) => {
            this._rejected = true;
            this._rejectValue = reason;

            if (rejectFunction)
                rejectFunction(reason);
        };
    }

    readonly [Symbol.toStringTag]: string = "toString";

    catch<TResult = never>(onrejected?: ((reason: any) => (PromiseLike<TResult> | TResult)) | undefined | null): Promise<T | TResult> {
        return this.promise.catch(onrejected);
    }

    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => (PromiseLike<TResult1> | TResult1)) | undefined | null,
                                         onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null): Promise<TResult1 | TResult2> {
        return this.promise.then(onfulfilled, onrejected);
    }

    finally(any: any): any {
        if (this.promise.hasOwnProperty("finally"))
            return (this.promise as any)["finally"](any);
        return undefined;
    }

    get resolved(): boolean {
        return this._resolved;
    }

    get resolvedValue(): T | undefined {
        return this._resolvedValue;
    }

    get rejected(): boolean {
        return this._rejected;
    }

    get completed() {
        return this.resolved || this.rejected;
    }
}

export function currentTimeMillis() {
    return new Date().getTime();
}