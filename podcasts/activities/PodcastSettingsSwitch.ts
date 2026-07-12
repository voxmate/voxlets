import {IPickVisitOptions} from "@voxmate/orc/pickers";
import {ISwitch, NamedValueItem, SwitchActivity} from "@voxmate/orc/SwitchActivity";
import {ActivityBase} from "./ActivityBase";
import {IPodcastData} from "../services/podcastDataService";

export abstract class PodcastSettingsSwitch extends ActivityBase {

    abstract setSetting(settings: IPodcastData, value: any);

    abstract getSetting(settings: IPodcastData): any;

    abstract getOptions(): NamedValueItem[];

    static setPickerSettings(): IPickVisitOptions<NamedValueItem> {
        return {isDynamic: false, breakRight: true}
    }

    protected async run() {

        const that = this;
        const opts: ISwitch<NamedValueItem> = {
            async getOptions(): Promise<NamedValueItem[]> {
                return that.getOptions();
            },
            async setValue(value: any): Promise<any> {
                const settings = that.dataService.podcastData;
                that.setSetting(settings, value);
                that.dataService.save();
            },
            async getCurrentValue(): Promise<any> {
                const settings = that.dataService.podcastData;
                return that.getSetting(settings);
            }
        };

        await this.exec(new SwitchActivity(opts, PodcastSettingsSwitch.setPickerSettings()));
    }
}