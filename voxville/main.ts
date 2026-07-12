import {Orchestrator} from "@voxmate/orc/orc";
import {VoxvilleMainMenuActivity} from "./activities/VoxvilleMainMenuActivity";
import {VoxvilleGameManager} from "./VoxvilleGameManager";

export async function main() {
    await new Orchestrator()
        .inject("manager", new VoxvilleGameManager())
        .start(VoxvilleMainMenuActivity);
}