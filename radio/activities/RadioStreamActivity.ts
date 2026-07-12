import {BasePlayer, PlayerOptions} from "@voxmate/orc/player";

import voxmate, {ICastStreamInspectionResult} from "@voxmate/voxmate";
import {Activity} from "@voxmate/orc/orc";
import {RadioService} from "../service";
import {IStation, RestartRadio} from "../common/common.radio";

export class RadioStreamActivity extends BasePlayer {

    get radio(): RadioService {
        return this[RadioService.inject];
    }

    constructor(private readonly station: IStation) {
        super();
        this.disableSeek();
        this.enableHint("During playback, swipe right for track info");
    }

    protected useStreamingPlayer(): boolean {
        return true;
    }

    protected getPlayerResourceId(): string {
        return this.station.url;
    }

    protected async rightAction(): Promise<PlayerOptions> {

        const url = this.station.url;

        class CheckTrackDetails extends Activity {

            private result: ICastStreamInspectionResult;

            protected async init(): Promise<void> {
                await super.init();
                this.result = await this.wrap(voxmate.special.inspectIceCastStream(url));
            }

            protected async run(): Promise<void | undefined> {
                if (!this.result.ok) await this.say("No track info.");
                else await this.sayDynamicInfo(this.result.title);
            }
        }

        const dex = this.roll();
        dex.add("Check track details", CheckTrackDetails);

        dex.add("Set Sleep Timer", async () => {
            if (await this.setSleepTimerInteractive())
                dex.unwind();
        });

        this.radio.addStationOptions(this, dex, this.station);

        await dex.run();

        return PlayerOptions.ContinuePlaying;
    }

    async handleError(e) {
        if (e === RestartRadio)
            throw e;
        await super.handleError(e);
    }

    protected async run(): Promise<any> {
        console.log("Streaming...", this.station.url);
        return super.run();
    }
}