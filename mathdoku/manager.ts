import {IMathDokuGameState, MathDokuDifficulty, MathDokuGame} from "./activities/MathDokuGame";
import voxmate from "voxmate/voxmate";
import {Activity, IService} from "voxmate/orc/orc";
import {MathdokuSettings} from "./voxlet.types";


const SAVE_KEY = "save";
const SCORE_KEY = "highscore";
const GAMES_KEY = "gamesplayed";

export interface IScore {
    score: number;
    isHighScore: boolean;
}

export class MathDokuGameManager implements IService {
    static inject = Symbol("manager");

    private _game: MathDokuGame;

    newGame(size: number = 4, difficulty: MathDokuDifficulty = MathDokuDifficulty.Reduced) {
        this.clear();
        const state = MathDokuGame.createNewGame(size, difficulty);
        this._game = new MathDokuGame(state);
    }

    constructor(private readonly root: Activity) {

    }

    get haveSaveGame(): boolean {
        const save = localStorage.getItem(SAVE_KEY);
        return save !== null;
    }

    loadGame() {
        try {
            const saveJson = localStorage.getItem(SAVE_KEY);
            const save = JSON.parse(saveJson) as IMathDokuGameState;
            this._game = new MathDokuGame(save);
        } catch (e) {
            voxmate.system.telemetry.error("Unable to load mathdoku game", e);
            this.newGame();
        }
    }

    saveCurrentGame() {
        const save = JSON.stringify(this._game.save());
        localStorage.setItem(SAVE_KEY, save);
    }

    clear() {
        this._game = null;
        localStorage.removeItem(SAVE_KEY);
    }

    async getOptions(): Promise<MathdokuSettings> {
        return await this.root.getVoxletSettings();
    }

    get game() {
        if (!this._game)
            this.newGame();
        return this._game;
    }

    finishGame(): IScore {
        const score = this._game.score();
        const isHighScore = score > this.highScore;
        if (isHighScore) {
            localStorage.setItem(SCORE_KEY, score.toString());
        }

        const gamesPlayed = this.gamesPlayed + 1;
        localStorage.setItem(GAMES_KEY, gamesPlayed.toString());

        this.clear();

        return {
            score: score,
            isHighScore: isHighScore
        };
    }

    get gamesPlayed() {
        return parseInt(localStorage.getItem(GAMES_KEY) ?? "0");
    }

    get highScore(): number {
        return parseInt(localStorage.getItem(SCORE_KEY) ?? "0");
    }
}