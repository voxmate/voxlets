import {IService} from "@voxmate/orc/orc";
import {Browser, ExternalNewsProvider, IRssEngineFeedNewsProviderConfiguration, NewsProvider} from "./providers";
import {SkyNews} from "./sources/SkyNews";
import {DailyMail} from "./sources/DailyMail";
import {HuffPostUK} from "./sources/HuffPostUK";
import {TheIndependent} from "./sources/theIndependent";
import {TheSun} from "./sources/theSun";
import {DailyMirror} from "./sources/DailyMirror";
import {Metro} from "./sources/Metro";
import {DailyStar} from "./sources/DailyStar";
import {RssFeedNewsProviderConfigurations} from "./sources/external";

export function getNewsProviders(browser: Browser): NewsProvider[] {

    const providers: NewsProvider[] = [
        new SkyNews(browser),
        new DailyMail(browser),
        new HuffPostUK(browser),
        new TheIndependent(browser),
        new TheSun(browser),
        new DailyMirror(browser),
        new Metro(browser),
        new DailyStar(browser),
    ];

    for (let config of RssFeedNewsProviderConfigurations)
        providers.push(new ExternalNewsProvider(browser, config));

    return providers;
}

const key = "providers";
const ns = "providers";

export class NewsProviderManager implements IService {
    static inject = Symbol("providers");

    private _providers: NewsProvider[] = null;
    private _customProviderUIDs = new Set();

    private write(providers: IRssEngineFeedNewsProviderConfiguration[]) {
        localStorage.setItem(key, JSON.stringify(providers), ns);

        this._providers = null;
        this._customProviderUIDs = new Set();
    }

    private getCustomProviders(): IRssEngineFeedNewsProviderConfiguration[] {
        return JSON.parse(localStorage.getItem(key, ns)) ?? [];
    }

    saveCustomProvider(provider: IRssEngineFeedNewsProviderConfiguration) {
        const providers = this.getCustomProviders();
        providers.push(provider);
        this.write(providers);
    }

    deleteCustomProvider(uid: string) {
        const providers = this.getCustomProviders();
        providers.filter(p => p.uid != uid);
        this.write(providers);
    }

    isCustomUID(uid: string): boolean {
        return this._customProviderUIDs.has(uid);
    }

    getProviders(browser: Browser): NewsProvider[] {

        if (!this._providers) {
            const providers = getNewsProviders(browser);
            for (let provider of this.getCustomProviders()) {
                console.log(provider);
                this._customProviderUIDs.add(provider.uid);
                providers.push(new ExternalNewsProvider(browser, provider));
            }
            this._providers = providers;
        }

        return this._providers;

    }
}