import {VoxVille} from "./game/game";
import voxmate, {IVoxmatePromise} from "@voxmate/voxmate";

const SAVE_GAME_KEY = "save";

export class VoxvilleGameManager {
    private _vv: VoxVille;

    newGame() {
        localStorage.removeItem(SAVE_GAME_KEY);
        this._vv = new VoxVille();
    }

    get haveSaveGame(): boolean {
        const save = localStorage.getItem(SAVE_GAME_KEY);
        return save !== null;
    }

    loadGame() {
        const saveJson = localStorage.getItem(SAVE_GAME_KEY);
        const save = JSON.parse(saveJson) as { state: string };

        this._vv = new VoxVille();
        this._vv.load(save.state);
    }

    saveCurrentGame() {
        const save = JSON.stringify({state: this._vv.save()});
        localStorage.setItem(SAVE_GAME_KEY, save);
    }

    clear() {
        localStorage.removeItem(SAVE_GAME_KEY);
    }

    get vv(): VoxVille {
        if (!this._vv)
            this.newGame();
        return this._vv;
    }
}