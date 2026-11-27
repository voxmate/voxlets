import {
    GameCenterBaseActivity,
    GameCenterContract,
    IGameCenterGame,
    IGameCenterQueuing,
    IInstalledGameInput,
    isTerminalStatus,
    isWaitingStatus,
} from "./GameCenterBaseActivity";
import {GameCenterNicknameEditor, GameCenterProfileActivity} from "./GameCenterNicknameEditor";
import {IGameCenterParty, IGameCenterPartyPlayer} from "./GameCenterService";
import {BackendCallError, backendSocketUrl, tenantNameOf, useBackend} from "@voxmate/orc/backend";
import {IGameCenterPlayLaunch, IGameCenterServiceResult} from "@voxmate/orc/gamecenter";
import {RPCSocketActivity, subscribe} from "@voxmate/orc/RPCSocketActivity";
import voxmate, {Gesture, Sound} from "@voxmate/voxmate";
import {arrayToText} from "@voxmate/voxmate/utility/array";

import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

const BACKGROUND_CHANNEL = "periodic";

const GAMECENTER_IDENT = "github.com/voxmate/voxlets/gamecenter";

function resolveGameSocketUrl(server: string | undefined, gameIdent: string, roomId: string): string {
    const encodedRoom = encodeURIComponent(roomId);
    if (!server) {
        const tenant = tenantNameOf(gameIdent);
        return backendSocketUrl(gameIdent, `/ws/${tenant}/${encodedRoom}`);
    }
    if (/\/ws\/[^/]+\/?$/.test(server)) {
        return `${server.replace(/\/+$/, "")}/${encodedRoom}`;
    }
    return server;
}

