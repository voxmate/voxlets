import {Actor, Gesture, HapticSignal, IPrompt, ISpeechOptions, UserInput, Sound} from "../voxmate";
import {Activity, IActivityConstructor, ISayItem, ItemName, Sayable} from "./orc";

type Picked<T> = (item: T) => Promise<any>

export type ILocalVisitor<T> = (item: T) => Promise<void>;

export interface IItem {
    name: ItemName;
}

export interface IActivityDeclaration extends IItem {
    activity: IActivityConstructor;
    expandedActivity?: IActivityConstructor;
    expandedParameters?: any[];
    parameters?: any[];
    item?: any;
}

export interface IPickerConfig<T> {
    startingPosition?: number;

    infoPrompt?: (item: T, idx: number) => string | IPrompt;
    textPrompt?: (item: T, idx: number) => string | IPrompt | Promise<string> | Promise<IPrompt>;

    // Supersedes info and text prompts, and executes this function asSayGroup of Item
    sayGroup?: (item: T, idx: number) => Promise<UserInput | null>;

    speechSettings?: (item: T, idx: number) => ISpeechOptions;

    isDynamic?: boolean;
    isInfoDynamic?: boolean;
    isContentInformational?: boolean;

    help?: string;

    isItemHidden?: (t: T) => Promise<boolean>;

    destructureFromActivityDeclaration?: boolean;  //Should only be used internally. REFACTOR?

    breakRight?: boolean;
    breakKey?: number;          // Matchable Property for Control-Flow Exceptions
    autoskip?: boolean;         // Skips to the next option automatically. Ends at last option. Disabled by default.
    notifyMove?: (idx: number, ui: UserInput | null) => void;

    noBackJumps?: boolean; //TODO: Make this work well with hidden items
    noLargeJumps?: boolean; //TODO: Make this work well with hidden items
    largeJumpStepSize?: number;
    throwRejectedInput?: boolean;
    upstreamRejectedInput?: Activity;
    disableHapticFeedback?: boolean;
}

export interface IPickVisitTitle {
    title: Sayable;
    actor: Actor;
}

export interface IPickVisitOptions<T> extends IPickerConfig<T> {
    paginateItems?: boolean;    // Automatically adds 1., 2. etc to items. Works only if infoPrompt isn't provided.
    implicitVisit?: boolean;    // Visits the option without swipe right. Disabled by default.
    title?: IPickVisitTitle;
}

async function resolveItemName(name: ItemName): Promise<string | IPrompt> {
    if (typeof name === "function") {
        return name();
    }
    return name;
}

function constructOptions<T extends IItem>(options: IPickVisitOptions<T>): IPickerConfig<T> {

    let infoPrompt: ((item: T, idx: number) => string | IPrompt) | null = null;
    let textPrompt = (async (item: T) => await resolveItemName(item.name));

    if (options.paginateItems) {
        infoPrompt = (item, idx) => (idx + 1).toString();
    }

    return {
        scope: false,
        ...{
            "infoPrompt": infoPrompt,
            "textPrompt": textPrompt
        }, ...options
    } as any;
}

export class PickerRejectedInput {
    constructor(public readonly ui: UserInput) {
    }
}

export class PickOneActivity<T> extends Activity<T> {

    protected lastPickUI: UserInput | null = null;

    constructor(protected readonly config: IPickerConfig<T>,
                protected readonly items: T[]) {
        super({isSubordinate: true});
    }

    private getActors(config: IPickerConfig<any>): [Actor, Actor] {

        let contentActor = Actor.DynamicContent;
        let dynamic = config.isDynamic;

        if (dynamic === undefined)
            dynamic = true;

        if (!dynamic) {
            contentActor = Actor.Content;
            if (config.isContentInformational) {
                contentActor = Actor.Informational;
            }
        } else if (config.isContentInformational) {
            contentActor = Actor.DynamicInformational;
        }

        let infoActor = Actor.Informational;
        if (config.isInfoDynamic)
            infoActor = Actor.DynamicInformational;

        return [infoActor, contentActor];
    }

    private makePrompt<T>(item: T, idx: number, config: IPickerConfig<T>): Promise<UserInput | null> {

        if (config.sayGroup)
            return config.sayGroup(item, idx);

        const that = this;

        async function itemNamePrompt() {

            const infof = config.infoPrompt || (() => null) as any;
            const promptf = config.textPrompt!;
            const optf = config.speechSettings || (() => ({})) as any;
            const [infoActor, contentActor] = that.getActors(config);

            const itemInfo = infof(item, idx);
            const itemText: string | IPrompt = await promptf(item, idx);
            const options = optf(item, idx);
            const sayings: ISayItem[] = [];


            let optfActor = options.actor || null;
            if (itemInfo) sayings.push({
                "text": itemInfo,
                "actor": optfActor || infoActor,
                options: options
            });

            if (itemText) sayings.push({
                "text": itemText,
                "actor": optfActor || contentActor,
                options: options
            });


            await that.sayMultiple(sayings, false);
        }

        return this.asSayGroup(itemNamePrompt);
    }

