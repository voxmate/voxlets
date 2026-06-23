import {IActivityOptions, SimpleSayable} from "./orc";
import voxmate, {Actor, Gesture, IAudioResult, IPlayerStatus, Sound} from "../voxmate";
import {randomId} from "../utility/random";
import {formatDuration} from "../utility/strings";
import {TimerHandle} from "../types";

import {RolodexEntryBuilder} from "./rolodex";
import {RollActivity} from "./RollActivity";

const PLAYER_DISPOSED = "invalid player";
const QUICK_TELEPORT_TIMEOUT = 600;

const SHORT_FORWARD_JUMP = 15_000; // 15 seconds
const LONG_FORWARD_JUMP = 12 * SHORT_FORWARD_JUMP; // 3 minutes

export enum PlayerOptions {
    ContinuePlaying = 0,
    RestartPlayer = 1,
    SleepTimer = 2,
    Quit = 3
}

export enum SeekPastZero {
    WrapAround,
    SeekToStart
}

interface IBasePlayerOptions extends IActivityOptions {
    verbose?: boolean;
    seekPastZeroBehavior?: SeekPastZero;
}

export class SleepTimer {

    static readonly SLEEP_TIMER_FADE_SECONDS = 10;

    private readonly _promise: Promise<void>;

    private _sleeperHandle: TimerHandle;
    private _fadeOutLauncherHandle: TimerHandle;
    private _fadeOutHandle: TimerHandle;

    private _disposed: boolean = false;

    private _volume: number = 100;

    constructor(sleepTimeInMinutes: number, private readonly internal: boolean = false) {
        this._promise = new Promise<void>(resolve => {
            const sleepStart = sleepTimeInMinutes * 60 * 1000;
            this._sleeperHandle = setTimeout(() => {
                this.dispose(true);
                resolve();
            }, sleepStart);

            const fadeOut = Math.max(0, (sleepTimeInMinutes * 60 - SleepTimer.SLEEP_TIMER_FADE_SECONDS) * 1000);
            this._fadeOutLauncherHandle = setTimeout(() => {
                this.beginFadeOut();
            }, fadeOut);
        });
    }

    private beginFadeOut() {
        //MATH: 100^(-1/seconds) endLevel^(1/seconds) /. {seconds -> 10, endLevel -> 5} // N
        this._fadeOutHandle = setInterval(async () => {
            this._volume *= 0.74;
            if (this._volume < 1)
                clearInterval(this._fadeOutHandle);
        }, 1000);
    }

    sleep(): Promise<void> {
        return this._promise;
    }

    dispose(hard: boolean) {
        if (hard || this.internal) {
            this._disposed = true;
            if (this._sleeperHandle)
                clearInterval(this._sleeperHandle);

            if (this._fadeOutHandle)
                clearInterval(this._fadeOutHandle);

            if (this._fadeOutLauncherHandle)
                clearInterval(this._fadeOutLauncherHandle);
        }
    }

    get volume(): number {
        return this._volume;
    }

    get isDisposed(): boolean {
        return this._disposed;
    }
}

export abstract class BasePlayer<TResult = any> extends RollActivity<TResult> {

    private _playerReady: Promise<void> = Promise.resolve();
    private _playerReadySignal: (() => void) | null = null;

    private _playerId: string | null = null;
    private _playbackCompletion: Promise<IAudioResult> | null = null;

    private _volume: number = 100;
    private _seekDisabled = false;
    private _hint: SimpleSayable | null = null;

    private _sleepTimer: SleepTimer | null = null;
    private _sleepTimerQueryHandle: TimerHandle | null = null;
    private _sleepInterruptMode: boolean = false;
    private _sleepHalt = false;

    private _lastTeleportTs: number = 0;

    protected constructor(private readonly playerOptions: IBasePlayerOptions = {}) {
        super(playerOptions);
    }

    override async hint() {
        return this._hint;
    }

    override async help(): Promise<void> {

        await this.hint();

        if (!this._seekDisabled)
            await this.sayInfo("Use swipe up and down gestures to go back and forward in the audio file");
    }

    //region Overridable Properties

    protected abstract getPlayerResourceId(): string

    protected useStreamingPlayer(): boolean {
        return false;
    }

    protected getPlayerSpeed(): number {
        return 1;
    }

    protected async onUpdate(status: IPlayerStatus) {

    }

    protected async getInitialStatus(): Promise<IPlayerStatus | null> {
        return null;
    }

