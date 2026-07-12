import {IPrompt} from "@voxmate/voxmate";
import {randomChoice} from "@voxmate/voxmate/utility/random";

export enum CellStatus {
    Clear,
    Clouds,
    DamagedShip,
    Debris
}

export enum ShootResult {
    Miss,
    Hit,
    Destroyed
}

export interface ICell {
    name: string;
    status: CellStatus
}

interface ICellData extends ICell {
    hasDebris: boolean;
    isDamaged: boolean;
    debrisDecay: number;
    ship: IShip | null;
    slot: ISlot | null;
}

interface IShip {
    name: string | IPrompt;
    size: number;
    power: number;
    cost: number;
}

interface ISlot {
    x: number;
    y: number;
    vertically: boolean;
}

interface IBattleshipGameState {
    aiPoints: number;
    field: ICellData[][];
    fieldSize: number;
}

const SHIPS: IShip[] = [
    {
        name: "Row boat",
        size: 1,
        power: 1,
        cost: 5
    }, {
        name: "Transporter",
        size: 2,
        power: 2,
        cost: 9
    }, {
        name: "Destroyer",
        size: 3,
        power: 4,
        cost: 16
    }, {
        name: "Cruiser",
        size: 4,
        power: 8,
        cost: 28
    }, {
        name: "Carrier",
        size: 5,
        power: 16,
        cost: 56
    }
];

const COLUMNS = "ABCDEFGHIJKLMNOPQRST";

export class BattleshipGame {

    private readonly _state: IBattleshipGameState;

    private get size(): number {
        return this._state.fieldSize;
    }

    private get field(): ICellData[][] {
        return this._state.field;
    }

    constructor(data: number | IBattleshipGameState) {
        if (typeof data == "number") {
            this._state = this.initNewGame(data);
            while (this.aiPlaceShip(true)) {
            }
        } else {
            this._state = data;
        }
    }

    private initNewGame(fieldSize: number): IBattleshipGameState {

        const field: ICellData[][] = [];

        for (let i = 0; i < fieldSize; ++i) {
            const row: ICellData[] = [];
            for (let j = 0; j < fieldSize; ++j) {
                row.push({
                    name: COLUMNS[i] + (j + 1),
                    status: CellStatus.Clouds,
                    debrisDecay: 0,
                    hasDebris: false,
                    ship: null,
                    slot: null,
                    isDamaged: false,
                })
            }
            field.push(row);
        }

        return {
            field: field,
            aiPoints: 100,
            fieldSize: fieldSize
        };
    }

    private getAffordableShips(): IShip[] {
        const affordable: IShip[] = [];
        for (let ship of SHIPS) {
            if (ship.cost <= this._state.aiPoints)
                affordable.push(ship);
        }
        affordable.reverse();
        return affordable;
    }

    private chooseShip(ships: IShip[], mustChoose: boolean): IShip | null {

        if (ships.length === 0)
            return null;

        if (!mustChoose) {
            const wait = randomChoice([false, false, true]);
            if (wait) {
                return null;
            }
        }

        return randomChoice(ships);
    }

    private checkFree(xp: number, yp: number, ship: boolean) {
        if (xp < 0 || yp < 0)
            return !ship;

        if (xp >= this.size || yp >= this.size)
            return !ship;

        const cell = this.field[xp][yp];
        return (cell.ship === null) && !cell.hasDebris && cell.status == CellStatus.Clouds
    }

    private checkShipDestroyed(src: ICellData) {

        const shipCells: ICellData[] = [];
        for (let i = 0; i < this.size; ++i) {
            for (let j = 0; j < this.size; ++j) {
                const cell = this.field[i][j];
                if (cell.slot === src.slot) {
                    shipCells.push(cell);
                }
            }
        }

        for (let cell of shipCells)
            if (!cell.isDamaged)
                return false;

        for (let cell of shipCells) {
            cell.status = CellStatus.Debris;
        }

        return true;
    }

    private checkIfShipCanBePlaced(x: number, y: number, size: number, vertically: boolean) {

        for (let offset of [-1, 0, 1]) {

            let xp = x + offset;
            let yp = y + offset;

            for (let i = -1; i <= size; ++i) {

                if (vertically) {
                    xp = x + i + offset;
                } else {
                    yp = y + i + offset;
                }

                if (!this.checkFree(xp, yp, offset == 0))
                    return false;
            }
        }

        return true;
    }

    private findSlotForShip(ship: IShip): ISlot | null {
        //Rules: no ships or debris around point, and all possible mount points

        const slots: null | ISlot[] = [];
        for (let vertically of [true, false]) {
            for (let x = 0; x < this.size; ++x) {
                for (let y = 0; y < this.size; ++y) {
                    if (this.checkIfShipCanBePlaced(x, y, ship.size, vertically)) {
                        slots.push({
                            x: x,
                            y: y,
                            vertically: vertically,
                        })
                    }
                }
            }
        }

        return randomChoice(slots);
    }

    private placeShip(ship: IShip, slot: ISlot) {

        console.log("Placing: ", ship.name, "at", COLUMNS[slot.x], slot.y + 1, slot.vertically ? "vert" : "hor");

        this._state.aiPoints -= ship.cost;

        const shipCopy = JSON.parse(JSON.stringify(ship));

        for (let i = 0; i < ship.size; ++i) {
            let [xp, yp] = [slot.x, slot.y];
            if (slot.vertically) {
                xp = slot.x + i;
            } else {
                yp = slot.y + i;
            }

            const cell = this.field[xp][yp];
            cell.ship = shipCopy;
            cell.slot = slot;
        }
    }

    private aiPlaceShip(mustChoose: boolean) {

        const ships = this.getAffordableShips();

        while (ships.length > 0) {

            const ship = this.chooseShip(ships, mustChoose);
            if (ship === null) {
                return false;
            }

            const slot = this.findSlotForShip(ship);
            if (slot == null) {
                ships.splice(ships.indexOf(ship), 1);
                continue
            }

            this.placeShip(ship, slot);
            return true;
        }

        return false;
    }

    shoot(x: number, y: number): ShootResult {
        const cell = this.field[x][y];

        if (cell.ship) {
            cell.isDamaged = true;
            cell.status = CellStatus.DamagedShip;
            if (this.checkShipDestroyed(cell))
                return ShootResult.Destroyed;
            return ShootResult.Hit;
        } else {
            cell.status = CellStatus.Clear;
        }

        return ShootResult.Miss;
    }

    getCell(x: number, y: number): ICell {
        return this.field[x][y];
    }

    printBoard() {

        let headers = " ";
        for (let i = 0; i < this.size; ++i) {
            headers += (i + 1).toString();
        }
        console.log(headers);

        for (let i = 0; i < this.size; ++i) {
            let row = COLUMNS[i] + "";
            for (let j = 0; j < this.size; ++j) {
                const cell = this.field[i][j];

                if (cell.ship) {
                    if (!cell.isDamaged) {
                        if (cell.slot.vertically)
                            row += "|";
                        else
                            row += "=";
                    } else {
                        row += "x"
                    }
                } else {
                    if (cell.status === CellStatus.Clouds) {
                        row += "?"
                    }

                    if (cell.status === CellStatus.Clear) {
                        row += "~"
                    }
                }
            }
            console.log(row);
        }

    }

    get playing(): boolean {
        return true
    }

    saveGame(): string {
        return JSON.stringify(this._state)
    }
}