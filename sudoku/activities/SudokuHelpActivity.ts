import {RollActivity} from "@voxmate/orc/RollActivity";

export class SudokuHelpActivity extends RollActivity<void> {
    protected async run(): Promise<void> {
        await this.readLong([
            "Sudoku is played on a grid of 9 by 9 spaces.",
            "To make it easier to navigate, the spaces are arranged into a smaller grid of 3 by 3 squares.",
            "Each square is a smaller grid of 3 by 3 spaces",

            "Each row, column and square needs to be filled with numbers one through nine, but never repeat",
            "Some spaces are given to you, and you can't change their value",
            "Sudoku is easier if a lot of spaces are given",

            "Within the Game Grid use swipe up, left, down and right gestures to choose a square, double tap to enter each square.",
            "At the grid boundary you will hear a ping indicating the boundary.",
            "Swiping in that direction again, will break out of the grid.",

            "You will then have an option to choose one of the 9 spaces, double tap to set value.",
            "When you filled out the entire grid correctly, the game will end and you will get your score.",
            "To exit the game, either swipe left repeatedly or draw a counter-clockwise circle."
        ], {escapeAfterLastBlock: true});
    }
}