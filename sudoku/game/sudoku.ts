import {GameDifficulty, ISudokuTile} from "./types";
import sudoku from 'sudoku-umd';

export class SudokuVictory {

}

interface ISudokuState {
    ticks: number;
    tiles: ISudokuTile[];
}

function initSudokuTiles(difficulty: GameDifficulty): ISudokuTile[] {

    const board = sudoku.generate(difficulty, false);
    const grid = sudoku.board_string_to_grid(board);

    const tiles: ISudokuTile[] = [];
    for (let i = 0; i < 9; ++i) {
        let row = "";
        for (let j = 0; j < 9; ++j) {
            const stringValue = grid[i][j];
            const provided = stringValue !== ".";

            let value = 0;
            if (provided)
                value = parseInt(stringValue);

            tiles.push({
                i: i,
                j: j,
                value: value,
                provided: provided,
                unsure: false
            });

            row += value;
        }
    }

    return tiles;
}

export class Sudoku {

    private _state: ISudokuState;

    constructor(private readonly difficulty: GameDifficulty = GameDifficulty.Intermediate) {
        this._state = {
            ticks: 0,
            tiles: initSudokuTiles(difficulty)
        };
        this.checkVictory();
    }

    load(json: string) {
        this._state = JSON.parse(json);
    }

    save(): string {
        return JSON.stringify(this._state);
    }

    get tiles(): ISudokuTile[] {
        return this._state.tiles;
    }

    getTileSquare(tile: ISudokuTile): ISudokuTile[] {
        const l = Math.floor(tile.i / 3);
        const k = Math.floor(tile.j / 3);
        return this.getSquareTiles(k, l);
    }

    getSquareTiles(k: number, l: number,): ISudokuTile[] {
        const tiles: ISudokuTile[] = [];
        for (let tile of this._state.tiles) {
            const cl = Math.floor(tile.i / 3) === l;
            const ck = Math.floor(tile.j / 3) === k;
            if (cl && ck)
                tiles.push(tile);
        }

        return tiles;
    }

    getRowTiles(i: number): ISudokuTile[] {
        const tiles: ISudokuTile[] = [];
        for (let j = 0; j < 9; ++j) {
            tiles.push(this.getTileAt(j, i));
        }
        return tiles;
    }

    getColumnTiles(j: number): ISudokuTile[] {
        const tiles: ISudokuTile[] = [];
        for (let i = 0; i < 9; ++i)
            tiles.push(this.getTileAt(j, i));
        return tiles;
    }

    private getTileAt(i: number, j: number): ISudokuTile {
        return this._state.tiles[i + 9 * j];
    }

    private getValueAt(i: number, j: number): number {
        return this.getTileAt(i, j).value;
    }

    private valid() {
        for (let i = 0; i < 9; ++i) {
            for (let j = 0; j < 9; ++j) {

                const value = this.getValueAt(i, j);
                if (value === 0) {
                    return false;
                }

                // Check the line
                for (let j2 = 0; j2 < 9; ++j2) {
                    if (j2 != j && this.getValueAt(i, j2) == value) {
                        return false;
                    }
                }

                // Check the column
                for (let i2 = 0; i2 < 9; ++i2) {
                    if (i2 != i && this.getValueAt(i2, j) == value) {
                        return false;
                    }
                }

                // Check the square
                const startI = Math.floor(i / 3) * 3;
                for (let i3 = startI; i3 < startI + 3; ++i3) {
                    const startJ = Math.floor(j / 3) * 3;
                    for (let j3 = startJ; j3 < startJ + 3; ++j3) {
                        if ((j3 != j || i3 != i) && this.getValueAt(i3, j3) == value) {
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    checkVictory() {
        if (this.valid()) {
            throw new SudokuVictory();
        }
    }

    getTime() {
        return this._state.ticks;
    }

    tick() {
        this._state.ticks++;
    }

    score() {
        // ((81 - diff)/81)^2*(10000000/seconds)
        const diff = this.difficulty;
        const seconds = this._state.ticks;
        return Math.floor(Math.pow((81 - diff) / 81, 2) * 10000000 / Math.max(1, seconds));
    }

    clear() {
        for (let tile of this._state.tiles) {
            if (!tile.provided) {
                tile.value = 0;
                tile.unsure = false;
            }
        }
    }
}