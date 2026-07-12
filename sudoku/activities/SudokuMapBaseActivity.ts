import {SudokuUIBaseActivity} from "./SudokuUIBaseActivity";
import {Activity} from "@voxmate/orc/orc";
import voxmate, {Gesture, Sound} from "@voxmate/voxmate";
import {ISudokuTile} from "../game/types";
import {INavGridLocation, NavGrid} from "@voxmate/orc/navigation/NavGrid";

export class Point {
    constructor(readonly i: number, readonly j: number) {
    }
}

const positions = ["North Eastern", "Northern", "North Western", "Eastern",
    "Central", "Western", "South Eastern", "Southern", "South Western"];

export abstract class SudokuMapBaseActivity extends SudokuUIBaseActivity<any> {
    private ng = new NavGrid(3, 3).stepToCenter();

    constructor() {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
    }

    abstract describeMapTile(i: number, j: number);

    abstract descend(i: number, j: number): Activity;

    private async descendInternal() {
        await this.exec(this.descend(this.ng.i, this.ng.j));
    }

    protected async run(): Promise<void | undefined> {

        const ng = this.ng;

        await this.execOutsideNavigationalScope(async () => {

                let bump: INavGridLocation = null;

                while (this.isActive) {

                    let ui = this.getInterrupt();
                    if (ui === null) {
                        ui = await this.asSayGroup(async () => await this.describeMapTile(ng.i, ng.j));
                    }

                    if (!ui) {
                        ui = await this.get();
                    }

                    if (ui.kind != "gesture") {
                        continue;
                    }

                    if (ng.isSteppingGesture(ui.gesture)) {
                        ng.step(ui.gesture);
                        if (ng.isOutsideBounds) {
                            if (!bump || !ng.matches(bump)) {
                                voxmate.audio.sound(Sound.Separator);
                                bump = ng.loc;
                                ng.stepBackToGrid();
                            } else {
                                return;
                            }
                        } else {
                            bump = null;
                        }

                    } else if (ui.gesture === Gesture.DoubleTap) {
                        await this.descendInternal();
                    } else if (ui.gesture === Gesture.Hat) {
                        return;
                    }

                    if (ng.isOutsideBounds)
                        ng.stepBackToGrid();
                }
            }
        );
    }
}

function multi(text: string, n: number) {
    if (n === 0)
        return text + "s";

    if (n > 1)
        return text + "s";

    return text;
}

export class SudokuBoardActivity extends SudokuMapBaseActivity {

    descend(k: number, l: number): Activity {
        return new SudokuSquareActivity(k, l);
    }

    async describeMapTile(k: number, l: number): Promise<any> {
        const tiles = this.sudoku.getSquareTiles(k, l);
        const totalProvided = tiles.filter((t) => t.provided).length;
        const countMissing = tiles.filter((t) => t.value === 0).length;
        const set = tiles.filter((t) => t.value > 0 && !t.provided).length;
        const unsure = tiles.filter((t) => t.value > 0 && !t.provided && t.unsure).length;
        const pd = positions[k + 3 * l];

        await this.sayDynamicInfo(`${countMissing} ${multi("number", countMissing)} missing in ${pd} square`);
        if (totalProvided < 9)
            await this.sayDynamicInfo(`${set} ${multi("number", set)} set`);
        if (unsure > 0)
            await this.sayDynamicInfo(`${unsure} ${multi("number", unsure)} unsure`);
    }
}

export class SudokuSquareActivity extends SudokuMapBaseActivity {

    constructor(private k: number, private l: number) {
        super();
    }

    descend(i: number, j: number): Activity {
        const tiles = this.sudoku.getSquareTiles(this.k, this.l);
        return new SudokuSpaceActivity(tiles[i + 3 * j]);
    }

    async describeMapTile(i: number, j: number): Promise<any> {
        const tiles = this.sudoku.getSquareTiles(this.k, this.l);
        const tile: ISudokuTile = tiles[i + 3 * j];
        const pd = positions[i + 3 * j];

        if (tile.provided) {
            await this.sayDynamicInfo(`${tile.value} given in ${pd} space`);
        } else {
            if (tile.value === 0) {
                await this.sayDynamicContent(`no number in ${pd} space`);
            } else {
                const unsure = tile.unsure ? " unsure" : "";
                await this.sayDynamicContent(`${tile.value}${unsure} set in ${pd} space`);
            }
        }
    }
}

export class SudokuSpaceActivity extends SudokuUIBaseActivity<any> {

    constructor(private readonly tile: ISudokuTile) {
        super();
    }

    protected async run(): Promise<void | any> {

        const that = this;

        async function showTileSequence(tiles: ISudokuTile[], self: ISudokuTile, isRow: boolean) {
            const sequence = that.roll();
            let lastIndex = null;
            for (let i = 0; i < tiles.length; ++i) {

                const tile = tiles[i];
                let valueS = "";
                if (i === 0) {
                    if (isRow) {
                        valueS += "Left Edge ";
                    } else {
                        valueS += "Top Edge ";
                    }
                }

                if (i === tiles.length - 1) {
                    if (isRow) {
                        valueS += "Right Edge ";
                    } else {
                        valueS += "Bottom Edge ";
                    }
                }

                if (tile === self) {
                    voxmate.audio.sound(Sound.Marker);
                }

                if (tile.value === 0)
                    valueS += "not set";
                else valueS += tile.value.toString();

                if (tile.provided) {
                    valueS += " given";
                } else if (tile.value > 0) {
                    valueS += " set";
                }

                if (tile.unsure) {
                    valueS += " unsure";
                }

                sequence.add(async () => {
                    if (i === 0 && lastIndex === tiles.length - 1) {
                        voxmate.audio.sound(Sound.Separator);
                    }
                    lastIndex = i;
                    return valueS;
                });
            }
            await sequence.run();
        }

        if (this.tile.provided) {
            voxmate.audio.sound(Sound.Separator);
            return;
        }

        const roll = this.roll();

        roll.add("Set Value", async () => {
            const options = this.roll();
            for (let i = 0; i <= 9; ++i) {
                const value = (i + this.tile.value) % 10;
                options.add(async () => {
                    if (value > 0) return value.toString();
                    return "Clear";
                }, async () => {
                    this.changeValue(this.tile, value);
                    roll.unwind();
                }).showWhen(async () => {
                    if (value === 0)
                        return true;

                    const square = this.sudoku.getTileSquare(this.tile);
                    return square.find((tile) => tile.value === value) === undefined;
                });
            }
            await options.run();
        });

        roll.add("Check Row", async () => {
            const row = this.manager.sudoku.getRowTiles(this.tile.i);
            await showTileSequence(row, this.tile, true);
        });

        roll.add("Check Column", async () => {
            const col = this.manager.sudoku.getColumnTiles(this.tile.j);
            await showTileSequence(col, this.tile, false);
        });

        roll.add(async () => this.tile.unsure ? "Mark Confident" : "Mark Unsure", async () => {
            this.tile.unsure = !this.tile.unsure;
            roll.unwind();
        }).showWhen(async () => this.tile.value !== 0);


        await roll.run();

    }

}