import {Orchestrator} from "@voxmate/orc/orc";
import {VoxLiveChatService} from "./chat/VoxLiveChatService";
import {VoxLiveChatLobby} from "./activities/VoxLiveChatLobby";

export async function main() {
    await new Orchestrator()
        .inject("chat", new VoxLiveChatService())
        .start(VoxLiveChatLobby);

    console.log("Exit Chat Main");
}
