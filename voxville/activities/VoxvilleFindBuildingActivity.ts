import {VoxvilleUIBaseActivity} from "./VoxvilleUIBaseActivity";
import {
    BuildingCode,
    createResourceManifest,
    IBuildingData,
    IResourceManifest,
    ITile,
    resourceManifestAdd
} from "../game/types";
import {formatAmount, pluralize} from "./utility/utility";
import {Rolodex} from "@voxmate/orc/rolodex";
import * as _ from "lodash"

const BuildingCodeKeys = Object.keys(BuildingCode).filter(k => typeof BuildingCode[k as any] === "number");
const BuildingCodes = BuildingCodeKeys.map(k => BuildingCode[k as any]);

export class VoxvilleFindBuildingActivity extends VoxvilleUIBaseActivity<ITile> {
    constructor() {
        super();
    }

    private createBuildingBrowserRoll(buildings: IBuildingData[]): Rolodex {
        const picker = this.roll();
        for (const bulding of buildings) {
            picker.add(this.buidingBasicInfo(bulding, true), async () => {
                return this.vv.getTile(bulding.i, bulding.j)
            });
        }
        return picker;
    }

    private createBuildingBrowserRollGrouping(buildings: IBuildingData[]): Rolodex {
        const groups = _.groupBy(buildings, ((b: IBuildingData) => b.code));
        const roll = this.roll();
        for (let code of BuildingCodes) {
            if (groups.hasOwnProperty(code)) {
                const buildings: IBuildingData[] = groups[code];
                const building: IBuildingData = _.first(buildings);

                roll.add(`${buildings.length} ${pluralize(building.name, buildings.length)}`, async () => {
                    const picker = this.createBuildingBrowserRoll(buildings);
                    return await picker.run();
                })
            }
        }
        return roll;
    }

