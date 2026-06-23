import {Orchestrator} from "voxmate/orc/orc";
import {MathDokuMainActivity} from "./activities/MathDokuGameActivity";
import {MathDokuGameManager} from "./manager";

export async function main() {
    await new Orchestrator()
        .startWithServices(MathDokuMainActivity, MathDokuGameManager);
}
