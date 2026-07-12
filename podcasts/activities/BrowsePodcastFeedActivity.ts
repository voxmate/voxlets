import {PodcastDataService} from "../services/podcastDataService";
import {ActivityBase} from "./ActivityBase";
import {IPodcastChannel, IPodcastFeed, mprompt} from "../data/data";
import {PickVisitItems} from "@voxmate/orc/pickers";
import {PlayPodcastActivity} from "./PlayPodcastActivity";

export class BrowsePodcastFeedActivity extends ActivityBase {
    dataService: PodcastDataService;

    private feed: IPodcastFeed;

    constructor(private readonly channel: IPodcastChannel) {
        super()
    }

    protected async init(): Promise<any> {
        try {
            this.feed = await this.getPodcastFeed(this.channel);
        } catch (e) {
            console.error("FEED INIT ERR", e);
        }
    }

    protected async run() {
        if (!this.feed) {
            await this.sayInfo("Something went wrong fetching episodes for this podcast.");
        } else if (this.feed.items.length === 0) {
            await this.sayInfo("There are no episodes in this podcast");
        } else {

            const dex = this.roll();
            for (let i = 0; i < this.feed.items.length; i++) {
                const item = this.feed.items[i];
                dex.add(async () => {
                    await this.sayDynamicContent(mprompt(this.feed.channel, item.name));
                    await dex.paginate(i, this.feed.items.length);
                }, async () => {
                    await this.exec(new PlayPodcastActivity(item))
                })
            }
            await dex.run();
        }
    }
}