import {Activity, IService} from "@voxmate/orc/orc";
import {
    IFavoriteStations,
    IRadioSettings,
    IStation,
    IStationDescriptor,
    IStationGroup,
    RestartRadio
} from "./common/common.radio";
import {RadioStreamActivity} from "./activities/RadioStreamActivity";
import {RichActivity} from "@voxmate/orc/RichActivity";
import {Sound} from "@voxmate/voxmate";
import {Rolodex} from "@voxmate/orc/rolodex";
import {RadioMainActivity} from "./activities/RadioMainActivity";

export class RadioService implements IService {

    static inject = Symbol("radio");

    constructor(private readonly root: RadioMainActivity) {

    }

    private async getStationFromDescriptor(context: RichActivity, descriptor: IStationDescriptor): Promise<IStation | null> {

        const station = await context.fhttp("voxlet_radio", "resolveStreams", {"guideId": descriptor.id}) as
            { compatible: boolean, url: string };

        if (!station.compatible) {
            await context.sayDynamicInfo(`Sorry, I am unable to get a compatible stream for ${descriptor.name}`);
            return null;
        }

        return {...descriptor, url: station.url, group: ""};
    }

    async getFavoriteStations(): Promise<IFavoriteStations> {

        const radioSettings = await this.getSettings();

        console.log("settings", radioSettings);

        const stations: IStation[] = [];
        const groups: { [groupName: string]: IStation[] } = {};

        if (radioSettings.stations) {
            for (let station of radioSettings.stations) {

                // Somehow station can be set to null
                if (!station)
                    continue;

                // Filter out stations in old format
                if ("streams" in station)
                    continue;

                if (radioSettings.group && station.group) {
                    const list = groups[station.group] = groups[station.group] || [];
                    list.push(station);
                } else stations.push(station);
            }
        }

        const stationGroups: IStationGroup[] = [];
        for (let key of Object.keys(groups)) {
            stationGroups.push({
                name: key,
                stations: groups[key]
            });
        }

        return {freeStations: stations, stationGroups: stationGroups};
    }

    async stream(context: RichActivity, descriptor: IStationDescriptor) {
        try {
            const station = await this.getStationFromDescriptor(context, descriptor);
            if (station != null)
                await context.exec(new RadioStreamActivity(station));

        } catch (e) {
            if (e === RestartRadio)
                throw e;
            await context.sayInfo("Unable to reach Voxmate Server");
        }
    }

    addStationOptions(context: Activity, options: Rolodex, station: IStation) {

        options.add(async () => {
            await context.sayDynamicInfo(`Listen to ${station.name}`);
        }, async () => {
            await context.exec(new RadioStreamActivity(station));
            options.unwind();
        });

        options.add(async () => {
            if (!await this.isStationFavorite(station)) {
                await context.sayDynamicInfo("Add to favorites");
            } else {
                await context.sayDynamicInfo("Remove from favorites");
            }
        }, async () => {
            if (!await this.isStationFavorite(station)) {
                await this.addStationToFavorites(station);
            } else {
                await this.removeStationFromFavorites(station);
            }
            context.sound(Sound.Good);
            throw RestartRadio;
        });

        options.add(async () => {
            if (station.group.length > 0) {
                await context.sayContent("Change group");
            } else {
                await context.sayContent("Assign group");
            }

            if (station.group.length > 0)
                await context.sayInfo(`Current group is: ${station.group}`);
        }, async () => {
            let group = await this.root.editField(station.group);
            if (group && group != station.group) {
                if (await this.addStationToGroup(station, group))
                    context.sound(Sound.Good);
                else context.sound(Sound.Bad);
                throw RestartRadio;
            }
        }).showWhen(async () => {
            return (await this.getSettings()).group;
        });

        options.add(async () => {
            await context.sayInfo(`Move to the top of favorites`);
        }, async () => {
            if (await this.moveStationToTopOfFavorites(station))
                context.sound(Sound.Good);
            else context.sound(Sound.Bad);
            throw RestartRadio;
        });
    }

    async runStationOptions(context: RichActivity, station: IStation | IStationDescriptor) {

        const options = context.roll();

        let descriptor: IStation;
        if ("id" in station)
            descriptor = await this.getStationFromDescriptor(context, station);
        else descriptor = station;

        if (descriptor == null) {
            context.sound(Sound.EndContent);
            return;
        }

        this.addStationOptions(context, options, descriptor);
        await options.run();
    }

    async getSettings(forceRefresh: boolean = false): Promise<IRadioSettings> {
        const settings = await this.root.getVoxletSettings(forceRefresh) as IRadioSettings;

        const prunedStations = settings.stations.filter((station) => {
            if (!station) return false;
            if ("streams" in station) return false;
            return true;
        });

        if (settings.stations.length != prunedStations.length) {
            settings.stations = prunedStations;
            await this.root.patchVoxletSettings({stations: prunedStations});
        }

        return settings;
    }

    async isStationFavorite(station: IStation) {
        const settings = await this.getSettings();
        for (let s of settings.stations)
            if (station.id == s.id)
                return true;
        return false;
    }

    async addStationToFavorites(station: IStation) {
        const settings = await this.getSettings(true);
        if (await this.isStationFavorite(station))
            return;

        settings.stations.push(station);
        await this.root.patchVoxletSettings({stations: settings.stations});
    }

    async addStationToGroup(station: IStation, group: string) {
        const settings = await this.getSettings(true);

        for (let s of settings.stations) {
            if (s.id == station.id) {
                s.group = group;

                await this.root.patchVoxletSettings({stations: settings.stations});

                station.group = group;
                return true;
            }
        }

        return false;
    }

    async removeStationFromFavorites(station: IStation) {
        const settings = await this.getSettings(true);

        if (!await this.isStationFavorite(station))
            return;

        settings.stations = settings.stations.filter(s => s.id !== station.id);
        await this.root.patchVoxletSettings({stations: settings.stations});
    }

    async moveStationToTopOfFavorites(station: IStation) {
        const settings = await this.getSettings(true);

        if (settings.stations.length < 2)
            return true;

        let idx = -1;
        for (let i = 0; i < settings.stations.length; i++) {
            let s = settings.stations[i];
            if (s.id == station.id) {
                idx = i;
                break;
            }
        }

        if (idx === 0) {
            return true;
        }

        if (idx !== -1) {
            const st = settings.stations;

            const [a, b] = [st[0], st[idx]];
            [st[0], st[idx]] = [b, a];

            await this.root.patchVoxletSettings({stations: st});
            return true;
        }

        return false;
    }
}