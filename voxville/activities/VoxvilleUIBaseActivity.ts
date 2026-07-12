import {
    BuildingCode,
    createPopulationManifest,
    createResourceManifest,
    IBuildingConstructionOption,
    IBuildingData,
    IPopulationManifest,
    IRegion,
    IResourceManifest,
    ITile,
    IVoxVilleState,
    manifestDelta,
    popManifestDelta,
    resourceManifestAdd,
    TileKind
} from "../game/types";
import {arrayToText, pluralize, singularize, total, unpack, unpackWithoutDetails} from "./utility/utility";
import {VoxvilleGameManager} from "../VoxvilleGameManager";

import {IBackgroundSoundController, RollActivity} from "@voxmate/orc/RollActivity";
import {VoxVille} from "../game/game";
import {Rolodex} from "@voxmate/orc/rolodex";


import * as _ from "lodash";
import {Sound} from "@voxmate/voxmate";

const positions = ["North Eastern", "Northern", "North Western", "Eastern",
    "Central", "Western", "South Eastern", "Southern", "South Western"];


export abstract class ExportCandidateActivity<T> extends RollActivity<T> {

}

function areaIsTile(area: ITile | IRegion): area is ITile {
    return area.hasOwnProperty("i");
}

export type Ding = "constructionComplete" | "ping" | "tileGridIn" | "regionGridIn" | "levelup"
export type Loop = "rain" | TileKind


export abstract class VoxvilleUIBaseActivity<T> extends ExportCandidateActivity<T> {
    protected readonly manager: VoxvilleGameManager;

    get vv(): VoxVille {
        return this.manager.vv;
    }

    get state(): IVoxVilleState {
        return this.manager.vv.game;
    }

    protected tileToGridLocation(tile: ITile): string {
        const ri = tile.i % 3;
        const rj = tile.j % 3;
        return positions[rj * 3 + ri];
    }

    protected tileBasicInfo(tile: ITile): string {
        const prefix = this.tileToGridLocation(tile);
        return `${prefix} ${tile.kind} with ${tile.waterCapacity} water, and ${tile.lifeCapacity} life`;
    }

    protected buidingBasicInfo(buildingData: IBuildingData, includeLocation: boolean = false): string {
        let description = buildingData.name;

        const keys = Object.keys(buildingData.upgrades);

        if (keys.length === 1) {
            const upgrade = _.first(keys);
            description += " with " + upgrade;
        } else if (keys.length > 1) {
            description += " with " + keys.length + " upgrades";
        }

        if (includeLocation) {
            const tile = this.vv.getTile(buildingData.i, buildingData.j);
            const region = this.vv.getTileRegion(tile.i, tile.j);
            description += ` in ${region.name} on ${this.tileBasicInfo(tile)}`;
        }

        return description;
    }

