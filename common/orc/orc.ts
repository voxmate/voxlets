import {
    Actor,
    AnyFunction,
    DeregisterFunction,
    EN,
    Gesture,
    HapticSignal,
    IAudioResult,
    IGeoLocation,
    IHttpResult,
    IPrompt,
    ISpeechOptions,
    IVoxmatePromise,
    IVoxmateSettings,
    RecordingId,
    Sound,
    UserInput,
    VoiceInputMode,
    voxmate,
    VoxmateFeature,
    VoxmatePermission
} from "../voxmate";

import {ControllablePromise, toArray} from "../utility/common";
import {removeArrayElement} from "../utility/array";
import {IDict} from "../utility/types";
import {zoning} from "../utility/zone";
import {AsyncAction} from "./types";

const ORC_LS_NAMESPACE = "__voxmate_orc";

class HttpError extends Error {
    constructor(readonly code: string) {
        super();
    }
}


// region Interfaces

const orchestrator = Symbol("orchestrator");
export const CascadeEnd = Symbol("Cascade End");
export const RestartOrc = Symbol("Restart Orchestrator");
const UnWrap = Symbol("UnWrap");

const NOOP = () => {
};

const LOADING_PROMPT: IPrompt = {[EN]: "Loading, please wait"};
const LOADING_ERROR_PROMPT: IPrompt = {[EN]: "An error has occurred while loading"};
const NO_CONTEXTUAL_HELP: IPrompt = {[EN]: "There's no contextual help available right now."};
const NO_VOICE_COMMANDS: IPrompt = {[EN]: "There are no voice commands available."};


export class IntrinsicError extends Error {
    constructor(readonly code: string) {
        super();
    }

    override toString() {
        return this.code;
    }

    override valueOf() {
        return this.code;
    }
}

function isMissingPermission(err: IntrinsicError): null | VoxmatePermission {
    const e = err.message;
    const mpp = "missing-permission-";
    if (e && typeof e == "string" && e.startsWith("permission-missing-")) {
        return e.substr(mpp.length) as VoxmatePermission;
    }
    return null;
}

interface Link {
    previous: Link | null;
    activity: Activity;
    stack: Activity[];
}

export interface IExtendedSpeechOptions extends ISpeechOptions {
    forwardInterrupt?: boolean; // Recycles Interrupts, effectively re-throwing it in the future on same VM.
}

const HALT_SENTINEL = Symbol("HALT");

// A swipe acted on within this window is still what the user meant; replaying
// anything older mistargets the next prompt instead.
const INPUT_REPLAY_TTL_MS = 1500;

const liveSayGroups = new Set<symbol>();

interface InputTap {
    predicate: (ui: UserInput) => boolean;
    handler: (ui: UserInput) => void;
}

class InputChannel {

    private _disposed = false;
    private inputAwaiter: ControllablePromise<UserInput> | null = null;
    private pending: { ui: UserInput, at: number } | null = null;
    private taps: InputTap[] = [];
    private observers: ((ui: UserInput) => void)[] = [];

    input(ui: UserInput): boolean {

        for (const observer of [...this.observers])
            observer(ui);

        for (let i = this.taps.length - 1; i >= 0; --i) {
            const tap = this.taps[i];
            if (tap.predicate(ui)) {
                tap.handler(ui);
                return true;
            }
        }

        if (this.inputAwaiter && !this.inputAwaiter.resolved) {
            this.inputAwaiter.resolve(ui);
            this.inputAwaiter = null;
            return true;
        }

        if (this._disposed)
            return false;

        this.pending = {ui: ui, at: Date.now()};
        return true;
    }

    requeue(ui: UserInput) {
        if (!this._disposed)
            this.pending = {ui: ui, at: Date.now()};
    }

    next(): Promise<UserInput> {

        if (this._disposed) {
            const promise = new ControllablePromise<UserInput>();
            promise.reject(HALT_SENTINEL);
            return promise;
        }

        const replay = this.takeFreshPending();
        if (replay) {
            const promise = new ControllablePromise<UserInput>();
            promise.resolve(replay);
            return promise;
        }

        this.inputAwaiter = new ControllablePromise<UserInput>();
        return this.inputAwaiter;
    }

    release(awaiter: Promise<UserInput>) {
        if (this.inputAwaiter === awaiter)
            this.inputAwaiter = null;
    }

    tap(predicate: (ui: UserInput) => boolean, handler: (ui: UserInput) => void): DeregisterFunction {
        const tap: InputTap = {predicate: predicate, handler: handler};
        this.taps.push(tap);
        return () => removeArrayElement(this.taps, tap);
    }

    observe(handler: (ui: UserInput) => void): DeregisterFunction {
        this.observers.push(handler);
        return () => removeArrayElement(this.observers, handler);
    }

    private takeFreshPending(): UserInput | null {
        const pending = this.pending;
        this.pending = null;
        if (pending && Date.now() - pending.at < INPUT_REPLAY_TTL_MS)
            return pending.ui;
        return null;
    }

    dispose() {
        this._disposed = true;
        this.pending = null;
        this.taps = [];
        this.observers = [];
        if (this.inputAwaiter)
            this.inputAwaiter.reject(HALT_SENTINEL);
    }
}

export interface IActivityConstructor<T extends Activity = Activity> {
    new(...parameters: any[]): T;
}


export interface IService {

}

export interface IServiceConstructor<TActivity = Activity> {
    new(root: Activity): IService;

    inject: symbol;
}

export interface IActivityOptions {
    voiceInputMode?: VoiceInputMode;
    loadingPrompt?: string | IPrompt;
    loadingErrorPrompt?: string | IPrompt;

    isSubordinate?: boolean;
    freezeQuietly?: boolean;
    cascade?: boolean;
}

export type SimpleSayable = string | IPrompt
export type Sayable = SimpleSayable | Promise<string> | Promise<IPrompt>

export type Maker<T> = () => T | Promise<T>
export type NameFunction = () => (Promise<string> | Promise<IPrompt>)
export type ItemName = Sayable | NameFunction

export interface ISayItem {
    text: Sayable;
    actor: Actor;
    options?: ISpeechOptions;
}

export interface ISayRequest {
    text: Sayable;
    options?: ISpeechOptions;
}


