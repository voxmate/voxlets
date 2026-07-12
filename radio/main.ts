import {Orchestrator} from "@voxmate/orc/orc";
import {RadioMainActivity} from "./activities/RadioMainActivity";
import {RadioService} from "./service";

export async function main() {
    await new Orchestrator()
        .startWithServices(RadioMainActivity, RadioService);
}