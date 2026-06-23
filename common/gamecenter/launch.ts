import {Activity, Orchestrator} from "../orc/orc";


interface PlayResult {
    action: "play",
    server: string;
    roomId: string;
}

interface LaunchResult {
    action: "result"
    result: IGameCenterServiceResult<any>;
}

type GameCenterServiceLaunch = PlayResult | LaunchResult |
    {
        action: "help" | "setup" | "check-setup"
    }


const NOOP = (value: any = true) => new class extends Activity {
    protected async run() {
        return value;
    }
};

export interface IGameCenterServiceResult<T> {
    ident: string;
    created: number;
    winner: boolean | null;
    players: { [playerId: string]: string }
    result?: T;
    status: "finished" | "abandoned";
}

export abstract class GameCenterServiceLauncher<TResult> {
    // noinspection TypeScriptAbstractClassConstructorCanBeMadeProtected
    constructor(readonly service: string,
                readonly launch: GameCenterServiceLaunch,
                readonly orchestrator: Orchestrator | undefined = undefined) {
        this.orchestrator = orchestrator ?? new Orchestrator();
    }

    private async runActivity(activity: Activity) {
        return await this.orchestrator.start(activity);
    }

    private async getActivityForLaunch(): Promise<Activity | null> {
        switch (this.launch.action) {
            case "play":
                return this.launchPlayActivity(this.launch.server, this.service, this.launch.roomId);
            case "result":
                return this.launchResultActivity(this.launch.result);
            case "help":
                return this.launchHelpActivity();
            case "setup":
        }
    }

    async run(): Promise<any> {
        const activity = await this.getActivityForLaunch();
        if (activity)
            return await this.runActivity(activity);
    }

    abstract launchPlayActivity(server: string, service: string, roomId: string): Promise<Activity | null>;

    abstract launchResultActivity(result: IGameCenterServiceResult<TResult>): Promise<Activity | null>;

    async launchHelpActivity(): Promise<Activity | null> {
        return NOOP();
    }

    async launchSetupActivity(): Promise<Activity | null> {
        return NOOP();
    }

    async launchCheckSetupActivity(): Promise<Activity<boolean> | null> {
        return NOOP(true);
    }
}