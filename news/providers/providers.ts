import {IService, Orchestrator, Sayable} from "@voxmate/orc/orc";

import * as convert from "xml-js";
import cheerio from "cheerio";
import moment from 'moment';
import {Moment} from 'moment';
import voxmate, {IHttpResult, Language} from "@voxmate/voxmate";
import {randomId} from "@voxmate/voxmate/utility/random";
import {arrayToText} from "@voxmate/voxmate/utility/array";
import {RichActivity} from "@voxmate/orc/RichActivity";

export type CompositeExtractorTestFunction = ($: cheerio.Root) => boolean;
export type Transform = ($: cheerio.Root) => cheerio.Root;

export interface INewsCategory {
    name: Sayable;
    listable: boolean;
    subs?: INewsCategory[];
}

export interface INewsArticleDescriptor {
    title: Sayable;
    url: string;
    publicationDate?: Date;
    author?: Sayable;
}

export type NewsSectionKind = "paragraphs" | "header" | "figure" | "feature" | "feature-title"

export interface INewsArticleSection {
    kind: NewsSectionKind;
    text: string[] | string;
}

export interface INewsArticle extends INewsArticleDescriptor {
    sections: INewsArticleSection[];
}

export interface INewsProviderDescriptor {
    name: string;
    description: string;
    language: Language;
}

type SmartSelector = string | (($: cheerio.Cheerio) => string | null)


export interface ISimpleExtractorConfiguration {

    pageContentSelector: string;

    extractFigureCaptions?: boolean;
    extractHeaderCaptions?: boolean;
    extractListingsText?: boolean;

    articleTitleSelector?: SmartSelector;
    authorSelector?: SmartSelector;

    dateSelector?: string;
    dateFunction?: ($: cheerio.Cheerio) => Moment | null;
    dateFormatString?: string;

    filterSelectors?: string[];
    filterText?: string[];
    articleFeatures?: Feature[];
    pageFeatures?: Feature[];
}

export interface IRssFeedNewsCategory extends INewsCategory {
    feedUrl: string;
    subs?: IRssFeedNewsCategory[];
}


export interface IRssFeedNewsProviderConfiguration {
    rootUrl: string;
    descriptor: INewsProviderDescriptor;
    categories: IRssFeedNewsCategory[];
}

export interface IRssEngineFeedNewsProviderConfiguration extends IRssFeedNewsProviderConfiguration {
    uid: string;
    engine: ExternalNewsEngine,
}


export interface IRssExtractorFeedNewsProviderConfiguration extends IRssFeedNewsProviderConfiguration {
    extractor: ArticleExtractor;
}

interface ICompositeBranch {
    test: CompositeExtractorTestFunction;
    extractor: ArticleExtractor;
}

function cleanXMLTitle(text: string) {
    return text.replace(/&apos;/gmi, "'"); //&apos; invalid chars
}

export type MercuryDocument = {
    title: string;
    content: string;
    author?: string | null;
    date_published?: string | null;
    lead_image_url: string;
    url: string;
    domain: string;
    excerpt: string;
    word_count: number;
    direction: string;
    total_pages: number;
    rendered_pages: number;
}

export type ReadabilityDocument = {
    title: string;
    byline: string;
    dir: null;
    content: string;
    excerpt: string;
}

export class Browser implements IService {

    static inject = Symbol("browser");

    constructor(private readonly root: RichActivity) {

    }

    private async httpGetFollowSoftRedirects(url: string, headers: any = {}, attempted: any = {}): Promise<IHttpResult> {

        attempted[url] = true;

        const data = await this.root.httpGet(url, headers);

        if (data.content) {
            const short = data.content.length < 2000;

            if (short) {
                const movedMarker = data.content.indexOf("The document has moved") != -1;
                if (movedMarker) {

                    const regex = /HREF="(.*)">/gm;
                    const redirectUrl = regex.exec(data.content)[1];

                    if (!attempted[redirectUrl])
                        return this.httpGetFollowSoftRedirects(redirectUrl, headers, attempted);
                }
            }
        }

        return data;
    }