export class Exit {
    constructor(readonly code: number) {
    }
}

interface Context {
    activity: Activity;
    group?: symbol;
}

class GroupInterruptToken extends Error {
    constructor(readonly group: symbol, readonly ui: UserInput) {
        super("Group Interrupt Token");
    }
}

interface ISymbolicInjection {
    symbol: symbol;
    value: any;
}

export type CancellableOperationResult<T> =
    { cancelled: false, result: T }
    | { cancelled: true }

let GlobalOrchestrator: Orchestrator | undefined = undefined;

export class MissingVoxmatePermission extends Error {
    constructor(readonly permission: VoxmatePermission) {
        super(`Missing Permission ${permission}`);
    }
}

export class Orchestrator {

    private chain: Link | null = null;

    private unsubscribeFromUserInputs: DeregisterFunction | null = null;
    private unsubscribeFromEvents: DeregisterFunction | null = null;
    private fail = new ControllablePromise();

    private readonly zones = zoning<Context>();
    private readonly requiredFeatures: VoxmateFeature[] = ["beta-update-6"];
    private readonly injections: IDict = {};
    private readonly symbolicInjections: ISymbolicInjection[] = [];

    private _isNavigationSuspended = false;
    private _lastUserInputSequence = -1;
    private _lastUserInput: UserInput | null = null;

    private _voxmateSettings: IVoxmateSettings | undefined = undefined;
    private _voxletSettings: any = undefined;

    readonly environment = voxmate.environment.info();

    private async delegateActionToActivity(activity: Activity, action: (activity: Activity) => Promise<any>): Promise<any> {
        try {
            return await this.wrap({activity: activity}, () => action(activity));
        } catch (e) {
            activity.endWithError(e);
        }
    }

    private async delegateToManagingActivity(action: (activity: Activity) => Promise<any>): Promise<any> {

        if (!this.chain)
            return;

        const activity = this.getManagingActivity()!;
        return this.delegateActionToActivity(activity, action);
    }

    private async delegateToTopActivity(action: (activity: Activity) => Promise<any>): Promise<any> {

        if (!this.chain)
            return;

        const activity = this.getTopActivity()!;
        return this.delegateActionToActivity(activity, action);
    }

    private async invokeHelp() {
        await this.delegateToManagingActivity(async (activity) => {

            if (activity.isRunningHelp)
                return;

            activity.isRunningHelp = true;
            await activity.haltIfEnded();

            await activity.runSubActivityInIsolation(async () => {
                await activity.invokeHelp();
                activity.isRunningHelp = false;
            });

            activity.poke();
        });
    }

    private rejectObject(any: any | undefined): any | undefined {
        if (any)
            voxmate.input.rejectObject(JSON.stringify(any));
        return any;
    }

    private async handleRecording(recordingId: RecordingId) {
        const obj = await this.delegateToManagingActivity(async (activity) => {
            if (activity.voiceInputMode === VoiceInputMode.RecordInput)
                return await activity.onRecording(recordingId);
        });
        return this.rejectObject(obj);
    }

    private async handleCommand(command: string) {
        const obj = await this.delegateToManagingActivity(async (activity) => {
            const commandMode = activity.voiceInputMode === VoiceInputMode.CommandInput;
            const dictationMode = activity.voiceInputMode === VoiceInputMode.DictationInput;
            if (commandMode || dictationMode)
                return await activity.onVoiceCommand(command);
        });
        return this.rejectObject(obj);
    }

    private updateSettings(settings: IVoxmateSettings) {
        this._voxmateSettings = settings;
    }

    private beginMonitoringEvents() {

        voxmate.input.setGestureScopingIntent([Gesture.CircleClockwise]);
        voxmate.input.setCommandScopingIntent(true);
        voxmate.input.setRecordingScopingIntent(true);

        this.unsubscribeFromUserInputs = voxmate.input.subscribe(async ui => {
            await this.input(ui);
        }, false);

        this.unsubscribeFromEvents = voxmate.events.subscribe(event => {
            if (event.kind === "settings")
                this.updateSettings(event.settings);
        });

        this.resumeNavigation();
    }

    async handleSpecialUserInput(ui: UserInput | null): Promise<boolean> {

        if (!ui)
            return false;

        this._lastUserInput = ui;

        try {

            this._lastUserInputSequence = ui.sequence;

            if (ui.kind == "gesture") {
                if (!this._isNavigationSuspended) {
                    if (ui.gesture === Gesture.DoubleLeft || ui.gesture === Gesture.Left) {
                        this.popTopActivity();
                        return true;
                    }
                }

                if (ui.gesture === Gesture.CircleClockwise) {
                    await this.invokeHelp();
                    return true;
                }
            }

            if (ui.kind == "recording") {
                await this.handleRecording(ui.recordingId);
                return true;
            }

            if (ui.kind == "command") {
                await this.handleCommand(ui.transcript);
                return true;
            }

            return false;

        } catch (e) {
            this.fail.reject(e);
        }

        return false;
    }

    async input(ui: UserInput) {

        if (ui.isInterrupt)
            return;

        const handled = await this.handleSpecialUserInput(ui);

        if (handled)
            return;

        await this.delegateToTopActivity(async activity => {
            if (!activity.input(ui))
                console.error(`Input ${ui.kind} undeliverable to top activity, dropped`);
        });
    }

    inject(property: string, value: any): this {
        this.injections[property] = value;
        return this;
    }

    injectAs(symbol: symbol, value: any): this {
        this.injections[symbol as any] = value;
        this.symbolicInjections.push({symbol: symbol, value: value});
        return this;
    }

    async startWithServices<TActivity extends Activity>(root: IActivityConstructor<TActivity>,
                                                        ...services: IServiceConstructor<TActivity>[]) {

        this.zones.start();
        await this.updateVoxmateSettings();

        const activity = new root();

        for (let serviceConstructor of services) {
            await this.wrap({activity: activity}, async () => {
                const service = new serviceConstructor(activity);
                this.injectAs(serviceConstructor.inject, service);
            });
        }

        return await this.start(activity);
    }

    require(feature: VoxmateFeature): this {
        this.requiredFeatures.push(feature);
        return this;
    }

