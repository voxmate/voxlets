import {Browser, CompositeExtractor, Feature, RssFeedNewsProvider, SimpleExtractor} from "../providers";

import moment from "moment";
import cheerio from "cheerio";
import {EN} from "@voxmate/voxmate";

class ArticleSynopsisListing extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        const container = $.find("ul.mol-bullets-with-font");
        const listing = container.find("li").get().map(it => cheerio(it).text().trim());
        if (listing.length > 0) {
            this.extract(container, "Synopsis", listing);
        }
    }

}

export class DailyMail extends RssFeedNewsProvider {
    constructor(browser: Browser) {

        super(browser, {
            rootUrl: "https://www.dailymail.co.uk/",
            descriptor: {
                language: EN,
                description: "The online edition of the Daily Mail, British daily middle-market newspaper. " +
                    "Mail Online features international news, and carries mainly UK-focused coverage of sports, " +
                    "personal finance, travel, celebrity news, science and lifestyle editorials.",
                name: "Daily Mail"
            },
            categories: [
                {feedUrl: "articles.rss", listable: true, name: "All Articles"},
                {feedUrl: "home/index.rss", listable: true, name: "Home"},
                {feedUrl: "news/index.rss", listable: true, name: "News"},
                {feedUrl: "news/worldnews/index.rss", listable: true, name: "World News"},
                {feedUrl: "sport/index.rss", listable: true, name: "Sport"},
                {feedUrl: "tvshowbiz/index.rss", listable: true, name: "TV and Showbiz"},
                {feedUrl: "auhome/index.rss", listable: true, name: "Australia"},
                {feedUrl: "femail/index.rss", listable: true, name: "Femail"},
                {feedUrl: "health/index.rss", listable: true, name: "Health"},
                {feedUrl: "sciencetech/index.rss", listable: true, name: "Science and Technology"},
                {feedUrl: "money/index.rss", listable: true, name: "Money"},
                {feedUrl: "travel/index.rss", listable: true, name: "Travel"},
            ],
            extractor: new CompositeExtractor()
                .else(new SimpleExtractor({
                    pageContentSelector: "div[itemprop='articleBody']",
                    //articleTitleSelector: ($) => cheerio($.find("h2").get(0)).text(),
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ".author-section a.author",
                    dateFunction: ($) => {
                        return moment($.find(".article-timestamp-published time").attr("datetime"));
                    },
                    pageFeatures: [new ArticleSynopsisListing()],
                    filterSelectors: [".rotator"],
                }))
        });
    }
}