import {Activity} from "@voxmate/orc/orc";
import {BattleshipGame, CellStatus, ICell, ShootResult} from "../battleship/BattleshipGame";
import {Gesture} from "@voxmate/voxmate";

export class GameActivity extends Activity {

    private readonly size = 7;

    protected async run() {
        const game = new BattleshipGame(this.size);

        await this.execOutsideNavigationalScope(async () => {
            const that = this;

            let [x, y] = [0, 0];

            while (game.playing) {

                function move(g) {

                    if (g == Gesture.Left)
                        y -= 1;

                    if (g == Gesture.Up)
                        x -= 1;

                    if (g == Gesture.Down)
                        x += 1;

                    if (g == Gesture.Right)
                        y += 1;

                    if (y == that.size)
                        y -= 1;

                    if (x == that.size)
                        x -= 1;

                    if (x < 0)
                        x = 0;
                }

                function moveBack() {
                    if (x < 0)
                        x++;

                    if (x == that.size)
                        x--;

                    if (y < 0)
                        y++;

                    if (y == that.size)
                        y--;
                }

                async function describeCurrentPosition(cell: ICell) {
                    const ui1 = await that.saySkipping(cell.name);
                    if (ui1)
                        return ui1;

                    const ui2 = await that.saySkippingContent(CellStatus[cell.status]);
                    if (ui2)
                        return ui2;

                    return await that.get();
                }

                async function promptExit() {
                    let ui = await that.saySkipping("Do you want to quit the game?");
                    if (!ui) {
                        ui = await that.get();
                    }

                    return ui.kind == "gesture" && (ui.gesture == Gesture.Left || ui.gesture == Gesture.DoubleTap);

                }


                const cell = game.getCell(x, y);
                console.log("--------------");
                game.printBoard();

                let ui = this.getInterrupt();
                if (ui === null) {
                    ui = await describeCurrentPosition(cell);
                    this.getInterrupt();
                }

                if (ui.kind != "gesture") {
                    continue;
                }

                if (ui.gesture != Gesture.DoubleTap) {

                    move(ui.gesture);

                    if (x < 0 || y < 0 || x == this.size || y == this.size) {
                        if (await promptExit()) {
                            return;
                        } else {
                            moveBack();
                        }
                    }
                } else {
                    const result = game.shoot(x, y);
                    if (result == ShootResult.Miss) {
                        await that.saySkippingContent("You missed");
                    }
                    if (result == ShootResult.Hit) {
                        await that.saySkippingContent("You hit an enemy ship!");
                    }
                    if (result == ShootResult.Destroyed) {
                        await that.saySkippingContent("You destroyed an enemy ship!");
                    }
                }
            }
        });
    }
}