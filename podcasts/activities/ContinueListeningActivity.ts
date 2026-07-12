import {Activity} from "@voxmate/orc/orc";
import {ICurrentlyPlayingSave, PodcastDataService} from "../services/podcastDataService";
import {PickVisitItemsLocal} from "@voxmate/orc/pickers";
import {PlayPodcastActivity} from "./PlayPodcastActivity";
import {mprompt} from "../data/data";
import {EN, ES, ET, IPrompt, RU} from "@voxmate/voxmate";

interface IPickerCP {
    name: string | IPrompt;
    save?: ICurrentlyPlayingSave;
    clear?: boolean;
    language?: string;
}

export class ContinueListeningActivity extends Activity {
    dataService: PodcastDataService;

    protected async run() {

        const items: IPickerCP[] = [];
        for (let save of this.dataService.podcastData.currentlyPlaying) {

            const episode = save.episode;

            let name = episode.name + " from the " + episode.channel.name;
            if (!episode.channel.name.trim().toLowerCase().endsWith("podcast"))
                name += " podcast";

            const prompt = mprompt(episode.channel, {
                [EN]: name,
                [RU]: episode.name,
                [ET]: episode.name,
                [ES]: episode.name
            });

            items.push({name: prompt, save: save, language: episode.channel.language});
        }

        items.push({name: "Clear Listening History", clear: true});

        const CLEAR_HISTORY_TOKEN = "CLEAR_HISTORY";

        const picker = new PickVisitItemsLocal(items, async (pcp: IPickerCP) => {
            if (pcp.clear) {
                throw CLEAR_HISTORY_TOKEN
            } else {
                await this.exec(new PlayPodcastActivity(pcp.save.episode));
            }
        }, {isDynamic: true, speechSettings: (item) => ({"language": item.language})});

        try {
            await this.exec(picker);
        } catch (e) {
            if (CLEAR_HISTORY_TOKEN) {
                this.dataService.clearCurrentlyPlaying()
            } else {
                console.log("ERROR", e);
                throw e;
            }
        }
    }
}