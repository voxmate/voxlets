import {IPodcastChannel, IPodcastEpisode} from "../data/data";
import {IPlayerStatus} from "@voxmate/voxmate";
import * as _ from "lodash"

export interface ICurrentlyPlayingSave {
    episode: IPodcastEpisode;
    status: IPlayerStatus;
    lastListen: number;
}

export interface IPodcastData {
    currentlyPlaying: ICurrentlyPlayingSave[];
    history: IPodcastEpisode[];
    favorites: IPodcastChannel[];
    speed: number;
    sleepTimer: number | null;
}

const LOCALSTORAGE_KEY = "PODCAST-DATA";

export class PodcastDataService {

    private readonly data: IPodcastData;
    private readonly currentlyPlayingMap: { [key: string]: ICurrentlyPlayingSave } = {};

    private static initDefaultData(): IPodcastData {
        return {
            currentlyPlaying: [],
            history: [],
            favorites: [],
            speed: 1,
            sleepTimer: 10
        }
    }

    constructor() {

        const initialData = PodcastDataService.initDefaultData();

        try {
            const json = localStorage.getItem(LOCALSTORAGE_KEY);
            this.data = JSON.parse(json);

            if (this.data) {
                for (let key in initialData) {
                    if (!this.data.hasOwnProperty(key)) {
                        this.data[key] = initialData[key];
                    }
                }
            }

        } catch (e) {
            console.error("ERROR", e);
        }

        if (!this.data) {
            this.data = initialData;
            console.info("Initializing default podcast data");
        }

        for (let cpp of this.data.currentlyPlaying) {
            this.currentlyPlayingMap[cpp.episode.podcastFileUrl] = cpp;
        }

        this.save()
    }

    save() {

        this.data.currentlyPlaying.length = 0;

        for (let link in this.currentlyPlayingMap) {
            const cpp = this.currentlyPlayingMap[link];
            this.data.currentlyPlaying.push(cpp);
        }

        this.data.currentlyPlaying = _.sortBy(this.data.currentlyPlaying, [(cp: ICurrentlyPlayingSave) => -cp.lastListen]);

        localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(this.data));
    }

    get podcastData() {
        return this.data
    }

    updateCurrentlyPlaying(episode: IPodcastEpisode, status: IPlayerStatus) {
        const ts = new Date().getTime();
        this.currentlyPlayingMap[episode.podcastFileUrl] = {episode: episode, status: status, lastListen: ts};
        this.save();
    }

    getLatestStatus(episode: IPodcastEpisode) {
        const data = this.currentlyPlayingMap[episode.podcastFileUrl];
        if (data)
            return data.status;
        return null;
    }

    finishedPlaying(episode: IPodcastEpisode) {

        delete this.currentlyPlayingMap[episode.podcastFileUrl];

        this.data.history.unshift(episode);
        while (this.data.history.length > 25)
            this.data.history.pop();

    }

    clearCurrentlyPlaying() {
        for (let key in this.currentlyPlayingMap)
            delete this.currentlyPlayingMap[key];
        this.save();
    }

    isFavorited(channel: IPodcastChannel) {
        for (let ch of this.data.favorites)
            if (ch.feedUrl === channel.feedUrl)
                return true;
        return false;
    }

    favorite(channel: IPodcastChannel) {
        if (!this.isFavorited(channel)) {
            this.data.favorites.unshift(channel);
            this.save()
        }
    }

    unFavorite(channel: IPodcastChannel) {
        const idx = this.data.favorites.findIndex((ch) => ch.feedUrl === channel.feedUrl);
        if (idx !== -1) {
            this.data.favorites.splice(idx, 1);
            this.save();
        }
    }
}

export class PodcastDataServiceEp2 {

    private readonly data: IPodcastData;
    private readonly currentlyPlayingMap: { [key: string]: ICurrentlyPlayingSave } = {};

    private static initDefaultData(): IPodcastData {
        return {
            currentlyPlaying: [],
            history: [],
            favorites: [],
            speed: 1,
            sleepTimer: 10
        }
    }

}