    protected override async init() {
        await super.init();

        this._playerReady = new Promise<void>(resolve => {
            this._playerReadySignal = resolve;
        });

        try {
            const resourceId = this.getPlayerResourceId();
            const streaming = this.useStreamingPlayer();

            this._playerId = await this.wrap(voxmate.audio.player.init(resourceId, streaming));

            this.onEnd(async () => { // Make sure the player is terminated
                voxmate.audio.player.dispose(this._playerId!);
            });

            await this.wrap(voxmate.audio.player.prep(this._playerId!));
            if (this._playerReadySignal) {
                this._playerReadySignal();
            }

        } catch (e) {
            if (this.isFlowControl(e))
                throw e;
            console.warn("Unable to start Player", e);
        }
    }

    protected disableSeek() {
        this._seekDisabled = true;
    }

    protected enableHint(sayable: SimpleSayable = "During playback, swipe right for more options") {
        this._hint = sayable;
    }

    protected async getSleepTimerDurationInMinutes(): Promise<number> {
        return 1;
    }

    protected async endOnSeekBack(longSeekBack: boolean): Promise<TResult | undefined> {
        return undefined;
    }

    protected async finished(): Promise<TResult | null> {
        return null;
    }

    protected async rightAction(): Promise<PlayerOptions> {
        return PlayerOptions.ContinuePlaying;
    }

    protected get playerId(): string | null {
        return this._playerId;
    }

    async setSleepTimer(timer: SleepTimer) {

        await this._playerReady;

        await this.stopSleeperTimer(false, true, timer.volume);

        if (timer.isDisposed) {
            await this.updateVolume(100);
            return;
        }

        this._sleepTimer = timer;
        await this.updateVolume(timer.volume);

        const handle = this._sleepTimerQueryHandle = setInterval(async () => {
            await this.bindContext(async () => {
                await this.updateVolume(this._sleepTimer!.volume);
            });
        }, 1000);

        this.onEnd(() => {
            clearInterval(handle);
        });

        timer.sleep().then(() => {
            if (!this.ended && handle === this._sleepTimerQueryHandle) {
                if (this._sleepInterruptMode) {
                    voxmate.input.rejectObject(JSON.stringify({"action": "sleep"}));
                } else {
                    this._sleepHalt = true;
                }
            }
        });
    }

    //endregion

    private async updateVolume(volume: number) {
        if (volume != this._volume) {
            await this.wrap(voxmate.audio.player.setVolume(this._playerId!, volume));
            this._volume = volume;
        }
    }

    private async stopSleeperTimer(announce: boolean, internal: boolean, volume?: number) {

        if (this._sleepTimerQueryHandle) {
            clearTimeout(this._sleepTimerQueryHandle);
            this._sleepTimer?.dispose(!internal);
            this._sleepTimer = null;
            this._sleepTimerQueryHandle = null;
            if (announce) {
                await this.sayInfo(`Cleared sleep timer`);
            }
        }

        await this.updateVolume(volume || 100);
    }

    async setSleepTimerInteractive(): Promise<boolean> {

        const durations = [
            // {"name": "half a minute test timer", "value": 0.5}, //TODO: REMOVE
            {"name": "5 Minutes", "value": 5},
            {"name": "10 Minutes", "value": 10},
            {"name": "15 Minutes", "value": 15},
            {"name": "20 Minutes", "value": 20},
            {"name": "30 Minutes", "value": 30},
            {"name": "45 Minutes", "value": 45},
            {"name": "1 Hour", "value": 60},
            {"name": "1 Hour 20 minutes", "value": 80},
            {"name": "1 Hour 40 minutes", "value": 100},
            {"name": "2 Hours", "value": 120},
        ];

        const dex = this.roll().setActor(Actor.Content);
        for (let duration of durations) {
            dex.add(duration.name, async () => duration.value);
        }

        const minutes = await dex.run();
        if (minutes === undefined)
            return false;

        await this.setInternalSleepTimer(minutes);
        return true;
    }

    async setInternalSleepTimer(sleepTime: number) {
        await this.setSleepTimer(new SleepTimer(sleepTime, true));
        let unit = "minute";
        if (sleepTime != 1)
            unit += "s";
        await this.sayDynamicInfo(`Your timer is set for ${sleepTime} ${unit}`);
    }

    private async updatePlayerSpeed() {
        const speed = this.getPlayerSpeed();
        await this.wrap(voxmate.audio.player.setSpeed(this._playerId!, speed));
    }

