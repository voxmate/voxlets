import {HistoryChange, IChatMessage, normalizeTimestampMs} from "./common";

export class VoxLiveChatService {
    history: IChatMessage[] = [];
    userId: string = "";

    private trimHistory() {
        if (this.history.length > 500)
            this.history.shift();
    }

    addMessageToHistory(message: IChatMessage): HistoryChange {

        if (message.edited) {
            if (message.id) {
                const oldMessage = this.history.find(m => m.id == message.id);
                if (oldMessage) {
                    const idx = this.history.indexOf(oldMessage);
                    this.history.splice(idx, 1, message);
                    return HistoryChange.UpdatedMessage;
                }
            }

            const messageTs = normalizeTimestampMs(message.timestamp);
            for (let idx = 0; idx < this.history.length; ++idx) {
                const m = this.history[idx];
                if (normalizeTimestampMs(m.timestamp) > messageTs) {
                    this.history.splice(idx, 0, message);
                    this.trimHistory();
                    return HistoryChange.UpdatedMessage;
                }
            }
        }

        this.history.push(message);
        this.trimHistory();
        return HistoryChange.AddedMessage;
    }
}
