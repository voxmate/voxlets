import {Activity, IService} from "@voxmate/orc/orc";
import voxmate, {ResourceId} from "@voxmate/voxmate";
import {ControllablePromise} from "@voxmate/voxmate/utility/common";

const maxCacheSize = 10;
const key = "cache";
const ns = "cache";

type ResourceCacheItem = {
    resourceId: ResourceId;
    lastUsed: number;
}

type CachedResources = { [url: string]: ResourceCacheItem }

export class ResourceCache implements IService {

    static inject = Symbol();

    private working: ControllablePromise<void> = null;

    constructor(private readonly root: Activity) {

    }

    private getCache(): CachedResources {
        return JSON.parse(localStorage.getItem(key, ns) || "{}");
    }

    private saveCache(cache: CachedResources) {
        localStorage.setItem(key, JSON.stringify(cache), ns);
    }

    private getCacheItem(url: string): ResourceCacheItem | null {
        const cache = this.getCache();

        console.log("CACHE", Object.keys(cache).length, cache);

        if (url in cache) {
            const item = cache[url];
            item.lastUsed = (new Date()).getTime();
            this.saveCache(cache);
            return item;
        }
        return null;
    }

    private findLeastUsedUrl(cache: CachedResources) {

        const urls = Object.keys(cache);
        const values = Object.values(cache);

        let minUrl: string = undefined;
        let minValue = Number.MAX_VALUE;
        for (let i = 0; i < values.length; ++i) {
            const [url, value] = [urls[i], values[i].lastUsed];
            if (value < minValue) {
                minValue = value;
                minUrl = url;
            }
        }

        return minUrl;
    }

    private async updateCache(url: string, resourceId: ResourceId) {
        const cache = this.getCache();

        { // Prune Cache
            while (Object.keys(cache).length >= maxCacheSize) {
                console.log("Pruning cache");
                const url = this.findLeastUsedUrl(cache);
                await this.root.wrap(voxmate.filestore.clear(cache[url].resourceId));
                delete cache[url];
                this.saveCache(cache);
            }
        }

        cache[url] = {
            resourceId: resourceId,
            lastUsed: (new Date()).getTime()
        };

        this.saveCache(cache);
    }

    private async awaitCompletion() {
        const work = this.working;
        if (work)
            await work;
    }

    getCached(url: string): ResourceId | null {
        return this.getCacheItem(url)?.resourceId;
    }

    async saveToCache(url: string): Promise<ResourceId> {

        await this.awaitCompletion();
        this.working = new ControllablePromise();
        try {

            const item = this.getCacheItem(url);
            if (item != null)
                return item.resourceId;

            console.log("Downloading", url);
            const resourceId: ResourceId = await this.root.wrap(voxmate.filestore.save(url, true, {}, null));
            await this.updateCache(url, resourceId);
            console.log("Downloaded", url);
            return resourceId;
        } catch (e) {

            if (this.root.isFlowControl(e))
                throw e;

        } finally {
            console.log("Lifting worker");
            this.working.resolve();
        }
    }
}