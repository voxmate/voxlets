import {
    createPopulationManifest,
    createResourceManifest,
    IBuildingConstructionOption,
    IBuildingData,
    IBuildingUpgradeEffect,
    ILookupCache,
    IPopulationManifest, IPosition,
    IRegion,
    IResourceManifest,
    ITile,
    IVillager,
    IVoxVilleState,
    multiplyResourceManifest,
    resourceManifestAdd
} from './types';
import {Building, initBuildings} from './buildings';
import {mintVillager, PopulationSpawnPriorityOrder} from './population';
import {randomId} from "@voxmate/voxmate/utility/random";
import {removeArrayElement} from "@voxmate/voxmate/utility/array";

export interface IBuildingProductionState {
    consumption: IResourceManifest;
    production: IResourceManifest;
    efficiency: number;
    hasWorkers: boolean;
    hasWork: boolean;
    canAfford: boolean;
}

export class VoxVilleBase {

    protected state: IVoxVilleState = null;
    protected buildings: Building [] = [];
    protected buildingTypeLookup: { [buildingCode: number]: Building } = {};
    protected lookup: ILookupCache = null;

    private calculateCurrentLevel(): number {

        let level = 0;
        for (let kind of PopulationSpawnPriorityOrder) {
            if (this.lookup.population[kind] >= 50) {
                ++level;
            }
        }

        if (level > this.state.maxLevelReached) {
            this.state.maxLevelReached = level;
        }

        return Math.max(level, this.state.maxLevelReached);
    }

    calculateResourceCap(resource: keyof IResourceManifest): number {
        let capacity = this.state.baseResourceCapacity[resource];
        for (let building of this.state.buildings) {
            capacity += (building.storage[resource] || 0);

            for (let upgradeId in building.upgrades) {
                const upgrade = building.upgrades[upgradeId] as Partial<IBuildingUpgradeEffect>;
                if (upgrade.storage) {
                    capacity += upgrade.storage[resource] || 0;
                }
            }
        }
        return capacity;
    }

    getRegion(i: number, j: number) {
        const pr = i * 3 + j;
        return this.state.regions[pr];
    }

    getTileRegion(i: number, j: number): IRegion {
        const ri = Math.floor(i / 3) * 3 + Math.floor(j / 3);
        return this.state.regions[ri];
    }

    getTile(i: number, j: number): ITile {
        const region = this.getTileRegion(i, j);
        const regionTileIndex = (i % 3) * 3 + j % 3;
        return region.tiles[regionTileIndex];
    }

    protected getNeighbouringTiles(i: number, j: number, dist: number = 1, includeSelf: boolean = false): ITile[] {
        const neighbours: ITile[] = [];
        for (let idx = i - dist; idx <= i + dist; idx += 1) {
            for (let jdx = j - dist; jdx <= j + dist; jdx += 1) {
                if (idx >= 0 && jdx >= 0 && idx < 9 && jdx < 9) {
                    if (!(idx === i && jdx === j) || includeSelf) {
                        neighbours.push(this.getTile(idx, jdx));
                    }
                }
            }
        }

        return neighbours;
    }

    canAfford(res: Partial<IResourceManifest>): boolean {
        let canAfford = true;
        if (res === null) {
            return canAfford;
        }

        for (let key in res) {
            if (this.state.resources[key] < res[key]) {
                canAfford = false;
                break;
            }
        }
        return canAfford;
    }

    missingResources(res: Partial<IResourceManifest>): Partial<IResourceManifest> {
        const manifest = createResourceManifest(res);
        for (let key in res) {
            const diff = this.state.resources[key] - res[key];
            if (diff > 0) {
                delete manifest[key];
            } else {
                manifest[key] = -diff;
            }
        }
        return manifest;
    }


    protected subtract(res: Partial<IResourceManifest>, toMax = false): boolean {

        let canAfford = this.canAfford(res);

        if (!canAfford && !toMax) {
            return false;
        }

        for (let key in res) {
            this.state.resources[key] = Math.max(0, this.state.resources[key] - res[key]);
        }

        return canAfford;
    }

    protected subtractToMaxProportionally(res: Partial<IResourceManifest>, toMax = false): [boolean, Partial<IResourceManifest>] {
        // This function will subtract from resources, and return proportions subtracted

        let short = false;
        const subtracted: Partial<IResourceManifest> = {};

        for (let key in res) {
            const have = this.state.resources[key];
            const subtract = res[key];
            let portion = 1;
            if (have < subtract) {
                short = true;
                portion = have / subtract;
            }

            subtracted[key] = portion;
            this.state.resources[key] = Math.max(0, have - subtract);
        }

        return [!short, subtracted];
    }

