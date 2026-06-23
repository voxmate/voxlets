import {Activity, Exit, MissingVoxmatePermission, Sayable, SimpleSayable} from "./orc";
import {ReaderFinalState, Rolodex, RolodexEntryBuilder} from "./rolodex";
import voxmate, {
    Actor,
    ClipboardDataKind,
    IInputMethods,
    IKeyPress,
    ISpeechOptions,
    UserInput,
    Sound,
    VoxmatePermission,
    VoxmatePermissionManifest, KeyPressUserInput
} from "../voxmate";
import {ControllablePromise, toArray} from "../utility/common";
import {arrayToText} from "../utility/array";
import {Entity, PhoneNumberEntity, URLEntity, YoutubeVideoEntity} from "./Entities";
import {timeFromNow} from "../utility/time";

export type PermissionRequest = {
    [perm in VoxmatePermission]?: string
}


export interface IBackgroundSoundController {

    unableToStartPlayback: boolean;

    stop(): Promise<void>;

    done(): Promise<void>;
}

export interface IBackgroundLoopController extends IBackgroundSoundController {
    pause(): Promise<void>;

    resume(): Promise<void>;
}


const DEFAULT_CONFIRM_PROMPT = "Are you sure?";

export interface EditorInvoke {
    type: "edit" | "search";
}

function checkPermissionManifest(permissions: VoxmatePermission[], manifest: VoxmatePermissionManifest) {
    const missingPermissions: VoxmatePermission[] = [];
    for (let key of permissions)
        if (!(manifest as unknown as Record<string, boolean>)[key])
            missingPermissions.push(key);
    return missingPermissions;
}

export interface IEditorStringInput extends EditorInvoke {
    type: "search";
    prompt?: SimpleSayable;
    action: SimpleSayable;
    confirm?: boolean;
}

export interface IStringEditFieldConfig {
    allowEmojiInput?: boolean;
    maxLength?: number | null;
    initialText?: string | null;
}


export type Reminder = {
    message: SimpleSayable;
    frequencyInSeconds: number;
    disableHint?: boolean;     // if set, disables hints in the editor.
}

export interface IEditFieldConfig extends IStringEditFieldConfig {
    typed?: IKeyPress;
    reminder?: Reminder;
}

export interface IDialPadFieldConfig {
    initial: string;
    minInputLength: number;
    maxInputLength?: number;
    minError: string;
    prompt: string | null;
}


export interface IEditorFieldEdit extends EditorInvoke {
    type: "edit";
    config: IEditFieldConfig;
    prompt?: string;
}

function isEmptyObject(obj: any) {
    // noinspection LoopStatementThatDoesntLoopJS
    for (let prop in obj)
        return false;
    return true;
}

export interface IReadLongOptions {
    actor?: Actor;
}

interface ILongReaderOptions {
    title?: string;
    escapeAfterLastBlock?: boolean;
    speech?: ISpeechOptions;
    extendOptions?: (options: Rolodex, reader: Rolodex) => void;
}

interface IPlaybackOptions {
    volume?: number;
    autoDispose?: boolean;
    skipForward?: number;
    streaming?: boolean;
}

export abstract class RollActivity<T = any> extends Activity<T> {

    private static _inputs: IInputMethods | null = null;

    roll(...texts: string[]): Rolodex {
        const roll = new Rolodex(this);
        for (let text of texts) {
            roll.add(text);
        }
        return roll;
    }

    override async invokeHelp(): Promise<void> {
        const help = await this.help();
        if (help)
            await this.readLong(toArray(help), {title: "Help"});
    }

    async playInBackground(resource: string, options: IPlaybackOptions = {}) {
        const {volume = 100, autoDispose = true, skipForward = 0, streaming = false} = options;

        let playerId: string | null = null;
        try {
            playerId = await this.wrap(voxmate.audio.player.init(resource, streaming, true));
        } catch (e) {
            return;
        }

        if (!await this.wrap(voxmate.audio.player.prep(playerId!))) {
            return new class implements IBackgroundSoundController {
                unableToStartPlayback = true;

                async stop() {
                    //Do Nothing
                }

                async done() {

                }
            };
        }

        await this.wrap(voxmate.audio.player.setVolume(playerId!, volume));
        if (skipForward > 0)
            await this.wrap(voxmate.audio.player.setPosition(playerId!, skipForward));

        const promise = this.wrap(voxmate.audio.player.play(playerId!));

        let disposed = false;

        async function dispose() {
            if (!disposed) {
                await voxmate.audio.player.dispose(playerId!);
                disposed = true;
            }
        }

        promise.then(dispose);

        if (autoDispose)
            this.onEnd(dispose);

        return new class implements IBackgroundSoundController {

            unableToStartPlayback = false;

            async stop() {
                await dispose();
            }

            async done() {
                await promise;
            }
        };
    }

