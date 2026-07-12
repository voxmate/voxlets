import {Browser, Feature} from "../../providers";
import cheerio from "cheerio";
import {clean} from "../../../utility";

export class TwitterFeature extends Feature {
    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        for (let tweet of $.find(".twitter-tweet").get().map(it => cheerio(it))) {

            const atags = tweet.find("a").get().map(it => cheerio(it));
            for (let atag of atags) {
                if (!atag.attr("href").startsWith("https://twitter.com/hashtag")) {
                    atag.remove()
                }
            }

            this.extract(tweet, "Tweet", clean(tweet.text()));
        }
    }
}