    async get(url: string, headers: any = {}): Promise<string> {
        return (await this.httpGetFollowSoftRedirects(url, headers)).content;
    }

    async getJson(url: string, headers: any = {}): Promise<any | null> {
        const data = await this.root.httpGet(url, headers);
        if (data.isValidJson)
            return JSON.parse(data.content);
        return null;
    }

    async getWithMercury(url: string): Promise<MercuryDocument | null | "paywalled" | "error"> {

        const api = "https://news-dot-voxlet-sys.appspot.com/api/clean_article";
        const data = await this.root.httpPostJson(api, {
            url: url
        });

        if (data.isValidJson) {
            const payload = JSON.parse(data.content);
            if (payload.ok === false) {
                return null;
            }

            if (payload.error) {
                const msg = payload.message;
                if (msg && typeof msg === "string") {
                    if (msg.indexOf("402") !== -1) {
                        return "paywalled";
                    }
                }
                return "error";
            }

            return payload;
        }

        return null;
    }

    async getWithReadability(url: string): Promise<ReadabilityDocument | null> {

        const endpoint = "https://clearnews.run.voxmate.com/getUrlContent";
        const result = await this.root.httpPostJson(endpoint, {url: url});

        if (!result.ok)
            return null;

        const doc = JSON.parse(result.content) as { ok: boolean, article: ReadabilityDocument };
        if (!doc.ok)
            return null;

        return doc.article;
    }
}

abstract class ArticleExtractor {
    abstract getArticle($: cheerio.Root, descriptor: INewsArticleDescriptor, browser: Browser): Promise<INewsArticle | null>
}

export abstract class NewsProvider {

    protected _headers: any = {};

    protected constructor(
        protected readonly browser: Browser,
        readonly rootUrl: string,
        private readonly descriptor: INewsProviderDescriptor) {
    }

    addHeader(name: string, value: string) {
        this._headers[name] = value;
    }

    abstract getArticle(descriptor: INewsArticleDescriptor): Promise<INewsArticle>

    abstract getCategoryArticles(rootUrl: string, category: INewsCategory): Promise<INewsArticleDescriptor[]>

    abstract listCategories(): Promise<INewsCategory[]>

    get label() {
        return this.descriptor.name;
    }

    get uid() {
        return this.rootUrl;
    }

    get language() {
        return this.descriptor.language;
    }

    get description() {
        return this.descriptor.description;
    }

    prompt(text: string) {
        return {[this.descriptor.language]: text.trim()};
    }
}

interface IFeatureComponent {
    title: string,
    text: string | string[]
}

export abstract class Feature {

    private readonly _markClass;
    private readonly _markSelector;

    constructor() {
        this._markClass = randomId();
        this._markSelector = `.${this._markClass}`;
    }

    private _ids: string[] = [];
    private _registry: { [id: string]: IFeatureComponent } = {};

    get markSelector() {
        return this._markSelector;
    }

    abstract scan($: cheerio.Cheerio, browser: Browser);

    recover(elementId: string): IFeatureComponent {
        return this._registry[elementId];
    }

    recoverAll(): IFeatureComponent[] {
        return this._ids.map(id => this._registry[id]);
    }

    protected async nest($: cheerio.Cheerio, feature: Feature, browser: Browser) {
        await feature.scan($, browser);
    }

    protected extend($: cheerio.Cheerio, title: string, text: string | string[] = "") {
        if ($.length === 1) {
            const id = randomId();
            $.append(`<extracted-feature id='${id}' class="${this._markClass}"></extracted-feature>`);
            this._registry[id] = {title: title.trim(), text: text};
            this._ids.push(id);
        } else if ($.length > 1) {
            console.warn("Extract has more than one components");
            $.remove();
        }
    }