    private stopMonitoringInputs() {
        this.suspendNavigation();

        if (this.unsubscribeFromUserInputs)
            this.unsubscribeFromUserInputs();

        if (this.unsubscribeFromEvents)
            this.unsubscribeFromEvents();

        voxmate.input.setCommandScopingIntent(false);
        voxmate.input.setRecordingScopingIntent(false);
        voxmate.input.setGestureScopingIntent([]);
    }

    async start(ac: IActivityConstructor<any> | Activity): Promise<any> {

        if (typeof ac === "function")
            return await Promise.race([this.fail, this.runMainLoop(ac)]);

        return await this.start(class extends Activity {
            protected async run(): Promise<void | any> {
                return await this.exec(ac);
            }
        });
    }

    private hasFeature(feature: VoxmateFeature): boolean {
        return this.environment.features.indexOf(feature) !== -1;
    }

    private async runMainLoop(ac: IActivityConstructor): Promise<any> {

        if (GlobalOrchestrator)
            throw Error("Only one Orchestrator is allowed at a time");

        GlobalOrchestrator = this;

        let restart = true;
        let result = undefined;

        while (restart) {
            restart = false;

            try {
                this.zones.start();
                if (!this._voxmateSettings)
                    await this.updateVoxmateSettings();

                this.beginMonitoringEvents();

                for (let feature of this.requiredFeatures) {
                    if (!this.hasFeature(feature)) {
                        this.suspendNavigation();
                        await voxmate.audio.say("Voxmate needs to be updated to run this app. " +
                            "Please download Voxmate update in Google Play.");
                        return;
                    }
                }

                result = await this.exec(new ac(), false);

            } catch (e) {
                if (e instanceof Exit) {
                    if (e.code !== 0) {
                        console.error("Exited with code: " + e.code);
                    }
                } else throw e;
            } finally {
                this.zones.stop();
                this.stopMonitoringInputs();
                GlobalOrchestrator = undefined;
            }
        }

        return result;
    }

    private prepareActivity(activity: Activity) {

        const activityObject = activity as any;
        activityObject[orchestrator] = this;

        for (let injection in this.injections)
            if (this.injections.hasOwnProperty(injection))
                activityObject[injection] = this.injections[injection];

        for (let si of this.symbolicInjections)
            activityObject[si.symbol] = si.value;
    }

    private popTopActivity() {

        const chain = this.chain;

        if (!chain)
            return;

        if (chain.stack.length) {
            let idx = chain.stack.length;
            let cascade;
            do {
                const activity = chain.stack[--idx];
                cascade = !!activity.activityOptions.cascade;
                activity.end(undefined, true);
            } while (cascade && idx > 0);

        } else {
            chain.activity.end(undefined, true);
        }
    }

    private startAndRunActivityToCompletion(activity: Activity): Promise<any | null | undefined> {
        return new Promise<any>((resolve, reject) => {
            activity.endPromise.then(resolve);
            activity.start().then(resolve, reject);
        });
    }

    async exec(activity: Activity, managing: boolean): Promise<any> {

        await this.prepareActivity(activity);

        managing = !this.chain || managing;

        if (managing) {
            this.chain = {activity: activity, previous: this.chain, stack: []};
            voxmate.input.setVoiceInputMode(activity.voiceInputMode);
        } else this.chain!.stack.push(activity);

        let result = null;
        let error = null;

        try {
            result = await this.zones.wrap({activity: activity}, () => this.startAndRunActivityToCompletion(activity));
        } catch (e) {

            if (e instanceof MissingVoxmatePermission) {
                result = null;
            } else if (e instanceof IntrinsicError && isMissingPermission(e)) {

                const permission = isMissingPermission(e);
                voxmate.system.telemetry.error(`Missing permission ${permission}`);
                await this.exec(new class extends Activity {
                    protected async run() {
                        this.sound(Sound.Bad);
                        await this.sayDynamicInfo(`Voxmate is missing ${permission} permission. Please enable it in Permission Settings.`);
                    }
                }, true);

            } else {
                error = e;
            }
        }

        activity.end(result);

        if (activity.hasError)
            error = activity.error;
        else if (error != null) {
            activity.endWithError(error);
        }

        if (managing) {

            for (let activity of this.chain!.stack)
                activity.end(undefined);

            this.chain = this.chain!.previous;

            if (this.chain)
                voxmate.input.setVoiceInputMode(this.chain.activity.voiceInputMode);

        } else {
            removeArrayElement(this.chain!.stack, activity);
        }

        if (error)
            throw error;

        return result;
    }

    private getTopActivityOf(link: Link | null): Activity | null {
        if (!link) return null;

        const stack = link.stack;
        if (stack.length)
            return stack[stack.length - 1];

        return link.activity;
    }

    private walk(predicate: (activity: Activity) => Boolean): Activity | undefined {
        let node = this.chain;

        while (node) {
            for (let i = node.stack.length - 1; i >= 0; --i)
                if (predicate(node.stack[i]))
                    return node.stack[i];

            if (predicate(node.activity))
                return node.activity;

            node = node.previous;
        }

        return undefined;
    }

    private findLink(reference: Activity): Link | null {

        let link = this.chain;

        while (link) {
            if (link.activity === reference)
                return link;

            for (let activity of link.stack)
                if (activity === reference)
                    return link;

            link = link.previous;
        }

        return this.chain;
    }

    getTopActivity(reference: Activity | null = null): Activity | null {

        let link = this.chain;
        if (reference)
            link = this.findLink(reference);

        return this.getTopActivityOf(link);
    }

    getManagingActivity(reference: Activity | null = null): Activity | null {

        let link = this.chain;
        if (reference)
            link = this.findLink(reference);

        return link?.activity ?? null;
    }

    hasActivity(ac: IActivityConstructor) {
        return this.walk((a) => a instanceof ac) !== undefined;
    }

    isAttached(target: Activity): boolean {
        return this.walk(a => a === target) !== undefined;
    }

