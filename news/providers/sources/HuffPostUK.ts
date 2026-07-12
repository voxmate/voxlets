import {
    Browser,
    CompositeExtractor,
    Feature,
    RssFeedNewsProvider,
    SimpleExtractor
} from "../providers";

import moment from "moment";
import cheerio from "cheerio";
import {TwitterFeature} from "./common/TwitterFeature";
import {regexGetFirstGroup} from "@voxmate/voxmate/utility/common";
import {extractInstagramPostText} from "./common/InstagramFeature";
import {EN} from "@voxmate/voxmate";

class InstagramPost extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser) {
        const posts = $.find(".instagram-media").get().map(it => cheerio(it));
        for (let post of posts) {
            const url = post.attr("data-instgrm-permalink");
            if (!url) {
                this.remove(post);
                continue
            }

            const instagramId = regexGetFirstGroup(/instagram.com\/p\/(.*)\//gm, url);

            const text = await extractInstagramPostText(instagramId, browser);
            if (!text) {
                this.remove(post);
                continue;
            }

            this.extract(post, "Instagram Post", text);
        }
    }
}

class FooterDeleter extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        this.remove($.find(".extra-content").nextAll());
    }
}

function isLifeArticle($: cheerio.Root): boolean {
    return $(".entry__body").length == 0
}

class Subtitle extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        const he = $.find(".headline__subtitle, header .dek");
        const headline = he.text().trim();
        if (headline)
            this.extract(he, headline);
    }
}

export class HuffPostUK extends RssFeedNewsProvider {
    constructor(browser: Browser) {

        super(browser, {
            rootUrl: "https://www.huffingtonpost.co.uk/feeds/",
            descriptor: {
                language: EN,
                description: "British Version of the American news and opinion site founded in 2005. " +
                    "It offers news and original content, and covers wide variety of topics, such as politics, business, lifestyle, environment and technology ",
                name: "HuffPost UK"
            },
            categories: [
                {feedUrl: "index.xml", listable: true, name: "Top Stories"},
            ],
            extractor: new CompositeExtractor()
                .if(isLifeArticle, new SimpleExtractor({
                    pageContentSelector: ".entry__content-list",
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ($) => cheerio($.find(".entry__byline__author a div")).text().trim(),
                    dateFunction: ($) => {
                        const dt = $.find(".timestamp time span").text().trim();
                        if (!dt)
                            return null;
                        return moment.utc(dt, "DD/MM/YYYY HH:mm").local()
                    },
                    filterSelectors: [".related-entries", ".cli-related-articles"],
                    articleFeatures: [new InstagramPost()],
                    pageFeatures: [new Subtitle()]
                }))
                .else(new SimpleExtractor({
                    pageContentSelector: ".entry__body",
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ($) => cheerio($.find(".author-card__details__name").get(0)).text().trim(),
                    dateFunction: ($) => {
                        const dt = $.find(".timestamp__date--published").text().trim();
                        if (!dt)
                            return null;
                        return moment.utc(dt, "DD/MM/YYYY HH:mm").local()
                    },
                    filterSelectors: [".related-entries", ".yr-entry-footer", ".cli-related-articles"],
                    articleFeatures: [new InstagramPost(), new FooterDeleter(), new TwitterFeature()],
                    filterText: ["This is a breaking news story and will be updated. Follow HuffPost"],
                    pageFeatures: [new Subtitle()]
                }))
        });

        this.addHeader("User-Agent", "Googlebot")
    }
}