    private async continuePlaying(status?: IPlayerStatus, position?: number) {

        if (status) {
            if (position !== undefined && status.duration > 0) {
                let newPosition: number;
                if (position < 0) {
                    const status = await this.getStatus();
                    const duration = status?.duration ?? 0;
                    if (duration > 0)
                        newPosition = Math.max(0, Math.min(duration + position, duration));
                    else newPosition = 0;
                } else {
                    newPosition = Math.max(0, Math.min(position, status.duration - 1));
                }

                if (!this._seekDisabled) {
                    await this.wrap(voxmate.audio.player.setPosition(this._playerId!, newPosition));
                }
            } else {
                if (status.duration < 0 && !this.useStreamingPlayer())
                    console.warn("Unknown duration. Duration not yet ready?. Was targeting position => " + position);
            }

            await this.updateVolume(this._volume || 100);
        }

        await this.updatePlayerSpeed();
        if (this._sleepHalt) {
            await this.stopSleeperTimer(false, false);
            await this.get(); // This is sleep, so let's just quietly wait for input
            await this.updateVolume(100);
        }

        this._sleepHalt = false;
        this._playbackCompletion = this.wrap(voxmate.audio.player.play(this._playerId!));
    }

    private async getStatus(): Promise<IPlayerStatus | null> {
        return await this.wrap(voxmate.audio.player.getStatus(this._playerId!));
    }

    private async teleport(isBack: boolean): Promise<number> {

        const sign = isBack ? -1 : 1;

        const now = new Date().getTime();
        if (now - this._lastTeleportTs >= QUICK_TELEPORT_TIMEOUT) {
            this._lastTeleportTs = now;
            return sign * 10 * 1000;
        }

        this._lastTeleportTs = now;
        let latestId: string | null = null;
        const set = () => {
            const id = randomId();
            latestId = id;
            return id;
        };

        const durations = [20, 30, 60, 120, 5 * 60, 60 * 10, 20 * 60, 30 * 60, 60 * 60, 2 * 60 * 60];
        let directionPrefix = isBack ? "go back " : "skip forward ";
        let directionSuffix = isBack ? "back " : "forward ";

        if (isBack)
            durations.reverse();

        const dex = this.roll();

        let fistDex: RolodexEntryBuilder | null = null;
        let lastDex: RolodexEntryBuilder | null = null;

        for (let i = 0; i < durations.length; i++) {
            let duration = durations[i];

            lastDex = dex.add(async () => {

                if (duration === Number.POSITIVE_INFINITY) {
                    dex.unwind(duration);
                    return;
                }

                let durationQuantity = duration;
                let durationUnit = "seconds";

                if (duration >= 60) {
                    durationQuantity = durationQuantity / 60;
                    durationUnit = "minute";
                    if (durationQuantity > 1)
                        durationUnit += "s";
                }

                if (durationQuantity >= 60) {
                    durationQuantity = durationQuantity / 60;
                    durationUnit = "hour";
                    if (durationQuantity > 1)
                        durationUnit += "s";
                }

                if (directionPrefix) {
                    const say = this.sayDynamicInfo(`${directionPrefix}${durationQuantity} ${durationUnit}`);
                    directionPrefix = "";
                    await say;
                } else {
                    const say = this.sayDynamicInfo(`${durationQuantity} ${durationUnit} ${directionSuffix}`);
                    await say;
                }

                const id = set();
                await this.getWithTimeout(600);
                if (id == latestId)
                    dex.unwind(duration);

            }, async () => duration);

            if (fistDex === null)
                fistDex = lastDex;
        }

        // Continuation sentinel

        if (!isBack) {
            dex.add(async () => {
                voxmate.audio.sound(Sound.Separator);
                lastDex!.goto();
            });
        }

        dex.add(async () => dex.unwind(0));

        if (isBack) {
            dex.add(async () => {
                voxmate.audio.sound(Sound.Separator);
                fistDex!.goto();
            });
        }

        lastDex!.first(isBack);

        const out = await dex.run();
        return sign * (out ?? 0) * 1000;
    }