    protected async describeTile(tile: ITile) {

        if (tile.buildingId === null) {
            await this.sayDynamicContent(this.tileBasicInfo(tile));
        } else {
            const buildingData = this.manager.vv.getBuildingData(tile.buildingId);

            let sparseMode = false;
            let lastBuildTicksRemainingSaid = 0;
            while (buildingData.buildTicksRemaining > 0) {
                if (buildingData.buildTicksRemaining != lastBuildTicksRemainingSaid) {

                    if (!sparseMode)
                        await this.sayDynamicContent("Construction site of " + buildingData.name);

                    const turns = lastBuildTicksRemainingSaid = buildingData.buildTicksRemaining;
                    if (turns > 3) {
                        await this.sayDynamicContent(`${turns} ${pluralize("turn", turns)} remaining`);
                    } else {
                        sparseMode = true;
                        await this.getWithTimeout(100);
                    }
                } else {
                    await this.getWithTimeout(500);
                }
            }

            await this.sayDynamicInfo(this.buidingBasicInfo(buildingData));

            if (buildingData.kind === "housing") {
                let previousTotal = -1;
                let previousWorking = -1;

                while (this.isActive) {

                    const occupancyManifest = this.vv.getBuildingOccupancyManifest(buildingData.id);
                    const currentTotal = total(occupancyManifest);

                    if (currentTotal != previousTotal) {
                        previousTotal = currentTotal;

                        if (total(occupancyManifest) === 0) {
                            await this.sayDynamicContent("Empty");
                        } else {
                            await this.sayDynamicContent(unpack(occupancyManifest));
                            const workingManifest = this.vv.getBuildingWorkManifest(buildingData.id);
                            const currentWorking = total(workingManifest);
                            if (previousWorking != currentWorking) {
                                previousWorking = currentWorking;

                                const working = unpack(workingManifest);
                                if (currentWorking === 0)
                                    await this.sayDynamicContent("No villagers are employed");
                                else if (currentWorking === 1) await this.sayDynamicContent(working + " is working");
                                else await this.sayDynamicContent(working + " are working");
                            }
                        }

                        let totalConsumption: Partial<IResourceManifest> = createResourceManifest();
                        for (let villagerId of buildingData.villagerIds) {
                            const villager = this.vv.getVillager(villagerId);
                            totalConsumption = resourceManifestAdd(totalConsumption, villager.consumes);
                        }

                        const missingResources = this.vv.missingResources(totalConsumption);
                        if (total(missingResources) > 0) {
                            await this.sayDynamicContent(`Missing ${unpackWithoutDetails(missingResources)} to improve villager happiness`);
                        }
                    }

                    await this.getWithTimeout(1000);
                }
            }

            if (buildingData.kind === "production") {

                let previousTotal = -1;
                while (this.isActive) {
                    const productionState = this.vv.getBuildingProductionState(buildingData.id);
                    const employs = this.tally(buildingData.villagerIds);
                    const missingWorkers = popManifestDelta(buildingData.workers, employs);
                    const totalEmploys = total(employs);

                    if (totalEmploys != previousTotal) {
                        previousTotal = totalEmploys;

                        if (totalEmploys > 0) {
                            if (productionState.efficiency > 0) {
                                if (totalEmploys > 1) await this.sayDynamicContent(`${unpack(employs)} work here`);
                                else await this.sayDynamicContent(`${unpack(employs)} works here`);
                            } else {
                                if (totalEmploys > 1) await this.sayDynamicContent(`${unpack(employs)} idle here`);
                                else await this.sayDynamicContent(`${unpack(employs)} idles here`);
                            }
                        } else {
                            await this.sayDynamicContent("No villagers are working here");
                        }

                        const delta = this.vv.game.tick - buildingData.constructionCompletedAtTick;
                        if (delta > 5) {

                            if (productionState.efficiency > 0) {

                                const consumes = unpack(productionState.consumption);
                                if (consumes.length > 0) {
                                    await this.sayDynamicContent(`Consumes: ${consumes} per turn`);
                                }

                                const produces = unpack(productionState.production);
                                if (produces.length > 0) {
                                    await this.sayDynamicContent(`Makes: ${produces} per turn`);
                                }
                            }

                            if (productionState.efficiency < 100) {

                                if (total(missingWorkers) > 0) {

                                    if (total(employs) == 0)
                                        await this.sayDynamicContent(`Missing ${unpack(missingWorkers)} to begin production`);
                                    else if (productionState.efficiency > 0)
                                        await this.sayDynamicContent(`Missing ${unpack(missingWorkers)} for improved production`);
                                }

                                const missing = this.vv.missingResources(productionState.consumption);
                                if (total(missing) > 0) {
                                    await this.sayDynamicContent(`Not enough ${unpackWithoutDetails(missing)} to begin production`);
                                }

                                if (productionState.efficiency > 0)
                                    await this.sayDynamicContent("Production Efficiency at " +
                                        (productionState.efficiency * 100).toFixed(0) + "%");

                            } else {
                                await this.sayDynamicContent("Operating at full capacity");
                            }

                        }
                    }
                    await this.getWithTimeout(1000);
                }
            }
        }
    }

    protected async describeRegion(region: IRegion) {

        await this.sayDynamicContent(`${region.name}`);

        if (region.locked) {

            let matchCount = 0;
            for (let tile of region.tiles) {
                if (tile.kind === region.kind)
                    ++matchCount;
            }

            await this.sayDynamicContent(`Locked, we only know that it has ${matchCount} ${singularize(region.kind)} districts`);
        } else {
            const buildings: IBuildingData[] = [];
            for (let tile of region.tiles) {
                if (tile.buildingId) {
                    buildings.push(this.vv.getBuildingData(tile.buildingId));
                }
            }

            let descriptions: string[] = [];
            const groups = _.toPairs(_.groupBy(buildings, b => b.code));
            for (let [, buildings] of groups) {
                const repr = _.first(buildings);
                descriptions.push(buildings.length + " " + pluralize(repr.name, buildings.length));
            }

            await this.sayDynamicContent(arrayToText(descriptions));
        }
    }

    private getProductionFromOption(tile, option: IBuildingConstructionOption): Partial<IResourceManifest> {
        const buildingData = this.vv.makeBuilding(tile, option);
        const building = this.vv.getBuildingFromData(buildingData);
        return building.getProductionManifest(buildingData);
    }

    private getConsumptionFromOption(tile, option: IBuildingConstructionOption): Partial<IResourceManifest> {
        const buildingData = this.vv.makeBuilding(tile, option);
        const building = this.vv.getBuildingFromData(buildingData);
        return building.getConsumptionManifest(buildingData);
    }

