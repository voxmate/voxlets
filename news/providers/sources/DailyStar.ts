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

export class DailyStar extends RssFeedNewsProvider {
    constructor(browser: Browser) {


        super(browser, {
            rootUrl: "https://www.dailystar.co.uk/",
            descriptor: {
                language: EN,
                description: "An Online edition of the Daily Star - British daily tabloid founded in 1978. It features stories about celebrities, sport, news and gossip",
                name: "Daily Star"
            },
            categories: [
                {feedUrl: "?service=rss", listable: true, name: "All articles"},
                {
                    feedUrl: "news/?service=rss", listable: true, name: "News", subs: [
                        {feedUrl: "news/latest-news/?service=rss", listable: true, name: "Latest News"},
                        {feedUrl: "news/world-news/?service=rss", listable: true, name: "World News"},
                        {feedUrl: "news/weird-news/?service=rss", listable: true, name: "Weird News"},
                        {feedUrl: "news/politics/?service=rss", listable: true, name: "Politics"},
                    ]
                },
                {
                    feedUrl: "sport/football/?service=rss", listable: true, name: "Football", subs: [
                        {feedUrl: "sport/transfer-news/?service=rss", listable: true, name: "Transfer News"},
                    ]
                },
                {
                    feedUrl: "sport/?service=rss", listable: true, name: "Sport", subs: [
                        {feedUrl: "sport/motogp/?service=rss", listable: true, name: "MotoGP"},
                        {feedUrl: "sport/snooker/?service=rss", listable: true, name: "Snooker"},
                        {feedUrl: "sport/darts/?service=rss", listable: true, name: "Darts"},
                        {feedUrl: "sport/boxing/?service=rss", listable: true, name: "Boxing"},
                        {feedUrl: "sport/ufc/?service=rss", listable: true, name: "UFC"},
                        {feedUrl: "sport/f1/?service=rss", listable: true, name: "F1"},
                        {feedUrl: "sport/rugby-league/?service=rss", listable: true, name: "Rugby-league"},
                        {feedUrl: "sport/horse-racing/?service=rss", listable: true, name: "Racing"},
                        {feedUrl: "sport/motorsport/?service=rss", listable: true, name: "Motorsport"},
                    ]
                },
                {
                    feedUrl: "showbiz/?service=rss", listable: true, name: "Showbiz", subs: [
                        {feedUrl: "music/?service=rss", listable: true, name: "Music"},
                        {feedUrl: "movies/?service=rss", listable: true, name: "Movies"},
                    ]
                },
                {
                    feedUrl: "tv/?service=rss", listable: true, name: "TV", subs: [
                        {feedUrl: "latest/emmerdale/?service=rss", listable: true, name: "Emmerdale"},
                        {
                            feedUrl: "latest/coronation-street/?service=rss",
                            listable: true,
                            name: "Coronation Street"
                        },
                        {feedUrl: "latest/eastenders/?service=rss", listable: true, name: "Eastenders"},
                        {feedUrl: "latest/hollyoaks/?service=rss", listable: true, name: "Hollyoaks"},
                        {
                            feedUrl: "latest/im-a-celebrity-get-me-out-of-here/?service=rss",
                            listable: true,
                            name: "I'm A Celebrity… Get Me Out Of Here!"
                        },
                        {feedUrl: "latest/x-factor/?service=rss", listable: true, name: "X Factor"},
                        {
                            feedUrl: "latest/strictly-come-dancing/?service=rss",
                            listable: true,
                            name: "Strictly Come Dancing"
                        },
                        {feedUrl: "latest/towie/?service=rss", listable: true, name: "TOWIE"},
                        {
                            feedUrl: "latest/britains-got-talent/?service=rss",
                            listable: true,
                            name: "Britain's Got Talent"
                        },
                        {feedUrl: "latest/big-brother/?service=rss", listable: true, name: "Big Brother"},
                    ]
                },
                {
                    feedUrl: "tech/?service=rss", listable: true, name: "Tech", subs: [
                        {feedUrl: "tech/news/?service=rss", listable: true, name: "Tech News"},
                        {feedUrl: "tech/gaming/?service=rss", listable: true, name: "Gaming"},
                        {feedUrl: "tech/guides/?service=rss", listable: true, name: "Gaming Guides"},
                        {feedUrl: "tech/reviews/?service=rss", listable: true, name: "Reviews"},
                    ]
                },
                {
                    feedUrl: "life-style/?service=rss", listable: true, name: "Life and Style", subs: [
                        {feedUrl: "real-life/?service=rss", listable: true, name: "Real Life"},
                        {feedUrl: "love-sex/?service=rss", listable: true, name: "Love and Sex"},
                        {feedUrl: "diet-fitness/?service=rss", listable: true, name: "Diet and Fitness"},
                        {feedUrl: "fashion-beauty/?service=rss", listable: true, name: "Fashion and Beauty"},
                        {feedUrl: "health/?service=rss", listable: true, name: "Health"},
                        {feedUrl: "just-jane/?service=rss", listable: true, name: "Just Jane"},
                        {feedUrl: "cars/?service=rss", listable: true, name: "Cars"},
                        {feedUrl: "life-style/money/?service=rss", listable: true, name: "Money"},
                    ]
                },
                {
                    feedUrl: "travel/?service=rss", listable: true, name: "Travel", subs: [
                        {feedUrl: "travel/travel-news/?service=rss", listable: true, name: "Travel News"},
                        {feedUrl: "travel/adventure/?service=rss", listable: true, name: "Adventure"},
                        {feedUrl: "travel/beach/?service=rss", listable: true, name: "Beach"},
                        {feedUrl: "travel/party/?service=rss", listable: true, name: "Party"},
                    ]
                },
            ],
            extractor: new CompositeExtractor()
                .else(new SimpleExtractor({
                    pageContentSelector: ".content-column",
                    authorSelector: ($: cheerio.Cheerio) => {
                        const container = $.find(".author-information-container");

                        const textA = container.find("span[rel='author']").text().trim();
                        if (textA) return textA;

                        const textB = container.find("a").text().trim();
                        if (textB) return textB;

                        return null;
                    },
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
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