    protected async run(): Promise<TResult | null | void> {

        const playerId = this._playerId;

        if (playerId === null) {
            await this.sayInfo("Unable to start playback");
            return null;
        }

        const watcherHandle = this.setInterval(async () => {
            try {
                const status = await this.getStatus();
                if (status) await this.onUpdate(status);
            } catch (e) {

                if (this.isFlowControl(e))
                    throw e;

                if (e == PLAYER_DISPOSED) {
                    watcherHandle();
                } else {
                    console.log(e);
                }
            }
        }, 5000);

        this.onEnd(async () => {
            await this.stopSleeperTimer(false, true);
        });

        const initial = await this.getInitialStatus();

        if (initial && initial.position > 0) {
            const durationString = formatDuration(initial.position);
            if (this.playerOptions.verbose)
                await this.sayDynamicContent(`Resuming from ${durationString} mark`);
        }

        let startingPosition = 0;
        if (initial) startingPosition = initial.position;

        await this.continuePlaying(initial ?? undefined, startingPosition);

        try {
            while (this.isActive) {
                let audio: IAudioResult | null = null;
                try {
                    this._sleepInterruptMode = true;
                    audio = await this._playbackCompletion!;
                } catch (e) {

                    if (this.isFlowControl(e))
                        throw e;

                    if (e != PLAYER_DISPOSED) {
                        // noinspection ExceptionCaughtLocallyJS
                        throw e;
                    }
                } finally {
                    this._sleepInterruptMode = false;
                }


                if (audio && audio.interruptionInput) {
                    const ui = audio.interruptionInput;

                    if (await this.orchestrator.handleSpecialUserInput(ui))
                        return null;

                    const status = await this.getStatus();
                    let position: number = status?.position ?? 0;
                    let longSeekBack = false;

                    if (ui.kind == "gesture") {

                        const gesture = ui.gesture;

                        switch (gesture) {

                            case Gesture.DoubleUp:
                            case Gesture.Hat:
                                if (!this._seekDisabled) {
                                    position -= LONG_FORWARD_JUMP;
                                    longSeekBack = true;
                                }
                                break;

                            case Gesture.Up:
                                if (!this._seekDisabled) {
                                    const distance = await this.teleport(true);
                                    position += distance;
                                }
                                break;

                            case Gesture.Down:
                                if (!this._seekDisabled) {
                                    const distance = await this.teleport(false);
                                    position += distance;
                                }
                                break;

                            case Gesture.DoubleDown:
                                if (!this._seekDisabled) {
                                    position += LONG_FORWARD_JUMP;
                                }
                                break;

                            case Gesture.Right:

                                await this.stopSleeperTimer(true, false);

                                const action = await this.runSubActivity(async () => {
                                    return await this.rightAction() ?? PlayerOptions.ContinuePlaying;
                                });

                                if (action === PlayerOptions.RestartPlayer) {
                                    if (!this._seekDisabled) {
                                        await this.sayInfo("Restarting...");
                                        position = 0;
                                    }
                                }

                                if (action === PlayerOptions.SleepTimer) {
                                    const sleepTime = await this.getSleepTimerDurationInMinutes();
                                    await this.setInternalSleepTimer(sleepTime);
                                }

                                if (action === PlayerOptions.Quit) {
                                    watcherHandle();
                                    await this.stopSleeperTimer(false, true);
                                    return await this.finished();
                                }

                                break;
                        }

                        if (position <= 0) {
                            const end = await this.endOnSeekBack(longSeekBack);
                            if (end !== undefined) {
                                return end;
                            }
                        }

                        if (position <= 0) {
                            if (this.playerOptions.seekPastZeroBehavior === SeekPastZero.SeekToStart)
                                position = 0;
                        }

                        if (position != (status?.position ?? 0) && !this._seekDisabled)
                            voxmate.audio.sound(Sound.SoftClick);

                        await this.continuePlaying(status ?? undefined, position);

                    } else if (ui.kind == "object") {

                        const object = ui.object;

                        if (object.action === "sleep") {
                            await this.stopSleeperTimer(false, false);
                            await this.get(); // This is sleep, so let's just quietly wait for input
                            position -= 10 * 1000;
                            position = Math.max(0, position);
                            await this.updateVolume(100);
                        }

                        await this.continuePlaying(status ?? undefined, position);

                    } else {
                        await this.continuePlaying();
                    }


                } else {

                    if (this.playerOptions.verbose)
                        await this.sayInfo("Finished playing");

                    watcherHandle();
                    return await this.finished();
                }
            }
        } catch (e) {

            if (this.isFlowControl(e))
                throw e;

            if (e != PLAYER_DISPOSED) {
                await this.handleError(e);
            }
        }

        return await this.finished();
    }

    async handleError(e: unknown) {
        await this.sayInfo("There was a problem with playback");
        throw e;
    }
}

export class SimpleResourcePlayer extends BasePlayer {

    constructor(private readonly resourceId: string) {
        super();
    }

    protected override async rightAction(): Promise<PlayerOptions> {
        return PlayerOptions.Quit;
    }

    protected getPlayerResourceId(): string {
        return this.resourceId;
    }
}