import {Activity, IService} from "@voxmate/orc/orc";

import {IDict} from "@voxmate/voxmate/utility/types";
import {encodeURLQueryParameters} from "@voxmate/voxmate/utility/uri";

export class CalibreApiError extends Error {

}

enum CachePolicy {
    DoNotCache = 0,
    CacheHourly = 60 * 60 * 1000,
    CacheDaily = 24 * 60 * 60 * 1000
}

type CacheObject = {
    expires: number;
    data: any;
}

const CalibreCache = "CalibreCache";
export type Category = { "id": string, "category": string, "subcategory": string | null }
export type Author = { "id": string, "fullName": string, "firstName": string, "surname": string }

export class CalibreApiService implements IService {
    static inject = Symbol("calibre");
    private readonly ApiBase = "https://play.calibreaudio.org.uk/api/v1/";
    private cache: { [key: string]: CacheObject } = {};

    constructor(private readonly root: Activity) {
        this.syncCache();
    }

    private get now() {
        return new Date().getTime();
    }

    private syncCache() {

        this.cache = {};
        const n = localStorage.getLength(CalibreCache);
        const now = this.now;
        const expired = [];

        for (let i = 0; i < n; ++i) {
            const key = localStorage.key(i, CalibreCache);
            const cacheObject = JSON.parse(localStorage.getItem(key, CalibreCache)) as CacheObject;

            if (cacheObject.expires < now) {
                expired.push(key);
            } else {
                this.cache[key] = cacheObject;
            }
        }

        for (let key of expired)
            localStorage.removeItem(key, CalibreCache);
    }

    private getFromCache(key: string): any | undefined {

        const co = this.cache[key];
        if (!co)
            return undefined;

        if (co.expires > this.now)
            return co.data;

        return undefined;
    }

    private setCache(key: string, policy: CachePolicy, data: any) {
        if (policy) {
            const co: CacheObject = {expires: this.now + policy, data: data};
            localStorage.setItem(key, JSON.stringify(co), CalibreCache);
        }
    }

    private async getResource(path: string, params: IDict, policy: CachePolicy, transform: (result: any) => any = it => it): Promise<any> {
        const url = encodeURLQueryParameters(this.ApiBase + path, params);

        if (policy != CachePolicy.DoNotCache) {
            const obj = this.getFromCache(url);
            if (obj)
                return obj;
        }

        const result = await this.root.httpGet(url);
        if (!result.ok) throw new CalibreApiError(`Expected OK for ${url}`);
        if (!result.isValidJson) throw new CalibreApiError(`Expected JSON payload for ${url}`);
        let data = JSON.parse(result.content);
        data = transform(data);

        if (policy) {
            const co: CacheObject = {expires: this.now + policy, data: data};
            localStorage.setItem(url, JSON.stringify(co), CalibreCache);
        }

        return data;
    }

    async getCategories(): Promise<Category[]> {
        return await this.getResource("app/1/Categorys", {}, CachePolicy.CacheDaily);
    }

    async getAuthors(): Promise<Author[]> {
        return await this.getResource("app/1/Authors", {}, CachePolicy.CacheDaily);
    }

    async login(username: string, password: string) {

    }

    async logout() {
        localStorage.clear(CalibreCache);
    }

}