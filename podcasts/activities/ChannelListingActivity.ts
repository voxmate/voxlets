import {ActivityBase} from "./ActivityBase";
import {IPodcastChannel, mprompt} from "../data/data";
import {BrowsePodcastFeedActivity} from "./BrowsePodcastFeedActivity";

export class ChannelListingActivity extends ActivityBase {

    constructor(private readonly channels: IPodcastChannel[]) {
        super();
    }

    protected async run() {
        const dex = this.roll();
        for (let i = 0; i < this.channels.length; i++) {
            const channel = this.channels[i];
            dex.add(async () => {
                await this.sayDynamicContent(mprompt(channel, channel.name));
                await dex.paginate(i, this.channels.length);
            }, async () => {
                await this.exec(new BrowsePodcastFeedActivity(channel))
            })
        }
        await dex.run();
    }
}