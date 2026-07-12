import {Orchestrator} from "@voxmate/orc/orc";
import {SudokuMainMenuActivity} from "./activities/SudokuMainMenuActivity";
import {SudokuGameManager} from "./SudokuGameManager";

export async function main() {
    await new Orchestrator()
        .inject("manager", new SudokuGameManager())
        .start(SudokuMainMenuActivity);
}