    getActivitiesAbove(target: Activity): Activity[] {

        const above: Activity[] = [];

        if (!this.isAttached(target))
            return above;

        let node = this.chain;
        while (node) {
            for (let i = node.stack.length - 1; i >= 0; --i) {
                const activity = node.stack[i];
                if (activity === target)
                    return above;

                above.push(activity);
            }

            if (node.activity === target)
                return above;

            above.push(node.activity);
            node = node.previous;
        }

        return above;
    }

    get isNavigationSuspended(): boolean {
        return this._isNavigationSuspended;
    }

    // Monotonically increasing number of all UI events.
    get lastUserInputSequence(): number {
        return this._lastUserInputSequence;
    }

    get lastUI(): UserInput | null {
        return this._lastUserInput;
    }

    get voxmateSettings(): IVoxmateSettings | undefined {
        return this._voxmateSettings;
    }

    async updateVoxmateSettings() {
        this._voxmateSettings = await voxmate.settings.getVoxmateSettings();
    }

    async getVoxletSettings(refresh: boolean): Promise<any> {
        if (!this._voxletSettings || refresh)
            this._voxletSettings = await this.wrap(this.getContext(), () => voxmate.settings.getVoxletSettings());
        return this._voxletSettings;
    }

    suspendNavigation() {
        this._isNavigationSuspended = true;
    }

    resumeNavigation() {
        this._isNavigationSuspended = false;
    }

    getContext(): Context {
        return this.zones.context;
    }

    wrap<T>(context: Context, fn: AnyFunction<T>): Promise<T> {
        return this.zones.wrap(context, fn);
    }

    static get global() {
        return GlobalOrchestrator;
    }

    interrupt(obj: any) {
        const activity = this.getManagingActivity();
        if (activity)
            activity.endWithError(obj);
    }
}

class ActivityHaltSentinel {
    constructor(readonly activity: Activity, readonly value: any) {
    }
}

export class CooldownCounter {

    private _counter: number = 0;
    private _clear: DeregisterFunction | null = null;

    constructor(private readonly activity: Activity, private readonly timeout: number) {

    }

    get counter() {
        return this._counter;
    }

    trigger(): number {
        if (this._clear)
            this._clear();
        this._clear = this.activity.setTimeout(() => {
            this._counter = 0;
            this._clear = null;
        }, this.timeout);
        return ++this._counter;
    }
}

export abstract class Activity<T = any> {

    private readonly _loadingPrompt: string | IPrompt;
    private readonly _loadingErrorPrompt: string | IPrompt;
    private readonly _freezeQuietly: boolean;
    private readonly _promises: IVoxmatePromise<any>[] = [];
    private readonly _holds: DeregisterFunction[] = [];
    private readonly _ends: DeregisterFunction[] = [];

    private _ended = false;
    private _endValue: T | undefined = undefined;
    private readonly _endPromise = new ControllablePromise<any>();

    private readonly _inputs = new InputChannel();

    private _interrupt: UserInput | null = null;
    private _interruptAt = 0;

    private _activityError: any = undefined;
    private _activityHasError: boolean = false;
    private _halted = false;

    readonly isSubordinate: boolean;
    readonly voiceInputMode: VoiceInputMode = VoiceInputMode.NoInput;
    readonly activityOptions: IActivityOptions;

    private static freezing = false;

    isRunningHelp = false;

    constructor(options: IActivityOptions = {}) {

        this._endPromise.then(() => {
            for (let fn of this._ends) {
                try {
                    fn();
                } catch (e) {

                }
            }
            this._ends.length = 0;
        });

        this.activityOptions = options;
        this.voiceInputMode = options.voiceInputMode || VoiceInputMode.NoInput;
        this._loadingPrompt = options.loadingPrompt || LOADING_PROMPT;
        this._loadingErrorPrompt = options.loadingErrorPrompt || LOADING_ERROR_PROMPT;
        this.isSubordinate = !!options.isSubordinate;
        this._freezeQuietly = !!options.freezeQuietly;
    }

    get isSimulator() {
        return this.orchestrator.environment.device.platform === "simulator";
    }

    get orchestrator(): Orchestrator {
        return GlobalOrchestrator!;
    }

    async exec<Q>(activity: Activity<Q>): Promise<Q> {

        const newContext = !activity.isSubordinate;

        const interrupt = this.getInterrupt();
        activity.setInterrupt(interrupt);

        let suspendNavigationAfterExecute = false;
        if (this.orchestrator.isNavigationSuspended) {
            this.orchestrator.resumeNavigation();
            suspendNavigationAfterExecute = true;
        }

        try {
            return await this.orchestrator.exec(activity as any, newContext);
        } catch (e) {
            throw e;

        } finally {
            if (suspendNavigationAfterExecute)
                this.orchestrator.suspendNavigation();
        }
    }

    /*
        Run this function when activity ends.
        Guaranteed (bugs not withstanding) to run the function even if the activity ends with an exception.
     */
    onEnd(fn: () => any): DeregisterFunction {
        const fnw = () => {
            fn();
        };
        this._ends.push(fnw);

        return () => {
            if (!this._ended)
                removeArrayElement(this._ends, fnw);
        };
    }

    race<T>(...promises: Promise<T>[]): Promise<T> {
        return this.wrapAny(Promise.race(promises));
    }

    async haltIfEnded(activity: Activity | null = null) {
        if (activity === null) {
            const context = this.orchestrator.getContext();
            if (this._ended || (context && context.activity.ended))
                this.halt();
        } else {
            if (activity._ended)
                this.halt();
        }
    }

    protected async wrapAny<T>(promise: Promise<T>, hold: boolean = true): Promise<T> {

        await this.haltIfEnded();

        let release: DeregisterFunction | null = null;

        if (hold) {
            release = voxmate.task.hold();
            this._holds.push(release);
        }

        let cleared = false;
        const clearHold = () => {
            if (hold && !cleared) {
                cleared = true;
                try {
                    release!();
                } catch (e) {
                    console.error("RELEASE ERROR", e);
                } finally {
                    removeArrayElement(this._holds, release as any);
                }
            }
        };

        try {
            const result = await promise;
            await this.haltIfEnded();
            return result;
        } finally {
            clearHold();
        }
    }

    isFlowControl(e: any) {
        if (e === UnWrap) return true;
        if (e instanceof ActivityHaltSentinel) return true;
        return false;
    }

