import {DeepMenuActivity, IMenuItem} from "@voxmate/orc/DeepMenu";
import {GameActivity} from "./GameActivity";

export class BattleshipMainMenuActivity extends DeepMenuActivity<string> {

    async handle(item: string): Promise<void> {
        return undefined;
    }

    async menu(): Promise<IMenuItem<string>[]> {
        return [
            {
                name: "Start a new Game",
                activity: GameActivity
            }
        ]
    }

}