import {RPCSocketActivity, subscribe} from "./RPCSocketActivity";
import {ControllablePromise, currentTimeMillis} from "../utility/common";
import {CancellationToken, GameRoomConstants, GameRoomStatus} from "./RPCUtility";
import {DeregisterFunction, Gesture, Sound} from "../voxmate";
import {Activity} from "./orc";
import {RollActivity} from "./RollActivity";

export abstract class GameRoomActivity extends RPCSocketActivity {

    static AbandonGame = Symbol("Abandon Game");

    private _status: GameRoomStatus = GameRoomStatus.Gathering;
    private _statusActivity: Activity = null;
    private readonly _gameEnded = new ControllablePromise();

    @subscribe(GameRoomConstants.infoChannel)
    private async remoteInfo(message: string) {
        await this.runSubActivityInIsolation(async (activity) => {
            await activity.sayDynamicInfo(message);
            activity.poke();
        });
    }

    @subscribe(GameRoomConstants.contentChannel)
    private async remoteContent(message: string) {
        await this.runSubActivityInIsolation(async (activity) => {
            await activity.sayDynamicContent(message);
            activity.poke();
        });
    }

    @subscribe(GameRoomConstants.roomClosing, false)
    private async onRoomClosing(reason: string | null) {
        this._gameEnded.resolve();
        if (reason) {
            await this.runSubActivityInIsolation(async (activity) => {
                await activity.sayDynamicInfo(reason);
            });
        }
    }

    @subscribe(GameRoomConstants.roomStatus, false)
    private setStatus(status: GameRoomStatus) {

        if (this._status !== status)
            if (this._statusActivity)
                this._statusActivity.end(undefined);

        this._status = status;
        if (status === GameRoomStatus.GameOver) {
            console.log("Got room status => Game Over");
            this._gameEnded.resolve();
        }
    }

    protected async init(): Promise<void> {
        await super.init();
        this.setStatus(await this.rpc(GameRoomConstants.getRoomStatus));
    }

    protected async registerPlayerAction<T>(cancel: CancellationToken, task: Promise<T>): Promise<T> {

        const tickSoundThreshold = 20000;
        const tickFastThreshold = 10000;
        const timerIsEnabled = (cancel.timeout !== undefined) && cancel.timeout > 0;

        const timeouts: DeregisterFunction[] = [];

        let triggeredSound = false;

        try {

            if (timerIsEnabled) {
                const timeRemaining = cancel.timeout - currentTimeMillis();
                if (timeRemaining >= tickSoundThreshold) {
                    timeouts.push(this.setTimeout(() => {
                        triggeredSound = true;
                        this.sound(Sound.Tick);
                    }, timeRemaining - tickSoundThreshold));
                }

                if (timeRemaining >= tickFastThreshold) {
                    timeouts.push(this.setTimeout(() => {
                        triggeredSound = true;
                        this.sound(Sound.TickFast);
                    }, timeRemaining - tickFastThreshold));
                }
            }

            const result = await this.withCancellation(cancel, task);

            if (triggeredSound)
                this.sound(Sound.StopSounds);

            if (result.cancelled == true)
                return undefined;

            return result.result;

        } finally {
            for (let timeout of timeouts)
                timeout();
        }

        await this.haltIfEnded();
    }

    protected async gameEnded() {
        await this._gameEnded;
    }

    get isGameOver(): boolean {
        return this._gameEnded.resolved;
    }

    get playing(): boolean {
        return !this.isGameOver;
    }

    private async makeCurrentStatusActivity(): Promise<Activity | undefined> {
        switch (this._status) {
            case GameRoomStatus.Gathering:
                return this.makeGatheringActivity();
            case GameRoomStatus.Playing:
                return this.makePlayingActivity();
        }
        return undefined;
    }

    async runConnected() {

        while (this.playing && this.isActive) {
            const activity = await this.makeCurrentStatusActivity();
            if (activity) {

                this._statusActivity = activity;
                try {
                    const result = await this.withCancellation(this.gameEnded(), this.exec(activity));
                    if (result.cancelled) {
                        activity.end(undefined);
                    }
                } catch (e) {
                    if (e == GameRoomActivity.AbandonGame) {
                        return "abandon";
                    } else throw e;
                }
            } else {
                throw new Error(`Unable to create activity for current status (${this._status})`);
            }
        }

        await this.gameEnded();
        //TODO: Verify that this is needed
        //this.endAllActivitiesAbove();
        await this.runGameResultActivity();
    }

    private makeDefaultHungActivity(): Activity<boolean> {

        return new class extends RollActivity {

            protected async run(): Promise<void | any> {
                await this.execOutsideNavigationalScope(async () => {
                    while (this.isActive) {
                        const ui = await this.get();

                        if (ui.kind == "gesture") {
                            if (ui.gesture === Gesture.Poke)
                                continue;

                            if (ui.gesture === Gesture.DoubleLeft)
                                throw GameRoomActivity.AbandonGame;
                        }

                        await this.sayDynamicInfo("Please wait for your turn. Double swipe left to forfeit the game.");
                    }
                });
            }
        };
    }

    async makeGatheringActivity(): Promise<Activity> {
        return this.makeDefaultHungActivity();
    }

    async makePlayingActivity(): Promise<Activity> {
        return this.makeDefaultHungActivity();
    }

    protected async runGameResultActivity() {
        await this.sayInfo("Game over");
    }
}