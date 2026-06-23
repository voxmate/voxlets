import {Activity, IActivityConstructor, ItemName, Sayable} from "./orc";
import voxmate, {Actor, IPrompt, UserInput, Sound} from "../voxmate";
import {
    IActivityDeclaration,
    IPickVisitOptions,
    IPickVisitTitle,
    PickerBreakLoopToken,
    PickerGotoIndex,
    PickVisitActivity
} from "./pickers";

import {RollActivity} from "./RollActivity";
import {Action, AsyncAction} from "./types";

export type ConditionExpression = (this: Activity) => Promise<boolean>
export type ExtendedNameType = (() => Promise<void>) | ItemName;
export type ActivateOptionAction = Action | AsyncAction

interface IRolodexEntry {
    activityDeclaration: IActivityDeclaration;
    nameFunction: ExtendedNameType | null;
    condition: ConditionExpression | null;
    leave: Action | null;
    autoskip: boolean;
    sound?: Sound;
}

class RolodexToken {
    constructor(public readonly id: number, public reason: string | IPrompt | undefined) {
    }
}

class RolodexUnwindToken extends RolodexToken {
    constructor(id: number, readonly value: any) {
        super(id, undefined);
    }
}

class RolodexGotoToken extends RolodexToken {
    constructor(id: number, readonly index: number) {
        super(id, undefined);
    }
}


class RolodexIndirectActivity extends Activity {

    constructor(private readonly rolodexId: number, protected readonly activation: ActivateOptionAction) {
        super({isSubordinate: true});
    }

    async handleIndirection(): Promise<any> {
        if (this.activation == null)
            return undefined;
        return this.activation();
    }

    protected async run(): Promise<any> {
        try {
            return await this.handleIndirection();
        } catch (e) {

            if (e instanceof RolodexGotoToken) {
                if (e.id === this.rolodexId) {
                    throw new PickerGotoIndex(this.rolodexId, e.index);
                }
            }

            if (e instanceof RolodexUnwindToken) {
                if (e.id === this.rolodexId)
                    throw new PickerBreakLoopToken(e.id, e.value);
            }

            throw e;
        }
    }
}

class RolodexExpandIndirectActivity extends RolodexIndirectActivity {

    override async handleIndirection(): Promise<any> {
        if (this.activation == null)
            return undefined;
        this.sound(Sound.Expand);
        return this.activation();
    }
}

class RolodexNOOPActivity extends Activity {
    protected async run(): Promise<void | undefined> {
        voxmate.audio.sound(Sound.EndContent);
    }
}

export interface RolodexOptions extends IPickVisitOptions<IActivityDeclaration> {
    defaultReturn?: any;
    haltReturn?: any;
    throwRejectedInput?: boolean,

    // Specifies a target activity for all rejected input of this picker
    upstreamRejectedInput?: Activity;
}

export class RolodexEntryBuilder {

    constructor(private readonly rolodex: Rolodex, private readonly entry: IRolodexEntry, public index: number) {

    }

    get rolodexId(): number {
        return this.rolodex.id;
    }

    first(condition: boolean = true): this {
        if (condition)
            this.rolodex.rotateIntoFocus(this);
        return this;
    }

    showWhen(condition: ConditionExpression): this {
        this.entry.condition = condition;
        return this;
    }

    expand(activation: AsyncAction): this {
        this.entry.activityDeclaration.expandedActivity = RolodexExpandIndirectActivity;
        this.entry.activityDeclaration.expandedParameters = [this.rolodexId, activation];
        this.entry.sound = Sound.ExpandHint;
        return this;
    }

    onLeave(leave: Action): this {
        this.entry.leave = leave;
        return this;
    }

    autoskip() {
        this.entry.autoskip = true;
        return this;
    }

    goto(): never {
        throw new RolodexGotoToken(this.rolodex.id, this.index);
    }

    next() {
        if (this.rolodex.size > 1)
            this.rolodex.goto(this.index + 1);
    }
}

