import {IRegion, ITile} from "../game/types";
import {VoxvilleTileActivity} from "./VoxvilleTileActivity";
import {VoxvilleMapBaseActivity} from "./VoxvilleMapBaseActivity";
import {Activity} from "@voxmate/orc/orc";
import {Ding, Loop} from "./VoxvilleUIBaseActivity";
import {INavGridLocation} from "@voxmate/orc/navigation/NavGrid";


export class VoxvilleMapTileActivity extends VoxvilleMapBaseActivity {

    constructor(private readonly region: IRegion, private readonly startingTile?: ITile) {
        super();
    }

    private getTile(i: number, j: number) {
        const io = this.region.tiles[0].i;
        const jo = this.region.tiles[0].j;
        return this.vv.getTile(io + i, jo + j);
    }

    descend(i: number, j: number): Activity {
        const tile = this.getTile(i, j);
        return new VoxvilleTileActivity(tile)
    }

    getDing(): Ding {
        return "tileGridIn";
    }

    getLoop(): Loop {
        return this.region.kind;
    }

    async describeMapTile(i: number, j: number) {
        const tile = this.getTile(i, j);
        await this.describeTile(tile)
    }

    jumpTo(): INavGridLocation | undefined {
        if (this.startingTile) {
            const i = this.startingTile.i % 3;
            const j = this.startingTile.j % 3;
            return {i: i, j: j};
        }
    }
}