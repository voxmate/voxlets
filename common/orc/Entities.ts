import {formatPhoneNumber, formatUrl} from "../utility/strings";
import {IYouTubeVideo} from "../voxmate";
import {RollActivity} from "./RollActivity";

export abstract class Entity {
    constructor(readonly data: string) {
    }

    async prepare(context: RollActivity) {

    }

    abstract presentEntity(context: RollActivity): Promise<void>

    abstract activateEntity(context: RollActivity): Promise<void>
}

export class URLEntity extends Entity {
    override async activateEntity(context: RollActivity) {
        await context.openURL(this.data);
    }

    override async presentEntity(context: RollActivity) {
        await context.sayDynamicContent(formatUrl(this.data));
    }

}

export class YoutubeVideoEntity extends Entity {

    private _info: IYouTubeVideo | null = null;

    override async prepare(context: RollActivity) {
        try {
            this._info = await voxmate.special.youtube.info(this.data);
        } catch (e) {
            console.warn("Unable to get YT video with id", this.data);
        }
    }

    override async activateEntity(context: RollActivity) {
        await context.playYoutubeVideo(this.data);
    }

    override async presentEntity(context: RollActivity) {
        if (this._info) {
            await context.sayDynamicInfo(`${this._info.title} | YouTube`, {autoDetectLanguage: true});
        } else {
            await context.sayDynamicInfo("Play youtube video");
        }
    }

}

export class PhoneNumberEntity extends Entity {

    async activateEntity(context: RollActivity): Promise<void> {
        await context.callPhone(this.data);
    }

    async presentEntity(context: RollActivity): Promise<void> {
        await context.sayDynamicContent(`Use phone number ${formatPhoneNumber(this.data)}`);
    }

}

export function formatEntityText(text: string, entities: Entity[]) {
    // TODO
}