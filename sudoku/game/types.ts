export enum GameDifficulty {
    Test = 80, //TODO: Remove
    VeryEasy = 70,
    Beginner = 62,
    Intermediate = 53,
    Experienced = 35,
    Expert = 26
}

export interface ISudokuTile {
    i: number;
    j: number;
    provided: boolean;
    unsure: boolean;
    value: number;
}