    async wrap<T>(promise: IVoxmatePromise<T>): Promise<T> {
        await this.haltIfEnded();

        const context = this.orchestrator.getContext().activity;
        context._promises.push(promise);

        return new Promise<T>(async (resolve, reject) => {
            try {
                await promise;
                removeArrayElement(context._promises, promise);
                if (context.isActive)
                    resolve(promise);
                else {
                    reject(UnWrap);
                }
            } catch (e) {
                removeArrayElement(context._promises, promise);
                if (context.isActive) {
                    if (typeof e === "string") {
                        reject(new IntrinsicError(e));
                    } else reject(e);
                } else reject(UnWrap);
            }
        });
    }

    async preloadAssets() {
        await this.wrap(voxmate.filestore.preloadAssets());
    }

    private endAllActivitiesAbove() {
        /*
            Something is wrong with this function. It causes exceptions if not called from end. Review
         */
        if (this.orchestrator.isAttached(this)) {
            const above = this.orchestrator.getActivitiesAbove(this);
            for (let activity of above)
                activity.end(undefined);
        }
    }

    end(value: T | undefined = undefined, halted: boolean = false) {

        if (this._ended)
            return;

        this._ended = true;
        this._inputs.dispose();

        try {
            this.endAllActivitiesAbove();

            this._endValue = value;
            this._halted = this._halted || halted;

            for (const promise of this._promises) {
                promise.cancel();
            }

            //NB. Deregister() modifies holds...
            for (const deregister of [...this._holds])
                deregister();

        } finally {
            this._endPromise.resolve(value);
        }
    }

    endWithError(err: any) {

        if (err == UnWrap)
            return;

        if (this._halted) {
            if (err instanceof ActivityHaltSentinel)
                this.end(err.value);
        } else if (!this._activityHasError) {
            this._activityError = err;
            this._activityHasError = true;
            this.end(undefined, true);
        }
    }

    getInterrupt(consume: boolean = true): UserInput | null {
        if (this._interrupt) {
            const value = this._interrupt;
            if (consume)
                this._interrupt = null;
            return value;
        }
        return null;
    }

    async execOutsideNavigationalScope<T = void>(fn: () => Promise<T>): Promise<T> {
        try {
            this.orchestrator.suspendNavigation();
            return await fn();
        } finally {
            this.orchestrator.resumeNavigation();
        }
    }

    get managingActivity(): Activity | null {
        return this.orchestrator.getManagingActivity(this);
    }

    get endPromise(): Promise<any> {
        return this._endPromise;
    }

    get ended(): boolean {
        return this._ended;
    }

    get isActive(): boolean {
        return !this._ended;
    }

    //TODO: Rework around terminated.
    // This property was supposed to indicate that activity was terminated unnaturally.
    // But has now some double meaning...
    get halted() {
        return this._halted;
    }

    get hasError() {
        return this._activityHasError;
    }

    get error() {
        return this._activityError;
    }

    get isAttached() {
        return this.orchestrator.isAttached(this);
    }

    bindContext<T>(fn: AnyFunction<T>) {

        if (this.ended)
            return;

        const context = this;
        const currentContext = this.orchestrator.getContext();
        if (currentContext && currentContext.activity == context)
            return fn();

        return this.orchestrator.wrap({activity: context}, fn);
    }

    private makeActivityScopedTimer(timerFunction: any, fn: AnyFunction, timeout: number, context: Context | null = null): DeregisterFunction {

        if (this._ended)
            return NOOP;

        let repeated = timerFunction === setInterval;

        context = context ?? this.orchestrator.getContext();

        const zoneAwareTimerFunction = (fn: AnyFunction, timeout: number) => {
            return timerFunction(async () => {
                try {
                    await this.orchestrator.wrap(context, fn);
                } catch (e) {

                    if (e === UnWrap)
                        return;
                    if (e instanceof ActivityHaltSentinel && e.activity === this) {
                        this.end(e.value);
                    } else {
                        throw e;
                    }
                }
            }, timeout);
        };

        const handle = zoneAwareTimerFunction(async () => {
            try {
                await fn();
            } catch (e) {
                this.endWithError(e);
            } finally {
                if (!repeated)
                    clearOnEndHandler();
            }
        }, timeout);

        const clearTimer = () => {
            clearTimeout(handle);
            clearOnEndHandler();
        };

        const clearOnEndHandler = context.activity.onEnd(clearTimer);

        return clearTimer;
    }

    get voxmateSettings(): IVoxmateSettings | undefined {
        return this.orchestrator.voxmateSettings;
    }

    async getVoxletSettings(refresh: boolean = false) {
        return this.orchestrator.getVoxletSettings(refresh);
    }

    async saveVoxletSettings(settings: any) {
        await this.wrap(voxmate.settings.setVoxletSettings(settings));
        await this.getVoxletSettings(true);
    }

    protected makeCooldownCounter(timeout: number): CooldownCounter {
        return new CooldownCounter(this, timeout);
    }

    // Utility Functions

    async delay(timeout: number): Promise<undefined> {
        if (this.orchestrator.getContext().group) {
            const ui = await this.getWithTimeout(timeout);
            this.triggeringInterruptGroup(ui);
        } else {
            await this.wrap(voxmate.task.delay(timeout));
        }

        return undefined;
    }

    /* Make SAY_ Cohesive */

    rejectUI(ui: Partial<UserInput> | undefined | null, delay: number = 0, soft: boolean = true) {

        if (!ui)
            return;

        if (ui.kind == "gesture" && ui.gesture !== undefined) voxmate.input.rejectGesture(ui.gesture, delay, soft);
        if (ui.kind == "keyPress" && ui.char !== undefined) voxmate.input.rejectKey(ui.char, ui.keyKind, ui.shift, delay, soft);
    }

    protected triggeringInterruptGroup(ui: UserInput | null): UserInput | null {

        if (ui) {
            const ctx = this.orchestrator.getContext();
            if (ctx.group) {
                if (liveSayGroups.has(ctx.group))
                    throw new GroupInterruptToken(ctx.group, ui);

                console.error(`Input ${ui.kind} reached a completed say group, requeueing`);
                this._inputs.requeue(ui);
                return null;
            }
        }
        return ui ?? null;
    }

