import {IActivityConstructor, IActivityOptions} from "./orc";
import {PickVisitItemsLocal} from "./pickers";
import {IPrompt} from "../voxmate";
import {RollActivity} from "./RollActivity";
import {shuffleArray} from "../utility/random";

export interface IMenuItemBase<T> {
    name: string | IPrompt;
    hideWhen?: () => Promise<boolean>;
}

export interface IPayloadDescriptor<T> extends IMenuItemBase<T> {
    payload: T
}

export interface IActivityDescriptor<T> extends IMenuItemBase<T> {
    activity: IActivityConstructor
    parameters?: any[]
}

export interface ISubmenu<T> extends IMenuItemBase<T> {
    submenu: IMenuItem<T>[]
}

export type IMenuItem<T> = IPayloadDescriptor<T> | ISubmenu<T> | IActivityDescriptor<T>

export function isSubmenu<T>(menuitem: IMenuItem<T>): menuitem is ISubmenu<T> {
    return (menuitem as any).submenu != undefined
}

export function isPayload<T>(menuitem: IMenuItem<T>): menuitem is IPayloadDescriptor<T> {
    return (menuitem as any).payload != undefined
}

interface IDeepMenuOptions extends IActivityOptions {
    isDynamicMenu?: boolean,
    emptyOptionsPrompt?: string | IPrompt;
}

export abstract class DeepMenuActivity<T> extends RollActivity<T> {

    constructor(private readonly deepMenuOptions: IDeepMenuOptions = {}) {
        super(deepMenuOptions)
    }

    protected async run(): Promise<void> {

        let submenu = await this.menu();

        if (!submenu || submenu.length === 0) {

            let prompt: string | IPrompt = "There are no options in this menu";
            if (this.deepMenuOptions.emptyOptionsPrompt) {
                prompt = this.deepMenuOptions.emptyOptionsPrompt;
            }

            await this.sayInfo(prompt);
            return undefined;
        }

        await this.dive({name: "???", submenu: submenu});

        return undefined;
    }

    private async dive(menu: ISubmenu<T>) {

        if (this.orchestrator.environment.fuzzing)
            shuffleArray(menu.submenu);

        async function isItemHidden(item: IMenuItem<T>): Promise<boolean> {
            if (item.hideWhen) {
                return await item.hideWhen();
            }
            return false;
        }

        let dynamic = false;
        if (this.deepMenuOptions.isDynamicMenu) {
            dynamic = true;
        }

        await this.exec(new PickVisitItemsLocal(menu.submenu, async (item: IMenuItem<T>) => {

            if (isSubmenu(item)) {
                await this.dive(item);
            } else if (isPayload(item)) {
                await this.handle(item.payload);
            } else {
                await this.exec(new item.activity(...(item.parameters || [])))
            }
        }, {isDynamic: dynamic, isItemHidden: isItemHidden}));
    }

    abstract menu(): Promise<IMenuItem<T>[]>;

    async handle(item: T): Promise<void> {

    };

}