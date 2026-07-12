import {
    Browser,
    CompositeExtractor, Feature,
    RssFeedNewsProvider,
    SimpleExtractor
} from "../providers";

import moment from "moment";
import cheerio from "cheerio";
import {EN} from "@voxmate/voxmate";

class SubtitleFeature extends Feature {
    async scan($: cheerio.Cheerio) {
        const obj = $.find("p.sub-title");
        this.extract(obj, obj.text().trim());
    }
}

export class DailyMirror extends RssFeedNewsProvider {
    constructor(browser: Browser) {


        super(browser, {
            rootUrl: "https://www.mirror.co.uk/",
            descriptor: {
                language: EN,
                description: "An Online edition of the Daily Mirror, British daily tabloid founded in 1903. " +
                    "It focuses on latest news, show business and television stories, " +
                    "as well as sport, and particularly, football news.",
                name: "Daily Mirror"
            },
            categories: [
                {
                    feedUrl: "news/?service=rss", listable: true, name: "News", subs: [
                        {feedUrl: "news/uk-news/?service=rss", listable: true, name: "UK News"},
                        {feedUrl: "news/us-news/?service=rss", listable: true, name: "US News"},
                        {feedUrl: "news/world-news/?service=rss", listable: true, name: "World News"},
                        {feedUrl: "news/weird-news/?service=rss", listable: true, name: "Weird News"},
                        {feedUrl: "all-about/crime/?service=rss", listable: true, name: "Crime"},
                        {
                            feedUrl: "news/real-life-stories/?service=rss",
                            listable: true,
                            name: "Real life stories"
                        },
                        {feedUrl: "science/?service=rss", listable: true, name: "Science"},
                        {feedUrl: "lifestyle/health/?service=rss", listable: true, name: "Health"},
                        {feedUrl: "lifestyle/motoring/?service=rss", listable: true, name: "Motoring"},
                    ]
                },
                {feedUrl: "news/politics/?service=rss", listable: true, name: "Politics"},
                {
                    feedUrl: "sport/?service=rss", listable: true, name: "Sport", subs: [
                        {feedUrl: "sport/boxing/?service=rss", listable: true, name: "Boxing"},
                        {feedUrl: "all-about/six-nations/?service=rss", listable: true, name: "Rugby"},
                        {feedUrl: "sport/tennis/?service=rss", listable: true, name: "Tennis"},
                        {feedUrl: "all-about/ufc/?service=rss", listable: true, name: "UFC"},
                        {feedUrl: "all-about/wwe/?service=rss", listable: true, name: "WWE"},
                        {feedUrl: "sport/cricket/?service=rss", listable: true, name: "Cricket"},
                        {feedUrl: "sport/horse-racing/?service=rss", listable: true, name: "Racing"},
                        {
                            feedUrl: "all-about/women-in-sport/?service=rss",
                            listable: true,
                            name: "Women in Sport"
                        },
                        {feedUrl: "sport/golf/?service=rss", listable: true, name: "Golf"},
                        {feedUrl: "sport/formula-1/?service=rss", listable: true, name: "Formula-1"},
                    ]
                },
                {feedUrl: "sport/football/?service=rss", listable: true, name: "Football"},
                {
                    feedUrl: "3am/?service=rss", listable: true, name: "Celebrities", subs: [
                        {feedUrl: "3am/style/?service=rss", listable: true, name: "Fashion"},
                    ]
                },
                {feedUrl: "tv/?service=rss", listable: true, name: "TV"},
                {feedUrl: "film/?service=rss", listable: true, name: "Film"},
                {feedUrl: "all-about/royal-family/?service=rss", listable: true, name: "Royals"},
                {feedUrl: "tech/?service=rss", listable: true, name: "Tech"},
                {feedUrl: "money/?service=rss", listable: true, name: "Money"},
                {feedUrl: "travel/?service=rss", listable: true, name: "Travel"},
                {feedUrl: "lifestyle/family/?service=rss", listable: true, name: "Family"},
            ],
            extractor: new CompositeExtractor()
                .else(new SimpleExtractor({
                    pageContentSelector: ".content-column",
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ($: cheerio.Cheerio) => {
                        const container = $.find(".author-information-container");

                        const textA = container.find("span[rel='author']").text().trim();
                        if (textA) return textA;

                        const textB = container.find("a").text().trim();
                        if (textB) return textB;

                        return null;
                    },
                    dateFunction: ($) => {
                        const zulu = $.find("time.date-published").attr("datetime");
                        if (!zulu) return null;
                        return moment(zulu);
                    },
                    filterSelectors: [
                        "form",
                        "aside",
                        "section[data-embed-group='read-more']",
                        ".in-article",
                        "#social-follow",
                        ".embedded-image-grid",
                        ".tag-list"
                    ],
                    pageFeatures: [new SubtitleFeature()],
                    articleFeatures: []
                }))
        });
    }
}