    protected async runIgnoringGroupInterrupts<T extends any>(fn: AsyncAction<T>): Promise<T | null> {
        try {
            return await fn();
        } catch (e) {

            if (this.isFlowControl(e))
                throw e;

            if (e instanceof GroupInterruptToken)
                return null;
            throw e;
        }
    }

    async asSayGroup<T>(fn: AsyncAction<void>, unwrap: boolean = true): Promise<UserInput | null> {

        const group = Symbol("Group");
        const ctx = this.orchestrator.getContext();

        liveSayGroups.add(group);
        try {
            const ui = await this.orchestrator.wrap({activity: ctx.activity, group: group}, async () => {
                try {
                    await fn();
                } catch (e) {
                    if (e instanceof GroupInterruptToken && e.group == group) {
                        await this.haltIfEnded();
                        return e.ui;
                    } else throw e;
                }

                await this.haltIfEnded();
                return null;
            });

            if (unwrap)
                return this.triggeringInterruptGroup(ui);
            return ui;
        } finally {
            liveSayGroups.delete(group);
        }
    }

    async say(text: Sayable, options?: IExtendedSpeechOptions): Promise<UserInput | null> {

        if (this._ended)
            return null;

        if (this._interrupt && Date.now() - this._interruptAt >= INPUT_REPLAY_TTL_MS)
            this._interrupt = null;

        let speech: IAudioResult | null = null;
        let retry = true;
        while (speech == null && retry) {
            try {
                speech = await this.wrap(voxmate.audio.say(await text, options));
            } catch (e) {
                if (this.isFlowControl(e))
                    throw e;

                if (e == "tts-error") {
                    const armed = this.armInput();
                    try {
                        await armed.promise;
                    } finally {
                        armed.release();
                    }
                    retry = true;
                } else throw e;
            }
        }

        if (speech && speech.interrupted) {

            const ui = speech.interruptionInput;

            await this.orchestrator.handleSpecialUserInput(ui);
            await this.haltIfEnded();

            if (options?.forwardInterrupt && ui) {
                this.rejectUI(ui);
                return null;
            }

            return this.triggeringInterruptGroup(ui);
        }

        return null;
    }

    async sayInfo(text: Sayable, options?: IExtendedSpeechOptions): Promise<UserInput | null> {
        return await this.say(text, {actor: Actor.Informational, ...options});
    }

    async sayContent(text: Sayable, options?: IExtendedSpeechOptions) {
        return await this.say(text, {actor: Actor.Content, ...options});
    }

    async sayDynamicContent(text: Sayable, options?: IExtendedSpeechOptions): Promise<UserInput | null> {
        return await this.say(text, {actor: Actor.DynamicContent, ...options});
    }

    async sayDynamicInfo(text: Sayable, options?: IExtendedSpeechOptions): Promise<UserInput | null> {
        return await this.say(text, {actor: Actor.DynamicInformational, ...options});
    }

    // TODO: Remove Say Skipping, prefer SayGroups, or {forwardInterrupt: true} option
    async saySkipping(text: Sayable, options?: IExtendedSpeechOptions): Promise<UserInput | null> {

        {
            const interrupt = this.getInterrupt();
            if (interrupt)
                return interrupt;
        }

        const interrupt = await this.say(text, options);
        this.setInterrupt(interrupt);

        return interrupt;
    }

    async saySkippingMultiple(actor: Actor, ...texts: Sayable[]): Promise<UserInput | null> {

        {
            const interrupt = this.getInterrupt();
            if (interrupt)
                return interrupt;
        }

        const group: ISayItem[] = [];
        for (let text of texts)
            group.push({actor: actor, text: text});

        const interrupt = await this.sayMultiple(group, false);
        this.setInterrupt(interrupt);

        return interrupt;
    }

    async saySkippingDynamicContent(...texts: Sayable[]) {
        return await this.saySkippingMultiple(Actor.DynamicContent, ...texts);
    }

    async saySkippingContent(...texts: Sayable[]) {
        return await this.saySkippingMultiple(Actor.Content, ...texts);
    }

    async sayMultiple(texts: ISayItem[], block: boolean = true): Promise<UserInput | null> {

        const interrupt = this.getInterrupt();
        if (interrupt)
            return interrupt;

        for (let i = 0; i < texts.length; ++i) {
            const item = texts[i];

            const opts = item.options || {};
            let ui = await this.say(item.text, {"actor": item.actor, ...opts});

            if (ui)
                return ui;
        }

        if (block) {
            return await this.get();
        }

        return null;
    }

    input(ui: UserInput): boolean {
        return this._inputs.input(ui);
    }

    private armInput(): { promise: Promise<UserInput>, release: () => void } {

        const own = this._inputs.next();

        const ctx = this.orchestrator.getContext();
        if (this === ctx.activity)
            return {
                promise: this.wrapAny(own),
                release: () => this._inputs.release(own),
            };

        const other = ctx.activity._inputs.next();
        return {
            promise: this.race(this.wrapAny(own, false), this.wrapAny(other, false)),
            release: () => {
                this._inputs.release(own);
                ctx.activity._inputs.release(other);
            },
        };
    }

    async getWithTimeout(timeout: number): Promise<UserInput | null> {

        const interrupt = this.getInterrupt();
        if (interrupt)
            return this.triggeringInterruptGroup(interrupt);

        const armed = this.armInput();
        try {
            const ui = await this.withTimeout(null, timeout, armed.promise);
            if (!ui)
                return null;
            return this.triggeringInterruptGroup(ui);
        } catch (e) {
            if (this.isFlowControl(e))
                throw e;

            if (e === HALT_SENTINEL)
                this.halt();

            else throw e;
        } finally {
            armed.release();
        }
    }

    async get(): Promise<UserInput> {

        const interrupt = this.getInterrupt();
        if (interrupt)
            return this.triggeringInterruptGroup(interrupt)!;

        const armed = this.armInput();
        try {
            return this.triggeringInterruptGroup(await armed.promise)!;
        } catch (e) {
            if (this.isFlowControl(e))
                throw e;

            if (e === HALT_SENTINEL)
                this.halt();

            else throw e;
        } finally {
            armed.release();
        }
    }

