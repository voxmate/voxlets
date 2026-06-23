import {IDict} from "./types";

export function encodeURLQueryParameters(url: string, params: IDict) {

    const query = Object.entries(params)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");

    if (query !== "")
        if (!url.endsWith("?"))
            url += "?";

    return url + query;
}