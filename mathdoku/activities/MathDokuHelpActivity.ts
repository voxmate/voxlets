import {RollActivity} from "@voxmate/orc/RollActivity";

export class MathDokuHelpActivity extends RollActivity {
    protected async run(): Promise<void | any> {
        const rolodex = this.roll();

        /*

        The goal of Math-Doku, also known as KenKen, is to fill a grid with digits - 1 through 3 for a 3 by 3 grid,
         1 through 4 for a 4 by 4 grid, 1 through 5 for a 5 by 5, and so on.
         It should be done in such a way, that each row and each column contain exactly one of each digit.
          Additionally, grid is divided into smaller, irregular by shape and size group of cells called cages.
          Each cage contains a target number. If there’s more than one cell in the cage, the target is also accompanied
          by an arithmetic operation. You must fill that cage with numbers that produce the target number, using only
          the specified arithmetic operation. Numbers can be filled in any order. Numbers may be repeated within a cage,
           if necessary, as long as they do not repeat within a single row or column. For example, a linear three-cell
           cage specifying addition and a target number of 6 in a 4 by 4 puzzle must be satisfied with the digits 1, 2, and 3.
            In a one-cell cage, just set the target number in that cell.

         */

        rolodex.add("Math-Doku, also known to some as KenKen, is played on a square Grid of Spaces.");
        rolodex.add("The Grid can be 3 by 3, 4 by 4, 5 by 5 and 6 by 6 spaces large.");
        rolodex.add("The Grid comes sectioned into Cages - irregularly shaped groups of adjacent Spaces.");
        rolodex.add("Each Cage has at least 1 Space, and has an arithmetical operation and Solution attached to it.");

        rolodex.add("All the Spaces in the Grid start off empty.");
        rolodex.add("The goal of Math-Doku is to fill out Spaces with numbers 1 through 3 for a 3 by 3 grid, 1 through 4 for a 4 by 4 grid, and so on.");
        rolodex.add("There are two basic rules that you must adhere to in order to fill the Grid");

        rolodex.add("First, you must make sure that no number is present more than once in same row or column");
        rolodex.add("For example, a row in a 3 by 3 Grid can be (1, 3, 2), but not (2, 3, 2)");

        rolodex.add("Second, each Cage's arithmetic operation on your numbers matches the provided Solution for that Cage");
        rolodex.add("For if the Cage operation is addition, and the solution is 3, the cage may have numbers (2, 1) but not (2, 2).");
        rolodex.add("Note, however, that numbers may repeat within a single Cage, because its shape could zig-zag across several rows and columns");


        await rolodex.run({autoskip: true});
    }
}