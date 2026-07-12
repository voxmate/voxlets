import {SudokuUIBaseActivity} from "./SudokuUIBaseActivity";
import {SudokuGameActivity} from "./SudokuGameActivity";
import {Actor, Gesture} from "@voxmate/voxmate";
import {SudokuNewGameActivity} from "./SudokuNewGameActivity";
import {SudokuHelpActivity} from "./SudokuHelpActivity";

export class SudokuMainMenuActivity extends SudokuUIBaseActivity<any> {

    protected async run() {

        const rolodex = this.roll().setActor(Actor.Content);

        const continueOption = rolodex.add("Continue playing", async () => {
            this.manager.loadGame();
            await this.exec(new SudokuGameActivity());
        }).showWhen(async () => this.manager.haveSaveGame);

        rolodex.add("Solve a New Sudoku", async () => {
            if (this.manager.haveSaveGame) {
                await this.saySkippingDynamicContent("If you start a new game, your previous game will be lost. Continue?");
                const ui = await this.get();

                if (ui.kind == "gesture")
                    if (ui.gesture === Gesture.Right) {
                        await this.exec(new SudokuNewGameActivity());
                        continueOption.goto();
                    }

            } else {
                await this.exec(new SudokuNewGameActivity());
                await continueOption.goto();
            }
        });

        rolodex.add("How to Play", async () => {
            await this.exec(new SudokuHelpActivity());
        });

        rolodex.add("My High Score", async () => {
            if (this.manager.gamesPlayed > 0) {
                await this.sayDynamicInfo(`Your High Score is ${this.manager.highScore} points`);
                await this.sayDynamicInfo(`Your have solved ${this.manager.gamesPlayed} sudoku puzzles`);
            } else {
                await this.sayDynamicInfo(`You haven't solved any sudokus yet`);
            }
        }).showWhen(async () => this.manager.highScore > 0);

        rolodex.add("Clear All Game Data", async () => {
            if (await this.confirm()) {
                this.manager.clear();
                this.quit(0);
            }
        }).showWhen(async () => this.manager.haveSaveGame);

        return await rolodex.run();
    }
}