    protected calculateCapacity(manifest: Partial<IPopulationManifest>) {
        let count = 0;
        for (let key in manifest) {
            count += manifest[key];
        }
        return count;
    }

    protected add(res: Partial<IResourceManifest>, adjustCap: boolean = true) {
        for (let key in res) {
            if (adjustCap) {
                const cap = this.calculateResourceCap(key as keyof IResourceManifest);
                this.state.resources[key] = Math.min(cap, this.state.resources[key] + res[key]);
            } else {
                this.state.resources[key] += res[key];
            }
        }
    }

    protected applyCaps() {
        for (let key in this.state.resources) {
            const cap = this.calculateResourceCap(key as keyof IResourceManifest);
            this.state.resources[key] = Math.min(cap, this.state.resources[key]);
        }
    }

    protected generateLookupTables() {

        const population = createPopulationManifest();
        const employment = createPopulationManifest();

        const lookup: ILookupCache = {
            employers: {},
            housing: {},
            buildings: {},
            villagers: {},
            occupancy: {},
            work: {},
            population: population,
            employment: employment,
            level: 0,
        };

        for (let villager of this.state.villagers) {
            lookup.villagers[villager.id] = villager;
            ++population[villager.kind];

            if (villager.workplaceId !== null) {
                ++employment[villager.kind];
            }
        }

        for (let building of this.state.buildings) {
            lookup.buildings[building.id] = building;

            if (building.kind === 'housing') {
                for (let villagerId of building.villagerIds) {
                    lookup.housing[villagerId] = building;
                    const villager = lookup.villagers[villagerId];
                    if (!lookup.work[building.id]) {
                        lookup.work[building.id] = createPopulationManifest();
                    }

                    lookup.work[building.id][villager.kind] += villager.workplaceId !== null ? 1 : 0;
                }
            }

            if (building.kind === 'production') {
                for (let id of building.villagerIds) {
                    lookup.employers[id] = building;
                }
            }

            const occupancy = createPopulationManifest();

            for (let villagerId of building.villagerIds) {
                const villager = lookup.villagers[villagerId];
                occupancy[villager.kind] += 1;
            }

            lookup.occupancy[building.id] = occupancy;
        }

        for (let villager of this.state.villagers) {
            lookup.villagers[villager.id] = villager;
        }

        this.lookup = lookup;
        lookup.level = this.calculateCurrentLevel();
    }

    protected distributeLifeAndWaterCapacities() {

        for (let region of this.state.regions) {
            for (let tile of region.tiles) {
                tile.waterCapacity = 0;
                tile.lifeCapacity = 0;
            }
        }

        for (let region of this.state.regions) {

            for (let tile of region.tiles) {

                if (tile.kind === 'waters') {
                    tile.waterCapacity = 10;
                    const neighbours = this.getNeighbouringTiles(tile.i, tile.j);
                    for (let neighbor of neighbours) {
                        if (neighbor.kind != 'waters') {
                            neighbor.waterCapacity += 2;
                        }
                    }
                }

                if (tile.kind === 'forests' || tile.kind === 'grasslands') {

                    let amount = 10;
                    if (tile.kind === 'grasslands') {
                        amount = 3;
                    }

                    tile.lifeCapacity = amount;
                    const neighbours = this.getNeighbouringTiles(tile.i, tile.j);
                    for (let neighbor of neighbours) {
                        if (neighbor.kind != tile.kind) {
                            if (neighbor.kind != 'forests' && neighbor.kind != 'grasslands') {
                                neighbor.lifeCapacity += Math.floor(amount / 3);
                            }
                        }
                    }
                }
            }
        }

        for (let region of this.state.regions) {
            for (let tile of region.tiles) {
                if (tile.buildingId != null) {
                    const buildingData = this.getBuildingData(tile.buildingId);

                    if (buildingData.buildTicksRemaining > 0) {
                        continue;
                    }

                    let water = 0;
                    let life = 0;
                    let range = 0;

                    if (buildingData.field) {
                        water += buildingData.field.irrigation;
                        life += buildingData.field.life;
                        range += buildingData.field.range;
                    }

                    for (let upgradeId in buildingData.upgrades) {
                        const upgrade: Partial<IBuildingUpgradeEffect> = buildingData.upgrades[upgradeId];
                        water += upgrade.irrigation || 0;
                        range += upgrade.range || 0;
                        life += upgrade.life || 0;
                    }

                    const neighbours = this.getNeighbouringTiles(tile.i, tile.j, range, true);
                    for (let neighbour of neighbours) {
                        neighbour.waterCapacity = Math.min(water + neighbour.waterCapacity, 10);
                        neighbour.lifeCapacity = Math.min(life + neighbour.lifeCapacity, 10);
                    }
                }
            }
        }

        for (let region of this.state.regions) {
            for (let tile of region.tiles) {
                tile.waterCapacity = Math.min(10, tile.waterCapacity);
                tile.lifeCapacity = Math.min(10, tile.lifeCapacity);
            }
        }
    }