    tapInput(predicate: (ui: UserInput) => boolean, handler: (ui: UserInput) => void): DeregisterFunction {
        return this.autoClearing(this._inputs.tap(predicate, this.guardedInputHandler(handler)));
    }

    observeInput(handler: (ui: UserInput) => void): DeregisterFunction {
        return this.autoClearing(this._inputs.observe(this.guardedInputHandler(handler)));
    }

    private guardedInputHandler(handler: (ui: UserInput) => void): (ui: UserInput) => void {
        return ui => {
            Promise.resolve(this.bindContext(() => handler(ui))).catch(e => {
                if (!this.isFlowControl(e))
                    console.error("Input handler error", e);
            });
        };
    }

    private autoClearing(deregister: DeregisterFunction): DeregisterFunction {
        const unhook = this.onEnd(deregister);
        return () => {
            unhook();
            deregister();
        };
    }

    setInterrupt(ui: UserInput | null) {
        this._interrupt = ui;
        this._interruptAt = Date.now();
    }

    resetInterrupt() {
        this.getInterrupt();
    }

    haptic(signal: HapticSignal) {
        if (this._ended)
            return;

        return voxmate.audio.haptic(signal);
    }

    sound(sound: Sound) {
        if (this._ended)
            return;
        return voxmate.audio.sound(sound);
    }

    async myLocation(retying: boolean = false): Promise<IGeoLocation | null> {
        await this.haltIfEnded();
        try {
            return await this.wrap(voxmate.location.get());
        } catch (e) {

            if (this.isFlowControl(e))
                throw e;

            if (e == "missing")
                console.warn("Location is missing");

            if (e instanceof IntrinsicError && isMissingPermission(e) == "location")
                console.warn("Location permission is missing");

            if (retying == false)
                return null;

            const loader = new class extends Activity<IGeoLocation> {
                constructor() {
                    super({loadingPrompt: "Trying to get your location. Swipe left to cancel."});
                }

                protected async run(): Promise<IGeoLocation | undefined> {
                    while (this.isActive) {
                        try {
                            const location = await this.wrap(voxmate.location.get());
                            if (location != null)
                                return location;
                        } catch (e) {
                            if (this.isFlowControl(e))
                                throw e;
                            await this.delay(250);
                        }
                    }
                }
            };

            return await this.exec(loader) ?? null;
        }
    }

    async httpGet(url: string, headers: any = {}, sign: boolean = false): Promise<IHttpResult> {
        await this.haltIfEnded();
        try {
            return await this.wrap(voxmate.http.request(url, "GET", null, headers, sign));
        } catch (e) {

            if (this.isFlowControl(e))
                throw e;

            if (e instanceof IntrinsicError)
                throw new HttpError(e.code);
            throw e;
        }
    }

    async httpPostJson(url: string, payload: any) {
        await this.haltIfEnded();
        const task = voxmate.http.request(url, "POST", JSON.stringify(payload), {}, true);
        try {
            const data = await this.wrap(task);
            if (!data.ok)
                throw new HttpError(`Unable to load URL: ${url}`);
            return data;
        } catch (e) {

            if (this.isFlowControl(e))
                throw e;

            if (e instanceof IntrinsicError)
                throw new HttpError(e.code);

            throw e;
        }
    }

    async httpMakeRequest(url: string, method: "GET" | "POST", payload: string | null,
                          headers: { [header: string]: string }, sign: boolean = false) {
        await this.haltIfEnded();
        try {
            const data = await this.wrap(voxmate.http.request(url, method, payload, headers, sign));
            if (!data.ok)
                throw new HttpError(`Unable to load URL: ${url}`);
            return data;

        } catch (e) {
            if (this.isFlowControl(e))
                throw e;
            if (e instanceof IntrinsicError)
                throw new HttpError(e.code);
            throw e;
        }
    }


    async freeze<Q>(task: Promise<Q> | (() => Promise<Q>), message: string | null = null): Promise<Q | null> {
        let activatedFrost = false;
        try {
            await this.haltIfEnded();

            if (task == null)
                return null;

            if (typeof task == "function")
                task = task();

            if (this._freezeQuietly || Activity.freezing) {
                return await task;
            }

            activatedFrost = true;
            Activity.freezing = true;

            let soundedTimes = 0;
            let delayDuration = 500;

            const watcher = new ControllablePromise();
            const end = () => {
                watcher.resolve();
            };
            task.then(end, end);

            const ctx = this.orchestrator.getContext();
            ctx.activity;

            while (this.isActive) {

                await this.race(watcher, this.delay(delayDuration), ctx.activity.endPromise, this.endPromise);

                if (watcher.resolved) {
                    break;
                } else {
                    delayDuration = 1500;
                    if (soundedTimes < 3) {
                        this.sound(Sound.Loading);
                        soundedTimes++;
                    } else {
                        soundedTimes = 0;

                        let loadingPrompt = this._loadingPrompt;
                        if (message !== null)
                            loadingPrompt = message;

                        await this.sayDynamicContent(loadingPrompt, {visuallyHidden: true});
                    }
                }
            }

            return await task;

        } finally {
            if (activatedFrost)
                Activity.freezing = false;
        }
    }

    async invokeHint(): Promise<boolean> {
        const hint = await this.hint();

        if (hint === null)
            return false;

        const blocks = hint instanceof Array ? hint : [hint];

        if (blocks.length > 0)
            this.sound(Sound.Hint);

        let ui = await this.asSayGroup(async () => {
            for (let part of blocks) {
                await this.sayDynamicInfo(part);
            }
        });
        if (ui) this.rejectUI(ui);
        return true;
    }

    async invokeHelp() {
        const help = await this.help();
        if (!help)
            return;

        for (let item of toArray(help))
            await this.sayInfo(item, {forwardInterrupt: true});
        this.sound(Sound.EndContent);
        await this.get();
    }

    async hasAPILevel(level: number): Promise<boolean> {
        return this.orchestrator.environment.device.version >= level;
    }

    // Activities should consider implementing
    async hint(): Promise<null | SimpleSayable | SimpleSayable[]> {
        return null;
    }

    // Override without super call OK
    async help(): Promise<void | null | undefined | string | string[]> {
        await this.sayInfo(NO_CONTEXTUAL_HELP);
    }

