import {Orchestrator} from "@voxmate/orc/orc";
import {BattleshipMainMenuActivity} from "./activities/BattleshipMainMenuActivity";

export async function main() {
    await new Orchestrator()
        .start(BattleshipMainMenuActivity);
}
