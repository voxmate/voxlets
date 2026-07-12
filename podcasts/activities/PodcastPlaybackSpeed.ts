import {NamedValueItem} from "@voxmate/orc/SwitchActivity";
import {PodcastSettingsSwitch} from "./PodcastSettingsSwitch";
import {IPodcastData} from "../services/podcastDataService";

export class PodcastPlaybackSpeed extends PodcastSettingsSwitch {

    getOptions(): NamedValueItem[] {
        return [
            {"name": "Normal Speed", "value": 1},
            {"name": "25% Faster", "value": 1.25},
            {"name": "50% Faster", "value": 1.5},
            {"name": "Double Speed", "value": 2},
        ];
    }

    getSetting(settings: IPodcastData): any {
        return settings.speed;
    }

    setSetting(settings: IPodcastData, value: any) {
        settings.speed = value;
    }
}