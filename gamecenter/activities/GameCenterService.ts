export interface IGameCenterProfile {
    registered: boolean;
    id?: string;
    userId?: string;
    nick?: string;
    createdAt?: number;
    updatedAt?: number;
}

export interface IGameCenterPartyPlayer {
    id: string;
    userId: string;
    nick: string;
    ready: boolean;
    joinedAt: number;
}

export type PartyStatus = "waiting" | "open" | "gathering" | "playing" | "ended" | "abandoned" | "finished";

export interface IGameCenterParty {
    partyId: string;
    roomId: string;
    gatheringId?: string;
    gameIdent: string;
    status: PartyStatus;
    size: number;
    playerCount: number;
    readyPlayerCount: number;
    parameters?: Record<string, unknown>;
    players?: IGameCenterPartyPlayer[];
    me: {
        member: boolean;
        gathered: boolean;
    };
    server?: string;
    matchTicket?: string;
    resultToken?: string;
    result?: unknown;
    createdAt?: number;
    updatedAt?: number;
}

export class GameCenterService {
    profile: IGameCenterProfile | null = null;
    party: IGameCenterParty | null = null;
}
