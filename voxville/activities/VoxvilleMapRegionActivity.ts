import {VoxvilleMapTileActivity} from "./VoxvilleMapTileActivity";
import {Activity} from "@voxmate/orc/orc";
import {VoxvilleMapBaseActivity} from "./VoxvilleMapBaseActivity";
import {Ding, Loop} from "./VoxvilleUIBaseActivity";
import {ITile} from "../game/types";
import {INavGridLocation} from "@voxmate/orc/navigation/NavGrid";
import {Rolodex} from "@voxmate/orc/rolodex";

export class VoxvilleMapRegionActivity extends VoxvilleMapBaseActivity {


    constructor(private readonly startingTile?: ITile, private descendStartingTile: boolean = true) {
        super();
    }

    descend(i: number, j: number): Activity | Rolodex {
        const region = this.vv.getRegion(i, j);

        if (region.locked)
            return this.createRegionOptionsRoll(region);

        //We shall only descend to starting tile once
        if (this.startingTile && this.descendStartingTile) {
            this.descendStartingTile = false;
            return new VoxvilleMapTileActivity(region, this.startingTile);
        } else {
            return new VoxvilleMapTileActivity(region, undefined);
        }
    }

    async describeMapTile(i: number, j: number): Promise<any> {
        const region = this.vv.getRegion(i, j);
        return this.describeRegion(region);
    }

    getDing(): Ding {
        return "regionGridIn";
    }

    getLoop(): Loop {
        return "rain";
    }

    jumpTo(): INavGridLocation | undefined {
        if (this.startingTile) {
            const region = this.vv.getTileRegion(this.startingTile.i, this.startingTile.j);
            const idx = this.vv.game.regions.indexOf(region);
            return {i: Math.floor(idx / 3), j: idx % 3};
        }
        return undefined;
    }
}