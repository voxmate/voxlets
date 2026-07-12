import {PodcastDataService} from "../services/podcastDataService";
import {ActivityBase} from "./ActivityBase";
import {IPodcastChannel} from "../data/data";
import {ChannelListingActivity} from "./ChannelListingActivity";

export class SearchActivity extends ActivityBase {

    dataService: PodcastDataService;

    private results: IPodcastChannel[] = [];

    constructor(private readonly query: string) {
        super({loadingPrompt: "Searching for " + query});
    }

    protected async init(): Promise<any> {
        try {
            this.results = await this.searchForPodcast(this.query);
        } catch (e) {
            console.error("SEARCH RESULTS ERR", e);
        }
    }

    protected async run() {
        if (!this.results || this.results.length === 0) {
            await this.say("There are no matches for your search");
        } else {
            return this.exec(new ChannelListingActivity(this.results));
        }
    }
}