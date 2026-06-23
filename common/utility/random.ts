import {IDict} from "./types";


let globalIdCounterFunction = 0;

// Generates a random printable string, that will be unique for each run.
export function randomId(): string {
    //Looks a bit ugly, but performs well.
    const size = 3; // Size can't just be anything.
    const randomId = Math.random().toString(36).substr(2, size);
    return `id_${randomId}_${(globalIdCounterFunction++).toString()}`;
}

// This generates a type 4 UUID.
export function makeGloballyUniqueIdentifier(): string {
    // noinspection SpellCheckingInspection
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/*
    Takes a weighted map of probabilities {k:p}, and returns a key k from map with probability p
    The map doesn't need to be normed.
    Behaviour with negative probabilities as input is undefined.
*/
export function biasedChoice<T extends string>(map: IDict<number>): T | undefined {

    const keys = Object.keys(map) as T[];
    if (keys.length == 0)
        return undefined;

    let total = 0;
    for (let key of keys)
        total += map[key];

    if (total < 0)
        return undefined;

    const probabilities: number[] = [];
    for (let i = 0; i < keys.length; ++i)
        probabilities[i] = map[keys[i]] / total;

    const target = Math.random();
    let pointer = 0;
    for (let i = 0; i < keys.length; ++i) {
        pointer += probabilities[i];
        if (target < pointer)
            return keys[i];
    }

    return keys[keys.length - 1];
}

/*
    Shuffles the array in place, returns the same array for convenience.
 */
export function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        const aj = array[j];
        array[j] = array[i];
        array[i] = aj;
    }
    return array;
}

export function randomIndex(array: any[]): number {
    return Math.floor(Math.random() * array.length);
}

export function randomChoice<T>(array: T[]): T | undefined {
    if (array.length === 0)
        return undefined;

    return array[randomIndex(array)];
}

export function randomIntegerMaxInclusive(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomInteger(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}