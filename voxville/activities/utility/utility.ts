import {IManifest} from "../../game/types";

import plural from "pluralize"

export function formatAmount(amount: number): string {
    if (amount === 0)
        return "no";

    let amountf = amount.toFixed(1);
    if (amountf.endsWith(".0"))
        return amountf.substr(0, amountf.length - 2);
    return amountf;
}

export function singularize(word: string) {
    if (word.endsWith("s")) {
        return word.substr(0, word.length - 1);
    }
    return word;
}

export function unpackList(dict: any): string[] {

    if (dict === null) {
        return [];
    }

    const list: string[] = [];
    const keys = Object.keys(dict);
    for (let key of keys) {
        const amount: number = dict[key];
        if (amount != 0) {
            if (amount === 1) {
                key = singularize(key)
            }
            list.push(formatAmount(amount) + " " + key);
        }
    }

    return list
}

export function arrayToText(arr: string[]): string {
    if (arr.length <= 2) {
        return arr.join(' and ');
    }
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

export function unpack(dict: any): string {
    return arrayToText(unpackList(dict));
}

export function unpackWithoutDetails(dict: any): string {
    const keys = Object.keys(dict);

    const collection = [];

    for (let key of keys)
        if (dict[key])
            collection.push(key);

    return arrayToText(collection);
}

export function total<T>(dict: IManifest<T>): number {

    let total = 0;
    for (let key in dict) {
        total += dict[key];
    }

    return total;
}


export function pluralize(word, n: number = 2): string {
    if (n === 1)
        return word;

    return plural(word, n);
}