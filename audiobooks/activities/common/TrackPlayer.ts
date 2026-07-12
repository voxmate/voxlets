import {BasePlayer, PlayerOptions, SleepTimer} from "@voxmate/orc/player";
import {Actor, IPlayerStatus, Sound} from "@voxmate/voxmate";
import {RollActivity} from "@voxmate/orc/RollActivity";
import {Activity} from "@voxmate/orc/orc";
import {ResourceCache} from "../../ResourceCache";

type SleepTimerManagerUpdate = (timer: SleepTimer) => Promise<void>;
type SleepTimerManagerDeregisterFunction = () => void;

export const SLEEP_TIMER_DURATIONS = [5, 10, 15, 20, 25, 30, 40, 45, 60, 90, 120];

export interface IMultiTrackBook {
    trackCount: number;
    trackComplete: boolean[];
    currentTrackPosition: number;
    playbackSpeed: number;
    lastListenedTimestamp: number;
}

enum TrackPlayerResult {
    ContinuePlaying,
    RewindBackwards,
    GoToPreviousTrack,
    GoToNextTrack,
    RestartCurrentTrack
}

export class SleepTimerManager {

    private _timer: SleepTimer;
    private _callbacks: SleepTimerManagerUpdate[] = [];
    private _disposed = false;
    private _halt = false;
    private _isSet = false;

    constructor(readonly activity: Activity) {
    }

    get isTimerSet() {
        return this._isSet;
    }

    get timer() {
        return this._timer;
    }

    startNewTimer(duration: number) {
        if (this._disposed)
            return;

        if (this._timer)
            this.timer.dispose(true);

        const timer = this._timer = new SleepTimer(duration, false);
        this._isSet = true;

        timer.sleep().then(() => {
            if (this._timer === timer) {
                this._isSet = false;
            }
        });

        for (let fn of this._callbacks)
            setTimeout(async () => await fn(timer), 0);
    }

    async register(callback: SleepTimerManagerUpdate): Promise<SleepTimerManagerDeregisterFunction> {
        this._callbacks.push(callback);

        if (this._timer)
            await callback(this._timer);

        return () => {
            const idx = this._callbacks.indexOf(callback);
            this._callbacks.splice(idx, 1);
        };
    }

    dispose() {
        if (this._timer && !this._timer.isDisposed) {
            this._halt = true;
            this._timer.dispose(true);
        }

        this._disposed = true;
        this._isSet = false;
    }

    get halt() {
        return this._halt;
    }
}

class TrackPlayer extends BasePlayer<TrackPlayerResult> {

    get cache(): ResourceCache {
        return this[ResourceCache.inject];
    }

    private exitResult: TrackPlayerResult = null;
    private resourceId: string;

    constructor(private readonly book: IMultiTrackBook,
                private readonly track: number,
                private readonly trackNoun: string,
                private readonly trackDescriptor: string,
                private readonly resourceIdLoadTask: Promise<string>,
                private readonly sleepTimerManager: SleepTimerManager) {
        super({freezeQuietly: sleepTimerManager.isTimerSet});
        this.enableHint();
    }

    protected async endOnSeekBack(longSeekBack): Promise<TrackPlayerResult> {
        if (longSeekBack)
            return TrackPlayerResult.RestartCurrentTrack;
        return TrackPlayerResult.RewindBackwards;
    }

    protected async init(): Promise<any> {
        const trackUrl = await this.resourceIdLoadTask;
        if (trackUrl.startsWith("http")) {
            const cachedResourceId = this.cache.getCached(trackUrl);
            if (cachedResourceId != null) {
                this.resourceId = cachedResourceId;
            } else {
                this.setTimeout(async () => {
                    await this.cache.saveToCache(trackUrl);
                });
                this.resourceId = trackUrl;
            }
        }

        await super.init();

        this.onEnd(await this.sleepTimerManager.register(async () => {
            await this.setSleepTimer(this.sleepTimerManager.timer);
        }));
    }

    protected getPlayerSpeed(): number {
        return this.book.playbackSpeed;
    }

    protected async onUpdate(status: IPlayerStatus) {
        await super.onUpdate(status);
        this.book.currentTrackPosition = status.position;
        this.book.lastListenedTimestamp = new Date().getTime();
    }

    protected getPlayerResourceId(): string {
        return this.resourceId;
    }