    private fillRollWithBuildingOptions(roll: Rolodex, tile: ITile, option: IBuildingConstructionOption, msg: string) {

        roll.add(msg, async () => {
            const broll = this.roll();

            const prod = this.getProductionFromOption(tile, option);
            const consumption = this.getConsumptionFromOption(tile, option);

            broll.add("Building cost: " + unpack(option.buildingCost));

            if (total(prod) > 0) {
                broll.add(`Makes: ${unpack(prod)} per turn`);
            }

            if (total(consumption) > 0) {
                broll.add(`Consumes: ${unpack(consumption)} per turn`);
            }

            if (total(option.housing) > 0) {
                broll.add("Houses: " + unpack(option.housing));
            }

            if (total(option.workforce) > 0) {
                broll.add("Employs: " + unpack(option.workforce));
            }

            if (option.field) {
                const field = option.field;
                if (field.irrigation)
                    broll.add(`${field.life > 0 ? "Adds" : "Drains"} ${Math.abs(field.life)} water ${field.life > 0
                        ? "to" : "from"} ${field.range} adjacent districts in range`);

                if (field.life)
                    broll.add(`${field.life > 0 ? "Adds" : "Drains"} ${Math.abs(field.life)} life ${field.life > 0
                        ? "to" : "from"} ${field.range} adjacent districts in range`);
            }

            const that = this;

            async function beginConstruction() {
                if (that.vv.build(tile, option)) {
                    await that.sayDynamicContent("Starting Building " + option.name);
                    return true;
                } else {
                    const missing = that.vv.missingResources(option.buildingCost);
                    if (total(missing) > 0)
                        await that.sayDynamicContent(`Missing ${unpack(missing)} to begin construction`);
                    else {
                        return beginConstruction();
                    }
                }
            }

            broll.add("Begin Construction", async () => {
                return await beginConstruction();
            });

            if (await broll.run())
                return true;
        });
    }

    protected createBuildingOptionsRoll(area: ITile | IRegion, code: BuildingCode | null = null): Rolodex {

        const tiles: ITile[] = [];

        if (areaIsTile(area)) {
            tiles.push(area);
        } else {
            tiles.push(...area.tiles);
        }

        const oroll = this.roll();

        let hasOptions = false;
        for (let tile of tiles) {

            const options: IBuildingConstructionOption[] = _.sortBy(this.vv.getTileBuildingOptions(tile),
                (option: IBuildingConstructionOption) => option.code);

            const loc = this.tileToGridLocation(tile);

            for (let option of options) {

                if (code !== null && option.code !== code)
                    continue;

                let msg = `Build ${option.name} in ${loc} ${tile.kind} on ${tile.waterCapacity} water and ${tile.lifeCapacity} life`;
                if (code === null) {
                    msg = `Build ${option.name} on ${tile.waterCapacity} water and ${tile.lifeCapacity} life`;
                }

                this.fillRollWithBuildingOptions(oroll, tile, option, msg);
                hasOptions = true;
            }
        }

        if (!hasOptions) {
            this.sound(Sound.Bad);
            console.log("Can't build here...");
        }

        return oroll;
    }

    private tally(villagersIds: string[]): Partial<IPopulationManifest> {
        const manifest = createPopulationManifest();

        for (let villagerId of villagersIds) {
            const villager = this.vv.getVillager(villagerId);
            manifest[villager.kind] += 1;
        }

        for (let key in manifest) {
            if (manifest[key] === 0)
                delete manifest[key];
        }

        return manifest;
    }

