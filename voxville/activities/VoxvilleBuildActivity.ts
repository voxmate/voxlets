import {VoxvilleUIBaseActivity} from "./VoxvilleUIBaseActivity";
import {BuildingCode, IBuildingConstructionOption, IResourceManifest, ITile} from "../game/types";

import * as _ from "lodash"

interface IBuildingOption {
    tile: ITile
    option: IBuildingConstructionOption
}

export class VoxvilleBuildActivity extends VoxvilleUIBaseActivity<any> {

    constructor() {
        super();
    }

    protected async run() {

        const regionsRoll = this.roll();
        for (let region of this.vv.game.regions) {
            if (!region.locked) {
                regionsRoll.add(region.name, async () => {
                    const buildingOptions: { [buildingCode: number]: IBuildingOption[] } = {};

                    for (let tile of region.tiles) {
                        const options = this.vv.getTileBuildingOptions(tile);
                        for (let option of options) {
                            if (!buildingOptions[option.code]) {
                                buildingOptions[option.code] = [];
                            }
                            buildingOptions[option.code].push({tile: tile, option: option})
                        }
                    }

                    for (let key in buildingOptions) {
                        const collection = buildingOptions[key];
                        buildingOptions[key] = _.sortBy(collection, (item) => -(item.tile.waterCapacity + item.tile.lifeCapacity));
                    }

                    const roll = this.roll();

                    for (let buildingCodeName of Object.keys(BuildingCode)) {
                        const code = BuildingCode[buildingCodeName] as number;
                        if (buildingOptions.hasOwnProperty(code)) {
                            const options = buildingOptions[code];
                            const name = options[0].option.name;

                            roll.add(name, async () => {
                                if (await this.createBuildingOptionsRoll(region, code).run())
                                    regionsRoll.unwind();
                            });
                        }
                    }

                    await roll.run({isDynamic: false});
                });
            }
        }

        await regionsRoll.run();
    }
}