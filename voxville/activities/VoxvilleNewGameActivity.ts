import {VoxvilleUIBaseActivity} from "./VoxvilleUIBaseActivity";
import {singularize} from "./utility/utility";
import {VoxvilleGameActivity} from "./VoxvilleGameActivity";

export class VoxvilleNewGameActivity extends VoxvilleUIBaseActivity<any> {
    protected async run() {
        this.manager.clear();
        this.manager.newGame();

        await this.sayDynamicInfo("Pick your starting region");

        const pickRegionRoller = await this.roll();
        for (let region of this.vv.game.regions) {

            if (this.vv.canAfford(this.vv.getRegionCost(region))) {

                pickRegionRoller.add(region.name, async () => {

                    let matchCount = 0;
                    for (let tile of region.tiles) {
                        if (tile.kind === region.kind)
                            ++matchCount;
                    }
                    const regionInfo = this.roll();

                    regionInfo.add(`${matchCount} ${singularize(region.kind)} districts`);
                    regionInfo.add("Start village here", async () => {
                        this.vv.buyRegion(region);
                        return region.tiles[4];
                    });

                    return await regionInfo.run();
                });
            }
        }

        const tile = await pickRegionRoller.run();

        if (tile)
            await this.exec(new VoxvilleGameActivity(tile));
    }
}