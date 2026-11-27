import {Orchestrator} from "@voxmate/orc/orc";
import {RichActivity} from "@voxmate/orc/RichActivity";
import {INotification, Sound} from "@voxmate/voxmate";
import {GameCenterServiceToken, IInstalledGameInput} from "./activities/GameCenterBaseActivity";
import {GameCenterMainMenu, GameCenterPurgatoryActivity} from "./activities/GameCenterMainMenu";
import {GameCenterService} from "./activities/GameCenterService";

let orchestrator: Orchestrator | null = null;

interface IGameCenterLaunch {
    installedGames?: IInstalledGameInput[];
}

export async function main(launch?: IGameCenterLaunch) {
    orchestrator = new Orchestrator().injectAs(GameCenterServiceToken, new GameCenterService());
    await orchestrator.start(new GameCenterMainMenu(null, launch?.installedGames));
}

interface IGameCenterNotification {
    text: string;
    type: "friend-request" | "private-message" | "notification" | "gather";
    from?: string;
}

function suppressGatherMessage(): boolean {

    if (!orchestrator)
        return false;

    if (GameCenterPurgatoryActivity.SUPPRESS_NOTIFICATIONS)
        return true;

    return orchestrator.hasActivity(GameCenterPurgatoryActivity);
}

export async function notify(push: INotification) {

    const notification = push.data as IGameCenterNotification;

    class PlayNotification extends RichActivity {
        protected async run(): Promise<void | any> {
            this.sound(Sound.MessageNotification);
            if (notification.type === "private-message") {
                await this.sayDynamicInfo(`Game Center Message from ${notification.from}`);
                await this.sayDynamicContent(notification.text);
            } else {
                await this.sayDynamicInfo(notification.text);
            }
        }
    }

    let shouldNotify = true;

    // Purgatory connects through a socket to another service, and will notify user of changes in a different way.
    if (notification.type === "gather" && suppressGatherMessage())
        shouldNotify = false;

    if (shouldNotify) {
        const top = orchestrator?.getTopActivity();
        if (top) {
            await top.runSubActivityInIsolation(async activity => {
                await activity.exec(new PlayNotification());
            });
        } else await new Orchestrator().start(PlayNotification);
    }
}
