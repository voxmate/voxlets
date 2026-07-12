import {BrowseFavoritesActivity} from "./BrowseFavoritesActivity";
import {PodcastDataService} from "../services/podcastDataService";
import {ContinueListeningActivity} from "./ContinueListeningActivity";
import {BrowseTopPodcastsActivity} from "./BrowseTopPodcastsActivity";
import {BrowsePodcastCategoriesActivity} from "./BrowsePodcastCategoriesActivity";
import {RollActivity} from "@voxmate/orc/RollActivity";
import {Actor, EN} from "@voxmate/voxmate";
import {IPodcastChannel} from "../data/data";
import {ChannelListingActivity} from "./ChannelListingActivity";
import {SearchActivity} from "./SearchActivity";


const FEATURED: IPodcastChannel[] = [
    {
        name: "Blind Android Users Podcast",
        feedUrl: "https://anchor.fm/s/4495abac/podcast/rss",
        language: EN
    }, {
        name: "Your Own Pay Podcast",
        feedUrl: "https://yourownpay.com/feed/",
        language: EN
    }
];

export class MainMenuActivity extends RollActivity<string> {

    dataService: PodcastDataService;

    async run() {

        const roll = this.roll().setActor(Actor.Content);

        roll.add("Continue Listening", ContinueListeningActivity)
            .showWhen(async () => this.dataService.podcastData.currentlyPlaying.length > 0);

        roll.add("My Favorites", async () => {
            const haveFavorites = this.dataService.podcastData.favorites.length > 0;
            if (haveFavorites) await this.exec(new BrowseFavoritesActivity());
            else await this.sayDynamicInfo("You don't have any favorites yet.");
        });

        roll.add("Featured Podcasts", async () => {
            await this.exec(new ChannelListingActivity(FEATURED));
        });

        roll.add("Top Podcasts", BrowseTopPodcastsActivity);
        roll.add("Top Podcasts by Category", BrowsePodcastCategoriesActivity);
        roll.add("Search", async () => {
            const query = await this.getSearchQuery();
            if (query)
                await this.exec(new SearchActivity(query));
        });

        return roll.run();
    }
}