    private checkRejectedUserInput(ui: UserInput | null, config: IPickerConfig<any>) {

        if (!ui || ui.kind == "gesture")
            return;

        if (config.throwRejectedInput)
            throw new PickerRejectedInput(ui);

        if (config.upstreamRejectedInput)
            config.upstreamRejectedInput.input(ui);
    }

    protected async pick<T>(items: T[], config: IPickerConfig<T>, picked: Picked<T> | null = null): Promise<T | null | undefined> {

        const that = this;

        let idx = config.startingPosition || 0;

        let isItemHidden = config.isItemHidden || async function () {
            return false;
        };

        const autoSkipInitial = config.autoskip || false;
        let autoSkip = autoSkipInitial;

        function getItem(idx: number): T {

            let item = items[idx];

            if (config.destructureFromActivityDeclaration) {
                const aitem = item as any as IActivityDeclaration;
                if (aitem.item)
                    return aitem.item;
            }

            return item;
        }

        async function move(step: number, ui: UserInput | null = null): Promise<boolean> {

            let moveCount = 0;

            do {

                idx = (idx + step) % items.length;
                while (idx < 0) idx += items.length;

                // All items are hidden
                if (moveCount++ >= items.length)
                    return false;

                if (step == 0)
                    step = 1;

            } while (await isItemHidden(getItem(idx)));

            if (config.notifyMove)
                config.notifyMove(idx, ui);

            return true;
        }

        async function next() {
            let moveCount = 0;
            while (await isItemHidden(getItem(idx))) {
                await move(1);
                if (moveCount++ >= items.length)
                    return false;
            }
            return true;
        }

        async function haptic() {

            if (config.disableHapticFeedback == true)
                return;

            const enableHapticFeedback = that.voxmateSettings?.enableHapticFeedbackOnMenuOptions;
            if (enableHapticFeedback)
                await that.haptic(HapticSignal.Tick);
        }

        if (!await next())
            return undefined;

        while (this.isActive) {

            if (picked)
                await picked(items[idx]); //SIC, should forward ActivityDeclarae without destructure

            let ui = await this.makePrompt(getItem(idx), idx, config);

            this.checkRejectedUserInput(ui, config);

            if (ui && ui.kind == "gesture") {
                autoSkip = autoSkipInitial && ui.gesture == Gesture.Down;
            } else if (autoSkip) {

                if (idx === items.length - 1)
                    this.sound(Sound.EndContent);

                if (!await move(1))
                    return undefined;

                if (idx == 0) {
                    if (!await move(-1))
                        return undefined;
                    autoSkip = false;
                }

                if (!await next())
                    return undefined;

            }

            if (!ui && !autoSkip) {
                ui = await this.get();
                this.checkRejectedUserInput(ui, config);
            }

            if (ui && ui.kind == "gesture") {
                if (autoSkipInitial && ui.gesture == Gesture.Down) {
                    autoSkip = true;
                }

                let largeStep = config.largeJumpStepSize ?? Math.min(15, Math.max(2, Math.floor(0.2 * items.length)));
                if (config.noLargeJumps)
                    largeStep = 1;

                switch (ui.gesture) {

                    case Gesture.Down:
                        await haptic();

                        if (!await move(1, ui))
                            return undefined;

                        break;

                    case Gesture.DoubleUp: {
                        await haptic();
                        let backMoveRange = largeStep;
                        if (config.noBackJumps)
                            backMoveRange = largeStep + Math.min(idx - largeStep, 0);

                        if (!await move(-backMoveRange, ui)) {
                            return undefined;
                        }
                        break;
                    }


                    case Gesture.DoubleDown:
                        await haptic();
                        if (!await move(largeStep, ui)) {
                            return undefined;
                        }
                        break;

                    case Gesture.Up:
                        await haptic();

                    {
                        let allowBackMove = true;
                        if (config.noBackJumps)
                            if (idx - 1 < 0)
                                allowBackMove = false;

                        if (allowBackMove) {
                            if (!await move(-1, ui))
                                return undefined;
                        } else this.sound(Sound.EndContent);
                    }

                        break;

                    case Gesture.Right:
                    case Gesture.DoubleRight:
                    case Gesture.DoubleTap:
                        if (picked == null || config.breakRight) {
                            this.lastPickUI = ui;
                            return items[idx];
                        } else break;

                    case Gesture.Poke:
                        if (!await move(0, ui))
                            return undefined;
                        continue;

                    default:
                        this.checkRejectedUserInput(ui, config);
                        console.log("Invalid Picker Input", JSON.stringify(ui));
                }
            }

            this.checkRejectedUserInput(ui, config);

        }
    }