export enum ReaderFinalState {
    QuickToEnd,
    QuickSkipped,
    QuickExit,
    ReadExpanded,
}

export interface IReaderOptions {

}

type HaltHandler = (() => Promise<void>) | (() => void);

export class Rolodex {
    private static _rolodexIdGen = 1;

    readonly id = Rolodex._rolodexIdGen++;

    private _roller: IRolodexEntry[] = [];
    private _steps: RolodexEntryBuilder[] = [];
    private _defaultActor: Actor = Actor.DynamicContent;
    private _lastUserInputSequence = 0;
    private _lastUI: UserInput | null = null;
    private _title: IPickVisitTitle | undefined = undefined;
    private _haltHandler: HaltHandler | null = null;
    private _halted = false;

    private addRolodexEntry(entry: IRolodexEntry): RolodexEntryBuilder {
        this._roller.push(entry);
        const step = new RolodexEntryBuilder(this, entry, this._roller.length - 1);
        this._steps.push(step);
        return step;
    }

    private addEntry(name: ExtendedNameType, activity: IActivityConstructor, params: any[]): RolodexEntryBuilder {
        return this.addRolodexEntry({
            activityDeclaration: {
                name: "",
                activity: activity,
                parameters: params,
            },
            nameFunction: name,
            condition: null,
            leave: null,
            autoskip: false
        });
    }

    private build(options: RolodexOptions = {}): Activity {

        if (this._roller.length === 0)
            return new RolodexNOOPActivity();

        const rolodexId = this.id;
        const that = this;

        let currentIndex: number | null = null;

        const visitHandler = async function (item: any, idx: number): Promise<UserInput | null> {
            const entry = that._roller[idx];
            return that.activity.asSayGroup(async () => {
                try {
                    const nf = entry.nameFunction;

                    if (nf) {
                        if (typeof nf === "string")
                            await that.activity.say(nf, {actor: that._defaultActor});

                        if (typeof nf === "object") // Must be an IPrompt
                            await that.activity.say(nf, {actor: that._defaultActor});

                        if (typeof nf === "function") {
                            const result = await nf();

                            if (typeof result === "string")
                                await that.activity.say(result, {actor: that._defaultActor});

                            if (typeof result === "object") // Must be an IPrompt
                                await that.activity.say(result, {actor: that._defaultActor});
                        }
                    }

                    if (entry.autoskip) {
                        that._steps[idx].next();
                    }

                    if (entry.sound) {
                        that.activity.sound(entry.sound);
                    }

                } catch (e) {
                    if (e instanceof RolodexGotoToken) {
                        if (e.id === rolodexId) {
                            throw new PickerGotoIndex(rolodexId, e.index);
                        }
                    } else {
                        throw e;
                    }
                }
            });
        };

        const activityList: IActivityDeclaration[] = [];
        for (let entry of this._roller)
            activityList.push(entry.activityDeclaration);

        async function isItemHidden(activity: IActivityDeclaration) {
            const idx = activityList.indexOf(activity);
            const entry = that._roller[idx];
            if (entry.condition === null)
                return false;

            return !await entry.condition.call(that.activity);
        }

        function notifyClose() {
            if (currentIndex === null)
                return;

            const leave = that._roller[currentIndex].leave;
            if (leave)
                leave();
        }

        function notifyMove(idx: number, ui: UserInput | null) {
            that._lastUI = ui;
            notifyClose();
            currentIndex = idx;
        }

        const fullOptions: IPickVisitOptions<IActivityDeclaration> = {
            sayGroup: visitHandler,
            title: this._title,
            ...options,
            breakKey: this.id,
            isItemHidden: isItemHidden,
            notifyMove: notifyMove
        };

        const activity = new PickVisitActivity(activityList, fullOptions);
        activity.onEnd(notifyClose);
        return activity;
    }

    constructor(readonly activity: RollActivity) {
    }

    get size(): number {
        return this._roller.length;
    }

    get lastUI(): UserInput | null {
        return this._lastUI;
    }