    async playInForeground(resource: string, options: IPlaybackOptions = {}): Promise<UserInput | null> {
        const interrupting = new ControllablePromise<UserInput>();
        const untap = this.tapInput(() => true, ui => interrupting.resolve(ui));
        try {
            const controller = await this.playInBackground(resource, options);
            if (!controller) return null;
            const result = await this.withCancellation(interrupting, controller.done());
            if (result.cancelled) {
                await controller.stop();
                return this.triggeringInterruptGroup(await interrupting);
            }
            return null;
        } finally {
            untap();
        }
    }

    async confirmVisualWarning(action: string): Promise<boolean> {
        return await this.confirm(`Do you want to ${action}? The system will visually show one or more prompts, and will require input.`, true);
    }

    async getPermissionsManifest(): Promise<VoxmatePermissionManifest> {
        return await this.wrap(voxmate.system.os.getPermissions([]));
    }

    async havePermissions(...permissions: VoxmatePermission[]): Promise<boolean> {
        const manifest = await this.getPermissionsManifest();
        for (let permission of permissions)
            if (!(manifest as unknown as Record<string, boolean>)[permission])
                return false;
        return true;
    }

    async execGuarded<Q>(permissions: VoxmatePermission[], activity: Activity<Q>): Promise<Q | undefined> {
        if (await this.havePermissions(...permissions))
            return this.exec(activity);

        function makeDefaultPermissionRequest(): PermissionRequest {
            const defaults: { [perm in VoxmatePermission]: string } = {
                "contacts": "your contact book",
                "storage": "files on your device",
                "location": "your current location",
                "microphone": "your microphone",
                "calendar": "your calendar",
                "camera": "your camera",
                "launcher": "other apps on your device",
                "phone": "phone calls",
                "*": "everything"
            };

            const request: PermissionRequest = {};
            for (let permission of permissions) {
                request[permission] = "Voxmate needs to access " + defaults[permission];
            }

            return request;
        }

        const guard = new class extends RollActivity<boolean> {
            protected async run() {
                await this.guardPermissions(makeDefaultPermissionRequest());
                return true;
            }
        };

        if (await this.exec(guard))
            return this.exec(activity);
        return undefined;
    }

    async guardPermissions(request: PermissionRequest) {

        const permissions = Object.keys(request) as VoxmatePermission[];
        const manifest = await this.wrap(voxmate.system.os.getPermissions(permissions));
        const missingPermissions = checkPermissionManifest(permissions, manifest);
        if (missingPermissions.length == 0)
            return;

        const prompts: string[] = [];
        for (let permission of missingPermissions)
            prompts.push(request[permission]!);

        await this.sayDynamicInfo("In order to use this feature or Voxmate App, you'll need to grant Voxmate some additional permissions");
        await this.sayDynamicInfo(arrayToText(prompts));
        if (await this.confirmVisualWarning("grant permissions")) {
            const manifest = await this.freeze(this.wrap(voxmate.system.os.getPermissions(permissions, true)));
            const missingPermissions = checkPermissionManifest(permissions, manifest!);
            const stillMissingPermissions = missingPermissions.length > 0;
            if (stillMissingPermissions) {
                await this.sayDynamicInfo("Voxmate didn't get the necessary permissions. " +
                    "You can set Voxmate permissions in Android settings, " +
                    "visit this feature again, or go to Voxmate Settings, Permissions");
                throw new MissingVoxmatePermission(missingPermissions[0]);
            } else {
                this.sound(Sound.Good);
            }
        } else {
            throw new MissingVoxmatePermission(missingPermissions[0]);
        }
    }

