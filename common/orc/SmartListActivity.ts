import {RollActivity} from "./RollActivity";
import {Rolodex, RolodexEntryBuilder} from "./rolodex";
import {KeyKind, Sound, VoiceInputMode} from "../voxmate";
import {PickerRejectedInput} from "./pickers";

type Slot = {
    pinned: boolean;
    hidden: boolean;
}

function sortArrayByBooleanProperty<T>(array: T[], fn: (t: T) => boolean) {
    array.sort((a, b) => {
        const ab = fn(a) ? 1 : 0;
        const bb = fn(b) ? 1 : 0;
        return bb - ab;
    });
}

export class SmartListChanged<T> {
    constructor(readonly key?: string) {
    }
}

export type SmartListSettings = {
    collectionName: string;
    itemName: string | null;
    searchable: boolean;
}

export abstract class SmartListActivity<T> extends RollActivity<void> {

    private slots: { [key: string]: Slot } = {};
    private settings: SmartListSettings;

    // region Smart List INTERFACE

    abstract getList(): T[];

    abstract getItemKey(item: T): string;

    abstract getItemLabel(item: T): string;

    abstract openItem(item: T): Promise<void>;

    async presentItem(item: T) {
        await this.sayDynamicContent(this.getItemLabel(item));
    }

    // endregion

    private getSlot(item: T): Slot {

        const savedSlot = this.slots[this.getItemKey(item)];
        if (savedSlot)
            return savedSlot;

        return {pinned: false, hidden: false};
    }

    private saveSlot(item: T, slot: Slot) {

        const key = this.getItemKey(item);

        if (slot.pinned === false && slot.hidden === false) {
            delete this.slots[key];
        } else {
            this.slots[key] = slot;
        }

        localStorage.setItem("slots", JSON.stringify(this.slots), this.namespace);
    }

    private change(item: T, fn: (slot: Slot) => void) {

        const slot = this.getSlot(item);
        fn(slot);
        this.saveSlot(item, slot);
        this.sound(Sound.Good);
        throw new SmartListChanged(this.getItemKey(item));
    }

    private verifyUniqueKeys() {
        const set = new Set();
        for (let item of this.getList()) {
            const itemKey = this.getItemKey(item);
            if (set.has(itemKey))
                throw Error("SmartList collection has duplicate key: " + itemKey);
            set.add(itemKey);
        }
    }

    private update() {
        this.slots = JSON.parse(localStorage.getItem("slots", this.namespace) ?? "{}");
    }

    addItemOptions(options: Rolodex, item: T) {

        const slot = this.getSlot(item);

        options.add(async () => {
            if (this.settings.itemName)
                await this.sayDynamicInfo(`Open ${this.settings.itemName}`);
            else await this.sayDynamicInfo("Open");
        }, async () => {
            await this.openItem(item);
            return true;
        });

        if (!slot.hidden)
            options.add(async () => {

                if (slot.pinned) {
                    await this.sayDynamicInfo("Un-pin");
                } else {
                    await this.sayDynamicInfo("Pin");
                }

            }, async () => {
                this.change(item, (slot) => {
                    slot.pinned = !slot.pinned;
                });
            });

        options.add(async () => {
            if (slot.hidden) {
                await this.sayDynamicInfo("Un-hide");
            } else {
                await this.sayDynamicInfo("Hide");
            }
        }, async () => {
            this.change(item, (slot) => {
                slot.hidden = !slot.hidden;
            });
        });
    }

    addListOptions(list: Rolodex) {

    }

    constructor(private readonly namespace: string, settings: Partial<SmartListSettings> = {}) {
        super({voiceInputMode: VoiceInputMode.DictationInput});

        this.settings = {
            collectionName: "Items",
            itemName: null,
            searchable: true,
            ...settings
        };
    }

    async onVoiceCommand(transcript: string): Promise<any> {
        return {"transcript": transcript};
    }

