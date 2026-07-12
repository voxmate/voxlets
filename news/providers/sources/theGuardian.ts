import {
    Browser,
    CompositeExtractor,
    Feature,
    RssFeedNewsProvider,
    SimpleExtractor
} from "../providers";

import cheerio from "cheerio";
import {EN} from "@voxmate/voxmate";

function isLiveBlog($: cheerio.Root): boolean {
    return !!$.root().find(".content__main-column--liveblog").get(0);
}

class TwitterFeature extends Feature {
    async scan($: cheerio.Cheerio) {
        const tweets = $.find(".element-tweet").get().map((t) => cheerio(t));
        for (let tweet of tweets) {
            const author = tweet.find(".tweet__user-name").text().trim();
            const date = tweet.find(".tweet-date").text().trim();

            let title = "Tweet";
            if (author)
                title += ` by ${author}`;

            if (date)
                title += ` on ${date}`;

            const text = tweet.find(".tweet-body").text();
            this.extract(tweet, title, text);
        }
    }
}

export class TheGuardian extends RssFeedNewsProvider {
    constructor(browser: Browser) {

        const twitter = new TwitterFeature();

        super(browser, {
            rootUrl: "https://www.theguardian.com/",
            descriptor: {
                language: EN,
                description: "An online edition of The Guardian, British daily tabloid founded in 1821. " +
                    "It features UK and World News, sports, culture and lifestyle coverage, as well as editorial columns, opinion pieces and analyses.",
                name: "The Guardian"
            },
            categories: [
                {
                    feedUrl: "international/rss", listable: true, name: "World News", subs: [
                        {feedUrl: "uk-news/rss", listable: true, name: "UK News"},
                        {feedUrl: "uk/environment/rss", listable: true, name: "Environment"},
                        {feedUrl: "science/rss", listable: true, name: "Science"},
                        {feedUrl: "cities/rss", listable: true, name: "Cities"},
                        {feedUrl: "global-development/rss", listable: true, name: "Global Development"},
                        {feedUrl: "uk/technology/rss", listable: true, name: "Technology"},
                        {feedUrl: "uk/business/rss", listable: true, name: "Business"},
                        {feedUrl: "tone/obituaries/rss", listable: true, name: "Obituaries"},
                    ]
                },
                {
                    feedUrl: "uk/commentisfree/rss", listable: true, name: "Opinion", subs: [
                        {feedUrl: "profile/editorial/rss", listable: true, name: "The Guardian view"},
                        {feedUrl: "index/contributors/rss", listable: true, name: "Columnists"},
                        {feedUrl: "tone/letters/rss", listable: true, name: "Letters"},
                    ]
                },
                {
                    feedUrl: "uk/sport/rss", listable: true, name: "Sport", subs: [
                        {feedUrl: "football/rss", listable: true, name: "Football"},
                        {feedUrl: "sport/cricket/rss", listable: true, name: "Cricket"},
                        {feedUrl: "sport/rugby-union/rss", listable: true, name: "Rugby union"},
                        {feedUrl: "sport/tennis/rss", listable: true, name: "Tennis"},
                        {feedUrl: "sport/cycling/rss", listable: true, name: "Cycling"},
                        {feedUrl: "sport/formulaone/rss", listable: true, name: "Formula one"},
                        {feedUrl: "sport/golf/rss", listable: true, name: "Golf"},
                        {feedUrl: "sport/us-sport/rss", listable: true, name: "US sports"},
                    ]
                },
                {
                    feedUrl: "uk/culture/rss", listable: true, name: "Culture", subs: [
                        {feedUrl: "books/rss", listable: true, name: "Books"},
                        {feedUrl: "music/rss", listable: true, name: "Music"},
                        {feedUrl: "uk/tv-and-radio/rss", listable: true, name: "TV and radio"},
                        {feedUrl: "artanddesign/rss", listable: true, name: "Art and design"},
                        {feedUrl: "uk/film/rss", listable: true, name: "Film"},
                        {feedUrl: "music/classical-music-and-opera/rss", listable: true, name: "Classical"},
                        {feedUrl: "stage/rss", listable: true, name: "Stage"},
                    ]
                },
                {
                    feedUrl: "uk/lifeandstyle/rss", listable: true, name: "Lifestyle", subs: [
                        {feedUrl: "fashion/rss", listable: true, name: "Fashion"},
                        {feedUrl: "food/rss", listable: true, name: "Food"},
                        {feedUrl: "tone/recipes/rss", listable: true, name: "Recipes"},
                        {feedUrl: "lifeandstyle/love-and-sex/rss", listable: true, name: "Love and sex"},
                        {
                            feedUrl: "lifeandstyle/health-and-wellbeing/rss",
                            listable: true,
                            name: "Health and fitness"
                        },
                        {feedUrl: "lifeandstyle/home-and-garden/rss", listable: true, name: "Home and garden"},
                        {feedUrl: "lifeandstyle/women/rss", listable: true, name: "Women"},
                        {feedUrl: "lifeandstyle/men/rss", listable: true, name: "Men"},
                    ]
                },
            ],
            extractor: new CompositeExtractor()
                .if(isLiveBlog, new SimpleExtractor({
                    pageContentSelector: ".block--content",
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    filterSelectors: [".block-time", ".liveblog-block-byline__name"],
                    articleFeatures: [twitter]
                }))
                .else(new SimpleExtractor({
                    articleTitleSelector: ".content__standfirst",
                    pageContentSelector: ".content__article-body",
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: "span[itemprop=author]",
                    dateSelector: "time[itemprop=datePublished]",
                    dateFormatString: "ddd DD MMM YYYY HH mm",
                    filterSelectors: [".submeta", "span.bullet"],
                    articleFeatures: [twitter]
                }))
        });
    }
}