    async playLoopEffect(resource: string, volume: number): Promise<IBackgroundLoopController> {

        const playerId = await this.wrap(voxmate.audio.player.init(resource, true, true, true));
        if (!await this.wrap(voxmate.audio.player.prep(playerId))) {
            return new class implements IBackgroundLoopController {
                unableToStartPlayback = true;

                async resume(): Promise<void> {
                }

                async pause() {
                }

                async stop() {
                }

                async done() {

                }
            };
        }

        await this.wrap(voxmate.audio.player.setVolume(playerId, volume));
        this.setTimeout(() => {
            this.wrap(voxmate.audio.player.play(playerId));
        }, 1);

        let disposed = false;
        const that = this;

        async function dispose() {
            if (!disposed) {
                await voxmate.audio.player.dispose(playerId);
                disposed = true;
            }
        }

        this.onEnd(() => {
            dispose();
        });

        return new class implements IBackgroundLoopController {
            unableToStartPlayback = false;

            async resume(): Promise<void> {
                await that.wrap(voxmate.audio.player.setVolume(playerId, volume));
            }

            async pause() {
                await that.wrap(voxmate.audio.player.setVolume(playerId, 0));
            }

            async stop() {
                await dispose();
            }

            async done() {
                throw new Error("Background Loops are not DONE");
            }
        };
    }

    //TODO: Remove this Reader
    /**
     * @deprecated This Reader should not be used.
     */
    async readLongDeprecated(title: string, statements: Sayable[], options: IReadLongOptions = {}): Promise<ReaderFinalState> {

        const titleActor = options.actor ?? Actor.DynamicInformational;

        let quick = true;

        const readerActivity = new class extends RollActivity {
            constructor() {
                super({isSubordinate: true});
            }

            async run() {

                let completed = false;

                const reader = this.roll().setActor(Actor.DynamicContent);
                const titleItem = reader.add(async () => {
                    if (quick) {
                        await this.say(title, {actor: titleActor});
                    } else {
                        titleItem.next();
                    }
                }, async () => {
                    if (quick)
                        quick = false;
                    else reader.unwind(completed);
                    titleItem.next();
                });

                for (let i = 0; i < statements.length; i++) {
                    let statement = statements[i];
                    reader.add(async () => {

                        if (quick) {
                            if (reader.lastUI && reader.lastUI.kind == "gesture") {
                                voxmate.input.rejectGesture(reader.lastUI.gesture);
                                reader.unwind(completed);
                            }
                        }

                        // If I got here by skipping - OK, but if I upped or
                        // downed, then i need to break out of reader

                        await this.sayDynamicContent(statement);

                        if (i === statements.length - 1) {
                            completed = true;
                            if (quick)
                                reader.unwind(completed);
                        }

                    }, async () => {
                        if (quick) {
                            quick = false;
                        } else reader.unwind(completed);
                    });
                }

                return await reader.run({autoskip: true});
            }
        };

        const result = await this.exec(readerActivity);

        if (result === undefined) {
            if (quick)
                return ReaderFinalState.QuickExit;
            return ReaderFinalState.ReadExpanded;
        }

        if (result === true)
            return ReaderFinalState.QuickToEnd;

        return ReaderFinalState.QuickSkipped;
    }

    async openURL(url: string, title: string | null = null) {

        const settings = this.voxmateSettings;

        const options = this.roll();
        options.add(async () => {
            if (title)
                await this.sayDynamicContent(`Copy link to ${title}`);
            else await this.sayDynamicContent("Copy link");
        }, async () => {
            voxmate.system.copyToClipboard(ClipboardDataKind.Text, url);
            await this.sayInfo("copied");
            options.unwind();
        });

        options.add(async () => {
            if (title)
                await this.sayDynamicContent(`Visit ${title}`);
            else await this.sayDynamicContent("Visit link");
        }, async () => {
            const ok = settings?.enableTalkBackCompatibilityMode || await this.confirm("Are you sure you want to open the URL in your system browser?");
            if (ok) {
                voxmate.system.os.open(url);
                await this.get();
                options.unwind();
            }
        });

        await options.run();
    }

