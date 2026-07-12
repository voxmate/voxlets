import {NamedValueItem} from "@voxmate/orc/SwitchActivity";
import {PodcastSettingsSwitch} from "./PodcastSettingsSwitch";
import {IPodcastData} from "../services/podcastDataService";

export class PodcastPlaybackSleepTimer extends PodcastSettingsSwitch {

    constructor() {
        super();
    }

    getOptions(): NamedValueItem[] {
        return [
            {"name": "5 Minutes", "value": 5},
            {"name": "10 Minutes", "value": 10},
            {"name": "15 Minutes", "value": 15},
            {"name": "20 Minutes", "value": 20},
            {"name": "30 Minutes", "value": 30},
            {"name": "45 Minutes", "value": 45},
            {"name": "1 Hour 20 minutes", "value": 80},
            {"name": "1 Hour 40 minutes", "value": 100},
            {"name": "2 Hours", "value": 120},
        ];
    }

    getSetting(settings: IPodcastData): any {
        return settings.sleepTimer;
    }

    setSetting(settings: IPodcastData, value: any) {
        settings.sleepTimer = value;
    }
}