import {ITile} from "../game/types";
import {VoxvilleUIBaseActivity} from "./VoxvilleUIBaseActivity";
import {Actor} from "@voxmate/voxmate";

export class VoxvilleTileActivity extends VoxvilleUIBaseActivity<any> {

    constructor(private readonly tile: ITile) {
        super();
    }

    protected async run() {

        if (this.tile.buildingId !== null) {
            const building = this.vv.getBuildingData(this.tile.buildingId);
            await this.playBuildingEffect(building.code);
        }

        if (this.tile.buildingId === null) {
            await this.createBuildingOptionsRoll(this.tile).setActor(Actor.DynamicInformational).run();
        } else await this.createTileBuildingOptionsRoll(this.tile).setActor(Actor.DynamicInformational).run();
    }
}