    protected spawn(building: IBuildingData, unhappiness: Partial<IPopulationManifest>) {
        const occupancy = this.getBuildingOccupancyManifest(building.id);
        for (let kind of PopulationSpawnPriorityOrder) {

            const capacity = building.housing[kind] || 0;

            let kindHappiness = unhappiness[kind];
            if (kindHappiness === void (0)) {
                kindHappiness = -1;
            }

            const notUpgrading = building.buildTicksRemaining === 0;
            const kindHappy = kindHappiness === -1 || kindHappiness >= 30;

            if (notUpgrading && kindHappy && occupancy[kind] < capacity) {
                const life = this.getTileUnder(building).lifeCapacity;
                const passedLifeRequirementCheck = Math.random() < life / 10;

                if (passedLifeRequirementCheck) {
                    const villager = mintVillager(kind, building.id);
                    this.state.villagers.push(villager);
                    building.villagerIds.push(villager.id);
                    return true;
                } else {
                    return false;
                }
            }
        }
        return false;
    }

    protected grantFreeResources() {
        for (let resource in this.state.resources) {
            const current = this.state.resources[resource];
            const baseTick = this.state.baseRate[resource];
            const freeLimit = this.state.baseResourceCapacity[resource];
            if (current < freeLimit) {
                this.state.resources[resource] = Math.min(current + baseTick, freeLimit);
            }
        }
    }

    protected assignWorkplace(villager: IVillager, building: IBuildingData) {
        building.villagerIds.push(villager.id);
        villager.workplaceId = building.id;
        this.generateLookupTables();
    }

    protected relocateVillagersTo(villagerIds: string[], buildingData: IBuildingData): IVillager[] {

        const disturbed: IVillager[] = [];

        const housing = buildingData.kind === 'housing';

        const man = createPopulationManifest();
        const cap = createPopulationManifest(housing ? buildingData.housing : buildingData.workers);

        for (let villagerId of villagerIds) {
            const villager = this.getVillager(villagerId);
            const relocate = man[villager.kind] < cap[villager.kind];
            if (relocate) {
                if (housing) {
                    villager.houseId = buildingData.id;
                } else {
                    villager.workplaceId = buildingData.id;
                }
                buildingData.villagerIds.push(villagerId);
                man[villager.kind]++;
            } else {
                disturbed.push(villager);
            }
        }

        return disturbed;
    }

    constructor() {
        this.buildings = initBuildings(this);
        for (let building of this.buildings) {
            this.buildingTypeLookup[building.code] = building;
        }
    }

    makeBuilding(tile: ITile, option: IBuildingConstructionOption): IBuildingData {
        return {
            id: `${randomId()}-${option.name}`,
            kind: option.kind,
            code: option.code,
            i: tile.i,
            j: tile.j,
            buildTicksRemaining: option.buildTime,
            name: option.name,
            workers: option.workforce,
            housing: option.housing,
            buildingCost: option.buildingCost,
            storage: option.storage,
            villagerIds: [],
            upgrades: {},
            field: option.field,
            constructionCompletedAtTick: -1
        };
    }

    getTileUnder(occupant: IPosition) {
        return this.getTile(occupant.i, occupant.j);
    }

    getVillager(villagerId: string): IVillager {
        return this.lookup.villagers[villagerId];
    }

    getBuildingData(buildingId: string): IBuildingData {
        return this.lookup.buildings[buildingId];
    }

    getBuildingOccupancyManifest(buildingId: string): IPopulationManifest {
        return this.lookup.occupancy[buildingId];
    }

    getBuildingWorkManifest(buildingId: string): IPopulationManifest {
        return this.lookup.work[buildingId];
    }

    getBuildingHappinessManifest(buildingId: string, luxury: boolean = false): Partial<IPopulationManifest> {
        const building = this.getBuildingData(buildingId);

        const counts = createPopulationManifest();

        for (let villagerId of building.villagerIds) {
            const villager = this.getVillager(villagerId);
            if (luxury) {
                counts[villager.kind] += villager.luxuryHappiness;
            } else {
                counts[villager.kind] += villager.happiness;
            }
        }

        const occupancy = this.getBuildingOccupancyManifest(buildingId);
        for (let kind of Object.keys(occupancy)) {
            counts[kind] = Math.floor(counts[kind] / Math.max(1, occupancy[kind]));
        }

        return counts;
    }

