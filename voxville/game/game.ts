import {
	BuildingCode,
	createResourceManifest,
	IBuildingConstructionOption,
	IBuildingData,
	IBuildingUpgradeOption,
	IRegion,
	IResourceManifest,
	ITile,
	IVoxVilleState,
	manifestDelta,
	multiplyResourceManifest,

} from './types';
import {PopulationTaxRevenue} from './population';
import {initGameState} from './map';
import {VoxVilleBase} from './voxVilleBase';
import {shuffleArray} from "@voxmate/voxmate/utility/random";
import {removeArrayElement} from "@voxmate/voxmate/utility/array";

export enum NotificationKind {
	ConstructionComplete,
	ResourceRunningLow,
	ResourceDepleted,
	LevelUP
}

export interface INotification {
	kind: NotificationKind;
	source: string;
}

export class VoxVille extends VoxVilleBase {

	tickResourceDelta: Partial<IResourceManifest> = null;
	lastTaxCollected: number;

	save(): string {
		return JSON.stringify(this.state);
	}

	load(savegame: string) {
		this.state = JSON.parse(savegame);

		this.generateLookupTables();
		this.distributeLifeAndWaterCapacities();
		this.generateLookupTables();
	}

	private updateTileLocations() {
		for (let i = 0; i < 9; ++i) {
			for (let j = 0; j < 9; ++j) {
				const tile = this.getTile(i, j);
				tile.i = i;
				tile.j = j;
			}
		}
	}

	constructor() {
		super();
		this.state = initGameState();

		this.updateTileLocations();
		this.distributeLifeAndWaterCapacities();
		this.generateLookupTables();
	}

	private calculateResourcesRunningLow(): (keyof IResourceManifest)[] {
		const resources: (keyof IResourceManifest)[] = [];
		for (let resource in this.state.resources) {
			const amount = this.state.resources[resource];
			const delta = this.tickResourceDelta[resource] || 0;
			if (Math.abs(delta) > 0) {
				const future = amount + 30 * delta;
				if (future < 0) {
					resources.push(resource as keyof IResourceManifest);
				}
			}
		}
		return resources;
	}

	tick(): INotification[] {

		++this.state.tick;
		const startingLevel = this.level;
		const notifications: INotification[] = [];

		let heroPoints = 0;

		const startingResources = createResourceManifest(this.state.resources);

		let madeChanges = false;

		const workQueue: IBuildingData[] = [];

		if (this.state.buildings.length === 0) {
			this.grantFreeResources();
		}

		for (let buildingData of this.state.buildings) {
			const building = this.getBuildingFromData(buildingData);

			if (buildingData.buildTicksRemaining > 0) {
				--buildingData.buildTicksRemaining;
				if (buildingData.buildTicksRemaining === 0) {
					buildingData.constructionCompletedAtTick = this.state.tick;
					madeChanges = true;
					notifications.push({
						kind: NotificationKind.ConstructionComplete,
						source: buildingData.id
					});
				}
			} else {

				const consumption = building.getConsumptionManifest(buildingData);

				if (buildingData.kind === 'housing') {
					this.subtract(consumption, true);
				}

				if (buildingData.kind === 'production') {
					const productionState = this.getBuildingProductionState(buildingData.id);
					if (this.subtract(productionState.consumption, false)) {
						this.add(productionState.production, false);
					}

					if (productionState.hasWork) {
						workQueue.push(buildingData);
					}

					if (buildingData.code === BuildingCode.Tavern) {
						heroPoints += 1;
					}
				}
			}
		}

		shuffleArray(workQueue);

		let tax = 0;
		for (let villager of this.state.villagers) {

			// Consume normal requirements
			const [villagerRequirementMet, requirementPortion] = this.subtractToMaxProportionally(villager.consumes);

			let baseHappiness = 0;
			let count = Object.keys(requirementPortion).length;

			for (let key in requirementPortion) {
				baseHappiness += 50 / count * requirementPortion[key];
			}

			baseHappiness = Math.floor(baseHappiness);

			const building = this.getBuildingData(villager.houseId);
			const tile = this.getTileUnder(building);
			baseHappiness *= (1 + 0.1 * tile.waterCapacity);

			villager.debug['base'] = baseHappiness;

			if (villager.happiness > baseHappiness) {
				villager.happiness = Math.max(baseHappiness, 0.9 * villager.happiness);
			} else {
				villager.happiness = Math.min(baseHappiness, 1.1 * villager.happiness);
			}

			const haveLuxury = this.subtract(villager.consumesLuxury, true);

			// Consume luxury requirements
			if (villager.workplaceId !== null && haveLuxury) {
				villager.luxuryHappiness = Math.min(30, (1.05) * villager.luxuryHappiness + 1);
			} else {
				villager.luxuryHappiness = Math.max(0, (0.05) * villager.luxuryHappiness - 1);
			}

			// Assign work or collect tax
			if (villager.workplaceId === null) {
				for (let building of workQueue) {
					const occupancy = this.getBuildingOccupancyManifest(building.id)[villager.kind];
					const capacity = building.workers[villager.kind];
					if (occupancy < capacity) {
						madeChanges = true;
						this.assignWorkplace(villager, building);
						removeArrayElement(workQueue, building);
						break;
					}
				}
			} else {
				tax += (villager.happiness + villager.luxuryHappiness) * PopulationTaxRevenue[villager.kind];
			}

			if (villager.workplaceId === null) {
				if (villager.happiness > baseHappiness) {
					villager.happiness = villager.happiness * 0.95;
					if (villager.happiness < 1) {
						villager.happiness = 0;
					}
				}
			} else {
				const maxHappiness = Math.min(100, baseHappiness + 40);
				villager.happiness = Math.min(maxHappiness, 1.1 * villager.happiness + 1);
				if (villager.happiness > 99) {
					villager.happiness = 100;
				}
			}
		}

		this.add({gold: tax}, false);
		this.lastTaxCollected = tax;

		const globalUnhappiness = this.getVillagerUnhappinessManifest();

		for (let building of this.state.buildings) {
			if (building.kind === 'housing') {
				if (this.spawn(building, globalUnhappiness)) {
					madeChanges = true;
					break;
				}
			}
		}

		// Evict unhappy villagers
		for (let villager of this.state.villagers) {
			if (villager.happiness < 1) {
				this.evict(villager);
				madeChanges = true;
			}
		}

		if (madeChanges) {
			this.generateLookupTables();
			this.distributeLifeAndWaterCapacities();
		}

		this.tickResourceDelta = manifestDelta(this.state.resources, startingResources);

		this.applyCaps();

		const lowResources = this.calculateResourcesRunningLow();
		for (let resource of lowResources) {
			notifications.push({
				source: resource,
				kind: this.state.resources[resource] > 5 ?
					NotificationKind.ResourceRunningLow :
					NotificationKind.ResourceDepleted
			});
		}

		if (this.level > startingLevel) {
			notifications.push({
				kind: NotificationKind.LevelUP,
				source: 'word'
			});
		}

		if (heroPoints > 0) {
			const relativeHeroism = heroPoints / this.state.villagers.length;
			//With some chance spawn hero to tavern
		}

		return notifications;
	}

