function checkNeedsTranscription(source: any, destination: any, key: string): [boolean, boolean, boolean] {

    const sv = source[key];
    const dv = destination[key];

    if (Array.isArray(sv))  // Arrays are simply overwritten like values.
        return [true, true, true];

    if (sv !== null && dv !== null) {
        const match = sv.constructor === dv.constructor;
        if (!match)
            return [false, false, true];
    }

    if (sv === null)
        return [true, true, sv !== dv];

    if (dv === null)
        return [true, true, sv !== dv];

    if (typeof sv === "object")
        return [false, true, true];


    return [true, true, sv !== dv];
}

export function transcribe(source: any, destination: any): boolean {

    let changed = false;

    for (const key in destination)
        if (destination.hasOwnProperty(key))
            if (!source || !source.hasOwnProperty(key)) {
                delete destination[key];
                changed = true;
            }

    for (const key in source) {
        if (source.hasOwnProperty(key)) {
            if (destination.hasOwnProperty(key)) {
                const [simple, tmatch, needs] = checkNeedsTranscription(source, destination, key);

                if (needs) {
                    if ((tmatch && simple) || !tmatch) {
                        destination[key] = source[key];
                        changed = true;
                    } else {
                        const subc = transcribe(source[key], destination[key]);
                        changed = changed || subc;
                    }
                }
            } else {
                destination[key] = source[key];
                changed = true;
            }
        }
    }

    return changed;
}