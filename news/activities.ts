import {RollActivity} from "@voxmate/orc/RollActivity";
import {
    Browser,
    ExternalNewsProvider,
    INewsArticle,
    INewsArticleDescriptor,
    INewsCategory,
    IRssFeedNewsProviderConfiguration,
    NewsProvider,
    NewsSectionKind
} from "./providers/providers";
import {Actor, ClipboardDataKind, Sound} from "@voxmate/voxmate";
import moment from "moment";
import {clean, splitSentence} from "./utility";
import {SmartListActivity, SmartListChanged} from "@voxmate/orc/SmartListActivity";
import {Rolodex} from "@voxmate/orc/rolodex";

import {isUri} from "valid-url";
import RssParser from "rss-parser";

import {makeGloballyUniqueIdentifier} from "@voxmate/voxmate/utility/random";
import {NewsProviderManager} from "./providers/NewsProviderManager";


abstract class NewsBaseActivity<T = any> extends RollActivity<T> {

    get browser(): Browser {
        return this[Browser.inject];
    }

    get providers(): NewsProviderManager {
        return this[NewsProviderManager.inject];
    }
}

function isUnit<T>(any: T | T[]): any is T {
    return !Array.isArray(any);
}

interface IPart {
    info: boolean;
    text: string;
}

export class ArticleReader extends RollActivity {

    constructor(private readonly article: INewsArticle) {
        super();
    }

    async help() {
        return [
            "Swipe up and down to go between paragraphs. When swiping down, paragraphs will read one after the other.",
            "When you hear a hollow sound, you've reached the end of the article.",
            "Swipe left to go back to the article list."
        ];
    }

    private buildParts(): IPart[] {

        const parts: IPart[] = [];

        function push(text: string | string[], info: boolean = true) {

            if (isUnit(text)) {
                text = clean(text);
                if (text.length > 150) {
                    for (let part of splitSentence(text))
                        parts.push({info: info, text: part});
                } else {
                    parts.push({info: info, text: text});
                }

            } else for (let item of text)
                push(item, info);
        }

        const info: NewsSectionKind[] = ["header", "feature", "feature-title"];

        for (let section of this.article.sections) {

            if (section.kind === "figure") {
                push("Figure. " + section.text);
            } else if (section.kind === "paragraphs")
                push(section.text, false);

            else if (info.includes(section.kind))
                push(section.text);
        }

        if (this.article.author || this.article.publicationDate) {
            let spec = "Published";
            if (this.article.author)
                spec += ` by ${this.article.author}`;

            if (this.article.publicationDate) {
                const m = moment(this.article.publicationDate);
                if (m.isValid()) {
                    const timer = m.calendar(null, {sameElse: "MMMM Do, YYYY"});
                    if (spec.length) {
                        spec += " " + timer;
                    } else {
                        spec += timer;
                    }
                }
            }

            push(spec);
        }

        return parts;
    }

    private async weave(parts: IPart[]) {
        const dex = this.roll();

        for (let i = 0; i < parts.length; ++i) {

            const part = parts[i];
            const nextPart = parts[i + 1];

            let cachingTask = null;

            dex.add(async () => {
                let speech;
                if (part.info)
                    speech = this.sayDynamicInfo(part.text);
                else speech = this.sayDynamicContent(part.text);

                if (nextPart && cachingTask === null) {
                    if (nextPart.info) {
                        cachingTask = this.preloadDynamicInfo(nextPart.text);
                    } else {
                        cachingTask = this.preloadDynamicContent(nextPart.text);
                    }
                    cachingTask.then(() => {
                        cachingTask = null;
                    });
                }

                await speech;
            }, async () => {
                const dex = this.roll();
                await this.extendDexWithTextEntities(dex, part.text);
                await dex.run();
            });
        }

        await dex.run({autoskip: true});
    }

    protected async run(): Promise<void | any> {
        const parts = this.buildParts();
        await this.weave(parts);
        return;
    }

}

class ArticleContent extends NewsBaseActivity {
    private article: INewsArticle;

    constructor(private readonly provider: NewsProvider, private readonly descriptor: INewsArticleDescriptor) {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
        this.article = await this.provider.getArticle(this.descriptor);
    }

    protected async run(): Promise<void | any> {
        return await this.exec(new ArticleReader(this.article));
    }
}

class ArticleListing
    extends NewsBaseActivity {
    private articles: INewsArticleDescriptor[];

    constructor(private readonly provider: NewsProvider, private readonly category: INewsCategory) {
        super();
    }

    async help() {
        return "Swipe up and down to select between different articles, then swipe right to activate.";
    }

    protected async init(): Promise<void> {
        await super.init();
        this.articles = await this.provider.getCategoryArticles(this.provider.rootUrl, this.category);
    }

    protected async run(): Promise<void | any> {
        const dex = this.roll();
        for (let i = 0; i < this.articles.length; ++i) {
            let article = this.articles[i];
            dex.add(async () => {
                await this.sayDynamicContent(article.title);
                await dex.paginate(i, this.articles.length);
            }, async () => {
                await this.exec(new ArticleContent(this.provider, article));
            });
        }

        if (this.category.subs) {
            const subCategories = this.category.subs.slice();
            subCategories.reverse();
            for (let category of subCategories) {
                dex.add(async () => {
                    await this.sayDynamicInfo(category.name);
                }, async () => {
                    await this.exec(new ArticleListing(this.provider, category));
                });
            }
        }

        await dex.run();
    }
}

