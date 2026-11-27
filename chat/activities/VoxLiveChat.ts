import {RPCSocketActivity, subscribe} from "@voxmate/orc/RPCSocketActivity";
import {Activity} from "@voxmate/orc/orc";
import voxmate, {Gesture, IKeyPress, Sound} from "@voxmate/voxmate";
import {getChatSocketUrl, getMessageText, getUserName, IChatMessage, IChatSettings} from "../chat/common";
import {VoxLiveChatService} from "../chat/VoxLiveChatService";
import {VoxLiveChatHistoryView} from "./VoxLiveChatHistoryView";

enum ClientStatus {
    Joined,
    Left
}

interface IClientUpdate {
    nick: string;
    status?: ClientStatus;
    event?: "join" | "leave";
    userId?: string;
    channel?: string;
}

interface ISetNickResult {
    ok: boolean;
    nick: string;
    userId?: string;
}

export class VoxLiveChat extends RPCSocketActivity {

    private readonly chat!: VoxLiveChatService;

    private async updateHistory(): Promise<void> {
        this.chat.history = await this.rpc.call("history") as IChatMessage[];
    }

    private async joinVoxTeamChannel(): Promise<boolean> {
        return await this.rpc.call("joinChannel", {channel: "voxteam"}) as boolean;
    }

    private async postMessage(text: string) {
        await this.rpc.call("post", {text: text});
    }

    private async setNick(nick: string): Promise<ISetNickResult | null | undefined> {
        return await this.rpc.call<ISetNickResult | null | undefined>("setNick", {nick: nick});
    }

    protected async init() {
        await super.init();
        const timer = new Date().getTime();

        const nickResult = await this.setNick(this.chatSettings.nick);
        if (nickResult?.userId) {
            this.chat.userId = nickResult.userId;
        } else {
            const profile = await this.wrap(voxmate.system.profile());
            this.chat.userId = profile.userId;
        }

        await Promise.all([this.updateHistory(), this.joinVoxTeamChannel()]);

        const timeTaken = (new Date().getTime()) - timer;
        console.log("Connection took: ", timeTaken, "(ms)");
    }

    private async announceMessage(message: IChatMessage) {

        this.sound(Sound.MessageNotification);

        if (!this.isManagingActivity) {
            return;
        }

        const [nick, userId] = getUserName(message);
        if (userId === this.chat.userId) {
            this.sound(Sound.Good);
            return;
        }

        await this.asSayGroup(async () => {
            if (!message.edited) {
                if (message.isVoxmateTeam)
                    await this.sayDynamicInfo(nick + " from Voxmate");
                else await this.sayDynamicInfo(nick);
                await this.sayDynamicContent(getMessageText(message));
            } else {
                await this.sayDynamicInfo(`${nick} changed their earlier message`);
            }
        });
    }

    private async announceClientUpdate(clientUpdate: IClientUpdate) {

        if (clientUpdate.userId && clientUpdate.userId === this.chat.userId)
            return;

        this.sound(Sound.Ping);

        if (!this.isManagingActivity) {
            return;
        }

        await this.asSayGroup(async () => {
            const nick = clientUpdate.nick;
            const left = clientUpdate.event === "leave" || clientUpdate.status === ClientStatus.Left;
            await this.sayDynamicInfo(
                left ? `${nick} has left the chat` : `${nick} has joined the chat`,
                {forwardInterrupt: true}
            );
        });
    }

    private async execFocused<T>(fn: () => Promise<T>) {
        const activity = new class FocusActivity extends Activity<T> {
            protected async run(): Promise<T> {
                return await fn();
            }
        };
        return await this.exec(activity);
    }

    private async enterMessageInputMode(key: IKeyPress) {
        await this.execFocused(async () => {

            const text = await this.editField(undefined, {
                typed: key,
                allowEmojiInput: true,
                maxLength: 500
            });

            if (text) {
                await this.postMessage(text);
            }
        });
    }

    private async browseHistory() {
        await this.exec(new VoxLiveChatHistoryView());
    }

    @subscribe("message")
    async onMessage(message: IChatMessage) {
        this.chat.addMessageToHistory(message);
        await this.announceMessage(message);
    }

    @subscribe("client")
    async onClientUpdate(clientUpdate: IClientUpdate) {
        await this.announceClientUpdate(clientUpdate);
    }

    @subscribe("message-changed")
    async onMessageEdited(message: IChatMessage) {
        this.chat.addMessageToHistory(message);
        await this.announceMessage(message);
    }

    async runConnected(): Promise<any> {
        await this.say("Vox Chat is Connected", {forwardInterrupt: true});

        while (this.isActive) {
            const ui = await this.get();
            if (ui.kind == "keyPress") {
                await this.enterMessageInputMode(ui);
            }

            if (ui.kind == "gesture" && ui.gesture == Gesture.Up) {
                await this.browseHistory();
            }
        }
    }

    constructor(readonly chatSettings: IChatSettings) {
        super(getChatSocketUrl(), "chat", "chatroom");
    }

}
