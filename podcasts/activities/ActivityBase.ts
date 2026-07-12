import {
    getSearchUrl,
    getTopUrl,
    IPodcastChannel,
    IPodcastEpisode,
    IPodcastEpisodeDescriptor,
    IPodcastFeed
} from "../data/data";
import {PodcastDataService} from "../services/podcastDataService";

import RssParser from "rss-parser"
import {RollActivity} from "@voxmate/orc/RollActivity";

export abstract class ActivityBase extends RollActivity {

    readonly dataService: PodcastDataService;

    private async pack(url: string): Promise<IPodcastChannel[]> {
        try {
            const data = await this.httpGet(url);
            const hits = JSON.parse(data.content);

            const packed: IPodcastChannel[] = [];

            const results = hits["results"] as any[];
            for (let result of results) {
                packed.push({
                    name: result.collectionName,
                    feedUrl: result.feedUrl,
                    language: null
                });
            }

            return packed;

        } catch (e) {
            console.error("PACK ERR", e);
        }

        return [];
    }

    protected async searchForPodcast(term: string): Promise<IPodcastChannel[]> {
        return await this.pack(getSearchUrl(term));
    }

    protected async getTopPodcasts(genre?: number): Promise<IPodcastChannel[]> {
        return await this.pack(getTopUrl(genre));
    }

    private static validate(ep: IPodcastEpisodeDescriptor): boolean {

        if (!ep.hasOwnProperty("title")) {
            return false;
        }


        if (typeof ep.title !== "string") {
            return false;
        }


        if (!ep.hasOwnProperty("enclosure")) {
            return false;
        }


        if (typeof ep.enclosure !== "object") {
            return false;
        }

        const enc = ep.enclosure as any;

        if (!enc.hasOwnProperty("url")) {
            return false;
        }

        return typeof enc.url === "string";
    }

    protected async getPodcastFeed(channel: IPodcastChannel): Promise<IPodcastFeed | null> {

        try {
            const feedContent = await this.httpGet(channel.feedUrl);
            const parser = new RssParser();
            const feed = await parser.parseString(feedContent.content) as IPodcastFeed;

            if (feed) {
                if (channel.language === null && feed.language) {
                    channel.language = feed.language;
                    console.log(`Determined channel language to be ${channel.language}`);
                }

                const episodes: IPodcastEpisode[] = [];

                for (let episode of (feed.items as any as IPodcastEpisodeDescriptor[])) {
                    if (ActivityBase.validate(episode))
                        try {
                            episodes.push({
                                name: episode.title,
                                podcastFileUrl: episode.enclosure.url,
                                channel: channel
                            });
                        } catch (e) {
                            console.error("ERR Processing Episode", e)
                        }
                }

                feed.items = episodes;
                feed.channel = channel;
                console.log("Feed processed OK", episodes.length);
                return feed
            } else {
                if (feedContent) {
                    console.error("Error Fetching Podcast Feed", feedContent.code);
                } else {
                    console.error("Error Fetching Podcast Feed Result");
                }
            }

            return null;

        } catch (e) {
            console.error("FEED FETCH ERR", e);
        }

        return null
    }

}
