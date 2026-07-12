import {
    Browser,
    CompositeExtractor,
    Feature,
    RssFeedNewsProvider,
    SimpleExtractor
} from "../providers";

import moment from "moment";
import cheerio from "cheerio";
import {extractInstagramPostText} from "./common/InstagramFeature";
import {EN} from "@voxmate/voxmate";

class SubHeadingFeature extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        const element = $.find("h2.sub-headline");
        const subheading = element.text();
        this.extract(element, subheading);
    }
}

class TwitterExtractor extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        for (let tweet of $.find("amp-twitter").get().map(it => cheerio(it))) {
            const tweetId = tweet.attr("data-tweetid");
            if (tweetId) {
                const url = "https://twitter.com/user/status/" + tweetId;
                const html = await browser.get(url);

                let text = cheerio.load(html).root().find("meta[property='og:description']").attr("content");
                text = text.replace(/(?:https?|ftp):\/\/[\n\S]+/g, '');

                this.extract(tweet, "Tweet", text);
            }
        }
    }
}

class KeyPointsFeature extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        const highlights = $.find(".highlights");
        const title = highlights.find("h2").text();
        const points = highlights.find("ul").find("li").get().map(it => cheerio(it)).map(it => it.text());
        this.extract(highlights, title, points);
    }
}

class QuoteBox extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        const quotes = $.find(".inline-quotebox").get().map(it => cheerio(it));
        for (let quote of quotes) {
            const quoteText = quote.find("blockquote").text();
            const author = quote.find("figcaption").text();
            this.extract(quote, "Quote", `${quoteText}. By ${author}`);
        }
        return undefined;
    }

}

class InstagramPost extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser) {
        const posts = $.find("amp-instagram").get().map(it => cheerio(it));
        for (let post of posts) {
            const instagramId = post.attr("data-shortcode");
            if (!instagramId) {
                this.remove(post);
                continue;
            }
            const text = await extractInstagramPostText(instagramId, browser);
            if (!text) {
                this.remove(post);
                continue;
            }

            this.extract(post, "Instagram Post", text);
        }
    }
}

class LiveBlogItem extends Feature {

    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {

        const blog = $.find("amp-live-list.liveblog");
        const blogItems = blog.find(".lb-item").get().map(it => cheerio(it));

        for (let blogItem of blogItems) {
            const target = blogItem.find(".content");
            for (let heading of target.find("strong").get().map(it => cheerio(it))) {
                this.extract(heading, heading.text());
            }

            const text = target.text();
            this.extend(target, "", text);
        }

        return undefined;
    }
}

