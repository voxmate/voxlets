import {Orchestrator} from "@voxmate/orc/orc";
import {MediaPlayerStartActivity} from "./activities/MediaPlayerActivity";

export async function main() {
    await new Orchestrator()
        .start(MediaPlayerStartActivity);
}