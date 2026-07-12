import {EN, IPrompt} from "@voxmate/voxmate";

export interface IPodcastChannel {
    name: string;
    feedUrl: string;
    language: string | null;
}

export interface IPodcastEpisode {
    name: string;
    podcastFileUrl: string;
    channel: IPodcastChannel;
}

export interface IPodcastEpisodeDescriptor {
    name: string;
    title: string;
    link: string;
    enclosure: {
        type: string;
        url: string;
    };
    pubData: string;
    content: string;
}

export interface IPodcastFeed {
    title: string;
    description: string;
    language: string;
    items: IPodcastEpisode[];
    channel: IPodcastChannel;
}

export function encodeQueryData(data: any) {
    const parameters = [];

    for (let key in data) {
        if (data.hasOwnProperty(key)) {
            const keystr = encodeURIComponent(key);
            const valuestr = encodeURIComponent(data[key]);
            parameters.push(`${keystr}=${valuestr}`);
        }
    }

    if (!parameters.length)
        return "";

    return "?" + parameters.join('&');
}

const SearchEndpoint = "https://itunes.apple.com/search";

export function getSearchUrl(term: string) {
    return "https://itunes.apple.com/search" + encodeQueryData({
        "term": term,
        "limit": 25,
        "entity": "podcast"
    });
}

export function getTopUrl(genre?: number) {

    const paramerers = {
        "term": "podcast", //TODO: Review this hack
        "limit": 50,
        "entity": "podcast"
    };

    if (genre)
        paramerers["genreId"] = genre;

    const url = SearchEndpoint + encodeQueryData(paramerers);
    console.log(url);
    return url;
}

export function mprompt(ch: IPodcastChannel, text: string | IPrompt): string | IPrompt {
    if (typeof text === "string") {
        if (ch.language)
            return {[ch.language]: text};
        return {[EN]: text};
    }

    return text;
}