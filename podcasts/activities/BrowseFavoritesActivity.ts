import {ChannelListingActivity} from "./ChannelListingActivity";
import {ActivityBase} from "./ActivityBase";

export class BrowseFavoritesActivity extends ActivityBase {
    protected async run() {
        const favorites = this.dataService.podcastData.favorites;
        await this.exec(new ChannelListingActivity(favorites));
    }
}