    protected extract($: cheerio.Cheerio, title: string, text: string | string[] = "") {
        if ($.length === 1) {
            const id = randomId();
            $.replaceWith(`<extracted-feature id='${id}' class="${this._markClass}"></extracted-feature>`);
            this._registry[id] = {title: title.trim(), text: text};
            this._ids.push(id);
        } else if ($.length > 1) {
            console.warn("Extract has more than one components");
            $.remove();
        }
    }

    protected remove($: cheerio.Cheerio) {
        $.remove();
    }

    clear() {
        this._ids.length = 0;
        this._registry = {};
    }
}

export class SimpleExtractor extends ArticleExtractor {

    constructor(private readonly config: ISimpleExtractorConfiguration) {
        super();
    }

    async getArticle($: cheerio.Root, descriptor: INewsArticleDescriptor, browser: Browser): Promise<INewsArticle> {

        const config = this.config;

        let sections: INewsArticleSection[] = [];
        let header: string = null;
        let paragraphs: string[] = [];
        let figure: string = null;
        let author: string = undefined;
        let publicationDate = undefined;

        if (config.pageFeatures)
            for (let feature of config.pageFeatures)
                feature.clear();

        if (config.articleFeatures)
            for (let feature of config.articleFeatures)
                feature.clear();

        function commit() {

            if (header !== null) {
                sections.push({text: header, kind: "header"});
                header = null;
            }

            if (figure !== null) {
                sections.push({text: figure, kind: "figure"});
                figure = null;
            }

            if (paragraphs.length > 0) {
                sections.push({text: paragraphs, kind: "paragraphs"});
                paragraphs = [];
            }
        }

        function addFeatureComponent(component: IFeatureComponent) {
            if (component.title)
                sections.push({text: component.title, kind: "feature-title"});

            if (component.text)
                sections.push({text: component.text, kind: "feature"});
        }

        if (config.pageFeatures) {
            for (let feature of config.pageFeatures) {
                await feature.scan($.root(), browser);
                for (let component of feature.recoverAll()) {
                    addFeatureComponent(component);
                }
            }
        }

        if (config.articleFeatures)
            for (let feature of config.articleFeatures) {
                await feature.scan($(config.pageContentSelector), browser);
            }

        if (config.authorSelector) {
            if (typeof config.authorSelector === "string") {
                author = arrayToText($(config.authorSelector).get().map((a) => cheerio(a).text().trim()));
            } else {
                author = config.authorSelector($.root()) || undefined;
            }

            if (author) {
                if (author.startsWith("By") || author.startsWith("by")) {
                    author = author.substr(2);
                }
            }
        }

        if (config.dateFunction) {
            publicationDate = config.dateFunction($.root())?.toDate();
        } else if (config.dateSelector) {
            publicationDate = $(config.dateSelector).text().trim();
            if (config.dateFormatString && publicationDate) {
                publicationDate = moment(publicationDate, config.dateFormatString).toDate();
            } else {
                publicationDate = moment(publicationDate).toDate();
            }
        }

        if (config.articleTitleSelector)
            if (typeof config.articleTitleSelector === "string") {
                header = $(config.articleTitleSelector).text().trim();
            } else {
                header = config.articleTitleSelector($.root()) || null;
            }

        if (config.filterSelectors) {
            for (let selector of config.filterSelectors) {
                $.root().find(selector).remove();
            }
        }

        commit();

        const selectors: string[] = [
            "p"
        ];

        if (config.extractHeaderCaptions)
            selectors.push("h1, h2, h3, h4, h5");

        if (config.extractFigureCaptions)
            selectors.push("figcaption");

        if (config.extractListingsText)
            selectors.push("li");

        if (config.articleFeatures)
            for (let feature of config.articleFeatures) {
                selectors.push(feature.markSelector);
            }

        const subSelector = selectors.join(", ");

        let contentSections: cheerio.Cheerio;
        if (config.pageContentSelector === "*")
            contentSections = $.root();
        else contentSections = $(config.pageContentSelector);

        contentSections.each((idx, element) => {
            $(element).find(subSelector).each((jdx, par: cheerio.Element) => {

                const elem = $(par);

                if (config.articleFeatures) { // Check if a mark is set
                    for (let feature of config.articleFeatures) {
                        if (elem.is(feature.markSelector)) {
                            commit();
                            const component = feature.recover(elem.attr("id"));
                            addFeatureComponent(component);
                        }
                    }
                }

                if (par.type == "text")
                    return;

                const tag = par.tagName;
                const text = elem.text().trim();
                if (text.length === 0)
                    return;

                if (tag === "p" || tag === "li") {

                    if (tag === "li") {
                        if (elem.find("p").get().length > 0) {
                            return; // "li" tag has a "p" in it, ignore
                        }
                    }

                    paragraphs.push(text);
                }

                if (/h[123456]/i.test(tag)) { // Header
                    commit();
                    header = text;
                    commit();
                }

                if (tag === "figcaption") { // Figure
                    commit();
                    figure = text;
                    commit();
                }
            });
        });

        commit();

        if (config.filterText)
            for (let i = 0; i < config.filterText.length; ++i)
                config.filterText[i] = config.filterText[i].toLowerCase();

        if (config.filterText) {
            for (let filter of config.filterText) {
                sections = sections.filter(s => {
                    if (typeof s.text === "string") {
                        return s.text.toLowerCase().indexOf(filter) === -1;
                    } else {
                        s.text = s.text.filter((ss) => {
                            return ss.toLowerCase().indexOf(filter) === -1;
                        });
                        return true;
                    }
                });
            }
        }

        sections = sections.filter(s => {
            if (s.text === "string")
                return true;
            return s.text.length > 0;
        });

        return {
            author: author,
            publicationDate: publicationDate,
            sections: sections,
            ...descriptor,
        };
    }
}

