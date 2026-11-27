import {clientRPC, RPCSocketOptions, subscribe} from "@voxmate/orc/RPCSocketActivity";
import {Activity} from "@voxmate/orc/orc";
import {backendSocketUrl} from "@voxmate/orc/backend";
import {NavigatorActivity} from "@voxmate/orc/navigation/NavigatorActivity";
import {Gesture, Sound} from "@voxmate/voxmate";
import {CancellationToken} from "@voxmate/orc/RPCUtility";
import {GameRoomActivity} from "@voxmate/orc/GameRoomActivity";
import {ControllablePromise} from "@voxmate/voxmate/utility/common";
import {
    GameCenterServiceLauncher,
    IGameCenterPlayLaunch,
    IGameCenterServiceLaunch,
    IGameCenterServiceResult,
} from "@voxmate/orc/gamecenter";
import {RichActivity} from "@voxmate/orc/RichActivity";

const TICTACTOE_IDENT = "github.com/voxmate/voxlets/tictactoe";

function resolveSocketUrl(server: string | undefined, roomId: string): string {
    const encodedRoom = encodeURIComponent(roomId);
    if (!server) {
        return backendSocketUrl(TICTACTOE_IDENT, `/ws/tictactoe/${encodedRoom}`);
    }
    if (/\/ws\/[^/]+\/?$/.test(server)) {
        return `${server.replace(/\/+$/, "")}/${encodedRoom}`;
    }
    return server;
}

interface IGridTile {
    i: number;
    j: number;
    mark: "x" | "o" | null;
}

class TicTacToeGame {
    private _picking: ControllablePromise<IGridTile> | null = null;

    constructor(public grid: IGridTile[], readonly mark: "x" | "o") {
    }

    async beginPicking() {
        this._picking = new ControllablePromise<IGridTile>();
        return this._picking;
    }

    pick(tile: IGridTile) {
        if (this._picking) {
            tile.mark = this.mark;
            this._picking.resolve(tile);
        }
        this._picking = null;
    }

    get canPick() {
        return !!this._picking;
    }
}

const positions = [
    "North Eastern", "Northern", "North Western",
    "Eastern", "Central", "Western",
    "South Eastern", "Southern", "South Western"];

class TicTacToeBoardActivity extends NavigatorActivity {

    constructor(private readonly game: TicTacToeGame) {
        super(3, 3);
    }

    get grid(): IGridTile[] {
        return this.game.grid;
    }

    async descend(i: number, j: number) {
        const tile = this.grid[i + 3 * j];

        if (tile.mark !== null) {
            this.sound(Sound.Bad);
            return false;
        }

        if (!this.game.canPick) {
            this.sound(Sound.Bad);
            await this.sayInfo("It's not your turn");
            return false;
        }

        this.sound(Sound.Good);
        this.game.pick(tile);
        return false;
    }

    async describeMapTile(i: number, j: number): Promise<any> {
        const idx = i + 3 * j;
        const pd = positions[idx];
        const mark = this.grid[idx].mark;
        const marking = (mark ? {"x": "crossed", "o": "circled"}[mark] : null) ?? "unmarked";
        await this.sayDynamicContent(`${pd} tile is ${marking}`);
    }

    async handleRepeatedBump(_gesture: Gesture): Promise<void> {
        if (await this.confirm("Do you want to abandon the game?", true))
            throw GameRoomActivity.AbandonGame;
    }
}

export class TicTacToeGameRoom extends GameRoomActivity {

    private game!: TicTacToeGame;

    protected async init() {
        await super.init();
        const {grid, mark} = await this.rpc.call("info");
        this.game = new TicTacToeGame(grid, mark);
        this.updateGrid(grid);
    }

    @subscribe("grid")
    updateGrid(grid: IGridTile[]) {
        this.game.grid = grid;
    }

    @clientRPC("pickGridElement", false)
    async pickGridElement(cancel: CancellationToken) {
        return this.registerPlayerAction(cancel, this.game.beginPicking());
    }

    async makePlayingActivity(): Promise<Activity> {
        return new TicTacToeBoardActivity(this.game);
    }
}

interface ITicTacToeResult {
    moves: number;
}

export async function main(launch: IGameCenterServiceLaunch<ITicTacToeResult>) {

    const launcher = new class extends GameCenterServiceLauncher<ITicTacToeResult> {

        constructor() {
            super("tictactoe", launch);
        }

        async launchPlayActivity(server: string, service: string, roomId: string, playLaunch: IGameCenterPlayLaunch) {
            const socketUrl = resolveSocketUrl(server, roomId);
            const headers: Record<string, string> = {};
            if (playLaunch.resultToken) {
                headers["X-Result-Token"] = playLaunch.resultToken;
            }
            const socketOptions: RPCSocketOptions = {
                ...(playLaunch.matchTicket ? {matchTicket: playLaunch.matchTicket} : {}),
                ...(Object.keys(headers).length > 0 ? {headers} : {}),
            };
            return new TicTacToeGameRoom(socketUrl, service, roomId, socketOptions);
        }

        async launchResultActivity(result: IGameCenterServiceResult<ITicTacToeResult>) {
            return new class extends RichActivity {
                protected async run() {
                    if (result.result) {
                        const moves = result.result.moves;
                        if (result.winner)
                            await this.sayDynamicInfo(`You won this game in ${moves} moves`);
                        else if (result.winner === false)
                            await this.sayDynamicInfo(`You lost this game after ${moves} moves`);
                        else {
                            await this.sayDynamicInfo(`The game lasted for ${moves} moves, and ended in a draw`);
                        }
                    }
                }
            };
        }
    };

    return launcher.run();
}
