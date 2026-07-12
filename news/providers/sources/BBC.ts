import {Browser, CompositeExtractor, Feature, RssFeedNewsProvider, SimpleExtractor} from "../providers";

import moment from "moment";
import cheerio from "cheerio";
import {StringFeature} from "./common/StringFeature";
import {EN} from "@voxmate/voxmate";

class RemoveRelatedArticles extends Feature {

    private isLinkOnly($: cheerio.Cheerio): boolean {
        const items = $.find("li").get();
        for (let item of items) {
            if (cheerio(item).find("a").length == 0)
                return false;
        }
        return true;
    }

    async scan($: cheerio.Cheerio) {
        const listings = $.find("ul").get();
        for (let listing of listings.map(it => cheerio(it))) {
            if (this.isLinkOnly(listing))
                this.remove(listing);
        }
    }
}

class OneStory extends Feature {
    async scan($: cheerio.Cheerio) {
        this.remove($.find(".story-body").nextAll());
    }
}

class SocialEmbed extends Feature {
    async scan($: cheerio.Cheerio) {
        const embeds = $.find(".social-embed").get().map(it => cheerio(it));
        for (let embed of embeds) {
            {
                const text = embed.find(".twitter-tweet").text().trim();
                if (text) {
                    this.extract(embed, "Tweet", text);
                } else {
                    this.remove(embed);
                }
            }
        }
    }
}

class ImageAltTextExtractor extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        const figures = $.find("figure").get().map(it => cheerio(it));
        for (let figure of figures) {
            const text = figure.find("img").attr("alt");
            if (!figure.find("figcaption").get(0)) {
                const altText = figure.find("img").attr("alt");
                if (altText)
                    this.extract(figure, "Image", altText);

                const dli = figure.find(".js-delayed-image-load");
                const delayedImageAltText = dli.attr("data-alt");
                if (delayedImageAltText) {

                    // image can be presentational, we'll skip those
                    const width = parseInt(dli.attr("data-width") || "0");
                    const height = parseInt(dli.attr("data-height") || "0");

                    console.log(delayedImageAltText, width, height);

                    if (Math.sqrt(width * height) < 300) this.remove(figure);
                    else this.extract(figure, "Image", delayedImageAltText);
                }
            }
        }
        return undefined;
    }

}

export function isVideoPost($: cheerio.Root): boolean {
    return $.root().find(".vxp").length == 1;
}

export class BBC extends RssFeedNewsProvider {
    constructor(browser: Browser) {

        super(browser, {
            rootUrl: "http://feeds.bbci.co.uk/news/",
            descriptor: {
                language: EN,
                description: "British public service broadcaster. World's largest broadcast news gathering operation, " +
                    "BBC provides readers with latest UK and World News, as well as long reads and educational material",
                name: "BBC"
            },
            categories: [
                {feedUrl: "rss.xml", listable: true, name: "Top Stories"},
                {
                    feedUrl: "uk/rss.xml", listable: true, name: "UK News", subs: [
                        {feedUrl: "england/rss.xml", listable: true, name: "England"},
                        {feedUrl: "northern_ireland/rss.xml", listable: true, name: "Northern Ireland"},
                        {feedUrl: "scotland/rss.xml", listable: true, name: "Scotland"},
                        {feedUrl: "wales/rss.xml", listable: true, name: "Wales"},
                    ]
                },
                {
                    feedUrl: "world/rss.xml", listable: true, name: "World News", subs: [
                        {feedUrl: "world/us_and_canada/rss.xml", listable: true, name: "US and Canada"},
                        {feedUrl: "world/europe/rss.xml", listable: true, name: "Europe"},
                        {feedUrl: "world/middle_east/rss.xml", listable: true, name: "Middle East"},
                        {feedUrl: "world/latin_america/rss.xml", listable: true, name: "Latin America"},
                        {feedUrl: "world/asia/rss.xml", listable: true, name: "Asia"},
                        {feedUrl: "world/africa/rss.xml", listable: true, name: "Africa"},
                    ]
                },
                {feedUrl: "business/rss.xml", listable: true, name: "Business"},
                {feedUrl: "politics/rss.xml", listable: true, name: "Politics"},
                {feedUrl: "health/rss.xml", listable: true, name: "Health"},
                {feedUrl: "education/rss.xml", listable: true, name: "Education"},
                {feedUrl: "science_and_environment/rss.xml", listable: true, name: "Science and Environment"},
                {feedUrl: "stories/rss.xml", listable: true, name: "Stories"},
                {feedUrl: "technology/rss.xml", listable: true, name: "Technology"},
                {feedUrl: "entertainment_and_arts/rss.xml", listable: true, name: "Entertainment and Arts"},
                {feedUrl: "explainers/rss.xml", listable: true, name: "Explainers"},
                {feedUrl: "newsbeat/rss.xml", listable: true, name: "Newsbeat"},
                {feedUrl: "reality_check/rss.xml", listable: true, name: "Reality Check"},
                {feedUrl: "the_reporters/rss.xml", listable: true, name: "Long Reads"},
                {feedUrl: "have_your_say/rss.xml", listable: true, name: "Have your say"},
            ],
            extractor: new CompositeExtractor()
                .if(isVideoPost, new SimpleExtractor({
                    pageContentSelector: ".vxp-media__summary",
                    pageFeatures: [new StringFeature("Video Post")]
                }))
                .else(new SimpleExtractor({
                    pageContentSelector: ".story-body__inner",
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ".byline__name",
                    dateFunction: ($) => {

                        const alt = $.find(".timestamp time").get(0);
                        if (alt) {
                            const ts = cheerio(alt).attr("data-timestamp");
                            if (!ts) return null;

                            const secondsSinceEpoch = parseInt(ts);
                            if (Number.isNaN(secondsSinceEpoch))
                                return null;

                            return moment(secondsSinceEpoch * 1000);
                        }

                        const ts = $.find(".date.date--v2").attr("data-seconds");
                        if (!ts)
                            return null;
                        const secondsSinceEpoch = parseInt(ts);
                        if (Number.isNaN(secondsSinceEpoch))
                            return null;

                        return moment(secondsSinceEpoch * 1000);
                    },
                    filterSelectors: ["h1", ".off-screen", ".tags-container", ".with-extracted-share-icons", ".sp-media-asset__smp-message", ".bbc-news-vj-embed-wrapper"],
                    articleFeatures: [new RemoveRelatedArticles(), new SocialEmbed(), new ImageAltTextExtractor()],
                    pageFeatures: [new OneStory()]
                }))
        });
    }
}