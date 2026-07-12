import {Browser} from "../../providers";

export async function extractInstagramPostText(instagramId: string, browser: Browser): Promise<string | null> {
    const lookupURL = "https://api.instagram.com/oembed?url=http://instagr.am/p/" + instagramId + "/";
    const data = await browser.getJson(lookupURL) as { "title": string, "author_name": string };
    if (!data) return null;
    return data.title + ". Written by " + data.author_name;
}