    protected async run() {
        const options = this.roll();
        const trackedResources = this.getTrackedResources();

        options.add("Find Housing", async () => {
            const buildings = _.filter(this.vv.game.buildings, (b: IBuildingData) => b.kind === "housing");
            if (buildings.length > 0)
                return await this.createBuildingBrowserRollGrouping(buildings).run();
            else await this.sayDynamicContent("You have no housing.");
        });

        options.add("Find Production", async () => {
            const buildings = _.filter(this.vv.game.buildings, (b: IBuildingData) => b.kind === "production");
            if (buildings.length > 0)
                return await this.createBuildingBrowserRollGrouping(buildings).run();
            else await this.sayDynamicContent("You have no production buildings");
        });

        options.add("Find by Consumption", async () => {
            const resourceRoll = this.roll();
            const consumption = this.vv.getConsumptionResources();
            const villagerConsumption = this.vv.getVillagerConsumption();

            for (let resource in trackedResources) {
                const total = consumption[resource] || 0;
                const totalFormatted = formatAmount(total);
                const canAffordTotal = this.vv.canAfford({[resource]: total});
                const consumingTotal = canAffordTotal ? "Consuming" : "Demanding";

                resourceRoll.add(`${consumingTotal} ${totalFormatted} ${resource} per turn`, async () => {

                    interface BuildingConsumptionRecord {
                        data: IBuildingData;
                        consumption: number
                    }

                    const aggr: BuildingConsumptionRecord[] = [];
                    for (const buildingData of this.vv.game.buildings) {
                        const building = this.vv.getBuildingFromData(buildingData);
                        const bcm = building.getConsumptionManifest(buildingData);
                        const bcr = bcm[resource] || 0;
                        if (bcr > 0) {
                            aggr.push({data: buildingData, consumption: bcr});
                        }
                    }

                    const groups = _.groupBy(aggr, (b: BuildingConsumptionRecord) => b.data.code);

                    interface CodePair {
                        code: string;
                        weight: number;
                    }

                    const order: CodePair[] = [];
                    for (const code in groups) {
                        const weight = _.sum(_.map(groups[code], (b: BuildingConsumptionRecord) => b.consumption));
                        order.push({code: code, weight: weight});
                    }

                    const codes = _.map(_.sortBy(order, (cp) => -cp.weight), (cp) => cp.code);

                    const groupRoll = this.roll();
                    for (let code of codes) {
                        if (groups.hasOwnProperty(code)) {
                            const group: BuildingConsumptionRecord[] = groups[code];
                            const rerpBuilding: BuildingConsumptionRecord = _.first(group);
                            const name = group.length + " " + pluralize(rerpBuilding.data.name, group.length);

                            const consumptions = _.map(group, (b: BuildingConsumptionRecord) => {
                                return b.consumption;
                            });

                            const totalConsumption = formatAmount(_.sum(consumptions) || 0);
                            const canAfford = this.vv.canAfford({[resource]: totalConsumption});

                            const consume = (canAfford ? "consume" : "demand") + (group.length > 1 ? "" : "s");
                            const prompt = `${name} ${consume} ${totalConsumption} ${resource} per turn`;

                            groupRoll.add(prompt, async () => {
                                const buildings: IBuildingData[] = _.map(group, (b: BuildingConsumptionRecord) => b.data);
                                return await this.createBuildingBrowserRoll(buildings).run();
                            });
                        }
                    }

                    const vcr = villagerConsumption[resource] || 0;
                    if (vcr > 0) {
                        const consume = (this.vv.canAfford({[resource]: vcr}) ? "consume" : "demand");
                        groupRoll.add(`Villagers ${consume} ${formatAmount(vcr)} ${resource} per turn`);
                    }

                    return await groupRoll.run();
                });
            }

            return await resourceRoll.run();
        });

        options.add("Find by Production", async () => {
            const resourceRoll = this.roll();
            const buildings = this.vv.game.buildings;

            let production: Partial<IResourceManifest> = createResourceManifest();
            for (let building of buildings) {
                const state = this.vv.getBuildingProductionState(building.id);
                production = resourceManifestAdd(state.production, production);
            }

            for (let resource in trackedResources) {
                const total = production[resource];
                if (!total)
                    continue;

                const totalFormatted = formatAmount(production[resource]);

                const canAffordTotal = this.vv.canAfford({[resource]: total});
                const producingTotal = canAffordTotal ? "Producing" : "Demanding";

                resourceRoll.add(`${producingTotal} ${totalFormatted} ${resource} per turn`, async () => {

                    interface BuildingProductionRecord {
                        data: IBuildingData;
                        production: number
                    }

                    const aggr: BuildingProductionRecord[] = [];
                    for (const buildingData of this.vv.game.buildings) {
                        const state = this.vv.getBuildingProductionState(buildingData.id);
                        const bpr = state.production[resource] || 0;
                        if (bpr > 0) {
                            aggr.push({data: buildingData, production: bpr});
                        }
                    }

                    const groups = _.groupBy(aggr, (b: BuildingProductionRecord) => b.data.code);

                    interface CodePair {
                        code: string;
                        weight: number;
                    }

                    const order: CodePair[] = [];
                    for (const code in groups) {
                        const weight = _.sum(_.map(groups[code], (b: BuildingProductionRecord) => b.production));
                        order.push({code: code, weight: weight});
                    }

                    const codes = _.map(_.sortBy(order, (cp) => -cp.weight), (cp) => cp.code);

                    const groupRoll = this.roll();
                    for (let code of codes) {
                        if (groups.hasOwnProperty(code)) {
                            const group: BuildingProductionRecord[] = groups[code];
                            const rerpBuilding: BuildingProductionRecord = _.first(group);
                            const name = group.length + " " + pluralize(rerpBuilding.data.name, group.length);

                            const productions = _.map(group, (b: BuildingProductionRecord) => {
                                return b.production;
                            });

                            const totalProduction = formatAmount(_.sum(productions));
                            const produces = "produce" + (group.length > 1 ? "" : "s");
                            const prompt = `${name} ${produces} ${totalProduction} ${resource} per turn`;

                            groupRoll.add(prompt, async () => {
                                const buildings: IBuildingData[] = _.map(group, (b: BuildingProductionRecord) => b.data);
                                return await this.createBuildingBrowserRoll(buildings).run();
                            });
                        }
                    }

                    return await groupRoll.run();

                });
            }

            const tax = this.vv.lastTaxCollected;
            if (tax > 0) {
                resourceRoll.add(`Villagers pay ${formatAmount(tax)} gold in tax per turn`);
            }

            if (resourceRoll.size == 0) {
                await this.sayDynamicContent("You have no production buildings");
            }

            return await resourceRoll.run();
        });

        return await options.run()
    }

}