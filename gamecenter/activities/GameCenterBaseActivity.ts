import {RichActivity} from "@voxmate/orc/RichActivity";
import {useBackend} from "@voxmate/orc/backend";
import {IGameCenterServiceResult} from "@voxmate/orc/gamecenter";
import {Sound} from "@voxmate/voxmate";
import {IDict} from "@voxmate/voxmate/utility/types";
import {
    GameCenterService,
    IGameCenterParty,
    IGameCenterProfile,
    PartyStatus,
} from "./GameCenterService";

export interface IInstalledGameInput {
    ident: string;
    name: string;
    description?: string;
    players: number;
    parameters?: Record<string, unknown>;
    priority?: number;
    wsUrl?: string;
}

export interface IGameCenterQueuing {
    game: {
        ident: string;
        params?: Record<string, unknown>;
    };
    version?: number;
    partyId: string;
    partyStatus: PartyStatus;
    roomId?: string;
    server?: string;
    matchTicket?: string;
    resultToken?: string;
}

export interface IGameCenterQueuingResult {
    message?: string;
    party?: IGameCenterParty | null;
    queuing: IGameCenterQueuing | null;
}

export type GameParameterSpec =
    | unknown[]
    | {
        name?: string;
        values: {
            name: string;
            value: any;
        }[];
    };

export interface IGameCenterGame {
    ident: string;
    name: string;
    players: number;
    description: string;
    queuing: number;
    priority?: number;
    wsUrl?: string;
    parameters: IDict<GameParameterSpec>;
}

export interface IGameCenterRegistration {
    problem?: string;
    updated: boolean;
    nick?: string;
    userId?: string;
}

export interface IGameCenterRecentGame extends Omit<IGameCenterServiceResult<any>, "status"> {
    partyId?: string;
    roomId?: string;
    gameIdent?: string;
    params?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
    allPlayers?: { id: string; nick: string }[];
    updatedAt?: number;
    status: "ended" | "finished" | "abandoned";
}

export abstract class GameCenterContract {
    abstract me(input: Record<string, never>): Promise<IGameCenterProfile>;
    abstract register(input: { nick: string }): Promise<IGameCenterRegistration>;
    abstract games(input: { installedGames?: IInstalledGameInput[] }): Promise<IGameCenterGame[]>;
    abstract current(input: Record<string, never>): Promise<IGameCenterQueuingResult>;
    abstract join(input: {
        gameIdent?: string;
        parameters?: Record<string, unknown>;
        installedGame?: IInstalledGameInput;
        game?: { ident: string; params?: Record<string, unknown> };
    }): Promise<IGameCenterQueuingResult>;
    abstract leave(input: { partyId?: string }): Promise<{ left: boolean; partyId?: string }>;
    abstract bump(input: { partyId?: string }): Promise<{ bumped: boolean; partyId?: string; bumpedAt?: number }>;
    abstract gather(input: { partyId?: string }): Promise<IGameCenterParty>;
    abstract recentGames(input: { limit?: number }): Promise<IGameCenterRecentGame[]>;
}

export const GameCenterServiceToken = Symbol("Game Center Service");

export function isWaitingStatus(status: PartyStatus | undefined): boolean {
    return status === "waiting" || status === "open";
}

export function isTerminalStatus(status: PartyStatus | undefined): boolean {
    return status === "ended" || status === "abandoned" || status === "finished";
}

export abstract class GameCenterBaseActivity<T = any> extends RichActivity<T> {

    [GameCenterServiceToken]!: GameCenterService;

    private _backend: ReturnType<typeof useBackend<typeof GameCenterContract>> | null = null;

    protected get backend() {
        if (!this._backend)
            this._backend = useBackend<typeof GameCenterContract>();
        return this._backend;
    }

    get gcs(): GameCenterService {
        return this[GameCenterServiceToken];
    }

    async getMyGameCenterProfile(refresh: boolean = false): Promise<IGameCenterProfile | null> {

        if (!refresh && this.gcs.profile)
            return this.gcs.profile;

        const profile = await this.backend.me({});

        if (profile && profile.registered)
            this.gcs.profile = profile;
        else
            this.gcs.profile = null;

        return this.gcs.profile;
    }

    async getGames(installedGames?: IInstalledGameInput[]): Promise<IGameCenterGame[]> {
        const input = installedGames && installedGames.length > 0 ? {installedGames} : {};
        return await this.backend.games(input);
    }

    async myRecentGames(): Promise<IGameCenterRecentGame[]> {
        return await this.backend.recentGames({});
    }

    async getMyCurrentQueuing(): Promise<IGameCenterQueuing | null> {
        const current = await this.backend.current({});
        this.gcs.party = current?.party ?? null;
        if (current && current.queuing)
            return current.queuing;
        return null;
    }

    async leaveCurrentGame(queuing: IGameCenterQueuing | null, quietly: boolean = false) {

        if (queuing == null) {
            await this.sayInfo("Already left");
            return;
        }

        let ok = quietly;

        if (!ok) {
            if (isWaitingStatus(queuing.partyStatus) || queuing.partyStatus === "gathering") {
                ok = await this.confirm("Are you sure you want to stop queuing?", true);
            } else if (queuing.partyStatus === "playing") {
                ok = await this.confirm("Are you sure you want to abandon the game?", true);
            }
        }

        if (ok) {
            this.sound(Sound.Good);
            const payload = queuing.partyId ? {partyId: queuing.partyId} : {};
            await this.freeze(this.backend.leave(payload));
            this.gcs.party = null;
            await this.sayInfo("Left the game");
        }
    }

    async registerGameCenterProfile(nick: string): Promise<IGameCenterRegistration> {
        return await this.backend.register({nick});
    }

    async queueForGame(game: {
        ident: string;
        params?: Record<string, unknown>;
        installedGame?: IInstalledGameInput;
    }): Promise<IGameCenterQueuing | null> {
        const parameters = game.params ?? {};
        const result = await this.backend.join({
            gameIdent: game.ident,
            parameters,
            ...(game.installedGame ? {installedGame: game.installedGame} : {}),
            game: {
                ident: game.ident,
                ...(Object.keys(parameters).length > 0 ? {params: parameters} : {}),
            },
        });

        this.gcs.party = result?.party ?? null;

        if (result?.message)
            await this.sayDynamicInfo(result.message);

        return result?.queuing ?? null;
    }

    async gatherForParty(partyId?: string): Promise<IGameCenterParty | null> {
        const party = await this.backend.gather(partyId ? {partyId} : {});
        if (party)
            this.gcs.party = party;
        return party ?? null;
    }
}
