import {IStationDescriptor} from "../common/common.radio";
import cheerio from "cheerio";
import {RichActivity} from "@voxmate/orc/RichActivity";
import {RadioBrowseStationsActivity} from "./RadioBrowseStationsActivity";

export class RadioBrowseLocalStationsActivity extends RichActivity {

    private stations: IStationDescriptor[] = [];

    constructor() {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();

        const localRadio = await this.httpGet("https://tunein.com/radio/local/");
        if (localRadio.code != 200) {
            throw Error("Unable to communicate with TuneIn");
        }

        const doc = cheerio.load(localRadio.content);
        let initialStateData = doc("#initialStateEl").html() as string;

        initialStateData = initialStateData.trim();

        const prefix = "window.INITIAL_STATE=";
        if (!initialStateData.startsWith(prefix))
            throw Error("Invalid State Data");

        const json = initialStateData.substr(prefix.length, initialStateData.length - prefix.length - 1);
        const jdata = JSON.parse(json);

        const localStations = jdata["categories"]["local"]["containerItems"][0]["children"];

        for (let child of localStations) {
            this.stations.push({
                "id": child.guideId,
                "name": child.title,
                "description": child.description || child.subtitle || ""
            });
        }
    }

    protected async run(): Promise<any> {

        if (this.stations.length == 0)
            return await this.sayDynamicInfo("Unable to find local stations");

        await this.exec(new RadioBrowseStationsActivity(this.stations));
    }
}

