import {Ding, VoxvilleUIBaseActivity} from "./VoxvilleUIBaseActivity";
import {VoxvilleMapRegionActivity} from "./VoxvilleMapRegionActivity";
import {INotification, NotificationKind} from "../game/game";
import voxmate from "@voxmate/voxmate";
import {VoxvilleResourceOverviewActivity} from "./VoxvilleResourceOverviewActivity";
import {VoxvilleBuildActivity} from "./VoxvilleBuildActivity";
import {VoxvilleFindBuildingActivity} from "./VoxvilleFindBuildingActivity";
import {ITile} from "../game/types";
import {PopulationSpawnPriorityOrder} from "../game/population";

interface INotificationStackItem {
    tick: number;
    text: string;
}

interface IAnnouncement {
    text: string;
    repeated?: boolean;
    ding?: Ding;
}

export class VoxvilleGameActivity extends VoxvilleUIBaseActivity<any> {

    private _gameTicksHandler: any = null;
    private _saveGameHandler: any = null;
    private _announcementHandler: any = null;

    private _recentAnnouncements: INotificationStackItem[] = [];
    private _announcementEcho: { [code: string]: number } = {};
    private _announcements: IAnnouncement[] = [];

    constructor(private readonly startingTile?: ITile, private readonly descendStartingTile: boolean = false) {
        super();
    }

    private filterCode(code: string) {
        const lastOccurrence = this._announcementEcho[code] || -1;
        const diff = this.vv.game.tick - lastOccurrence;
        if (lastOccurrence == -1 || diff > 60) {
            this._announcementEcho[code] = this.vv.game.tick;
            return false;
        } else return true;
    }

    private filterNotification(notification: INotification) {

        if (notification.kind === NotificationKind.ResourceRunningLow) {
            return this.filterCode("low_resource_" + notification.source);
        }

        if (notification.kind === NotificationKind.ResourceDepleted) {
            return this.filterCode("depleted_resource_" + notification.source);
        }

        return false;
    }

    private async announce(announcement: IAnnouncement) {

        while (this._recentAnnouncements.length > 30)
            this._recentAnnouncements.pop();

        const ding = await this.playSoundEffect(announcement.ding || "ping");

        const ui = await this.sayDynamicInfo(announcement.text);
        if (ui && ui.kind == "gesture") {

            await ding.stop();

            /* if (this.lastSayFraction < 0.2) {
                const repeated = announcement.repeated || false;
                if (!repeated) {
                    announcement.repeated = true;
                    this._announcements.push(announcement);
                }
            }

            if (this.lastSayFraction < 0.6) {
                voxmate.input.rejectGesture(ui.gesture);
            } */

        } else {
            this._recentAnnouncements.unshift({
                tick: this.vv.game.tick,
                text: announcement.text
            });
        }
    }

    private buildNotification(notification: INotification): IAnnouncement {

        if (notification.kind === NotificationKind.ConstructionComplete) {
            const building = this.vv.getBuildingData(notification.source);
            const region = this.vv.getTileRegion(building.i, building.j);
            return {
                text: `Construction of ${building.name} in ${region.name} is complete`,
                ding: "constructionComplete"
            };
        }

        if (notification.kind === NotificationKind.ResourceRunningLow) {
            return {text: `You are low on ${notification.source}`};
        }

        if (notification.kind === NotificationKind.ResourceDepleted) {
            return {text: `Your ${notification.source} is depleted`};
        }

        if (notification.kind === NotificationKind.LevelUP) {
            const level = this.vv.level;
            const villagerKind = PopulationSpawnPriorityOrder[level];
            return {
                text: `Congratulations! You've reached level ${this.vv.level}! ${villagerKind} are eager to move in to your village!`,
                ding: "levelup",
            };
        }

        return null;
    }

    private setupGame() {

        this._gameTicksHandler = this.setInterval(() => {

            const notifications = this.vv.tick();
            for (let notification of notifications) {
                if (notification.kind === NotificationKind.ConstructionComplete) {
                    this.setTimeout(async () => {
                        if (this.vv.game.buildings.length < 3) {
                            this._announcements.push(this.buildNotification(notification));
                        } else {
                            this.playSoundEffect("constructionComplete");
                        }
                    });

                } else if (!this.filterNotification(notification)) {
                    const announcement = this.buildNotification(notification);
                    this._announcements.push(announcement);
                }
            }
        }, 1000);

        this._saveGameHandler = this.setInterval(() => {
            this.manager.saveCurrentGame();
        }, 3000);

        this._announcementHandler = this.setInterval(async () => {

            const announcements = this._announcements.slice();
            this._announcements.length = 0;

            for (let announcement of announcements) {
                await this.runSubActivityInIsolation(async () => {
                    await this.announce(announcement);
                });
            }
        }, 1000);

        this.onEnd(() => {
            console.log("Closing Game");
            this.manager.saveCurrentGame();
        });
    }

    protected async run() {
        this.setupGame();

        const roll = this.roll();

        const map = roll.add("Map", VoxvilleMapRegionActivity);
        roll.add("Find", async () => {
            const find = new VoxvilleFindBuildingActivity();
            const tile = await this.exec(find);
            if (tile != null) {
                await this.exec(new VoxvilleMapRegionActivity(tile));
                map.goto();
            }
        });
        roll.add("Build", VoxvilleBuildActivity);
        roll.add("Notifications", async () => {
            const noticeroll = this.roll();
            for (let notification of this._recentAnnouncements)
                noticeroll.add(notification.text);
            await noticeroll.run();
        }).showWhen(async () => this._recentAnnouncements.length > 0);
        roll.add("Resources", VoxvilleResourceOverviewActivity);

        if (this.startingTile) {
            await this.sayDynamicInfo("Welcome to your Village!");
            await this.exec(new VoxvilleMapRegionActivity(this.startingTile, this.descendStartingTile));
        }

        await roll.runBlockingLeft({isDynamic: false, isContentInformational: true});
    }
}