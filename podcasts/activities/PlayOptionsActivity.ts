import voxmate, {IPlayerStatus} from "@voxmate/voxmate";
import {Activity} from "@voxmate/orc/orc";
import {PickVisitItemsLocal} from "@voxmate/orc/pickers";
import {PlayerOptions} from "@voxmate/orc/player";

import {PodcastDataService} from "../services/podcastDataService";
import {IPodcastEpisode} from "../data/data";
import {PlayOptionsDetailsActivity} from "./PlayOptionsDetailsActivity";
import {PodcastPlaybackSpeed} from "./PodcastPlaybackSpeed";
import {PodcastPlaybackSleepTimer} from "./PodcastPlaybackSleepTimer";

interface ISimpleAction {
    name: string;
    action: string;
}

export class PlayOptionsActivity extends Activity<PlayerOptions> {

    dataService: PodcastDataService;

    //private status: IPlayerStatus;

    constructor(private readonly episode: IPodcastEpisode, private readonly playerId: string) {
        super();
    }

    protected async init(): Promise<any> {
        //this.status = await this.wrap(voxmate.audio.player.getStatus(this.playerId))
    }

    protected async run(): Promise<PlayerOptions> {

        const options = [
            {name: "Sleep Timer", "action": "sleep"},
            {name: "Podcast Details", "action": "details"},
            {name: "Playback Speed", "action": "speed"},
            {name: "Restart playback", "action": "restart"},
        ];

        const channel = this.episode.channel;

        const isFavorite = this.dataService.isFavorited(channel);

        if (!isFavorite) {
            options.push({name: "Add podcast channel to favorites", action: "favorite"});
        } else {
            options.push({name: "Remove podcast channel from favorites", action: "unfavorite"});
        }

        const picker = new PickVisitItemsLocal(options, async (item: ISimpleAction) => {
            switch (item.action) {

                case "sleep":
                    await this.exec(new PodcastPlaybackSleepTimer());
                    if (this.dataService.podcastData.sleepTimer)
                        picker.breakLoop(PlayerOptions.SleepTimer);
                    break;

                case "favorite":
                    this.dataService.favorite(channel);
                    await this.sayInfo("Added podcast to favorites");
                    picker.breakLoop(PlayerOptions.ContinuePlaying);
                    break;

                case "unfavorite":
                    this.dataService.unFavorite(channel);
                    await this.sayInfo("Removed podcast from favorites");
                    picker.breakLoop(PlayerOptions.ContinuePlaying);

                    break;

                case "speed":
                    await this.exec(new PodcastPlaybackSpeed());
                    picker.breakLoop(PlayerOptions.ContinuePlaying);
                    break;

                case "details":
                    await this.exec(new PlayOptionsDetailsActivity(this.episode, this.playerId));
                    picker.breakLoop(PlayerOptions.ContinuePlaying);
                    break;

                case "restart": {
                    picker.breakLoop(PlayerOptions.RestartPlayer);
                    break;
                }
            }
        }, {isDynamic: false});

        return await this.exec(picker) as any;
    }
}