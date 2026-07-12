import {Orchestrator} from "@voxmate/orc/orc";
import {RichActivity} from "@voxmate/orc/RichActivity";

import cheerio from "cheerio";
import moment from "moment";


import {Browser, CompositeExtractor, INewsArticle, SimpleExtractor} from "../news/providers/providers";

import {ArticleReader} from "../news/activities";
import {regexGetFirstGroup} from "@voxmate/voxmate/utility/common";
import voxmate, {Sound} from "@voxmate/voxmate";
import {URLEntity, YoutubeVideoEntity} from "@voxmate/orc/Entities";

const host = "https://www.henshaws.org.uk/knowledge-village/";

interface IVillageTopic {
    title: string;
    url: string;
    description: string;
}

interface IVillagePost {
    type: "blog" | "video";
    title: string;
    description: string;
    url: string;
}

const extractor = new CompositeExtractor()
    .else(new SimpleExtractor({
        pageContentSelector: ".site-main",
        authorSelector: () => {
            return null;
        },
        extractHeaderCaptions: true,
        extractFigureCaptions: false,
        extractListingsText: false,
        dateFunction: ($) => {
            const zulu = $.find("post-date").text();
            return moment(zulu);
        },
        filterSelectors: [],
        pageFeatures: [],
        articleFeatures: []
    }));

class KnowledgeVillageBlogPost extends RichActivity {

    private article: INewsArticle = null;

    private kwError: string = null;

    constructor(private readonly postReference: IVillagePost) {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
        let data = await this.httpGet(this.postReference.url);

        let $ = cheerio.load(data.content);
        const buttons = $($(".content").find(".buttons").find("a"));
        let actualUrl: string = null;

        for (let i = 0; i < buttons.length; ++i) {
            const button = $(buttons.get(i));
            const url = button.attr("href");
            if (!url.includes("your-library")) {
                actualUrl = url;
                break;
            }
        }

        if (!actualUrl)
            return;


        if (actualUrl.endsWith(".pdf")) {
            this.kwError = "The article links to a PDF file. Voxmate can't open this PDF.";
            return;
        }

        data = await this.httpGet(actualUrl);

        if (!data.content) {
            this.kwError = "Voxmate is unable to get the article text.";
            return;
        }

        $ = cheerio.load(data.content);
        const browser = new Browser(this);

        this.article = await extractor.getArticle($, this.postReference, browser);

    }

    protected async run(): Promise<void | any> {


        if (this.error) {
            this.sound(Sound.Bad);
            await this.sayInfo(this.error);
            return;
        }

        if (!this.article) {
            await this.say("Unable to load blog post");
            return;
        }
        await this.say("Article Text");
        await this.exec(new ArticleReader(this.article));
    }
}

class KnowledgeVillageVideo extends RichActivity {
    private youtubeVideoId: string = null;

    constructor(private readonly post: IVillagePost) {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
        const data = await this.httpGet(this.post.url);
        const $ = cheerio.load(data.content);
        const buttons = $($(".content").find(".buttons").find("a"));
        for (let i = 0; i < buttons.length; ++i) {
            const button = $(buttons.get(i));
            const url = button.attr("href");

            console.log("URL", url);

            // Extract Entities

            const tt = await this.wrap(voxmate.utility.extractTextEntities(url));
            for (let entity of tt.entities) {
                if (entity.type == "youtube-video")
                    this.youtubeVideoId = entity.videoId;
            }
        }
    }

    protected async run(): Promise<void | any> {

        if (this.youtubeVideoId == null) {
            await this.say("Unable to get the video");
            return;
        }

        await this.playYoutubeVideo(this.youtubeVideoId);
    }
}

class KnowledgeVillageTopic extends RichActivity {
    private static count = 0;
    private readonly posts: IVillagePost[] = [];

    constructor(private readonly topic: IVillageTopic) {
        super();
        KnowledgeVillageTopic.count++;
    }

    protected async init(): Promise<void> {
        await super.init();

        const data = await this.httpGet(this.topic.url);

        const $ = cheerio.load(data.content);
        const posts = $(".single-resource");

        for (let i = 0; i < posts.length; ++i) {
            const post = $(posts.get(i));
            this.posts.push({
                url: post.find("a").attr("href"),
                type: post.hasClass("video") ? "video" : "blog",
                title: post.find("h3").text().trim(),
                description: post.find(".description").text().trim()
            });
        }
    }

    protected async run(): Promise<void | any> {
        const roll = this.roll();
        console.log(`Running ${KnowledgeVillageTopic.count} with ${this.posts.length} posts`);

        for (let post of this.posts) {
            roll.add(async () => {
                await this.sayDynamicInfo(post.title);
                for (let part of voxmate.utility.splitIntoSentences(post.description))
                    await this.sayDynamicContent(part);
            }, async () => {
                if (post.type == "video") {
                    await this.exec(new KnowledgeVillageVideo(post));
                } else {
                    await this.exec(new KnowledgeVillageBlogPost(post));
                }
            });
        }

        await roll.run();
    }
}

class KnowledgeVillage extends RichActivity {

    private topics: IVillageTopic[] = [];

    protected async init(): Promise<void> {
        await super.init();
        const data = await this.httpGet(host);
        const $ = cheerio.load(data.content);
        const sp = $(".single-product");
        for (let i = 0; i < sp.length; ++i) {
            const category = $(sp.get(i));
            const title = category.find("h3").text().trim();
            const description = category.find(".description").text().trim();
            const url = category.find("a").attr("href").trim();
            this.topics.push({
                title: title,
                url: url,
                description: description
            });
        }
    }

    protected async run(): Promise<void | any> {

        if (this.topics.length == 0) {
            await this.sayInfo("Unable to get a list of topics");
            return;
        }

        const roll = this.roll();

        for (let topic of this.topics) {
            roll.add(async () => {
                await this.sayDynamicInfo(topic.title);
                for (let part of voxmate.utility.splitIntoSentences(topic.description))
                    await this.sayDynamicContent(part);
            }, async () => {
                await this.exec(new KnowledgeVillageTopic(topic));
            });
        }

        await roll.run();
    }
}

export async function main() {
    await new Orchestrator()
        .start(KnowledgeVillage);
}