    getBuildingProductionState(buildingId: string): IBuildingProductionState {

        const buildingData = this.getBuildingData(buildingId);
        const building = this.getBuildingFromData(buildingData);
        const occupancy = buildingData.villagerIds.length;
        const totalWorkerCapacity = this.calculateCapacity(buildingData.workers);

        let efficacy = 1;
        if (totalWorkerCapacity > 0) {
            efficacy = occupancy / totalWorkerCapacity;
        }

        const consumption = building.getConsumptionManifest(buildingData);
        const production = building.getProductionManifest(buildingData);

        const effectiveConsumption = multiplyResourceManifest(efficacy, consumption);
        const effectiveProduction = multiplyResourceManifest(efficacy, production);
        const canAfford = this.canAfford(effectiveConsumption);
        const hasWorkers = buildingData.villagerIds.length > 0;

        return {
            consumption: effectiveConsumption,
            production: canAfford ? effectiveProduction : createResourceManifest(),
            efficiency: canAfford ? efficacy : 0,
            canAfford: canAfford,
            hasWorkers: hasWorkers,
            hasWork: occupancy < totalWorkerCapacity
        };
    }

    getVillagerUnhappinessManifest(): Partial<IPopulationManifest> {

        const population = createPopulationManifest(this.lookup.population);
        const manifest = createPopulationManifest();

        for (let kind of PopulationSpawnPriorityOrder) {
            if (population[kind] === 0) {
                delete manifest[kind];
            } else {
                manifest[kind] = Infinity;
            }
        }


        for (let v of this.state.villagers) {
            manifest[v.kind] = Math.min(v.happiness, manifest[v.kind]);
        }

        return manifest;
    }

    getVillagerAverageHappinessManifest(): Partial<IPopulationManifest> {

        const population = createPopulationManifest(this.lookup.population);
        const manifest = createPopulationManifest();

        for (let kind of PopulationSpawnPriorityOrder) {
            if (population[kind] === 0) {
                delete manifest[kind];
            } else {
                manifest[kind] = 0;
            }
        }

        for (let v of this.state.villagers) {
            manifest[v.kind] += v.happiness;
        }

        for (let kind of PopulationSpawnPriorityOrder) {
            if (manifest[kind]) {
                manifest[kind] /= population[kind];
            }
        }

        return manifest;
    }

    evict(villager: IVillager, fixHousing: boolean = true) {

        removeArrayElement(this.state.villagers, villager);

        if (fixHousing) {
            const buildingData = this.getBuildingData(villager.houseId);
            removeArrayElement(buildingData.villagerIds, villager.id);
        }

        if (villager.workplaceId != null) {
            const work = this.getBuildingData(villager.workplaceId);
            removeArrayElement(work.villagerIds, villager.id);
        }

        if (fixHousing) {
            this.generateLookupTables();
        }
    }

    getBuildingFromData(building: IBuildingData): Building {
        return this.buildingTypeLookup[building.code];
    }

    getVillagerConsumption(filter?: keyof IPopulationManifest): Partial<IResourceManifest> {
        let total: Partial<IResourceManifest> = createResourceManifest();
        for (let villager of this.state.villagers) {
            if (!filter || filter === villager.kind) {
                total = resourceManifestAdd(total, villager.consumes);
                total = resourceManifestAdd(total, villager.consumesLuxury);
            }
        }
        return total;
    }

    getConsumptionResources(): Partial<IResourceManifest> {
        let total: Partial<IResourceManifest> = createResourceManifest();

        for (let buildingData of this.state.buildings) {
            const building = this.getBuildingFromData(buildingData);
            const manifest = building.getConsumptionManifest(buildingData);
            total = resourceManifestAdd(total, manifest);
        }

        const villagerConsumption = this.getVillagerConsumption();
        total = resourceManifestAdd(total, villagerConsumption);

        return total;
    }

    getProductionResources(): Partial<IResourceManifest> {
        let total: Partial<IResourceManifest> = createResourceManifest();

        for (let buildingData of this.state.buildings) {
            const building = this.getBuildingFromData(buildingData);
            const manifest = building.getProductionManifest(buildingData);
            total = resourceManifestAdd(total, manifest);
        }

        return total;
    }

    get populationManifest(): IPopulationManifest {
        return this.lookup.population;
    }

    get employmentManifest(): IPopulationManifest {
        return this.lookup.employment;
    }

    get level(): number {
        return this.lookup.level;
    }
}