    async callPhone(number: string): Promise<any> {

        const options = this.roll();
        options.add(async () => {
            await this.sayDynamicContent("Copy phone number");
        }, async () => {
            voxmate.system.copyToClipboard(ClipboardDataKind.Text, number);
            await this.sayInfo("copied");
            options.unwind();
        });

        options.add(async () => {
            await this.sayDynamicContent("Call phone number");
        }, async () => {

            const isDialer = await this.wrap(voxmate.phone.isDialer());
            const ok = isDialer || await this.confirm("Are you sure you want to place a call in your system dialer?");
            if (ok) {
                await this.goto("intercom", {"phone": number});
                options.unwind();
            }
        });

        await options.run();
    }

    async confirm(prompt: Sayable = DEFAULT_CONFIRM_PROMPT, discourage: boolean = false, asMenu: boolean = false): Promise<boolean> {
        const dex = this.roll();

        if (discourage || asMenu) {

            await this.sayDynamicInfo(prompt);

            if (discourage) {
                dex.add("No", async () => false);
                dex.add("Yes", async () => true);
            } else {
                dex.add("Yes", async () => true);
                dex.add("No", async () => false);
            }
        } else {
            dex.add(async () => {
                await this.sayDynamicContent(prompt);
                await this.sayDynamicInfo("Swipe right to confirm");
            }, async () => {
                return true;
            });
        }

        return !!await dex.run();

    }

    protected async goto(ident: string, payload?: any, version?: number): Promise<any | undefined> {

        const block = voxmate.system.subscriptions.getBlockInfo();

        if (block.blocked) {
            await this.sound(Sound.Bad);
            await this.sayInfo(block.message.replace(/\$WHEN/g, timeFromNow(block.lifts)));
            return null;
        } else

            try {
                const data = await this.wrap(voxmate.system.goto(ident, payload, version));
                if (data.code === 0)
                    return data.data ?? {};
            } catch (e) {
                if (e == "INVALID_VERSION") {
                    await this.say("Unable to start App, because it requires a newer version of Voxmate.");
                    await this.say("Please update Voxmate in Google Play.");
                    return undefined;
                } else if (e == "NO_INTERNET") {
                    await this.say(`Unable to start ${ident}. Check your Internet connection.`);
                    return undefined;
                } else if (e == "INTERRUPTED") {
                    return undefined;
                } else throw e;
            }

        return null;
    }

    protected quit(number: number = 0) {
        throw new Exit(number);
    }

    async getSearchQuery(config: Partial<IEditorStringInput> = {}): Promise<string | null> {
        config.type = "search";
        return await this.goto("editor", config);
    }

    async editField(current: string | undefined = undefined, config: IEditFieldConfig = {}, prompt: string | undefined = undefined): Promise<string | undefined> {

        const copy = {...config};
        if (current) {
            copy.initialText = current;
        }

        if (copy.allowEmojiInput === undefined)
            copy.allowEmojiInput = true;

        const result = await this.goto("editor", {
            type: "edit",
            config: copy,
            prompt: prompt
        });

        // System can't return undefined, it will return empty object instead, fix here.
        if (isEmptyObject(result))
            return current;

        return result;
    }

    async editDialPadField(current: string | undefined = undefined, config: Partial<IDialPadFieldConfig> = {}, prompt: string | undefined = undefined): Promise<string | undefined> {

        const copy = {...config};

        if (current) {
            copy.initial = current;
        }

        if (prompt)
            copy.prompt = prompt;

        const result = await this.goto("dialpad", copy);

        if (isEmptyObject(result))
            return current;

        return result;
    }

    checkVersionAtLeast(version: number): boolean {
        return this.orchestrator.environment.version.code >= version;
    }

    async preloadDynamicInfo(text: Sayable, options?: ISpeechOptions): Promise<void> {
        // await this.preloadSay(text, {actor: Actor.DynamicInformational, ...options});
    }

    async preloadDynamicContent(text: string, options?: ISpeechOptions): Promise<void> {
        // await this.preloadSay(text, {actor: Actor.DynamicContent, ...options});
    }

    async getSupportedInputMethods(): Promise<IInputMethods> {
        if (!RollActivity._inputs)
            RollActivity._inputs = await this.wrap(voxmate.input.getInputMethods());
        return RollActivity._inputs;
    }

