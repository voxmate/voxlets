import {RichActivity} from "./RichActivity";
import {Sound} from "../voxmate";
import {Rolodex, RolodexEntryBuilder} from "./rolodex";
import {IDict} from "../utility/types";

export type VoxletFieldType = {
    type: "switch",
    target: string
    name: string
    description?: string
}

export interface IVoxletSettings {
    fields: VoxletFieldType[];
}

interface MultiSwitchSettingsBase<T = number | string | boolean> {

    getValue: () => Promise<T>;
    setValue: (value: T) => Promise<void>;

    name: string;
    description?: string;
    exit?: boolean;
    plural?: boolean;
}

export interface SwitchSettings extends MultiSwitchSettingsBase<boolean> {
}

export interface MultiSwitchSettings<T = number | string | boolean> extends MultiSwitchSettingsBase<T> {
    options: IDict<T>,
}

export function dexAddMultiSwitch<T>(dex: Rolodex, settings: MultiSwitchSettings<T>) {

    let labels: { [t: string]: string } = {};
    for (let label in settings.options) {
        const optionValueRepr = (settings.options[label] as any).toString();
        labels[optionValueRepr] = label;
    }

    function getLabel(option: T): string {
        return labels[(option as any).toString()];
    }

    dex.add(async () => {
        const current = await settings.getValue();
        const label = getLabel(current);
        const verb = settings.plural ? "are" : "is";
        await dex.activity.sayDynamicContent(`${settings.name} ${verb} ${label}`);

        if (settings.description) {
            await dex.activity.delay(1500);
            await dex.activity.sayDynamicInfo(settings.description);
        }

    }, async () => {
        const switcher = dex.activity.roll();
        const initial = await settings.getValue();

        let first: RolodexEntryBuilder | null = null;
        for (let option of Object.keys(settings.options)) {
            const value = settings.options[option];
            const entry = switcher.add(option, async () => value);
            if (value == initial || !first)
                first = entry;
        }

        first!.first(true);

        const choice = await switcher.run();
        if (choice !== undefined && choice != initial) {
            await settings.setValue(choice);
            dex.activity.sound(Sound.Good);
            if (settings.exit)
                dex.unwind();
        }
    });
}

export function dexAddSwitch(dex: Rolodex, settings: SwitchSettings) {
    return dexAddMultiSwitch<boolean>(dex, {
        ...settings, options: {"Enabled": true, "Disabled": false}
    });
}

export class VoxletSettingsManager extends RichActivity {

    protected async addBefore(dex: Rolodex) {

    }

    protected async addAfter(dex: Rolodex) {

    }

    protected async run() {
        const dex = this.roll();

        await this.addBefore(dex);

        const manifest = voxmate.system.reflection.getVoxletManifest();
        const settingsObject: IVoxletSettings = JSON.parse(manifest.settingsJson) ?? {"fields": []};

        let changed = false;
        const settings = await this.getVoxletSettings(true);

        this.onEnd(async () => {
            if (changed)
                await this.getVoxletSettings(true);
        });

        for (let field of settingsObject.fields) {
            if (field.type == "switch") {
                dexAddSwitch(dex, {
                    getValue: async () => settings[field.target],
                    setValue: async (option) => {
                        changed = true;
                        settings[field.target] = option;
                        await this.saveVoxletSettings(settings);
                    },
                    name: field.name,
                    description: field.description
                });
            }
        }

        await this.addAfter(dex);

        await dex.run();
    }
}

