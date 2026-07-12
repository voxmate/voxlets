import {RollActivity} from "@voxmate/orc/RollActivity";
import {SudokuGameManager} from "../SudokuGameManager";
import {Sudoku} from "../game/sudoku";
import {ISudokuTile} from "../game/types";
import {SudokuHelpActivity} from "./SudokuHelpActivity";

export abstract class SudokuUIBaseActivity<T> extends RollActivity<T> {
    protected readonly manager: SudokuGameManager;

    async help(): Promise<void> {
        await this.exec(new SudokuHelpActivity());
    }

    get sudoku(): Sudoku {
        return this.manager.sudoku;
    }

    changeValue(tile: ISudokuTile, value: number) {
        tile.value = value;
        if (value === 0)
            tile.unsure = false;
        this.manager.sudoku.checkVictory();
    }
}