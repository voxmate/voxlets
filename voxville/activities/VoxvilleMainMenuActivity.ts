import {VoxvilleUIBaseActivity} from "./VoxvilleUIBaseActivity";
import {VoxvilleGameActivity} from "./VoxvilleGameActivity";
import {Actor, Gesture} from "@voxmate/voxmate";
import {VoxvilleNewGameActivity} from "./VoxvilleNewGameActivity";
import {VoxvilleAlmanacActivity} from "./VoxvilleAlmanacActivity";

export class VoxvilleMainMenuActivity extends VoxvilleUIBaseActivity<any> {

    protected async init(): Promise<void> {
        await super.init();
        await this.preloadAssets();
    }

    protected async run() {

        const rolodex = this.roll().setActor(Actor.Informational);

        const continueOption = rolodex.add("Continue playing", async () => {
            this.manager.loadGame();
            await this.exec(new VoxvilleGameActivity());
        }).showWhen(async () => this.manager.haveSaveGame);

        rolodex.add("Start a New Game", async () => {
            if (this.manager.haveSaveGame) {
                await this.saySkippingDynamicContent("If you start a new game, your previous game will be lost. Continue?");
                const ui = await this.get();
                if (ui.kind == "gesture") {
                    if (ui.gesture === Gesture.Right) {
                        await this.exec(new VoxvilleNewGameActivity());
                        continueOption.goto();
                    }
                }
            } else {
                await this.exec(new VoxvilleNewGameActivity());
                await continueOption.goto();
            }
        });

        rolodex.add("Browse the Voxville Almanac", async () => {
            await this.exec(new VoxvilleAlmanacActivity());
        });

        rolodex.add("Clear Saved Game", async () => this.manager.clear())
            .showWhen(async () => this.manager.haveSaveGame);

        return await rolodex.run();
    }
}