export class TheIndependent extends RssFeedNewsProvider {
    constructor(browser: Browser) {

        super(browser, {
            rootUrl: "http://www.independent.co.uk/",
            descriptor: {
                language: EN,
                description: "A British online newspaper, originally established in 1986. In addition to news coverage on a broad range of topics, it also offers editorials and long reads",
                name: "The Independent"
            },
            categories: [
                {feedUrl: "rss", listable: true, name: "All articles"},
                {
                    feedUrl: "news/rss", listable: true, name: "News", subs: [
                        {feedUrl: "news/uk/rss", listable: true, name: "UK"},
                        {feedUrl: "news/world/rss", listable: true, name: "World"},
                        {feedUrl: "news/world/americas/rss", listable: true, name: "US"},
                        {feedUrl: "news/uk/politics/rss", listable: true, name: "UK Politics"},
                        {feedUrl: "topic/brexit/rss", listable: true, name: "Brexit"},
                        {feedUrl: "life-style/gadgets-and-tech/rss", listable: true, name: "Tech"},
                        {feedUrl: "news/science/rss", listable: true, name: "Science"},
                        {feedUrl: "news/education/rss", listable: true, name: "Education"},
                        {feedUrl: "environment/rss", listable: true, name: "Environment"},
                        {feedUrl: "news/health/rss", listable: true, name: "Health"},
                        {feedUrl: "news/business/rss", listable: true, name: "Business"},
                        {feedUrl: "infact/rss", listable: true, name: "InFact"},
                    ]
                },
                {
                    feedUrl: "voices/rss", listable: true, name: "Voices", subs: [
                        {feedUrl: "voices/editorials/rss", listable: true, name: "Editorials"},
                    ]
                },
                {
                    feedUrl: "sport/rss", listable: true, name: "Sport", subs: [
                        {feedUrl: "sport/football/rss", listable: true, name: "Football"},
                        {feedUrl: "sport/rugby/rugby-union/rss", listable: true, name: "Rugby Union"},
                        {feedUrl: "sport/cricket/rss", listable: true, name: "Cricket"},
                        {feedUrl: "sport/motor-racing/formula1/rss", listable: true, name: "F1"},
                        {feedUrl: "sport/general/boxing/rss", listable: true, name: "Boxing"},
                        {feedUrl: "sport/tennis/rss", listable: true, name: "Tennis"},
                        {feedUrl: "sport/cycling/rss", listable: true, name: "Cycling"},
                        {feedUrl: "sport/golf/rss", listable: true, name: "Golf"},
                        {feedUrl: "author/miguel-delaney/rss", listable: true, name: "Miguel Delaney"},
                        {feedUrl: "sport/us-sports/rss", listable: true, name: "US Sports"},
                    ]
                },
                {
                    feedUrl: "arts-entertainment/rss", listable: true, name: "Culture", subs: [
                        {feedUrl: "arts-entertainment/film/rss", listable: true, name: "Film"},
                        {feedUrl: "arts-entertainment/music/rss", listable: true, name: "Music"},
                        {feedUrl: "arts-entertainment/tv/rss", listable: true, name: "TV and Radio"},
                        {feedUrl: "arts-entertainment/books/rss", listable: true, name: "Books"},
                        {feedUrl: "arts-entertainment/art/rss", listable: true, name: "Art"},
                        {feedUrl: "arts-entertainment/photography/rss", listable: true, name: "Photography"},
                        {
                            feedUrl: "arts-entertainment/theatre-dance/rss",
                            listable: true,
                            name: "Theatre and Dance"
                        },
                        {feedUrl: "arts-entertainment/streaming/rss", listable: true, name: "Streaming Hub"},
                        {feedUrl: "arts-entertainment/games/rss", listable: true, name: "Games"},
                    ]
                },
                {feedUrl: "news/long_reads/rss", listable: true, name: "Long reads"},
                {feedUrl: "life-style/rss", listable: true, name: "Lifestyle"},
                // {feedUrl: root + "extras/indybest/rss", listable: true, name: "Indy Best"}, //TODO: Check if they fixed it
            ],
            extractor: new CompositeExtractor()
                .else(new SimpleExtractor({
                    pageContentSelector: ".body-content",
                    extractHeaderCaptions: true,
                    extractFigureCaptions: true,
                    extractListingsText: true,
                    authorSelector: ($) => {
                        const firstLink = $.find(".author a").get(0);
                        if (firstLink)
                            return cheerio($.find(".author a").get(0)).text();
                        return null;
                    },
                    dateFunction: ($) => {
                        const dt = $.find(".publish-date amp-timeago").attr("datetime");
                        if (!dt) return null;
                        return moment(dt, "YYYY-MM-DDTHH:mm:ssZ");
                    },
                    filterText: ["For further information and weather predictions", "For more interesting stories about"],
                    filterSelectors: [".ad-wrapper", ".inline-related", ".inline-prompt", ".signup-comp", ".i-gallery"],
                    articleFeatures: [new TwitterExtractor(), new InstagramPost(), new QuoteBox(), new KeyPointsFeature(), new LiveBlogItem()],
                    pageFeatures: [new SubHeadingFeature()]
                }))
        });
    }
}