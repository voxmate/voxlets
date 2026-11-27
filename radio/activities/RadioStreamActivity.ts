import {BasePlayer, PlayerOptions} from "@voxmate/orc/player";

import voxmate, {ICastStreamInspectionResult} from "@voxmate/voxmate";
import {Activity} from "@voxmate/orc/orc";
import {isPlaylistUrl, RadioService, resolvePlaylistUrl} from "../service";
import {IStation, RestartRadio} from "../common/common.radio";

export class RadioStreamActivity extends BasePlayer {

    private resolvedUrl: string;
    private readonly urlPreResolved: boolean;

    get radio(): RadioService {
        return this[RadioService.inject];
    }

    constructor(private readonly station: IStation, resolvedUrl?: string) {
        super();
        this.resolvedUrl = resolvedUrl ?? station.url;
        this.urlPreResolved = resolvedUrl !== undefined;
        this.disableSeek();
        this.enableHint("During playback, swipe right for track info");
    }

    protected override async init(): Promise<void> {
        if (
            !this.urlPreResolved &&
            Boolean(this.resolvedUrl) &&
            !this.resolvedUrl.endsWith("+++hls") &&
            (this.station.isPlaylist === true || isPlaylistUrl(this.resolvedUrl))
        ) {
            this.resolvedUrl = await resolvePlaylistUrl(this, this.resolvedUrl);
        }
        await super.init();
    }

    protected useStreamingPlayer(): boolean {
        return true;
    }

    protected getPlayerResourceId(): string {
        return this.resolvedUrl;
    }

    protected async rightAction(): Promise<PlayerOptions> {

        const url = this.resolvedUrl;

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
        console.log("Streaming...", this.resolvedUrl);
        return super.run();
    }
}