    setActor(actor: Actor): this {
        this._defaultActor = actor;
        return this;
    }

    setTitle(title: string, actor: Actor = Actor.Informational): this {
        this._title = {title: title, actor: actor};
        return this;
    }

    add(selection: ExtendedNameType, activation: IActivityConstructor | AsyncAction | null = null): RolodexEntryBuilder {

        if (typeof selection === "function") {
            const rolodexId = this.id;
            const originalNameFunction = selection;
            const wrapper = async () => {
                try {
                    return await originalNameFunction();
                } catch (e) {
                    if (e instanceof RolodexGotoToken) {
                        if (e.id === rolodexId) {
                            throw new PickerGotoIndex(rolodexId, e.index);
                        }
                    } else {
                        throw e;
                    }
                }
            };
            selection = wrapper as any;
        }

        if (activation === null) // Just a prompt
            return this.addEntry(selection, RolodexNOOPActivity, []);

        if (activation.prototype instanceof Activity)
            return this.addEntry(selection, activation as IActivityConstructor, []);

        // Must be ActivityAction
        return this.addEntry(selection, RolodexIndirectActivity, [this.id, activation]);
    }

    /**
     * @deprecated This Reader should not be used. Use the Gen2 reader.
     */
    addLongReader(title: string, options: IReaderOptions, ...sayableItems: Sayable[]) {
        const option = this.add(async () => {
            const rl = await this.activity.readLongDeprecated(title, sayableItems);

            if (rl === ReaderFinalState.QuickExit)
                this.unwind();

            if (rl === ReaderFinalState.QuickToEnd || rl == ReaderFinalState.ReadExpanded)
                option.next();
        });
    }

    unwind(value: any = undefined): never {
        throw new RolodexUnwindToken(this.id, value);
    }

    async run(options: RolodexOptions = {}): Promise<any> {
        const activity = this.build(options);
        try {
            const defaultReturn = options.defaultReturn ?? undefined;
            const returnValue = await this.activity.exec(activity) ?? defaultReturn;

            if (activity.halted) {
                this._halted = true;
                if (this._haltHandler)
                    return await this._haltHandler();
                return options.haltReturn ?? returnValue;
            }

            return returnValue;

        } catch (e) {
            if (e instanceof RolodexUnwindToken && e.id === this.id) {
                return e.value;
            } else {
                throw e;
            }
        } finally {
            this._lastUserInputSequence = activity.orchestrator.lastUserInputSequence;
        }
    }

    async runBlockingLeft(options: RolodexOptions = {}) {
        let exitSequenceNumber = -100;
        while (this.activity.isActive) {
            await this.run(options);
            const lastUISequenceNumber = this._lastUserInputSequence;
            if (exitSequenceNumber === lastUISequenceNumber - 1)
                break;
            exitSequenceNumber = lastUISequenceNumber;
            voxmate.audio.sound(Sound.Separator);
        }
    }

    rotateIntoFocus(option: RolodexEntryBuilder | null) {

        if (!option)
            throw Error("invalid option");

        if (this.id !== option.rolodexId || this._steps.length < 1)
            throw Error("Element not member of this Rolodex");

        let shifts = 0;
        while (this._steps[0] !== option && shifts < this._steps.length) {
            shifts++;
            this._steps.unshift(this._steps.pop()!);
            this._roller.unshift(this._roller.pop()!);
        }

        if (this._steps[0] !== option)
            throw Error("Element not member of this Rolodex. Internal Error");

        for (let i = 0; i < this._steps.length; i++)
            this._steps[i].index = i;
    }

    async paginate(idx: number, total: number = -1, what: string = "") {
        await this.activity.paginate(idx, total, what);
    }

    goto(index: number) {
        this._steps[index % this.size].goto();
    }

    getStep(index: number): RolodexEntryBuilder | null {
        return this._steps[index] ?? null;
    }

    onHalt(haltHandler: HaltHandler) {
        this._haltHandler = haltHandler;
    }

    get halted() {
        return this._halted;
    }
}