    protected async rightAction(): Promise<PlayerOptions> {

        await this.sayDynamicInfo(`You are listening to ${this.trackDescriptor}`);

        const roll = this.roll().setActor(Actor.Content);

        roll.add("Sleep Timer", async () => {
            const timers = this.roll();

            for (let duration of SLEEP_TIMER_DURATIONS)
                timers.add(duration + " Minutes", async () => duration);

            const durationInMinutes = await timers.run();
            if (durationInMinutes !== undefined) {
                this.sleepTimerManager.startNewTimer(durationInMinutes);
                roll.unwind();
            }
        });

        roll.add("Go To Beginning of this " + this.trackNoun, async () => {
            this.exitResult = TrackPlayerResult.RestartCurrentTrack;
            return PlayerOptions.Quit;
        });

        roll.add("Go To Previous " + this.trackNoun, async () => {
            this.exitResult = TrackPlayerResult.GoToPreviousTrack;
            return PlayerOptions.Quit;
        }).showWhen(async () => this.track > 0);

        roll.add("Go To Next " + this.trackNoun, async () => {
            this.exitResult = TrackPlayerResult.GoToNextTrack;
            return PlayerOptions.Quit;
        }).showWhen(async () => this.track < this.book.trackCount - 1);

        roll.add("Set Playback Speed", async () => {
            const speeds = this.roll();

            speeds.add("Normal Speed", async () => 1);
            speeds.add("25% Faster", async () => 1.25);
            speeds.add("50% Faster", async () => 1.5);
            speeds.add("Double Speed", async () => 2);

            const speed = await speeds.run();
            if (speed) {
                this.book.playbackSpeed = speed;
                roll.unwind();
            }
        });

        return await roll.run();
    }

    protected async getInitialStatus(): Promise<IPlayerStatus | null> {
        return {
            position: this.book.currentTrackPosition,
            duration: Math.max(this.book.currentTrackPosition + 1, 1),
            speed: this.book.playbackSpeed
        };
    }

    protected async finished(): Promise<TrackPlayerResult> {
        return this.exitResult || TrackPlayerResult.ContinuePlaying;
    }
}

export abstract class AudiobookMultiTrackPlayerActivity<TBook extends IMultiTrackBook> extends RollActivity {

    readonly sleepTimerManager = new SleepTimerManager(this);

    constructor(private readonly book: TBook) {
        super();
        this.onEnd(() => {
            this.sleepTimerManager.dispose();
        });
    }

    abstract getTrackResourceId(book: TBook, trackIndex: number): Promise<string>

    getTrackNoun() {
        return "Track";
    }

    getTrackDescriptor(book: TBook, trackIndex): string {
        return this.getTrackNoun() + " " + (trackIndex + 1);
    }

    protected async run(): Promise<void | any> {

        // Determine Current Position in the Book
        for (let track = 0; track < this.book.trackCount; ++track) {
            const complete = this.book.trackComplete[track];
            if (!complete) {

                const trackResourceId = this.getTrackResourceId(this.book, track);
                const descriptor = this.getTrackDescriptor(this.book, track);
                const noun = this.getTrackNoun();
                const player = new TrackPlayer(this.book, track, noun, descriptor, trackResourceId, this.sleepTimerManager);

                const task = this.exec(player);

                const result = await task as TrackPlayerResult;

                if (result === undefined) { // Left Swipe, just exit
                    return;
                }

                if (result == TrackPlayerResult.ContinuePlaying || result == TrackPlayerResult.GoToNextTrack) {
                    this.book.trackComplete[track] = true;
                    this.book.currentTrackPosition = 0;
                    continue;
                }

                if (result == TrackPlayerResult.GoToPreviousTrack) {
                    this.book.currentTrackPosition = 0;
                    if (track > 0) {
                        this.book.trackComplete[track - 1] = false;
                        track -= 2;
                    } else {
                        track -= 1;
                    }
                    continue;
                }

                if (result == TrackPlayerResult.RestartCurrentTrack) {
                    track -= 1;
                    this.book.currentTrackPosition = 0;
                    continue;
                }

                if (result === TrackPlayerResult.RewindBackwards) {
                    this.book.currentTrackPosition = -20000;
                    if (track > 0) {
                        this.book.trackComplete[track - 1] = false;
                        track -= 2;
                    } else {
                        track -= 1;
                    }
                    continue;
                }
            }
        }

        // When reached here, the books is finished, but we can start from the beginning:

        for (let i = 0; i < this.book.trackCount; ++i)
            this.book.trackComplete[i] = false;

        this.book.currentTrackPosition = 0;
        this.sound(Sound.EndContent);
        return undefined;
    }
}