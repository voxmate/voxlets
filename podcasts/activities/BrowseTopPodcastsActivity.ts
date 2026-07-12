import {PodcastDataService} from "../services/podcastDataService";
import {ActivityBase} from "./ActivityBase";
import {IPodcastChannel} from "../data/data";
import {ChannelListingActivity} from "./ChannelListingActivity";

export class BrowseTopPodcastsActivity extends ActivityBase {
    dataService: PodcastDataService;

    private podcasts: IPodcastChannel[];

    constructor(private readonly genre?: number) {
        super();
    }

    protected async init(): Promise<any> {
        this.podcasts = await this.getTopPodcasts(this.genre);
    }

    protected async run() {
        await this.exec(new ChannelListingActivity(this.podcasts));
    }
}