	private get regionCount(): number {
		let count = 0;
		for (let region of this.state.regions) {
			if (!region.locked) {
				++count;
			}
		}
		return count;
	}

	getTileBuildingOptions(tile: ITile): IBuildingConstructionOption[] {

		const options: IBuildingConstructionOption[] = [];

		for (let building of this.buildings) {
			if (building.meetsRequirements(tile)) {
				const option = building.getConstructionOption(tile);

				const existingBuilding = tile.buildingId && this.getBuildingData(tile.buildingId).code;
				if (this.level >= option.level && option.code !== existingBuilding) {
					options.push(option);
				}
			}
		}

		return options;
	}

	getRegionCost(region: IRegion): Partial<IResourceManifest> {
		if (region.kind === 'mountains' || region.kind === 'waters') {
			return {gold: 1700};
		}

		const count = this.regionCount;

		if (count === 0) {
			return {};
		}

		if (count === 1) {
			return {gold: 1100};
		}

		if (count === 2) {
			return {gold: 1300};
		}

		return {gold: 1000 + (count + 1) * 100};
	}

	isFoundingRegion(region: IRegion) {
		return region.kind === 'plains' || region.kind === 'forests' || region.kind === 'grasslands';
	}

	// State Mutagens

	buyRegion(region: IRegion): Partial<IResourceManifest> | null {
		const cost = this.getRegionCost(region);
		if (this.subtract(cost)) {
			region.locked = false;

			if (this.regionCount === 1) {
				removeArrayElement(this.state.regions, region);
				this.state.regions.splice(4, 0, region);
				this.updateTileLocations();
			}
			return null;
		}

		return this.missingResources(cost);
	}

	build(tile: ITile, option: IBuildingConstructionOption): boolean {
		const buildingData = this.makeBuilding(tile, option);

		if (this.subtract(option.buildingCost)) {

			if (tile.buildingId != null) {
				// This is an upgrade
				const oldBuildingData = this.getBuildingData(tile.buildingId);
				const idx = this.state.buildings.indexOf(oldBuildingData);
				this.state.buildings.splice(idx, 1);

				const villagerIds = oldBuildingData.villagerIds;
				const disturbedVillagers = this.relocateVillagersTo(villagerIds, buildingData);

				if (oldBuildingData.kind === 'housing') {
					for (let villager of disturbedVillagers) {
						this.evict(villager, false);
					}
				}

				for (let villager of disturbedVillagers) {
					villager.workplaceId = null;
				}
			}

			this.state.buildings.push(buildingData);
			tile.buildingId = buildingData.id;

			this.generateLookupTables();
			this.distributeLifeAndWaterCapacities();
			return true;
		}

		return false;
	}

	buildUpgrade(currentTile: ITile, upgrade: IBuildingUpgradeOption): boolean {
		const buildingData = this.getBuildingData(currentTile.buildingId);
		const building = this.getBuildingFromData(buildingData);

		if (this.subtract(upgrade.buildingCost)) {
			building.applyUpgrade(buildingData, upgrade);
			this.generateLookupTables();
			this.distributeLifeAndWaterCapacities();
			return true;
		}
		return false;
	}

	demolish(tile: ITile) {

		if (tile.buildingId === null) {
			return;
		}

		const building = this.getBuildingData(tile.buildingId);

		tile.buildingId = null;
		const refund = multiplyResourceManifest(0.6, building.buildingCost);
		this.add(refund);

		for (let villagerId of building.villagerIds) {
			const villager = this.getVillager(villagerId);
			if (building.kind === 'housing') {
				this.evict(villager, false);
			} else {
				villager.workplaceId = null;
			}
		}

		const idx = this.state.buildings.indexOf(building);
		this.state.buildings.splice(idx, 1);

		this.generateLookupTables();
		this.distributeLifeAndWaterCapacities();
	}

	// Getters

	get game(): IVoxVilleState {
		return this.state;
	}
}
