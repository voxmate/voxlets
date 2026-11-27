import {RichActivity} from "@voxmate/orc/RichActivity";
import {Sayable} from "@voxmate/orc/orc";
import {RollActivity} from "@voxmate/orc/RollActivity";
import {Actor} from "@voxmate/voxmate";
import {VoxLiveChat} from "./VoxLiveChat";

interface IReadLongOptions {
    actor?: Actor;
}

export class VoxLiveChatLobby extends RichActivity {

    private static LS_NICK = "nick";

    get nick(): string | null {
        return localStorage.getItem(VoxLiveChatLobby.LS_NICK);
    }

    set nick(value: string | null | undefined) {
        if (!value) localStorage.removeItem(VoxLiveChatLobby.LS_NICK);
        else localStorage.setItem(VoxLiveChatLobby.LS_NICK, value);
    }

    private async editNickname() {
        this.nick = await this.editField(this.nick ?? undefined, {maxLength: 25});
        if (this.nick) {
            await this.sayDynamicContent("Set nickname to: " + this.nick);
        }
    }

    private async openChat() {
        await this.exec(new VoxLiveChat({
            nick: this.nick ?? "Anonymous"
        }));
    }

    async readSkipping(statements: Sayable[], options: IReadLongOptions = {}): Promise<boolean> {

        const readerActivity = new class extends RollActivity {
            constructor() {
                super({isSubordinate: true});
            }

            async run() {

                const actor = options.actor ?? Actor.DynamicContent;
                const reader = this.roll();

                for (let i = 0; i < statements.length; i++) {
                    const statement = statements[i];
                    reader.add(async () => {
                        await this.say(statement, {actor: actor});
                        if (i == statements.length - 1) {
                            reader.unwind(true);
                        }
                    }, async () => {
                        reader.unwind(false);
                    });
                }

                reader.add(async () => {
                    reader.unwind(true);
                });

                return await reader.run({autoskip: true});
            }
        };

        return await this.exec(readerActivity);
    }

    protected async run(): Promise<void | any> {

        await this.repeatAtMost("chat-intro", async () => {
            await this.readSkipping([
                "Welcome to the Voxmate Chat",
                "Here you can chat with the team and other Voxmate Users.",
                "This chat is a preview for our upcoming chat service.",
                "Chat supports keyboard input. If you are not familiar with it, try the input tutorial first."
            ], {
                actor: Actor.Informational
            });
        });

        if (!this.nick) {
            await this.sayDynamicInfo("Please pick a nickname for yourself...");
            await this.editNickname();
        }

        await this.openChat();

        const options = this.roll().setActor(Actor.Informational);
        options.add("Back to Chat", async () => await this.openChat());
        options.add("Change My Nickname", async () => await this.editNickname());
        await options.run();
    }
}
