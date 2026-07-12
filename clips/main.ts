import {Orchestrator} from "@voxmate/orc/orc";
import {AudioClipMainActivity} from "./activities/AudioClipMainActivity";

export async function main() {
    await new Orchestrator()
        .start(AudioClipMainActivity);
}