    protected async run(): Promise<T | null | undefined> {
        return await this.pick(this.items, this.config);
    }
}

class LocalActivity<T> extends Activity {

    constructor(private readonly visitor: ILocalVisitor<T>, private readonly item: T) {
        super({isSubordinate: true, cascade: true});
    }

    protected async run() {
        await this.visitor(this.item);
    }
}

export class PickerBreakLoopToken {
    constructor(public readonly breakKey: number, readonly breakValue: any | undefined) {
    }
}

export class PickerGotoIndex {
    constructor(public readonly breakKey: number, public readonly index: number) {

    }
}

export class PickVisitActivity extends PickOneActivity<IActivityDeclaration> {

    private broken: boolean = false;
    private breakValue: any;

    constructor(items: IActivityDeclaration[], private readonly options: IPickVisitOptions<IActivityDeclaration> = {}) {
        super(constructOptions(options), items);
    }

    breakLoop(value?: any) {
        this.broken = true;
        this.breakValue = value;
    }

    protected async pickloop<T>(items: T[], config: IPickerConfig<T>, picked: Picked<T>, implicit: boolean = false) {

        let backOne = false;

        if (this.options.title) {
            const title = this.options.title;
            const ui = await this.say(title.title, {actor: title.actor});
            if (ui != null && ui.kind == "gesture" && ui.gesture == Gesture.Up) {
                backOne = true;
            }
        }

        let idx = config.startingPosition || 0;
        if (items.length > 0 && backOne) {
            idx = items.length - 1;
        }

        while (!this.ended && !this.broken) {
            try {

                config.startingPosition = idx;

                if (implicit) {
                    const item = await this.pick(items, config, picked);
                    if (item == null || config.breakRight) {
                        return item;
                    }

                    idx = items.indexOf(item);
                    if (config.notifyMove)
                        config.notifyMove(idx, null);
                } else {

                    const item = await this.pick(items, config);
                    if (item == null)
                        return null;

                    idx = items.indexOf(item);
                    if (config.notifyMove)
                        config.notifyMove(idx, null);

                    const result = await picked(item);
                    if (result !== undefined)
                        return result;
                }
            } catch (e) {

                let unhandled = true;

                if (e instanceof PickerGotoIndex) {
                    if (e.breakKey === this.config.breakKey) {
                        idx = e.index;
                        if (config.notifyMove)
                            config.notifyMove(idx, null);
                        unhandled = false;
                    }
                }

                if (e instanceof PickerBreakLoopToken) {
                    if (e.breakKey === this.config.breakKey) {
                        this.breakLoop(e.breakValue);
                        unhandled = false;
                    }
                }

                if (unhandled)
                    throw e;
            }
        }

        return this.breakValue;
    }

    protected override async run() {
        return await this.pickloop(this.items, this.config, async (item) => {

            let constructor = item.activity;
            let params = item.parameters || [];

            const expanded = this.lastPickUI && this.lastPickUI.kind == "gesture" && this.lastPickUI.gesture == Gesture.DoubleTap;
            if (expanded && item.expandedActivity) {
                constructor = item.expandedActivity;
                params = item.expandedParameters || [];
            }

            this.lastPickUI = null;
            const activity = new constructor(...params);
            return await this.exec(activity);
        }, !!this.options.implicitVisit);
    }
}

export class PickVisitItems<T extends IItem> extends PickVisitActivity {

    private static constructForwardParams<T extends IItem>(activity: IActivityConstructor, items: T[]): IActivityDeclaration[] {
        const declarations: IActivityDeclaration[] = [];
        for (let item of items)
            declarations.push({activity: activity, name: item.name, parameters: [item], item: item});
        return declarations;
    }

    constructor(activity: IActivityConstructor, items: T[], options: IPickVisitOptions<T> = {}) {
        super(PickVisitItems.constructForwardParams(activity, items), {
            ...options,
            destructureFromActivityDeclaration: true
        } as any);
    }
}

export class PickVisitItemsLocal<T extends IItem> extends PickVisitActivity {

    private static constructForwardParams<T>(items: IItem[], visitor: ILocalVisitor<T>): IActivityDeclaration[] {
        const declarations: IActivityDeclaration[] = [];
        for (let item of items)
            declarations.push({activity: LocalActivity, name: item.name, parameters: [visitor, item], item: item});
        return declarations;
    }

    constructor(items: T[], visitor: ILocalVisitor<T>, options: IPickVisitOptions<T> = {}) {
        super(PickVisitItemsLocal.constructForwardParams<T>(items, visitor), {
            scope: false, ...options, destructureFromActivityDeclaration: true
        } as any);
    }
}

