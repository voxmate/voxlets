import {RichActivity} from "@voxmate/orc/RichActivity";
import {RadioService} from "../service";
import {IStationDescriptor} from "../common/common.radio";

export class RadioBrowseStationsActivity extends RichActivity {

    get radio(): RadioService {
        return this[RadioService.inject];
    }

    constructor(private readonly stations: IStationDescriptor[]) {
        super();
    }

    protected async run(): Promise<any> {

        const dex = this.roll();

        for (let i = 0; i < this.stations.length; ++i) {
            let station = this.stations[i];

            dex.add(async () => {
                await this.sayDynamicContent(`${station.name}`);
                await dex.paginate(i, this.stations.length);
            }, async () => {
                await this.radio.stream(this, station);
            }).expand(async () => {
                await this.radio.runStationOptions(this, station);
            });
        }

        await dex.run();
    }
}