import {RichActivity} from "@voxmate/orc/RichActivity";
import {useBackend} from "@voxmate/orc/backend";
import {IStationDescriptor} from "../common/common.radio";
import {RadioBrowseStationsActivity} from "./RadioBrowseStationsActivity";
import {Sound} from "@voxmate/voxmate";

abstract class RadioSearchBackendContract {
    abstract search(input: { query: string }): Promise<{ Items?: any[] }>;
}

export class RadioSearchActivity extends RichActivity {

    async search(query: string): Promise<IStationDescriptor[]> {
        const stations: IStationDescriptor[] = [];

        const backend = useBackend<typeof RadioSearchBackendContract>();
        const result = await backend.search({query});
        for (let item of result?.Items ?? []) {

            if (item.ContainerType == "Stations") {
                for (let child of item.Children) {
                    stations.push({
                        id: child.GuideId,
                        name: child.Title,
                        description: child.Description,
                    });
                }
            }

            if (item.Type == "Station") {
                stations.push({
                    id: item.GuideId,
                    name: item.Title,
                    description: item.Description,
                });
            }
        }

        return stations;
    }

    protected async run() {
        const query = await this.getSearchQuery();
        if (query) {
            const stations = await this.freeze(this.search(query), "Searching...");
            if (stations.length == 0) {
                await this.sayDynamicInfo("Nothing found");
                this.sound(Sound.EndContent);
            } else await this.exec(new RadioBrowseStationsActivity(stations));
        }
    }
}