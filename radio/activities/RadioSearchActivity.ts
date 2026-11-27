import {RichActivity} from "@voxmate/orc/RichActivity";
import {useBackend} from "@voxmate/orc/backend";
import {IStationDescriptor} from "../common/common.radio";
import {RadioBrowseStationsActivity} from "./RadioBrowseStationsActivity";
import {Sound} from "@voxmate/voxmate";

const MAX_SEARCH_QUERY_LENGTH = 500;

abstract class RadioSearchBackendContract {
    abstract search(input: { query: string }): Promise<{ Items?: any[] }>;
}

export class RadioSearchActivity extends RichActivity {

    async search(query: string): Promise<IStationDescriptor[]> {
        const normalized = query.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
        if (!normalized)
            return [];

        const stations: IStationDescriptor[] = [];

        const backend = useBackend<typeof RadioSearchBackendContract>();
        const result = await this.wrapAny(backend.search({query: normalized}));
        const items = Array.isArray(result?.Items) ? result.Items : [];
        for (let item of items) {
            if (!item)
                continue;

            if (item.ContainerType == "Stations" && Array.isArray(item.Children)) {
                for (let child of item.Children) {
                    if (!child)
                        continue;
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
        const rawQuery = await this.getSearchQuery();
        if (typeof rawQuery !== "string")
            return;

        const query = rawQuery.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);
        if (!query) {
            await this.sayDynamicInfo("Please enter a search query");
            this.sound(Sound.EndContent);
            return;
        }

        let stations: IStationDescriptor[] | null;
        try {
            stations = await this.freeze(() => this.search(query), "Searching...");
        } catch (e) {
            if (this.isFlowControl(e))
                throw e;
            console.error("Radio search failed", e);
            await this.sayDynamicInfo("Unable to reach Voxmate Server");
            this.sound(Sound.EndContent);
            return;
        }

        if (!stations || stations.length == 0) {
            await this.sayDynamicInfo("Nothing found");
            this.sound(Sound.EndContent);
        } else {
            await this.exec(new RadioBrowseStationsActivity(stations));
        }
    }
}