    async onVoiceCommand(transcript: string): Promise<any> {
        await this.haltIfEnded();
        await this.sayInfo(NO_VOICE_COMMANDS);
    }

    async onRecording(recordingId: RecordingId): Promise<any> {
        await this.haltIfEnded();
    }

    async configuration(): Promise<any> {
        await this.haltIfEnded();
        return await this.wrap(voxmate.settings.getVoxletSettings());
    }

    protected async init() {

    }

    // Abstract Entry Point

    async start(): Promise<T | void | null> {

        const initializationTask = this.init();

        try {
            const initializationFreeze = this.freeze(initializationTask);
            await this.race(initializationFreeze, this._endPromise);
        } catch (e) {

            if (e === UnWrap)
                return null;

            if (e instanceof ActivityHaltSentinel)
                throw e;

            if (this.orchestrator.environment.device.platform == "simulator") {
                console.warn("Throwing Init Simulator Only", e);
                throw e;
            }

            this.sound(Sound.Bad);
            await this.sayDynamicContent(this._loadingErrorPrompt);
            console.error(e);
            return null;
        }

        try {

            await this.haltIfEnded();

            const ui = this.getInterrupt();
            if (ui != null)
                this.setInterrupt(ui);

            // If help shown more than 3 times, do not show help
            if (!this.isSubordinate) {
                const key = "___voxmate_hint_for_" + this.constructor.name;
                await this.repeatAtMost(key, async () => {
                    await this.invokeHint();
                }, 3);
            }

            this.getInterrupt();
            return await this.run();

        } catch (e) {
            if (e === UnWrap)
                return null;
            else if (e instanceof ActivityHaltSentinel && e.activity === this) {
                return e.value;
            } else {
                throw e;
            }
        }
    }

    halt(value: any = undefined): never {
        this._halted = true;
        throw new ActivityHaltSentinel(this, value);
    }

    async repeatAtMost(key: string, action: () => Promise<void>, times: number = 3) {
        const count = parseInt(localStorage.getItem(key, ORC_LS_NAMESPACE) ?? "0");
        if (count < times) {
            localStorage.setItem(key, (count + 1).toString(), ORC_LS_NAMESPACE);
            await action();
        }
    }

    async runSubActivity<T>(fn: (activity: Activity) => Promise<T>): Promise<T> {
        class IsolationActivity extends Activity<T> {

            constructor() {
                super({isSubordinate: true, cascade: true});
            }

            protected async run(): Promise<T> {
                return await fn(this);
            }
        }

        return await this.exec(new IsolationActivity());
    }

    async runSubActivityInIsolation<T>(fn: (activity: Activity) => Promise<T>): Promise<T> {
        return this.runInIsolation(async () => {

            class IsolationActivity extends Activity<T> {

                constructor() {
                    super({isSubordinate: true, cascade: true});
                }

                protected async run(): Promise<T> {
                    return await fn(this);
                }
            }

            return await this.exec(new IsolationActivity());
        });
    }

    async runInIsolation<T>(fn: () => Promise<T>): Promise<T> {
        return await new Promise<T>(async (resolve, reject) => {
            await voxmate.task.isolate(async (scopeId) => {

                if (!this.orchestrator)
                    return;

                let result: any = null;
                let error: any = null;

                try {
                    result = await this.orchestrator.wrap({activity: this}, async () => {
                        try {
                            await this.haltIfEnded();
                            return fn();
                        } finally {
                            await this.haltIfEnded();
                        }
                    });
                } catch (e) {

                    if (UnWrap)
                        return undefined;

                    if (e === CascadeEnd)
                        return undefined;

                    error = e;
                } finally {
                    await voxmate.task.ground(scopeId);
                }

                if (error) reject(error);
                else resolve(result);
            });
        });
    }

    poke() {
        voxmate.input.rejectGesture(Gesture.Poke, 200, false);
    }

    setInterval(fn: AnyFunction, timeout: number = 100): DeregisterFunction {
        return this.makeActivityScopedTimer(setInterval, fn, timeout);
    }

    setTimeout(fn: AnyFunction, timeout: number = 1): DeregisterFunction {
        return this.makeActivityScopedTimer(setTimeout, fn, timeout);
    }

    /**
     Sets a timer to run @param {func} fn once in the context of the current activity.
     @param {AnyFunction} fn - Function to be called.
     @return DeregisterFunction - Call this to cancel execution. Note that the timeout parameter is 0, so cancel quickly.
     */
    runOnceInBackground(fn: AnyFunction): DeregisterFunction {
        return this.makeActivityScopedTimer(setTimeout, fn, 0, {activity: this});
    }

    private timeout<T>(value: T, timeout: number, resolving: boolean = true): Promise<T> {
        const promise = new ControllablePromise<T>();
        this.setTimeout(() => {
            if (resolving) promise.resolve(value);
            else promise.reject(value);
        }, timeout);
        return promise;
    }

    withTimeout<T>(timeoutValue: T, duration: number, ...promises: Promise<T>[]): Promise<T> {
        const timeout = this.timeout(timeoutValue, duration);
        return this.race(timeout, ...promises);
    }

    async withCancellation<T, TCancellation = any>(cancellation: Promise<TCancellation>, task: Promise<T>): Promise<CancellableOperationResult<T>> {
        const cancelled = Symbol("cancellation-token");
        const cancellationTask = new ControllablePromise();
        const end = () => {
            cancellationTask.resolve(cancelled);
        };

        cancellation.then(end, end);

        const result = await this.race(cancellationTask, task);
        if (result === cancelled)
            return {cancelled: true};

        await this.haltIfEnded();
        return {cancelled: false, result: result};
    }

    async getNextInput(): Promise<UserInput> {
        const armed = this.armInput();
        try {
            return await armed.promise;
        } finally {
            armed.release();
        }
    }

    resolveOrTimeout<T>(duration: number, promise: Promise<T>, throws: any = null): Promise<T> {
        const timeout = this.timeout(throws ?? new Error("Timed out"), duration, false);
        return this.race(timeout, promise);
    }

    protected async run(): Promise<T | null | undefined | void> {
        return undefined;
    }
}