    private createEntry(dex: Rolodex, item: T) {
        return dex.add(async () => {
            await this.presentItem(item);
        }, async () => {
            await this.openItem(item);
        }).expand(async () => {
            const options = this.roll();
            this.addItemOptions(options, item);
            await options.run();
        });
    }

    private searchList(search: string | undefined, items: T[]): T[] {
        if (!search || search.length == 0)
            return items;

        const matches: T[] = [];

        search = search.toLowerCase();

        for (let item of items) {
            const label = this.getItemLabel(item).toLowerCase();
            if (label.includes(search))
                matches.push(item);
        }

        sortArrayByBooleanProperty(matches, item => !this.getSlot(item).hidden);

        return matches;
    }

    protected async run(): Promise<void> {

        let focus: string | undefined = undefined;
        let searchFilter: string | undefined = undefined;

        while (this.isActive) {

            if (this.getList().length === 0) {
                await this.sayDynamicInfo("There is nothing here");
                return;
            }

            this.verifyUniqueKeys();

            const searching = searchFilter && searchFilter.length > 0;

            let list = this.getList().slice();
            let fullList = list;

            this.update();

            if (searching) {
                list = this.searchList(searchFilter, list);
                if (list.length === 0) {
                    await this.sayInfo("Nothing found");
                    focus = undefined;
                    searchFilter = undefined;
                    continue;
                }
            } else {
                list = list.filter(item => !this.getSlot(item).hidden);
                sortArrayByBooleanProperty(list, item => this.getSlot(item).pinned);
            }

            const itemListDex = this.roll();
            let dexFocusedItem: RolodexEntryBuilder = null;
            for (let item of list) {
                const builder = this.createEntry(itemListDex, item);
                if (this.getItemKey(item) === focus)
                    dexFocusedItem = builder;
            }

            if (searching) {
                itemListDex.add(async () => {
                    await this.sayDynamicInfo("Clear Search");
                }, async () => {
                    searchFilter = undefined;
                    focus = undefined;
                    this.sound(Sound.Good);
                    throw new SmartListChanged();
                });
            } else {

                const hiddenList = fullList.filter(item => this.getSlot(item).hidden);
                if (hiddenList.length > 0) {
                    itemListDex.add(async () => {
                        await this.sayDynamicInfo(`Hidden ${this.settings.collectionName}`);
                    }, async () => {
                        const hiddenDex = this.roll();
                        for (let item of hiddenList)
                            this.createEntry(hiddenDex, item);
                        await hiddenDex.run();
                    });
                }

                if (this.settings.searchable) {
                    itemListDex.add(async () => {
                        await this.sayDynamicInfo("Search");
                    }, async () => {
                        const search = await this.editField(undefined);
                        if (search !== searchFilter) {
                            searchFilter = search;
                            focus = undefined;
                            this.sound(Sound.Good);
                            throw new SmartListChanged();
                        }
                    });
                }

                this.addListOptions(itemListDex);
            }

            if (dexFocusedItem)
                itemListDex.rotateIntoFocus(dexFocusedItem);

            try {
                await itemListDex.run({throwRejectedInput: true});
            } catch (e) {
                if (e instanceof PickerRejectedInput) {

                    if (e.ui.kind == "object") {
                        if ("transcript" in e.ui.object)
                            searchFilter = e.ui.object["transcript"];
                    } else if (e.ui.kind == "keyPress") {
                        if (e.ui.keyKind == KeyKind.Escape || e.ui.keyKind == KeyKind.Backspace)
                            searchFilter = undefined;
                        else searchFilter = await this.editField(undefined, {typed: e.ui});
                    }

                    focus = undefined;
                    continue;
                } else if (e instanceof SmartListChanged) {
                    focus = e.key;
                    continue;
                }

                throw e;
            }

            if (itemListDex.halted)
                return;
        }

    }

}

export abstract class SmartStaticListActivity<T> extends SmartListActivity<T> {
    constructor(private readonly list: T[], namespace: string, settings: Partial<SmartListSettings>) {
        super(namespace, settings);
    }

    getList(): T[] {
        return this.list;
    }
}

