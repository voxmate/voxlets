import {RichActivity} from "@voxmate/orc/RichActivity";
import {PickerRejectedInput} from "@voxmate/orc/pickers";
import {Sound} from "@voxmate/voxmate";
import {VoxLiveChatService} from "../chat/VoxLiveChatService";
import {getMessageText, getUserName, IChatMessage, whenMessage} from "../chat/common";

export class VoxLiveChatHistoryView extends RichActivity {
    private idx: number = 0;
    private readonly chat!: VoxLiveChatService;

    private async presentChatMessage(message: IChatMessage) {

        const [nick, userId] = getUserName(message);

        await this.sayDynamicContent(getMessageText(message));

        const when = whenMessage(message);

        if (message.isVoxmateTeam)
            await this.sayDynamicInfo(`${when} by ${nick} from Voxmate`);
        else if (userId !== this.chat.userId) {
            await this.sayDynamicInfo(`${when} by ${nick}`);
        } else {
            await this.sayDynamicInfo(`${when} by you`);
        }
    }

    private moveCursor(step: number): boolean {
        this.idx += step;

        if (this.idx < 0) {
            this.sound(Sound.Separator);
            this.idx = 0;
        }

        return this.idx >= this.chat.history.length;
    }

    protected async run(): Promise<void | any> {

        this.idx = this.chat.history.length - 1;

        if (this.chat.history.length === 0) {
            this.sound(Sound.Separator);
            await this.sayInfo("There are no old messages in this chat");
            return;
        }

        const dex = this.roll();

        dex.add(async () => {
            this.moveCursor(-10);
            current.goto();
        });

        dex.add(async () => {
            this.moveCursor(-1);
            current.goto();
        });

        const current = dex.add(async () => {
            const message = this.chat.history[this.idx];
            await this.presentChatMessage(message);
        });

        dex.add(async () => {
            if (this.moveCursor(1))
                dex.unwind();
            current.goto();
        });

        dex.add(async () => {
            if (this.moveCursor(10))
                dex.unwind();
            current.goto();
        });

        dex.rotateIntoFocus(current);

        try {
            await dex.run({
                throwRejectedInput: true
            });
        } catch (e) {
            if (e instanceof PickerRejectedInput)
                this.rejectUI(e.ui);
        }
    }
}
