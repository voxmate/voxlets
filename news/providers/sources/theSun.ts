import {Browser, CompositeExtractor, Feature, RssFeedNewsProvider, SimpleExtractor} from "../providers";
import cheerio from "cheerio";
import moment from "moment";
import {TwitterFeature} from "./common/TwitterFeature";
import {EN} from "@voxmate/voxmate";

class FigCaptionFix extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {

        const spams = $.find("span.article__media-span").get().map(it => cheerio(it));
        for (let spam of spams)
            spam.text(spam.text().trim() + ". ");


        const dtc = $.find(".article__datestamp");
        const text = dtc.text();
        if (text.indexOf("Invalid Date") !== -1) {
            this.remove(dtc);
        }

        return undefined;
    }
}

export class TheSun extends RssFeedNewsProvider {
    constructor(browser: Browser) {
        super(browser, {
            rootUrl: "https://www.thesun.co.uk/",
            descriptor: {
                language: EN,
                description: "Online version of one of the largest British tabloids, founded in 1964. It focuses on latest news, show business, TV and sports stories.",
                name: "The Sun"
            },
            categories: [
                {feedUrl: "feed", listable: true, name: "All articles"},
                {
                    feedUrl: "sport/football/feed", listable: true, name: "Football", subs: [
                        {feedUrl: "topic/transfer-news/feed", listable: true, name: "Transfer News"},
                        {feedUrl: "sport/football/premierleague/feed", listable: true, name: "Premier League"},
                        {
                            feedUrl: "sport/football/champions-league/feed",
                            listable: true,
                            name: "Champions League"
                        },
                        {feedUrl: "sport/football/championship/feed", listable: true, name: "Latin America"},
                        {feedUrl: "sport/football/efl/feed", listable: true, name: "EFL"},
                        {feedUrl: "sport/football/womens-super-league/feed", listable: true, name: "Africa"},
                    ]
                },
                {
                    feedUrl: "sport/feed", listable: true, name: "Sport", subs: [
                        {feedUrl: "sport/boxing/feed", listable: true, name: "Boxing"},
                        {feedUrl: "sport/horseracing/feed", listable: true, name: "Horse Racing"},
                        {feedUrl: "sport/wwe/feed", listable: true, name: "WWE"},
                        {feedUrl: "sport/golf/feed", listable: true, name: "Golf"},
                        {feedUrl: "sport/motorsport/feed", listable: true, name: "Motorsport"},
                        {feedUrl: "sport/athletics/feed", listable: true, name: "Athletics"},
                        {feedUrl: "sport/rugbyunion/feed", listable: true, name: "Rugby Union"},
                    ]
                },
                {
                    feedUrl: "tvandshowbiz/feed", listable: true, name: "TV and Showbiz", subs: [
                        {feedUrl: "tvandshowbiz/bizarre/feed", listable: true, name: "Bizarre"},
                        {feedUrl: "tvandshowbiz/tv/feed", listable: true, name: "TV"},
                        {feedUrl: "topic/soaps/feed", listable: true, name: "Soaps"},
                        {feedUrl: "topic/the-big-interview/feed", listable: true, name: "The Big Interview"},
                        {feedUrl: "tvandshowbiz/film/feed", listable: true, name: "Film"},
                        {feedUrl: "tvandshowbiz/music/feed", listable: true, name: "Music"},
                    ]
                },
                {
                    feedUrl: "news/feed", listable: true, name: "All News", subs: [
                        {feedUrl: "news/uknews/feed", listable: true, name: "UK News"},
                        {feedUrl: "news/worldnews/feed", listable: true, name: "World News"},
                        {feedUrl: "news/politics/feed", listable: true, name: "Politics"},
                        {feedUrl: "news/opinion/feed", listable: true, name: "Opinion"},
                        {feedUrl: "news/health-news/feed", listable: true, name: "Health News"},
                    ]
                },
                {
                    feedUrl: "fabulous/feed", listable: true, name: "Fabulous", subs: [
                        {feedUrl: "fabulous/fashion/feed", listable: true, name: "Fashion"},
                        {feedUrl: "fabulous/hair-and-beauty/feed", listable: true, name: "Hair and Beauty"},
                        {feedUrl: "fabulous/fabulous-celebrity/feed", listable: true, name: "Celebrity"},
                        {
                            feedUrl: "fabulous/health-and-fitness/feed",
                            listable: true,
                            name: "Health and Fitness"
                        },
                        {feedUrl: "fabulous/parenting/feed", listable: true, name: "Parenting"},
                        {feedUrl: "fabulous/relationship-advice/feed", listable: true, name: "Relationships"},
                    ]
                },
                {feedUrl: "money/feed", listable: true, name: "Money"},
                {
                    feedUrl: "tech/feed", listable: true, name: "Tech", subs: [
                        {feedUrl: "tech/science/feed", listable: true, name: "Science"},
                        {feedUrl: "tech/phones-gadgets/feed", listable: true, name: "Phones and Gadgets"},
                        {feedUrl: "tech/gaming/feed", listable: true, name: "Gaming"},
                    ]
                },
                {feedUrl: "travel/feed", listable: true, name: "Travel"},
                {feedUrl: "motors/feed", listable: true, name: "Motors"},
                {feedUrl: "dear-deidre/feed", listable: true, name: "Dear Deidre"},
            ],
            extractor: new CompositeExtractor()
                .else(new SimpleExtractor({
                    pageContentSelector: "div.article__content",
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ($) => {
                        const a = $.find("a[rel='author']").get(0);
                        if (a)
                            return cheerio(a).text();
                    },
                    dateFunction: ($) => {
                        const dt = $.find(".article__published").text();
                        if (!dt) return null;
                        return moment(dt, "DD MMM YYYY, HH:mm");
                    },
                    filterSelectors: [".rail", ".tags", ".article-boxout"],
                    articleFeatures: [new FigCaptionFix(), new TwitterFeature()]
                }))
        });
    }
}