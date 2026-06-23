import {colorize} from "../utility/coloring";
import {KenKen, KenKenGenerator, MathGroup, MathOperators} from "kengen";

export interface Region extends MathGroup {
    color: number;
}

export interface IMathDokuPuzzle extends KenKen {
    math: Region[];
}

export enum MathDokuDifficulty {
    Reduced,
    Full
}

export interface IMathDokuGameState {
    ticks: number;
    puzzle: IMathDokuPuzzle;
    solution: number[];
    size: number;
    difficulty: MathDokuDifficulty;
}

const MAX_GENERATION_ATTEMPTS = 30;
const PRIMES = [null, 2, 3, 5, 7, 11, 13, 17, 19, 23, 29];

function toCoordinate(index: number, size: number): { x: number, y: number } {
    const x = index % size;
    const y = Math.floor(index / size);
    return {x: x, y: y};
}

function isAdjacentIndex(a: number, b: number, size: number): boolean {
    const ac = toCoordinate(a, size);
    const bc = toCoordinate(b, size);

    for (let io = -1; io < 2; ++io) {
        for (let jo = -1; jo < 2; ++jo) {
            const xt = ac.x + io;
            const yt = ac.y + jo;
            if (xt == bc.x && yt == bc.y)
                return true;
        }
    }

    return false;
}

function isAdjacentRegion(a: Region, b: Region, size: number): boolean {
    for (let ac of a.cells) {
        for (let bc of b.cells) {
            if (isAdjacentIndex(ac, bc, size))
                return true;
        }
    }
    return false;
}

function cellIndex(i: number, j: number, size: number): number {
    return j * size + i;
}

function calculateColumnSignature(puzzle: KenKen, solution: number[], i: number): number {
    let product = 1;
    for (let j = 0; j < puzzle.size; ++j)
        product *= PRIMES[solution[(cellIndex(i, j, puzzle.size))]];
    return product;
}

function calculateRowSignature(puzzle: KenKen, solution: number[], j: number): number {
    let product = 1;
    for (let i = 0; i < puzzle.size; ++i)
        product *= PRIMES[solution[(cellIndex(i, j, puzzle.size))]];
    return product;
}

function checkSolutionConstraint(puzzle: KenKen, solution: number[]): boolean {

    let sig = 1;
    for (let i = 1; i <= puzzle.size; ++i)
        sig *= PRIMES[i];

    for (let i = 0; i < puzzle.size; ++i) {
        if (calculateColumnSignature(puzzle, solution, i) !== sig)
            return false;

        if (calculateRowSignature(puzzle, solution, i) !== sig)
            return false;
    }

    return true;
}

function checkGroup(cell: number[], op: MathOperators): number {
    switch (op) {
        case MathOperators.ADDITION:
            return cell.reduce((s, v) => s + v, 0);
        case MathOperators.MULTIPLICATION:
            return cell.reduce((s, v) => s * v, 1);
        case MathOperators.SUBTRACTION:
            return cell.reduce((s, c) => Math.max(s, c) - Math.min(s, c), 0);
        case MathOperators.DIVISION:
            return cell.reduce((s, c) => Math.max(s, c) / Math.min(s, c), 1);
    }

    throw "Invalid operator";
}

function checkSolutionMatchesGroupValue(puzzle: KenKen, solution: number[]): boolean {

    for (let group of puzzle.math) {
        const cell = group.cells.map(idx => solution[idx]);
        if (checkGroup(cell, group.operation) !== group.result)
            return false;
    }

    return true;
}

function checkSolutionValid(puzzle: KenKen, solution: number[]) {

    if (solution.some(v => v === null))
        return false;

    if (!checkSolutionConstraint(puzzle, solution))
        return false;

    if (!checkSolutionMatchesGroupValue(puzzle, solution))
        return false;

    return true;
}

function checkPuzzleValid(puzzle: KenKen) {
    // Sometimes KenGen generates invalid puzzles, they have non-integer solutions.
    for (let result of puzzle.math) {
        if (!Number.isInteger(result.result))
            return false;
    }

    return checkSolutionValid(puzzle, puzzle.cells);
}

