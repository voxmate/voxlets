import {IItem, IPickVisitOptions, PickVisitItemsLocal} from "./pickers";
import {Activity} from "./orc";


export interface NamedValueItem extends IItem {
    value: any
}

export interface ISwitch<T extends NamedValueItem> {

    getOptions(): Promise<T[]>

    getCurrentValue(): Promise<any>

    setValue(value: T): Promise<void>

}

export class SwitchActivity<T extends NamedValueItem> extends Activity {

    constructor(private readonly config: ISwitch<T>,
                private readonly pickerSettings: IPickVisitOptions<T> = {}) {
        super({isSubordinate: true})
    }

    private _rotation = 0;
    get rotation() {
        return this._rotation;
    }

    private rotateBy(options: T[], n: number) {
        for (let i = 0; i < n; ++i)
            options.push(options.shift());
    }

    private rotateOptions(options: T[], current: any) {
        const idx = options.findIndex((v) => v.value == current);
        this._rotation = idx;
        this.rotateBy(options, idx);
    }

    protected async run() {

        const options = await this.config.getOptions();
        if (!options || options.length === 0)
            return;

        const current = await this.config.getCurrentValue();

        this.rotateOptions(options, current);

        const picker = new PickVisitItemsLocal(options, async (item: T) => {
            if (await this.config.getCurrentValue() != item.value)
                await this.config.setValue(item.value)
        }, {implicitVisit: true, ...this.pickerSettings});

        await this.exec(picker);

    }

}