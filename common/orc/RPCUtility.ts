/*
        This file is shared between Client/Server through the magic of LN -S. Better ideas?
 */


// Resolves if a task is cancelled.
export interface CancellationToken<T = boolean> extends Promise<T> {
    timeout?: number;
}

export type RPCProtocol =
    | "init"        // Handshake: Sent by Server when Server is Ready. No other communication allowed before INIT.
    | "ready"       // Handshake: Sent by Client, when client is Ready. Client can RPC before Client is READY, but after INIT.
    | "rpc"         // Client/Server Sends RPC to Server/Client invoking a METHOD, with DATA, and Gets back a RESPONSE.
    | "response"    // Response Packet for a Given RPC request.
    | "error"       // ERROR Packet. If it is sent, the connection is broken.
    | "event"       // Server sends an EVENT to Client, without expecting a response.
    | "cancel"      // Server sends to Client, if RPC REQUEST is cancelled.
                    // Client should honor the cancellation by collapsing any prompts, and notifying the user of time-outitude.

export interface IRPCMessage {
    readonly protocol: RPCProtocol;
}

export interface IRPCInitMessage extends IRPCMessage {
    readonly protocol: "init"
    readonly connectionId: string;
}

export interface IRPCReadyMessage extends IRPCMessage {
    readonly protocol: "ready"
}

export interface IRPCEventMessage extends IRPCMessage {
    readonly protocol: "event";
    readonly channel: string;
    readonly data: any | null;
}

interface IRPCProtocolMessage extends IRPCMessage {
    readonly requestId: string;
}

export interface IRPCRequest extends IRPCProtocolMessage {
    readonly protocol: "rpc";
    readonly method: string;
    readonly data: any | null;

    // If present provides a hint to the request handler about possible future cancellation.
    readonly timeout?: number;
}

export interface IRPCRequestCancellation extends IRPCProtocolMessage {
    readonly protocol: "cancel"
}

export interface IRPCResponse extends IRPCProtocolMessage {
    readonly protocol: "response" | "error" | "cancel"
    readonly data?: any | null;
    readonly error?: string;
}

export interface IRPCErrorResponse extends IRPCProtocolMessage {
    protocol: "error";
    message: string;
}

function checkProtocol(obj: any, name: RPCProtocol) {
    return obj && obj.protocol === name;
}

export function isRPCInitMessage(obj: any): obj is IRPCInitMessage {
    return checkProtocol(obj, "init");
}

export function isRPCEventMessage(obj: any): obj is IRPCEventMessage {
    return checkProtocol(obj, "event");
}

export function isRPCResponse(obj: any): obj is IRPCResponse {
    return checkProtocol(obj, "response");
}

export function isRPCErrorResponse(obj: any): obj is IRPCErrorResponse {
    return checkProtocol(obj, "error");
}

export function isRPCRequest(obj: any): obj is IRPCRequest {
    return checkProtocol(obj, "rpc");
}

export function isRPCReadyMessage(obj: any): obj is IRPCReadyMessage {
    return checkProtocol(obj, "ready");
}

export function isRPCRequestCancellation(obj: any): obj is IRPCRequestCancellation {
    return checkProtocol(obj, "cancel");
}


// GameRoom

export enum GameRoomStatus {
    Gathering = 0,
    Playing = 1,
    GameOver = 2
}

export const GameRoomConstants = {
    getRoomStatus: "getRoomStatus",
    roomStatus: "roomStatus",
    infoChannel: "info",
    contentChannel: "content",
    roomClosing: "roomClosing"
};
