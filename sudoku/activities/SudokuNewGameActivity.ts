import {SudokuUIBaseActivity} from "./SudokuUIBaseActivity";
import {SudokuGameActivity} from "./SudokuGameActivity";
import {GameDifficulty} from "../game/types";

export class SudokuNewGameActivity extends SudokuUIBaseActivity<any> {

    constructor() {
        super();
    }

    protected async run() {
        this.manager.clear();

        const roll = this.roll();

        if (this.orchestrator.environment.isDevelopment) {
            roll.add("Solve a Test Sudoku", async () => GameDifficulty.Test);
        }
        roll.add("Solve a Very Easy Sudoku", async () => GameDifficulty.VeryEasy);
        roll.add("Solve an Easy Sudoku", async () => GameDifficulty.Beginner);
        roll.add("Solve a Medium Sudoku", async () => GameDifficulty.Intermediate);
        roll.add("Solve a Difficult Sudoku", async () => GameDifficulty.Experienced);
        roll.add("Attempt the Impossible Sudoku", async () => GameDifficulty.Expert);

        const difficulty = await roll.run();
        if (difficulty !== undefined) {
            this.manager.newGame(difficulty);
            await this.exec(new SudokuGameActivity());
        }
    }
}