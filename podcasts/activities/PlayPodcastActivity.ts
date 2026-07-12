import {IPlayerStatus} from "@voxmate/voxmate";
import {BasePlayer, PlayerOptions, SeekPastZero} from "@voxmate/orc/player";

import {IPodcastData, PodcastDataService} from "../services/podcastDataService";
import {IPodcastEpisode} from "../data/data";
import {PlayOptionsActivity} from "./PlayOptionsActivity";

export class PlayPodcastActivity extends BasePlayer {

    dataService: PodcastDataService;

    private get data(): IPodcastData {
        return this.dataService.podcastData;
    }

    constructor(private readonly episode: IPodcastEpisode) {
        super({
            verbose: true,
            seekPastZeroBehavior: SeekPastZero.SeekToStart
        });
        this.enableHint();
    }

    protected useStreamingPlayer(): boolean {
        return true;
    }

    protected getPlayerSpeed(): number {
        return this.data.speed;
    }

    protected async onUpdate(status: IPlayerStatus): Promise<any> {
        this.dataService.updateCurrentlyPlaying(this.episode, status);
    }

    protected getPlayerResourceId(): string {
        return this.episode.podcastFileUrl;
    }

    protected async getSleepTimerDurationInMinutes(): Promise<number> {
        return this.data.sleepTimer;
    }

    protected async getInitialStatus(): Promise<IPlayerStatus | null> {
        const initial = this.dataService.getLatestStatus(this.episode);
        if (initial)
            return initial;
        return super.getInitialStatus();
    }

    protected async rightAction(): Promise<PlayerOptions> {
        return await this.exec(new PlayOptionsActivity(this.episode, this.playerId));
    }

    protected async finished(): Promise<any> {
        this.dataService.finishedPlaying(this.episode);
    }
}