    get isManagingActivity(): boolean {
        return this.managingActivity === this;
    }

    async playYoutubeVideo(videoId: string) {
        return this.goto("youtube", {
            type: "play-video",
            videoId: videoId
        });
    }

    async getTextEntities(text: string): Promise<Entity[]> {
        const entities: Entity[] = [];
        const tt = await this.wrap(voxmate.utility.extractTextEntities(text));

        for (let entity of tt.entities) {
            if (entity.type == "url")
                entities.push(new URLEntity(entity.url));

            if (entity.type == "youtube-video")
                entities.push(new YoutubeVideoEntity(entity.videoId));

            if (entity.type == "phone-number")
                entities.push(new PhoneNumberEntity(entity.phoneNumber));
        }

        return entities;
    }

    async extendDexWithTextEntities(dex: Rolodex, text: string) {
        const entities = await this.getTextEntities(text);
        if (entities.length == 0) {
            this.sound(Sound.EndContent);
            return;
        }

        this.setTimeout(async () => {
            for (let entity of entities)
                await entity.prepare(this);
        });

        for (let entity of entities) {
            dex.add(async () => {
                await entity.presentEntity(this);
            }, async () => {
                await entity.activateEntity(this);
            });
        }
    }

    async presentTextEntities(text: string) {
        const dex = this.roll();
        await this.freeze(this.extendDexWithTextEntities(dex, text));
        await dex.run({paginateItems: true});
    }

    async paginate(idx: number, total: number = -1, what: string = "") {
        if (what.length > 0)
            what = what + " ";

        if (total > 0)
            await this.sayDynamicInfo(`${what}${idx + 1} of ${total}`);
        else await this.sayDynamicInfo(`${what}${idx + 1}`);
    }

    //TODO: Build out this new Reader, and Remove the old One
    async readLong(statements: string[] | string, options: ILongReaderOptions = {}): Promise<void> {

        const {
            escapeAfterLastBlock = false,
            title = null
        } = options;

        if (typeof statements === "string")
            statements = [statements];

        const readerActivity = new class extends RollActivity {

            constructor() {
                super({isSubordinate: true});
            }

            async run() {
                const readerDex = this.roll().setActor(Actor.DynamicContent);

                if (title && title.length > 0)
                    readerDex.add(async () => {
                        await this.sayDynamicInfo(title);
                    });

                let sentences: string[] = [];
                for (let statement of statements) {
                    const splits = voxmate.utility.splitIntoSentences(statement);
                    sentences.push(...splits);
                }

                for (let sentence of sentences)
                    readerDex.add(async () => {
                        await this.sayDynamicContent(sentence, {...options.speech});
                    }, async () => {
                        const optionsDex = this.roll();
                        await this.freeze(this.extendDexWithTextEntities(optionsDex, sentence));
                        if (options.extendOptions)
                            options.extendOptions(optionsDex, readerDex);
                        await optionsDex.run();
                    });

                if (escapeAfterLastBlock)
                    readerDex.add(async () => {
                        readerDex.unwind();
                    });

                return await readerDex.run({autoskip: true});
            }
        };

        await this.exec(readerActivity);
    }

}

export interface IIndeterminateRollerConfig {
    rolodex: Rolodex,
    indeterminateFragmentExpandsUpward?: boolean;
    jumpToIndeterminateFragment?: boolean;
}

export abstract class IndeterminateRoller<T = any> extends RollActivity<T> {

    private _indeterminateSectionStart: RolodexEntryBuilder | null = null;
    private _determinateSectionStart: RolodexEntryBuilder | null = null;
    private _insideIndeterminateSection = false;
    private _rolodex: Rolodex | null = null;

    constructor() {
        super({isSubordinate: true});
    }

    abstract onStepUp(): Promise<boolean>

    abstract onStepDown(): Promise<boolean>

    abstract onVisitCurrent(): Promise<boolean>

    abstract onEnterCurrent(): Promise<T>

    abstract make(): Promise<IIndeterminateRollerConfig>

    // Optional Overrides

    async onExpandCurrent(): Promise<T> {
        return await this.onEnterCurrent();
    }

    async onKeyPress(key: KeyPressUserInput) {

    }

    async onEnteringIndeterminateSection() {

    }

