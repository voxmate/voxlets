import {DeregisterFunction} from "../voxmate";
import {removeArrayElement} from "./array";

export type EventHandler = (...params: any[]) => void;

export class StrictEventEmitter<TEvent extends string> {
    private readonly eventHandlers: { [event: string]: EventHandler[] } = {};

    private registerHandlerFunction(event: string, fn: any): DeregisterFunction {

        if (!this.eventHandlers.hasOwnProperty(event))
            this.eventHandlers[event] = [];

        const handlers = this.eventHandlers[event];
        handlers.push(fn);

        return () => {
            removeArrayElement(handlers, fn);
        };
    }

    clear() {
        for (let event in this.eventHandlers)
            delete this.eventHandlers[event];
    }

    on(event: TEvent, handler: EventHandler): DeregisterFunction {
        const handlerWrapper = (...params: any[]) => {
            try {
                handler.apply(null, params);
            } catch (e) {
                console.error("Unhandled error in Event Handler");
                console.error(e);
            }
        };

        return this.registerHandlerFunction(event, handlerWrapper);
    }

    emit(event: TEvent, ...params: any[]) {
        const handlers = this.eventHandlers[event];
        if (!handlers)
            return;

        for (let handler of [...handlers]) {
            handler.apply(null, params);
        }
    }
}