    protected createTileBuildingOptionsRoll(tile: ITile): Rolodex {
        const rolodex = this.roll();

        const buildingData = this.vv.getBuildingData(tile.buildingId);

        const building = this.vv.getBuildingFromData(buildingData);
        const baseProduction = building.getProductionManifest(buildingData);
        const baseConsumption = building.getConsumptionManifest(buildingData);
        const baseHousing = buildingData.housing;

        const constructionOptions = this.vv.getTileBuildingOptions(tile);
        for (let option of constructionOptions) {
            this.fillRollWithBuildingOptions(rolodex, tile, option, `Upgrade ${buildingData.name} to ${option.name}`);
        }

        const upgrades = building.getConstructableUpgrades(buildingData);

        for (let upgrade of upgrades) {

            const bdc = JSON.parse(JSON.stringify(buildingData)) as IBuildingData;
            building.applyUpgrade(bdc, upgrade);

            const production = building.getProductionManifest(bdc);
            const consumption = building.getConsumptionManifest(bdc);
            const housing = bdc.housing;

            const extraProduction = manifestDelta(production, baseProduction);
            const extraConsumption = manifestDelta(consumption, baseConsumption);
            const extraHousing = popManifestDelta(housing, baseHousing);

            rolodex.add(`Add ${upgrade.name} upgrade`, async () => {
                const upr = this.roll();

                upr.add("Upgrade cost " + unpack(upgrade.buildingCost));

                if (total(extraProduction) > 0)
                    upr.add("Makes Extra: " + unpack(extraProduction));

                if (total(extraConsumption) > 0)
                    upr.add("Consumes Extra: " + unpack(extraConsumption));

                if (total(extraHousing) > 0)
                    upr.add("Houses Extra: " + unpack(extraHousing));

                if (buildingData.field) {
                    const field = buildingData.field;
                    if (field.irrigation)
                        upr.add(`${field.life > 0 ? "Adds" : "Drains"} ${Math.abs(field.life)} water ${field.life > 0
                            ? "to" : "from"} ${field.range} adjacent districts in range`);

                    if (field.life)
                        upr.add(`${field.life > 0 ? "Adds" : "Drains"} ${Math.abs(field.life)} life ${field.life > 0
                            ? "to" : "from"} ${field.range} adjacent districts in range`);
                }

                let upgradeAlreadyStarted = false;
                upr.add(async () => {
                    if (upgradeAlreadyStarted)
                        rolodex.unwind();
                    return "Begin Upgrading";
                }, async () => {
                    const announcement = "Started upgrading " + buildingData.name + " with " + upgrade.name;
                    if (this.vv.buildUpgrade(tile, upgrade)) {
                        upgradeAlreadyStarted = true;
                        await this.sayDynamicContent(announcement);
                        rolodex.unwind();
                    } else {
                        const missing = this.vv.missingResources(upgrade.buildingCost);
                        if (total(missing) > 0)
                            await this.sayDynamicContent(`Missing: ${unpack(missing)} to begin upgrading`);
                        else {
                            await this.sayDynamicContent(announcement);
                            rolodex.unwind();
                        }
                    }
                });

                await upr.run();
            });
        }

        rolodex.add("Demolish " + buildingData.name, async () => {

            const confirm = this.roll();
            confirm.add("Swipe again to confirm", async () => {
                await this.sayDynamicInfo("Demolished " + buildingData.name);
                this.vv.demolish(tile);
                rolodex.unwind();
            });

            await confirm.run();
        });

        rolodex.add(`${buildingData.name} Details`, async () => {
            const details = this.roll();

            if (total(baseProduction) > 0)
                details.add("Makes: " + unpack(baseProduction) + " per turn");

            if (total(baseConsumption) > 0)
                details.add("Consumes: " + unpack(baseConsumption) + " per turn");

            if (total(baseHousing) > 0) {
                details.add("Houses Total: " + unpack(baseHousing));
                const pop = this.tally(buildingData.villagerIds);
                if (total(pop) > 0)
                    details.add("Currently Living: " + unpack(pop));
                else details.add("Nobody is living here");
            }

            if (total(buildingData.workers) > 0) {
                details.add("Employs Total: " + unpack(buildingData.workers));
                const pop = this.tally(buildingData.villagerIds);
                if (total(pop) > 0)
                    details.add("Currently Working: " + unpack(pop));
                else details.add("Nobody is working here");
            }

            details.add("Built on: " + this.tileBasicInfo(tile));

            await details.run();
        });

        return rolodex;
    }

    protected createRegionOptionsRoll(region: IRegion): Rolodex {

        const upr = this.roll();
        const cost = this.vv.getRegionCost(region);

        upr.add("Region Cost " + unpack(cost));

        upr.add("Unlock Region", async () => {
            const missing = this.vv.buyRegion(region);
            if (missing === null) {
                await this.sayDynamicContent("Unlocked " + region.name);
                upr.unwind();
            } else {
                await this.sayDynamicContent("Can't afford region, missing " + unpack(missing));
            }
        });

        return upr;
    }

    protected playSoundEffect(ding: Ding): Promise<IBackgroundSoundController> {
        return this.playInBackground(`~effects/${ding}.mp3`, {volume: 30, autoDispose: false});
    }

    protected playBuildingEffect(code: BuildingCode) {
        const map = {0: "huts", 2: "cabin", 5: "woodhut"};
        const filename = map[code];
        if (filename) {
            const resource = `~buildings/${filename}.mp3`;
            this.setTimeout(async () => await this.playInBackground(resource, {volume: 10}));
        }
    }


    protected getTrackedResources(): Partial<IResourceManifest> {
        const consuming = this.vv.getConsumptionResources();
        const producing = this.vv.getProductionResources();

        const trackedResources = createResourceManifest(this.vv.game.resources);

        for (let key of Object.keys(trackedResources)) {
            const isConsuming = Math.abs((consuming[key] || 0)) > 0;
            const isProducing = Math.abs((producing[key] || 0)) > 0;
            const haveAlready = Math.abs(trackedResources[key] || 0) > 0;

            if (!(isConsuming || isProducing || haveAlready)) {
                delete trackedResources[key];
            }
        }

        return trackedResources;
    }
}