export class MathDokuGameVictory {
}

export class MathDokuGame {


    static createNewGame(size: number, difficulty: MathDokuDifficulty): IMathDokuGameState {
        const operators = [MathOperators.ADDITION, MathOperators.SUBTRACTION];
        if (difficulty === MathDokuDifficulty.Full)
            operators.push(...[MathOperators.MULTIPLICATION, MathOperators.DIVISION]);

        let puzzle: IMathDokuPuzzle;
        let stopper = 0;
        do {
            puzzle = KenKenGenerator.generate({
                size: size,
                operations: operators
            }) as IMathDokuPuzzle;
            ++stopper;
        } while (!checkPuzzleValid(puzzle) && stopper < MAX_GENERATION_ATTEMPTS);
        if (stopper === MAX_GENERATION_ATTEMPTS)
            throw `Unable to generate a valid game in ${MAX_GENERATION_ATTEMPTS} moves`;

        const adjacencyMatrix = [];
        for (let i = 0; i < puzzle.math.length; ++i) {
            const groupI = puzzle.math[i];
            const adjacencyVector = [];
            adjacencyMatrix.push(adjacencyVector);
            for (let j = 0; j < puzzle.math.length; ++j) {
                if (j !== i) {
                    if (isAdjacentRegion(groupI, puzzle.math[j], size)) {
                        adjacencyVector.push(j);
                    }
                }
            }
        }

        const colors = colorize(adjacencyMatrix);
        for (let i = 0; i < colors.length; ++i)
            puzzle.math[i].color = colors[i];


        console.log(puzzle.cells);

        return {
            ticks: 0,
            puzzle: puzzle,
            difficulty: difficulty,
            size: size,
            solution: Array(puzzle.cells.length).fill(null)
        };
    }

    constructor(private readonly state: IMathDokuGameState) {
        console.log(state);
    }

    private cellIndex(i: number, j: number): number {
        return cellIndex(i, j, this.state.size);
    }

    getRegion(i: number, j: number) {
        const cellIndex = this.cellIndex(i, j);
        for (let region of this.state.puzzle.math) {
            if (region.cells.some((index) => index == cellIndex))
                return region;
        }
        throw new Error("Impossible Region");
    }

    getValue(i: number, j: number): number {
        return this.state.solution[this.cellIndex(i, j)];
    }

    setValue(i: number, j: number, value: number) {
        this.state.solution[this.cellIndex(i, j)] = value;
        if (this.isRight)
            throw new MathDokuGameVictory();
    }

    getRow(j: number): number[] {
        const row = [];
        for (let i = 0; i < this.state.size; ++i) {
            row.push(this.getValue(i, j));
        }
        return row;
    }

    getColumn(i: number): number[] {
        const column = [];
        for (let j = 0; j < this.state.size; ++j) {
            column.push(this.getValue(i, j));
        }
        return column;
    }

    get isUnfinished() {
        for (let item of this.state.solution)
            if (item === null)
                return true;
        return false;
    }

    get isRight() {
        if (this.isUnfinished)
            return false;
        return checkSolutionValid(this.state.puzzle, this.state.solution);
    }

    get isWrong(): boolean {
        if (this.isUnfinished)
            return false;
        return !checkSolutionValid(this.state.puzzle, this.state.solution);
    }

    save(): IMathDokuGameState {
        return this.state;
    }

    clearSolution() {
        for (let i = 0; i < this.state.solution.length; ++i)
            this.state.solution[i] = null;
    }

    score() {
        // MATH: 10^diff*100000/Max[1, seconds], where diff is 0 or 1
        // MAX SCORE is 1 000 000, but practically you'll get scores less than 1000
        let diffFactor = this.state.difficulty === MathDokuDifficulty.Reduced ? 0 : 1;
        return Math.floor(Math.pow(10, 2 + this.size + diffFactor) / Math.max(1, this.getTicks()));
    }

    get size(): number {
        return this.state.size;
    }

    tick() {
        this.state.ticks++;
    }

    getTicks() {
        return this.state.ticks;
    }
}