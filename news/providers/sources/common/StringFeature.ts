import {Browser, Feature} from "../../providers";
import cheerio from "cheerio";

export class StringFeature extends Feature {
    constructor(private readonly text: string) {
        super();
    }

    async scan($: cheerio.Cheerio, browser: Browser): Promise<any> {
        const dummy = $.append("<div></div>");
        this.extend(dummy, this.text);
    }
}