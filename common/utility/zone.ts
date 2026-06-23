import {AnyFunction, global} from "../voxmate";


export interface Zones<TContext> {
    context: TContext;

    wrap<TResult>(context: TContext, fn: AnyFunction<TResult>): Promise<TResult>;

    start(): void;

    stop(): void;

    contextOf(promise: Promise<any>): TContext | undefined;

}

type PromiseExecutor<T> = (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void;

type GeneralizedPromiseType<T> = Promise<T>

export function zoning<TContext = any>(): Zones<TContext> {

    const SystemPromise = global.Promise;

    let activeContext: TContext | undefined = undefined;

    const zonify = (fn: ((...args: any[]) => any) | undefined, zapContext: TContext | undefined) => {
        if (!fn)
            return undefined;

        return function (this: any, ...args: any[]) {
            const parent = activeContext;
            try {
                activeContext = zapContext;
                return fn.apply(undefined, args);
            } finally {
                activeContext = parent;
            }
        };
    };

    const field = Symbol("ZAP Context");

    class ZoneAwarePromise<T> extends Promise<T> {

        [field]: TContext;

        constructor(executor: PromiseExecutor<T>, context: TContext | undefined = undefined) {
            super(zonify(executor, context ?? activeContext) as any);
            this[field] = (context ?? activeContext) as TContext;
        }

        override then(onFulfilled: any, onRejected: any) {
            return super.then(zonify(onFulfilled, this[field]), zonify(onRejected, this[field]));
        }

        override catch(onRejected: any) {
            return super.catch(zonify(onRejected, this[field]));
        }

        // @ts-ignore
        override finally(any): any {
            if (this.hasOwnProperty("finally"))
                return this["finally"](zonify(any, this[field]));
            return undefined;
        }
    }

    class Zoning implements Zones<TContext> {

        get context(): TContext {
            return activeContext as TContext;
        }

        start() {
            global.Promise = ZoneAwarePromise;
        }

        stop() {
            global.Promise = SystemPromise;
        }

        wrap<TResult>(ctx: TContext, fn: AnyFunction<TResult>): Promise<TResult> {
            // Must wrap in a current promise, to return correct async
            return new ZoneAwarePromise((resolve, reject) => {
                new ZoneAwarePromise((innerResolve, innerReject) => {
                    try {
                        const result = fn();
                        if (result instanceof Promise) {
                            result.then(innerResolve, innerReject);
                        } else {
                            innerResolve(result);
                        }
                    } catch (e) {
                        innerReject(e);
                    }
                }, ctx).then(resolve, reject);
            });
        }

        contextOf(promise: Promise<any>): TContext | undefined {
            return (promise as any)[field];
        }

    }

    return new Zoning();
}