export class CompositeExtractor extends ArticleExtractor {

    private readonly _transforms: Transform[] = [];
    private readonly _branches: ICompositeBranch[] = [];
    private _default: ArticleExtractor;

    transform(transform: Transform): this {
        this._transforms.push(transform);
        return this;
    }

    if(test: CompositeExtractorTestFunction, extractor: ArticleExtractor): this {
        this._branches.push({
            test: test,
            extractor: extractor
        });
        return this;
    }

    else(extractor: ArticleExtractor): this {
        this._default = extractor;
        return this;
    }

    async getArticle($: cheerio.Root, descriptor: INewsArticleDescriptor, browser: Browser): Promise<INewsArticle | null> {

        let data = $;
        for (let transform of this._transforms) {
            data = transform(data);
        }

        for (let branch of this._branches) {
            if (branch.test(data)) {
                return branch.extractor.getArticle(data, descriptor, browser);
            }
        }

        if (this._default) {
            return this._default.getArticle(data, descriptor, browser);
        }

        return null;
    }
}

export abstract class RssFeedBasedNewsProvider<TConfig extends IRssFeedNewsProviderConfiguration = IRssEngineFeedNewsProviderConfiguration> extends NewsProvider {

    protected constructor(browser: Browser, readonly config: TConfig) {
        super(browser, config.rootUrl, config.descriptor);
    }

    private extract(item) {
        if (typeof item === "string")
            return item;

        if (item.hasOwnProperty("_text"))
            return item["_text"];

        if (item.hasOwnProperty("_cdata"))
            return item["_cdata"];

        console.error("Unknown Item: ", JSON.stringify(item));
        return "<UNKNONWN>";
    }

    async getCategoryArticles(rootUrl: string, category: IRssFeedNewsCategory): Promise<INewsArticleDescriptor[]> {

        const items: INewsArticleDescriptor[] = [];

        const xml = await this.browser.get(rootUrl + category.feedUrl);

        try {
            const obj = JSON.parse(convert.xml2json(xml, {compact: true}));
            if (obj.hasOwnProperty("rss")) {
                for (let item of obj.rss.channel.item) {
                    items.push({
                        title: this.prompt(cleanXMLTitle(this.extract(item.title))),
                        url: item.link["_text"]
                    });
                }
            }

            if (obj.hasOwnProperty("feed")) {
                for (let item of obj.feed.entry) {
                    items.push({
                        title: this.prompt(this.extract(item.title)),
                        url: item.link["_attributes"].href
                    });
                }
            }

        } catch (e) {
            if (Orchestrator.global.environment.device.platform == "simulator")
                throw e;
            console.error("GET CAT ARTICLES", e);
        }

        return items;
    }