class CategoryListing extends NewsBaseActivity {

    private categories: INewsCategory[];

    constructor(private readonly provider: NewsProvider) {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
        this.categories = await this.provider.listCategories();
    }

    protected async run(): Promise<void | any> {
        if (this.categories.length === 1) {
            await this.exec(new ArticleListing(this.provider, this.categories[0]));
        } else {
            const dex = this.roll().setActor(Actor.DynamicContent);
            for (let category of this.categories)
                dex.add(category.name, async () => {
                    await this.exec(new ArticleListing(this.provider, category));
                });
            await dex.run();
        }
    }
}

type RSSFeedDetails = {
    title: string;
    description: string;
}

export class NewsOptions extends NewsBaseActivity {

    private async getRSSFeedDetails(feedUrl: string): Promise<RSSFeedDetails | null> {
        try {
            const feedContent = await this.httpGet(feedUrl);
            const parser = new RssParser();
            const feed = await parser.parseString(feedContent.content);
            return {title: feed.title, description: feed.description};
        } catch (e) {
            console.log(e);
            return null;
        }
    }

    private getProvidersForFeedUrl(feedUrl: string, details: RSSFeedDetails): ExternalNewsProvider[] {

        const config: IRssFeedNewsProviderConfiguration = {
            rootUrl: "",
            categories: [
                {name: "Articles", listable: true, feedUrl: feedUrl}
            ], descriptor: {
                language: "en",
                description: details.description,
                name: details.title
            }
        };

        return [
            new ExternalNewsProvider(this.browser, {
                engine: "mercury",
                uid: makeGloballyUniqueIdentifier(),
                ...config
            }),
            new ExternalNewsProvider(this.browser, {
                engine: "readability",
                uid: makeGloballyUniqueIdentifier(),
                ...config
            })
        ];
    }

    protected async run() {
        const dex = this.roll();
        dex.add(async () => {
            await this.sayDynamicInfo("Add RSS Feed by Link");
        }, async () => {

            const clip = await this.wrap(voxmate.system.loadFromClipboard());
            if (clip.kind === ClipboardDataKind.Text && isUri(clip.data)) {

                const feedUrl = clip.data;
                const details = await this.freeze(this.getRSSFeedDetails(feedUrl), "Fetching feed details...");

                if (details == null) {
                    await this.sayDynamicInfo("Unable to get RSS feed details");
                    return;
                }

                const options = this.roll();
                const providers = this.getProvidersForFeedUrl(feedUrl, details);

                for (let provider of providers) {
                    options.add(async () => {
                        await this.sayDynamicContent(`Try ${details.title} feed with ${provider.engine} Engine`);
                        await this.delay(1500);
                        await this.sayDynamicInfo("Double tap for options");
                    }, async () => {
                        await this.exec(new CategoryListing(provider));
                    }).expand(async () => {
                        const opts = this.roll();

                        opts.add(async () => {
                            await this.sayDynamicInfo("Try");
                        }, async () => {
                            await this.exec(new CategoryListing(provider));
                            return true;
                        });

                        opts.add(async () => {
                            await this.sayDynamicInfo(`Save ${details.title} and use it with ${provider.engine} engine`);
                        }, async () => {
                            this.providers.saveCustomProvider(provider.config);
                            this.sound(Sound.Good);
                            throw new SmartListChanged(provider.config.uid);
                        });

                        await opts.run();
                    });
                }

                await options.run();

            } else {
                await this.sayDynamicInfo("Copy an RSS feed URL to your clipboard, and come back here to try it out");
                await this.sound(Sound.EndContent);
            }
        });

        await dex.run();
    }

}

export class NewsChooseProviderActivity extends NewsBaseActivity {

    async help() {
        return [
            "Swipe up and down to select from different publications, then swipe right to activate.",
            "Swipe left to go back."
        ];
    }

    async hint() {
        return "Pick which publication you would like to read.";
    }

    protected async run(): Promise<void | any> {

        class NewsList extends SmartListActivity<NewsProvider> {

            get providers(): NewsProviderManager {
                return this[NewsProviderManager.inject];
            }

            get browser() {
                return this[Browser.inject];
            }

            constructor() {
                super("news.list", {
                    collectionName: "Sources",
                    itemName: "Provider",
                    searchable: true
                });
            }

            getList(): NewsProvider[] {
                return this.providers.getProviders(this.browser);
            }

            getItemKey(provider: NewsProvider): string {
                return provider.uid;
            }

            getItemLabel(provider: NewsProvider): string {
                return provider.label;
            }

            async openItem(provider: NewsProvider) {
                await this.exec(new CategoryListing(provider));
            }

            addListOptions(list: Rolodex) {
                list.add(async () => {
                    await this.sayDynamicInfo("Settings");
                }, async () => {
                    await this.exec(new NewsOptions());
                });
            }

            addItemOptions(options: Rolodex, item: NewsProvider) {
                super.addItemOptions(options, item);
                if (this.providers.isCustomUID(item.uid)) {
                    options.add(async () => {
                        await this.sayDynamicInfo("Delete");
                    }, async () => {
                        this.providers.deleteCustomProvider(item.uid);
                        this.sound(Sound.Good);
                        throw new SmartListChanged();
                    });
                }
            }
        }

        await this.exec(new NewsList());
    }
}