    async onLargeStepUp(): Promise<boolean> {
        return this.onStepUp();
    }

    async onLargeStepDown(): Promise<boolean> {
        return this.onStepDown();
    }

    async enterIndeterminateSection(): Promise<never> {

        if (!this._insideIndeterminateSection) {
            this._insideIndeterminateSection = true;
            await this.onEnteringIndeterminateSection();
        }

        return this._indeterminateSectionStart!.goto();
    }

    enterRegularSection(): never {
        return this._determinateSectionStart!.goto();
    }

    unwind(value: any = undefined): never {
        return this._rolodex!.unwind(value);
    }

    // Interface

    protected async run() {
        const config = await this.make();

        const dex = config.rolodex;
        this._rolodex = dex;
        const N = dex.size;

        const startingNode = dex.getStep(0);
        const endNode = dex.getStep(N - 1);


        const moveUp = (stay: boolean) => {
            if (stay)
                current.goto();
            else {
                this._insideIndeterminateSection = false;
                if (N > 0 && !config.indeterminateFragmentExpandsUpward) {
                    endNode?.goto();
                } else {
                    this.sound(Sound.EndContent);
                    current.goto();
                }
            }
        };

        const moveDown = (stay: boolean) => {
            if (stay)
                current.goto();
            else {
                this._insideIndeterminateSection = false;
                if (N > 0 && config.indeterminateFragmentExpandsUpward) {
                    startingNode?.goto();
                } else {
                    this.sound(Sound.EndContent);
                    current.goto();
                }
            }
        };

        const mover = (direction: boolean, fn: () => Promise<boolean>) => {
            return async () => {
                let stay = await this.runIgnoringGroupInterrupts(fn);
                if (stay == null) {
                    stay = true;
                }
                if (direction)
                    moveUp(stay);
                else moveDown(stay);
            };
        };

        // START-TRAP
        dex.add(async () => {
            if (config.indeterminateFragmentExpandsUpward) {
                this._insideIndeterminateSection = false;
                this.sound(Sound.EndContent);
                endNode?.goto();
            } else {
                this._insideIndeterminateSection = true;
                await this.onEnteringIndeterminateSection();
                current.goto();
            }
        });

        dex.add(mover(true, async () => await this.onLargeStepUp()));
        dex.add(mover(true, async () => await this.onStepUp()));

        const current = dex.add(async () => {
            const ok = await this.onVisitCurrent();
            if (!ok) {

                if (N == 0)
                    dex.unwind();

                this._insideIndeterminateSection = false;
                if (config.indeterminateFragmentExpandsUpward) {
                    startingNode?.goto();
                } else {
                    endNode?.goto();
                }
            }
        }, async () => {
            return await this.onEnterCurrent();
        }).expand(async () => {
            return await this.onExpandCurrent();
        });

        this._indeterminateSectionStart = current;
        this._determinateSectionStart = config.indeterminateFragmentExpandsUpward ? startingNode : endNode;

        dex.add(mover(false, async () => await this.onStepDown()));
        dex.add(mover(false, async () => await this.onLargeStepDown()));

        // END-TRAP
        dex.add(async () => {
            if (config.indeterminateFragmentExpandsUpward) {
                this._insideIndeterminateSection = true;
                await this.onEnteringIndeterminateSection();
                current.goto();
            } else {
                this._insideIndeterminateSection = false;
                this.sound(Sound.EndContent);
                startingNode?.goto();
            }
        });

        if (config.jumpToIndeterminateFragment) {
            this._insideIndeterminateSection = true;
            await this.onEnteringIndeterminateSection();
            dex.rotateIntoFocus(current);
        }

        let handlingKeyPress = false;
        this.tapInput(
            ui => ui.kind == "keyPress",
            ui => {
                if (handlingKeyPress)
                    return;
                handlingKeyPress = true;
                const done = () => {
                    handlingKeyPress = false;
                };
                this.runInIsolation(async () => {
                    await this.onKeyPress(ui as KeyPressUserInput);
                }).then(done, e => {
                    done();
                    this.endWithError(e);
                });
            });

        return await dex.run({
            largeJumpStepSize: 2,
            upstreamRejectedInput: this
        });
    }
}