function toLaunchPlayers(players?: IGameCenterPartyPlayer[]): Record<string, { nick: string }> | undefined {
    if (!players || players.length === 0)
        return undefined;
    const out: Record<string, { nick: string }> = {};
    for (const player of players) {
        const id = player.userId || player.id;
        if (id)
            out[id] = {nick: player.nick};
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

type GatherForPartyResult = boolean | "aborted";

class GatherForPartyActivity extends GameCenterBaseActivity<GatherForPartyResult> {
    constructor(private readonly partyId?: string) {
        super();
    }

    protected async run(): Promise<GatherForPartyResult> {
        while (this.isActive) {
            let ui = await this.sayInfo("Your party is ready. Double tap to confirm when you are ready to begin.");
            ui = ui ?? await this.getWithTimeout(5000);
            if (ui && ui.kind == "gesture" && ui.gesture == Gesture.DoubleTap) {
                await this.freeze(this.gatherForParty(this.partyId));
                return true;
            }
        }
        return false;
    }
}

interface IPurgatoryActivityResult {
    ok: boolean;
    error?: string;
    party?: IGameCenterParty;
}

export class GameCenterPurgatoryActivity extends RPCSocketActivity<IPurgatoryActivityResult> {
    static SUPPRESS_NOTIFICATIONS: boolean;

    private party: IGameCenterParty | null = null;
    private gatherForPartyActivity: GatherForPartyActivity | null = null;
    private _backend: ReturnType<typeof useBackend<typeof GameCenterContract>> | null = null;

    private announcementBlockDepth = 0;
    private gatheredForId: string | null = null;
    private waitElsewhereHintPlayed = false;

    private get backend() {
        if (!this._backend)
            this._backend = useBackend<typeof GameCenterContract>();
        return this._backend;
    }

    protected async init(): Promise<void> {
        await super.init();
        this.party = await this.rpc.call("getPartyUpdate");
    }

    constructor(partyId: string) {
        super(
            backendSocketUrl(GAMECENTER_IDENT, `/ws/purgatory/${encodeURIComponent(partyId)}`),
            "purgatory",
            partyId
        );
    }

    private endIfTerminalPartyUpdate(party: IGameCenterParty): boolean {
        if (this.ended)
            return true;

        if (isTerminalStatus(party.status)) {
            this.end({ok: false});
            return true;
        }
        if (party.me?.member === false) {
            this.end({ok: false, error: "Leaving the party"});
            return true;
        }
        if (party.status === "playing") {
            this.end({ok: true, party});
            return true;
        }
        return false;
    }

    @subscribe("update", false)
    private async onReceivedPartyUpdate(party: IGameCenterParty) {
        this.party = party;
        if (this.endIfTerminalPartyUpdate(party))
            return;

        this.setTimeout(async () => {
            await this.handlePartyUpdate(party);
        });
    }

    private async do<T>(action: () => Promise<T>): Promise<T> {
        this.announcementBlockDepth++;
        voxmate.audio.stopChannel(BACKGROUND_CHANNEL);
        try {
            return await action();
        } finally {
            this.announcementBlockDepth--;
        }
    }

    private async handlePartyUpdate(party: IGameCenterParty) {
        if (this.endIfTerminalPartyUpdate(party))
            return;

        if (isWaitingStatus(party.status)) {
            const wasGathering = this.gatherForPartyActivity !== null || this.gatheredForId !== null;
            this.gatheredForId = null;

            if (this.gatherForPartyActivity) { // transition from 'gathering' -> 'waiting'
                console.log("Transitioning from Gathering -> Waiting");
                const activeGather = this.gatherForPartyActivity;
                this.gatherForPartyActivity = null;
                activeGather.end("aborted");
            }

            if (wasGathering) {
                await this.do(async () => {
                    await this.sayInfo("A player didn't show up for the game. Back to the queue.");
                });
            }
        } else if (party.status === "gathering") { // transition from 'waiting' to 'gathering'
            const gatheringId = party.gatheringId ?? party.roomId ?? party.partyId;

            if (party.me?.gathered) {
                this.gatheredForId = gatheringId;
            } else if (party.me?.gathered === false && this.gatheredForId === gatheringId) {
                this.gatheredForId = null;
            }

            if (this.gatheredForId === gatheringId && party.me?.gathered !== false) {
                return;
            }

            if (this.gatherForPartyActivity === null) {
                const gatherActivity = new GatherForPartyActivity(party.partyId || this.getRoomId());
                this.gatherForPartyActivity = gatherActivity;
                const gathered = await this.do(() => this.exec(gatherActivity));
                if (this.gatherForPartyActivity === gatherActivity) {
                    this.gatherForPartyActivity = null;
                }

                if (this.ended || gathered === "aborted") {
                    return;
                }

                if (gathered === true) {
                    this.sound(Sound.Good);
                    if (!this.party || !isWaitingStatus(this.party.status)) {
                        this.gatheredForId = gatheringId;
                    }
                } else {
                    this.sound(Sound.Bad);
                    this.end({
                        ok: false,
                        error: "You left without confirming that you are ready"
                    });
                    return;
                }
            }
        }
    }

    private async makeStatusAnnouncement() {

        const party = this.party;
        if (!party) {
            return;
        }

        if (isWaitingStatus(party.status)) {
            const missingPlayerCount = party.size - party.playerCount;

            let msg = `Looking for ${missingPlayerCount} more player${missingPlayerCount > 1 ? "s" : ""} to join...`;
            if (missingPlayerCount <= 0)
                msg = "Party is almost ready...";

            if (this.allowAnnouncements)
                await this.sayDynamicInfo(msg, {channel: BACKGROUND_CHANNEL});

            if (!this.waitElsewhereHintPlayed) {
                this.waitElsewhereHintPlayed = true;
                if (this.allowAnnouncements)
                    await this.sayDynamicInfo("You will get a notification once your party is assembled. " +
                        "You can do something else meanwhile", {channel: BACKGROUND_CHANNEL});
            }
        }

        if (party.status === "gathering" && party.me?.gathered) {
            const missingPlayerCount = party.size - party.readyPlayerCount;
            if (missingPlayerCount < party.size && missingPlayerCount > 0) {

                let msg = `Waiting for ${missingPlayerCount} more players to confirm that they are ready...`;
                if (missingPlayerCount === 1) {
                    msg = "Waiting for the last player to confirm that they are ready...";
                }

                if (this.allowAnnouncements)
                    await this.sayDynamicInfo(msg, {channel: BACKGROUND_CHANNEL});
            }
        }
    }

    private setupPeriodicBumping() {
        const bumper = async () => {
            if (this.party && isWaitingStatus(this.party.status)) {
                try {
                    await this.backend.bump({partyId: this.getRoomId()});
                } catch (e) {
                    if (this.isFlowControl(e))
                        throw e;
                    console.log("Periodic bump failed", e);
                }
            }
        };
        this.setTimeout(bumper);
        this.setInterval(bumper, 15000);
    }

    get allowAnnouncements() {
        return this.announcementBlockDepth === 0;
    }

    async runConnected(): Promise<any> {

        this.onEnd(() => {
            voxmate.audio.stopChannel(BACKGROUND_CHANNEL);
        });

        this.setupPeriodicBumping();

        if (this.party && (!isWaitingStatus(this.party.status) || this.party.me?.member === false)) {
            await this.handlePartyUpdate(this.party);
            if (this.ended)
                return;
        }

        await this.makeStatusAnnouncement();

        while (this.isActive) {
            await this.delay(5000);

            if (this.party && this.party.me && !this.party.me.member) {
                this.end({ok: false, error: "Leaving the party"});
                return;
            }

            if (this.allowAnnouncements) {
                await this.sound(Sound.Loading);
                await this.makeStatusAnnouncement();
            }
        }
    }
}

class GameCenterLaunchGameActivity extends GameCenterBaseActivity {
    constructor(
        private readonly game: IGameCenterGame,
        private readonly launch: IGameCenterPlayLaunch) {
        super();
    }

    protected async run(): Promise<void | any> {
        return await this.goto(this.game.ident, this.launch);
    }
}

export class GameCenterMainMenu extends GameCenterBaseActivity {
    constructor(
        queuing: IGameCenterQueuing | null = null,
        private readonly installedGames?: IInstalledGameInput[]
    ) {
        super();
        this.queuing = queuing;
    }

    queuing: IGameCenterQueuing | null = null;
    games: IGameCenterGame[] = [];

    protected async init(): Promise<any> {
        await super.init();
        await this.updateCurrentQueuing();
        this.games = await this.getGames(this.installedGames);
        console.log("GAMES", this.games);
    }

    private async updateCurrentQueuing(): Promise<IGameCenterQueuing | null> {
        const profile = await this.getMyGameCenterProfile();
        if (profile)
            this.queuing = await this.getMyCurrentQueuing();
        else
            this.queuing = null;
        return this.queuing;
    }

    private async setupNickname(): Promise<boolean> {
        if (await this.getMyGameCenterProfile() === null) {
            await this.exec(new GameCenterNicknameEditor());
            if (await this.getMyGameCenterProfile() === null) {
                await this.sayInfo("You must setup a profile before you can play");
                return false;
            }
        }
        return true;
    }

    private getGameInfo(ident: string): IGameCenterGame {
        for (const game of this.games) {
            if (game.ident === ident)
                return game;
        }
        const targetTenant = tenantNameOf(ident);
        for (const game of this.games) {
            if (tenantNameOf(game.ident) === targetTenant)
                return game;
        }
        throw new Error(`Invalid game: ${ident}`);
    }

    private buildPlayLaunch(game: IGameCenterGame, queuing: IGameCenterQueuing): IGameCenterPlayLaunch {
        const party = this.gcs.party;
        const roomId = queuing.roomId ?? party?.roomId ?? queuing.partyId;
        const partyId = queuing.partyId ?? party?.partyId;
        const matchTicket = queuing.matchTicket ?? party?.matchTicket;
        const resultToken = queuing.resultToken ?? party?.resultToken;
        const rawServer = queuing.server ?? party?.server ?? game.wsUrl;
        const server = resolveGameSocketUrl(rawServer, game.ident, roomId);
        const players = toLaunchPlayers(party?.players);
        const parameters = party?.parameters ?? queuing.game.params;

        return {
            action: "play",
            server,
            roomId,
            ...(partyId ? {partyId} : {}),
            ...(matchTicket ? {matchTicket} : {}),
            ...(resultToken ? {resultToken} : {}),
            ...(players ? {players} : {}),
            ...(parameters && Object.keys(parameters).length > 0 ? {parameters} : {}),
        };
    }

    private async openQueuing(): Promise<void> {

        if (this.queuing) {
            if (this.queuing.partyStatus === "playing" && (this.queuing.roomId || this.queuing.partyId)) {
                const game = this.getGameInfo(this.queuing.game.ident);
                const launch = this.buildPlayLaunch(game, this.queuing);
                const result = await this.exec(new GameCenterLaunchGameActivity(game, launch));
                if (result === "abandon") {
                    const queuing = await this.freeze(this.updateCurrentQueuing());
                    await this.leaveCurrentGame(queuing, true);
                }
            } else {
                const purgatory = new GameCenterPurgatoryActivity(this.queuing.partyId);
                const result = await this.exec(purgatory);
                if (result) {
                    if (result.error)
                        await this.sayInfo(result.error);
                    else if (result.ok) {
                        const partyFromSocket = result.party ?? null;
                        await this.freeze(this.updateCurrentQueuing());
                        if (partyFromSocket && !this.gcs.party)
                            this.gcs.party = partyFromSocket;
                        if (partyFromSocket && this.queuing) {
                            this.queuing = {
                                ...this.queuing,
                                partyStatus: "playing",
                                roomId: this.queuing.roomId ?? partyFromSocket.roomId,
                                server: this.queuing.server ?? partyFromSocket.server,
                                matchTicket: this.queuing.matchTicket ?? partyFromSocket.matchTicket,
                                resultToken: this.queuing.resultToken ?? partyFromSocket.resultToken,
                            };
                        }
                        return this.openQueuing();
                    }
                }
            }
        }

        await this.freeze(this.updateCurrentQueuing());
    }

    private async createGameParameterization(game: IGameCenterGame) {

        const payload: { ident: string; params?: Record<string, unknown> } = {ident: game.ident};
        const params: Record<string, unknown> = {};
        const parameterSpecs = game.parameters ?? {};

        for (const paramKey in parameterSpecs) {
            const param = parameterSpecs[paramKey];
            if (!param)
                continue;

            const dex = this.roll();
            if (Array.isArray(param)) {
                if (param.length === 0)
                    continue;
                await this.sayDynamicInfo(paramKey);
                for (const value of param)
                    dex.add(String(value), async () => value);
            } else if (typeof param === "object" && Array.isArray(param.values)) {
                if (param.values.length === 0)
                    continue;
                await this.sayDynamicInfo(param.name ?? paramKey);
                for (const entry of param.values)
                    dex.add(entry.name, async () => entry.value);
            } else {
                continue;
            }

            const value = await dex.run();
            if (value === undefined)
                return undefined;

            params[paramKey] = value;
        }

        if (Object.keys(params).length > 0) {
            payload.params = params;
        }

        return payload;
    }

    private async runMainMenu() {
        const dex = this.roll();

        // Play Option
        const start = dex.add(async () => {
            if (this.queuing) {
                const game = this.getGameInfo(this.queuing.game.ident);
                if (this.queuing.partyStatus === "playing")
                    return `Continue playing ${game.name}`;
                return `Play ${game.name}`;
            } else {
                return "Play";
            }
        }, async () => {

            GameCenterPurgatoryActivity.SUPPRESS_NOTIFICATIONS = true;
            try {
                const queuing = await this.freeze(this.updateCurrentQueuing());
                if (!queuing) {

                    const gamePicker = this.roll();
                    for (const game of this.games) {
                        gamePicker.add(async () => {
                            await this.sayDynamicContent(game.name);
                            await this.sayDynamicInfo(game.description);

                            let final = `This is a ${game.players}-player game.`;
                            if (game.queuing > 0) {
                                if (game.queuing == 1)
                                    final += " There is one player in queue.";
                                else final += ` There are ${game.queuing} players in queue.`;
                            }
                            await this.sayDynamicInfo(final);

                        }, async () => {
                            const gp = await this.createGameParameterization(game);
                            if (gp != undefined)
                                return await this.queueForGame(gp);
                        });
                    }

                    await gamePicker.run();
                }

                await this.freeze(this.updateCurrentQueuing());

                if (this.queuing)
                    await this.openQueuing();

            } finally {
                GameCenterPurgatoryActivity.SUPPRESS_NOTIFICATIONS = false;
            }
        });

        // Abandon Game Option
        dex.add(async () => {
            if (this.queuing) {
                const game = this.getGameInfo(this.queuing.game.ident);

                const ps = this.queuing.partyStatus;
                if (isWaitingStatus(ps) || ps === "gathering")
                    return `Stop queuing for ${game.name}`;

                if (ps === "playing")
                    return `Abandon ${game.name}`;
            }
            return "";
        }, async () => {
            const queuing = await this.freeze(this.updateCurrentQueuing());
            await this.leaveCurrentGame(queuing);
            await this.updateCurrentQueuing();
            start.goto();
        }).showWhen(async () => !!this.queuing);

        dex.add("My recent games", async () => {
            const games = (await this.freeze(this.myRecentGames())) ?? [];

            const recent = this.roll();
            for (let i = 0; i < games.length; i++) {

                const game = games[i];
                const gameIdent = game.ident || game.gameIdent || "";

                recent.add(async () => {
                    const info = this.getGameInfo(gameIdent);
                    const nicks = arrayToText(Object.values(game.players));
                    await this.sayDynamicContent(`${info.name} with ${nicks} ${dayjs(game.created).fromNow()}`);
                    await recent.paginate(i, games.length);
                }, async () => {
                    const info = this.getGameInfo(gameIdent);
                    const normalizedResult: IGameCenterServiceResult<any> = {
                        ident: gameIdent,
                        created: game.created,
                        winner: game.winner,
                        players: game.players,
                        result: game.result,
                        status: game.status === "abandoned" ? "abandoned" : "finished",
                    };
                    await this.goto(info.ident, {
                        action: "result",
                        result: normalizedResult
                    });
                });
            }

            await recent.run();
        });

        dex.add(async () => {
            const profile = await this.getMyGameCenterProfile();
            await this.sayDynamicInfo(profile?.nick ?? "");
        }, GameCenterProfileActivity);

        return await dex.run();
    }

    protected async run(): Promise<any> {

        try {

            if (!await this.setupNickname())
                return;

            await this.runMainMenu();

        } catch (e) {
            if (e instanceof BackendCallError) {
                console.log("Backend Error", e.message);
                await this.sayInfo(`Error: ${e.message}`);
            } else throw e;
        }
    }

}
