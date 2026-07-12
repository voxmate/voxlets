import {SudokuUIBaseActivity} from "./SudokuUIBaseActivity";
import {SudokuBoardActivity} from "./SudokuMapBaseActivity";
import {Sudoku, SudokuVictory} from "../game/sudoku";
import {SudokuHelpActivity} from "./SudokuHelpActivity";
import {formatDuration} from "@voxmate/voxmate/utility/strings";
import {Sound} from "@voxmate/voxmate";

export class SudokuGameActivity extends SudokuUIBaseActivity<any> {

    get game(): Sudoku {
        return this.manager.sudoku;
    }

    constructor() {
        super();
    }

    protected async run() {

        this.setInterval(() => {
            this.game.tick();
        }, 1000);

        let won = false;
        this.onEnd(() => {
            if (!won)
                this.manager.saveCurrentGame();
        });

        try {
            const roll = this.roll();
            roll.add("Game Grid", async () => {
                await this.exec(new SudokuBoardActivity());
            });
            roll.add("How to Play", async () => {
                await this.exec(new SudokuHelpActivity());
            });
            roll.add("Clear My Solution", async () => {
                if (await this.confirm()) {
                    this.game.clear();
                    this.sound(Sound.Good);
                }
            });
            await roll.runBlockingLeft();
        } catch (e) {
            if (e instanceof SudokuVictory) {
                won = true;

                const seconds = this.game.getTime();
                const score = this.manager.finishGame();

                await this.sayDynamicInfo("Congratulations, you've solved this sudoku!");
                await this.sayDynamicInfo("It took you: " + formatDuration(seconds * 1000));
                if (score.isHighScore) {
                    await this.sayDynamicInfo(`Congratulations, you have a new high score - ${score.score} points`);
                } else {
                    await this.sayDynamicInfo(`Your score is: ${score.score} points`);
                }
            } else throw e;
        }
    }
}
