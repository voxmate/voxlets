import {Orchestrator} from "@voxmate/orc/orc";
import {NewsChooseProviderActivity} from "./activities";
import {Browser} from "./providers/providers";
import {NewsProviderManager} from "./providers/NewsProviderManager";


export async function main() {
    await new Orchestrator()
        .startWithServices(NewsChooseProviderActivity, Browser, NewsProviderManager);
}