    async listCategories(): Promise<INewsCategory[]> {
        return this.config.categories;
    }
}

export class RssFeedNewsProvider extends RssFeedBasedNewsProvider<IRssExtractorFeedNewsProviderConfiguration> {
    constructor(browser: Browser, config: IRssExtractorFeedNewsProviderConfiguration) {
        super(browser, config);
    }

    async getArticle(descriptor: INewsArticleDescriptor): Promise<INewsArticle> {
        const html = await this.browser.get(descriptor.url, this._headers);
        return await this.config.extractor.getArticle(cheerio.load(html), descriptor, this.browser);
    }
}

export type ExternalNewsEngine = "mercury" | "readability"

export class ExternalNewsProvider extends RssFeedBasedNewsProvider {

    constructor(browser: Browser, config: IRssEngineFeedNewsProviderConfiguration) {
        super(browser, config);
    }

    async getArticleWithMercury(descriptor: INewsArticleDescriptor): Promise<INewsArticle> {

        const cleanData = await this.browser.getWithMercury(descriptor.url);

        if (typeof cleanData === "string") {

            if (cleanData === "paywalled")
                return {
                    title: "Paywall",
                    url: descriptor.url,
                    sections: [{
                        text: ["This article is paywalled, and can not be read at this time."],
                        kind: "paragraphs"
                    }]
                };

            voxmate.system.telemetry.error("Unable to get article for url: " + descriptor.url);

            return {
                title: "An Error has occurred parsing this article",
                url: descriptor.url,
                sections: [{
                    text: ["We are sorry, but the article content is not parsable"],
                    kind: "paragraphs"
                }]
            };
        }

        let date: Date = undefined;
        if (cleanData.date_published)
            date = moment(cleanData.date_published).toDate();

        const root = cheerio.load(cleanData.content);

        const extractor = new SimpleExtractor({
            pageFeatures: [],
            pageContentSelector: "*",
            extractFigureCaptions: true,
            extractHeaderCaptions: true,
            extractListingsText: true
        });

        const article = await extractor.getArticle(root, descriptor, this.browser);

        return {
            title: cleanData.title,
            author: cleanData.author ?? "Unknown Author",
            url: descriptor.url,
            publicationDate: date,
            sections: article.sections
        };

    }

    async getArticleWithReadability(descriptor: INewsArticleDescriptor): Promise<INewsArticle> {
        const cleanData = await this.browser.getWithReadability(descriptor.url);

        if (cleanData == null) {
            voxmate.system.telemetry.error("Unable to get article for url: " + descriptor.url);
            return {
                title: "Error",
                url: descriptor.url,
                sections: [{
                    text: ["Unable to get this article"],
                    kind: "paragraphs"
                }]
            };
        }

        const root = cheerio.load(cleanData.content);

        const extractor = new SimpleExtractor({
            pageFeatures: [],
            pageContentSelector: "*",
            extractFigureCaptions: true,
            extractHeaderCaptions: true,
            extractListingsText: true
        });

        const article = await extractor.getArticle(root, descriptor, this.browser);

        return {
            title: cleanData.title,
            author: cleanData.byline ?? "Unknown Author",
            url: descriptor.url,
            sections: article.sections
        };
    }

    getArticle(descriptor: INewsArticleDescriptor): Promise<INewsArticle> {
        switch (this.config.engine) {
            case "mercury":
                return this.getArticleWithMercury(descriptor);
            case "readability":
                return this.getArticleWithReadability(descriptor);
        }
    }

    get engine() {
        return this.config.engine;
    }

    get uid() {
        return this.config.uid;
    }
}

