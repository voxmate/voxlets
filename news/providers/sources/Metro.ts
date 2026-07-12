import {
    Browser,
    CompositeExtractor, Feature,
    RssFeedNewsProvider,
    SimpleExtractor
} from "../providers";

import cheerio from "cheerio";
import {EN} from "@voxmate/voxmate";

class MetroFactBox extends Feature {

    isSpam(texts: string[]): boolean {
        // Some of the boxes are just prompts to send in news tips to metro.
        for (let text of texts)
            if (text.indexOf("@metro.co.uk") !== -1)
                return true;
        return false;
    }

    async scan($: cheerio.Cheerio) {
        const boxes = $.find(".metro-factbox").get().map(el => cheerio(el));
        for (let box of boxes) {

            const title = "FactBox: " + box.find("h2").text().trim();
            const texts = box.find(".metro-factbox-content p").get()
                .map(p => cheerio(p).text().trim())
                .filter(t => !!t);

            if (this.isSpam(texts))
                this.remove(box);
            else this.extract(box, title, texts);
        }
    }
}

export class Metro extends RssFeedNewsProvider {
    constructor(browser: Browser) {

        super(browser, {
            rootUrl: "https://metro.co.uk/",
            descriptor: {
                language: EN,
                description: "The online edition of UK’s highest-circulation print newspaper Metro. " +
                    "With focus on news, sports, travel, lifestyle and health, as well as arts and entertainment.",
                name: "Metro Online"
            },
            categories: [
                {
                    feedUrl: "news/feed", listable: true, name: "News", subs: [
                        {feedUrl: "news/uk/feed", listable: true, name: "UK News"},
                        {feedUrl: "news/world/feed", listable: true, name: "World News"},
                        {feedUrl: "news/weird/feed", listable: true, name: "Weird News"},
                        {feedUrl: "news/tech/feed", listable: true, name: "Tech News"},
                    ]
                },
                {
                    feedUrl: "sport/feed", listable: true, name: "Sport", subs: [
                        {feedUrl: "sport/football/feed", listable: true, name: "Football"},
                        {feedUrl: "sport/tennis/feed", listable: true, name: "Tennis"},
                        {feedUrl: "sport/cricket/feed", listable: true, name: "Cricket"},
                        {feedUrl: "sport/boxing/feed", listable: true, name: "Boxing"},
                        {feedUrl: "sport/UFC/feed", listable: true, name: "UFC"},
                    ]
                },
                {
                    feedUrl: "entertainment/feed", listable: true, name: "Entertainment", subs: [
                        {feedUrl: "entertainment/showbiz/feed", listable: true, name: "Showbiz"},
                        {feedUrl: "entertainment/tv/feed", listable: true, name: "TV"},
                        {feedUrl: "entertainment/film/feed", listable: true, name: "Film"},
                        {feedUrl: "entertainment/music/feed", listable: true, name: "Music"},
                        {feedUrl: "entertainment/gaming/feed", listable: true, name: "Gaming"},
                    ]
                },
                {
                    feedUrl: "tv-soaps/feed", listable: true, name: "Soaps", subs: [
                        {feedUrl: "tv-soaps/eastenders/feed", listable: true, name: "Eastenders"},
                        {feedUrl: "tv-soaps/emmerdale/feed", listable: true, name: "Emmerdale"},
                        {feedUrl: "tv-soaps/coronation-street/feed", listable: true, name: "Coronation-street"},
                        {feedUrl: "tv-soaps/hollyoaks/feed", listable: true, name: "Hollyoaks"},
                    ]
                },
                {
                    feedUrl: "lifestyle/feed", listable: true, name: "Lifestyle", subs: [
                        {feedUrl: "lifestyle/sex/feed", listable: true, name: "Sex"},
                        {feedUrl: "lifestyle/health/feed", listable: true, name: "Health"},
                        {feedUrl: "lifestyle/fashion/feed", listable: true, name: "Fashion"},
                        {feedUrl: "lifestyle/food/feed", listable: true, name: "Food"},
                        {feedUrl: "lifestyle/travel/feed", listable: true, name: "Travel"},
                    ]
                },
                {feedUrl: "feed/trending-posts", listable: true, name: "Trending"},
                {feedUrl: "feed", listable: true, name: "All Articles"},
            ],
            extractor: new CompositeExtractor()
                .else(new SimpleExtractor({
                    pageContentSelector: ".post",
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ".author-container a.author",
                    dateSelector: ".post-date",
                    filterSelectors: [".mor-link", ".zone-post-strip", "video", ".metro-ad-campaign-wrapper"],
                    filterText: ["leave a comment below"],
                    dateFormatString: "DD MMM YYYY h:mm a",
                    articleFeatures: [new MetroFactBox()]
                }))
        });
    }
}