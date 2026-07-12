import {Sudoku} from "./game/sudoku";
import {GameDifficulty} from "./game/types";
import voxmate from "@voxmate/voxmate";

const SAVE_KEY = "save";
const SCORE_KEY = "highscore";
const GAMES_KEY = "gamesplayed";

export interface IScore {
    score: number;
    isHighScore: boolean;
}

export class SudokuGameManager {
    private _sudoku: Sudoku;

    newGame(difficulty: GameDifficulty = GameDifficulty.Intermediate) {
        this.clear();
        this._sudoku = new Sudoku(difficulty);
    }

    get haveSaveGame(): boolean {
        const save = localStorage.getItem(SAVE_KEY);
        return save !== null;
    }

    loadGame() {
        try {
            const saveJson = localStorage.getItem(SAVE_KEY);
            const save = JSON.parse(saveJson) as { state: string };

            this._sudoku = new Sudoku();
            this._sudoku.load(save.state);
        } catch (e) {
            voxmate.system.telemetry.error("Unable to load sudoku game", e);
            this.newGame();
        }
    }

    saveCurrentGame() {
        const save = JSON.stringify({state: this._sudoku.save()});
        localStorage.setItem(SAVE_KEY, save);
    }

    clear() {
        localStorage.removeItem(SAVE_KEY);
    }

    get sudoku(): Sudoku {
        if (!this._sudoku)
            this.newGame();
        return this._sudoku;
    }

    finishGame(): IScore {
        const score = this._sudoku.score();
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
