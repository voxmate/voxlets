import {PodcastDataService} from "../services/podcastDataService";
import voxmate, {IPlayerStatus} from "@voxmate/voxmate";
import {IPodcastEpisode} from "../data/data";
import {Activity} from "@voxmate/orc/orc";
import {formatDuration} from "@voxmate/voxmate/utility/strings";

export class PlayOptionsDetailsActivity extends Activity {

    dataService: PodcastDataService;
    private status: IPlayerStatus;

    constructor(private readonly episode: IPodcastEpisode, private readonly playerId: string) {
        super()
    }

    protected async init(): Promise<any> {
        this.status = await this.wrap(voxmate.audio.player.getStatus(this.playerId))
    }

    protected async run() {

        const duration = this.status.duration - this.status.position;
        const rem = formatDuration(duration);

        await this.saySkippingDynamicContent(
            `About ${rem} remaining of the ${this.episode.name}`,
            `You are listening to ${this.episode.channel.name}`
        );

        return null;
    }
}