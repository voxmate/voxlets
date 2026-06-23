export function removeArrayElement<T>(array: T[], element: T): T[] {
    for (let i = array.length - 1; i >= 0; --i)
        if (array[i] === element)
            array.splice(i, 1);
    return array;
}

export function elementInArray<T>(element: T, array: T[]): boolean {
    return array.indexOf(element) !== -1;

}

export function arrayToText(arr: string[]): string {
    if (arr.length <= 2) {
        return arr.join(' and ');
    }
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
}

export function indexIsInBounds<T = any>(arr: T[], idx: number): boolean {
    if (idx < 0) return false;
    if (idx >= arr.length) return false;
    return true;
}