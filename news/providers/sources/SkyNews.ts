import {Browser, CompositeExtractor, Feature, RssFeedNewsProvider, SimpleExtractor} from "../providers";

import moment from "moment";
import cheerio from "cheerio";
import {TwitterFeature} from "./common/TwitterFeature";
import {EN} from "@voxmate/voxmate";

class SubheaderFeature extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        const component = $.find("h2");
        this.extract(component, component.text());
    }
}

class PodcastRemovalFeature extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        for (let s of $.find("p strong").get().map(it => cheerio(it))) {
            if (s.text().indexOf("Listen to the Daily podcast on") !== -1) {
                this.remove(s);
            }
        }
    }
}

export class SkyNews extends RssFeedNewsProvider {
    constructor(browser: Browser) {

        super(browser, {
            rootUrl: "http://feeds.skynews.com/feeds/rss/",
            descriptor: {
                language: EN,
                description: "An online edition of Sky News, a British free-to-air television news channel founded in 1989. " +
                    "Sky News reports on a wide range of stories in the UK and around the world, ranging from politics to business and arts.",
                name: "Sky News"
            },
            categories: [
                {feedUrl: "home.xml", listable: true, name: "All Articles"},
                {feedUrl: "uk.xml", listable: true, name: "UK"},
                {feedUrl: "world.xml", listable: true, name: "World"},
                {feedUrl: "politics.xml", listable: true, name: "Politics"},
                {feedUrl: "us.xml", listable: true, name: "US"},
                {feedUrl: "technology.xml", listable: true, name: "Science and Technology"},
                {feedUrl: "business.xml", listable: true, name: "Business"},
                {feedUrl: "entertainment.xml", listable: true, name: "Ents and Arts"},
                {feedUrl: "strange.xml", listable: true, name: "Offbeat"},
            ],
            extractor: new CompositeExtractor()
                .else(new SimpleExtractor({
                    pageContentSelector: ".sdc-article-body",
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ".sdc-article-author__byline",
                    dateFunction: ($) => {
                        const dt = $.find(".sdc-article-date__date-time").text().trim();
                        if (!dt) return null;
                        return moment.utc(dt, "dddd DD MMMM YYYY HH:mm").local();
                    },
                    filterSelectors: [".sdc-article-related-stories", ".sdc-article-custom-markup"],
                    filterText: [":: Listen to"],
                    pageFeatures: [new SubheaderFeature()],
                    articleFeatures: [new PodcastRemovalFeature(), new TwitterFeature()]
                }))
        });
    }
}