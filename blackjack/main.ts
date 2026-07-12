import {Orchestrator} from "@voxmate/orc/orc";
import {PlayBlackJackActivity} from "./activities/PlayBlackJackActivity";

export async function main() {
    await new Orchestrator().start(PlayBlackJackActivity);
}
