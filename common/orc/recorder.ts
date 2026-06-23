import {Activity, Sayable} from "./orc";
import voxmate, {Actor, Gesture, RecordingId, UserInput, VoiceInputMode} from "../voxmate";
import {SimpleResourcePlayer} from "./player";
import {IEditFieldConfig, RollActivity} from "./RollActivity";

export enum Confirm {
    DoNotConfirm,
    ConfirmOptionally,
    ConfirmAlways
}

export type MessageRecorderSettings = {
    minDurationInSeconds?: number;
    confirmMessage?: Confirm;
    allowTextMessage?: IEditFieldConfig
}

class MessageConfirmActivity extends Activity<boolean> {

    constructor(private readonly recordingId: RecordingId) {
        super();
    }

    private async play() {
        await this.exec(new SimpleResourcePlayer(this.recordingId));
    }

    async run(): Promise<boolean> {

        while (this.isActive) {
            await this.play();

            let ui = await this.sayInfo("Swipe right to confirm this message, left to record another one, or down to listen again.");

            if (!ui)
                ui = await this.get();

            if (ui.kind == "gesture") {

                if (ui.gesture === Gesture.Right || ui.gesture === Gesture.DoubleTap)
                    return true;

                if (ui.gesture === Gesture.Down)
                    await this.play();
            }
        }

        return false;
    }
}

export type TextMessage = { kind: "text", text: string };
export type Message = { kind: "recording", recordingId: RecordingId } | TextMessage;

export class MessageRecorder extends RollActivity<Message> {

    private recordingId: RecordingId | null = null;

    constructor(private readonly prompt: Sayable | undefined, private readonly settings: MessageRecorderSettings) {
        super({voiceInputMode: VoiceInputMode.RecordInput});
    }

    override async onRecording(recordingId: RecordingId) {
        this.recordingId = recordingId;
        return {"action": "recording"};
    }

    private async isRecordingValid() {
        if (this.isSimulator)
            return true;

        const info = await this.wrap(voxmate.audio.recordings.info(this.recordingId!));
        let invalid = !info || !info.duration;

        if (invalid)
            return false;

        if (this.settings.minDurationInSeconds)
            invalid = invalid || (info.duration ?? 0) < 1000 * this.settings.minDurationInSeconds;

        return !invalid;
    }

    private async getText(): Promise<TextMessage | undefined> {
        const text = await this.editField(undefined, this.settings.allowTextMessage);
        if (!text)
            return undefined;

        return {kind: "text", text: text};
    }

    async run(): Promise<Message | undefined> {

        if (this.prompt)
            await this.sayDynamicContent(this.prompt);

        while (this.isActive) {

            function haveRecording(ui: UserInput | null | undefined): boolean {
                return !!(ui && ui.kind == "object" && ui.object.action == "recording");
            }

            function openTextEditor(ui: UserInput | null | undefined): boolean {
                if (!ui) return false;
                return ui.kind == "gesture" && (ui.gesture == Gesture.Right || ui.gesture == Gesture.DoubleTap);
            }

            while (this.recordingId == null && this.isActive) {

                let ui = await this.asSayGroup(async () => {
                    if (this.settings.allowTextMessage) {
                        await this.sayDynamicInfo("Use the double-tap and hold gesture to begin recording, or swipe right to open text editor");
                    } else await this.sayDynamicInfo("Use the double-tap and hold gesture to begin recording");
                });

                if (haveRecording(ui))
                    break;

                if (openTextEditor(ui))
                    return await this.getText();

                ui = await this.getWithTimeout(5000);

                if (haveRecording(ui))
                    break;

                if (openTextEditor(ui))
                    return await this.getText();
            }

            if (!await this.isRecordingValid()) {
                await this.sayDynamicInfo("Your message is too short. Please make sure to leave a complete message");
                this.recordingId = null;
                continue;
            }

            let requireConfirmation = false;

            const confirm = this.settings.confirmMessage ?? Confirm.ConfirmOptionally;

            if (confirm == Confirm.ConfirmOptionally) {
                await this.sayDynamicContent("Do you want to review your message?");
                const dex = this.roll().setActor(Actor.DynamicInformational);
                dex.add("Review recording", async () => {
                    return true;
                });
                dex.add("Just use it", async () => {
                    return false;
                });
                requireConfirmation = await dex.run();
            } else if (confirm == Confirm.ConfirmAlways) {
                requireConfirmation = true;
            } else if (confirm == Confirm.DoNotConfirm) {
                requireConfirmation = false;
            }

            if (requireConfirmation) {
                const confirm = await this.exec(new MessageConfirmActivity(this.recordingId!));
                if (!confirm) {
                    await this.freeze(this.wrap(voxmate.audio.recordings.delete(this.recordingId!)));
                    this.recordingId = null;
                    continue;
                }
            }

            return {kind: "recording", recordingId: this.recordingId!};
        }

    }
}