import {IVoxmateStatic} from "./voxmate";

export {};

interface Storage {

    readonly length: number;

    getLength(ns?: string): number;

    clear(ns?: string): void;

    getItem(key: string, ns?: string): string | null;

    key(index: number, ns?: string): string | null;

    removeItem(key: string, ns?: string): void;

    setItem(key: string, value: string, ns?: string): void;

    namespaces(): string[];
}

interface Console {
    clear(): void;

    debug(...data: any[]): void;

    error(...data: any[]): void;

    info(...data: any[]): void;

    log(...data: any[]): void;

    warn(...data: any[]): void;
}

export type TimerHandle = unknown;

declare global {
    const voxmate: IVoxmateStatic;
    const localStorage: Storage;
    const console: Console;

    function exit(code: number): void;

    function clearInterval(handle?: TimerHandle): void;

    function clearTimeout(handle?: TimerHandle): void;

    function setInterval(handler: Function, timeout?: number, ...arguments: any[]): TimerHandle;

    function setTimeout(handler: Function, timeout?: number, ...arguments: any[]): TimerHandle;
}


