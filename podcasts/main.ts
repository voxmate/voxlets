import {Orchestrator} from "@voxmate/orc/orc";
import {MainMenuActivity} from "./activities/MainMenuActivity";
import {PodcastDataService} from "./services/podcastDataService";

export async function main() {
    await new Orchestrator()
        .inject("dataService", new PodcastDataService())
        .start(MainMenuActivity);
}