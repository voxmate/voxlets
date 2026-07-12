import {RadioStreamActivity} from "./RadioStreamActivity";
import {IFavoriteStations, IStation, RestartRadio} from "../common/common.radio";
import {RadioBrowseLocalStationsActivity} from "./RadioBrowseLocalStationsActivity";
import {Rolodex} from "@voxmate/orc/rolodex";
import {RadioService} from "../service";
import {RichActivity} from "@voxmate/orc/RichActivity";
import {RadioSearchActivity} from "./RadioSearchActivity";
import {VoxletSettingsManager} from "@voxmate/orc/VoxletSettingsManager";


export class RadioMainActivity extends RichActivity {

    get radio(): RadioService {
        return this[RadioService.inject];
    }

    async hint() {
        return "Pick which radio station you would like to listen to";
    }

    protected async init(): Promise<any> {
        await super.init();
    }

    private addStation(rolodex: Rolodex, index: number, station: IStation, n: number) {
        rolodex.add(async () => {
            await this.sayDynamicContent(`${station.name}`);
            await rolodex.paginate(index, n);
        }, async () => {
            const activity = new RadioStreamActivity(station);
            await this.exec(activity);
        }).expand(async () => {
            await this.radio.runStationOptions(this, station);
        });
    }

    private async showMainMenu() {
        const rolodex = this.roll();

        const stations = await this.freeze(this.radio.getFavoriteStations(), "Fetching your stations");

        for (let group of stations.stationGroups) {
            rolodex.add(`${group.name} Stations`, async () => {
                const groupDex = this.roll();
                const n = group.stations.length;
                for (let i = 0; i < n; ++i)
                    this.addStation(groupDex, i, group.stations[i], n);
                await groupDex.run();
            });
        }

        const n = stations.freeStations.length;
        for (let i = 0; i < n; ++i)
            this.addStation(rolodex, i, stations.freeStations[i], n);

        rolodex.add(async () => {
            await this.sayDynamicInfo("Browse Local Stations");
        }, RadioBrowseLocalStationsActivity);

        rolodex.add(async () => {
            await this.sayDynamicInfo("Search For Stations");
        }, RadioSearchActivity);

        rolodex.add(async () => {
            await this.sayDynamicInfo("Settings");
        }, async () => {
            await this.exec(new VoxletSettingsManager());
        });

        await rolodex.run();
    }

    protected async run() {

        let run = true;
        while (run) {
            run = false;
            try {
                await this.showMainMenu();
            } catch (e) {
                if (e === RestartRadio) {
                    run = true;
                } else throw e;
            }
        }
    }
}