import {GameCenterBaseActivity} from "./GameCenterBaseActivity";
import {Sound} from "@voxmate/voxmate";

export class GameCenterNicknameEditor extends GameCenterBaseActivity {

    protected async init(): Promise<any> {
        await super.init();
    }

    protected async run(): Promise<any> {

        while (this.isActive) {

            const profile = await this.freeze(this.getMyGameCenterProfile(true));

            const updating = profile != null;

            const prompt = updating ? "Change your nickname" : "Please pick a new nickname";
            const original = updating ? profile.nick : undefined;
            let nick = updating ? profile.nick : undefined;

            nick = await this.editField(nick, {maxLength: 20}, prompt);

            if (nick && nick !== original) {

                const result = await this.registerGameCenterProfile(nick);
                if (result.problem) {
                    await this.sayInfo(result.problem);
                    continue;
                }

                if (result.updated) {
                    const updatedProfile = await this.freeze(this.getMyGameCenterProfile(true));

                    if (updating)
                        await this.say(`Changed nickname to ${nick}`);
                    else await this.say(`Created profile with nickname ${nick}`);

                    this.sound(updatedProfile ? Sound.Good : Sound.Bad);
                    return;
                }

            } else if (nick === original) {
                return;
            } else {
                await this.sayInfo("Unable to setup profile");
                return;
            }
        }

    }
}

export class GameCenterProfileActivity extends GameCenterBaseActivity {

    protected async init(): Promise<any> {
        await super.init();
        await this.getMyGameCenterProfile(true);
    }

    protected async run(): Promise<void | any> {
        const dex = this.roll();
        dex.add("Change Nickname", GameCenterNicknameEditor);
        dex.add("Game History");
        await dex.run();
    }
}
