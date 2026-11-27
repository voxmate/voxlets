import {backendSocketUrl} from "@voxmate/orc/backend";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const CHAT_IDENT = "github.com/voxmate/voxlets/chat";

export function getChatSocketUrl(): string {
    return backendSocketUrl(CHAT_IDENT, "/ws/chat/chatroom");
}

export interface IChatMessage {
    id: string;
    userId?: string;
    nick?: string;
    text?: string;
    channel?: string;
    username?: string;
    message?: string;
    isVoxmateTeam?: boolean;
    timestamp: string | number;
    edited?: boolean;
}

export interface IChatSettings {
    nick: string;
}

export enum HistoryChange {
    AddedMessage,
    UpdatedMessage,
}

export function normalizeTimestampMs(timestamp: string | number): number {
    const numeric = typeof timestamp === "number" ? timestamp : parseFloat(timestamp);
    if (!Number.isFinite(numeric))
        return Date.now();
    return numeric < 1e12 ? numeric * 1000 : numeric;
}

export function tdFromNow(timestamp: string | number) {
    const mtime = new Date(normalizeTimestampMs(timestamp));
    return dayjs(mtime).fromNow();
}

export function roughFuture(seconds: number) {
    const mtime = new Date();
    mtime.setSeconds(mtime.getSeconds() + seconds);
    return dayjs(mtime).fromNow();
}

export function whenMessage(message: IChatMessage) {
    return tdFromNow(message.timestamp);
}

export function getMessageText(message: IChatMessage): string {
    return message.text ?? message.message ?? "";
}

export function getUserName(message: IChatMessage): [string, string] {
    if (message.nick !== undefined)
        return [message.nick, message.userId ?? message.nick];

    const username = message.username ?? "Anonymous";
    if (message.isVoxmateTeam)
        return [username, username];

    const mm = username.split(" | ");
    if (mm.length !== 2)
        return [username, username];

    return [mm[1], mm[0]];
}
