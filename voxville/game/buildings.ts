import {
	BuildingCode,
	createPopulationManifest,
	createResourceManifest,
	IBuildingConstructionOption,
	IBuildingData,
	IBuildingUpgradeEffect,
	IBuildingUpgradeOption,
	IResourceManifest,
	ITile, multiplyResourceManifest, populationManifestAdd,
	resourceManifestAdd, TileKind
} from './types';
import {VoxVilleBase} from './voxVilleBase';

export abstract class Building {

	private _basicUpgrades: IBuildingUpgradeOption[] = [];

	protected constructor(readonly code: BuildingCode, protected readonly vv: VoxVilleBase) {

	}

	abstract meetsRequirements(tile: ITile): boolean;

	abstract getConstructionOption(tile: ITile): IBuildingConstructionOption;

	protected abstract getConsumptionManifestInternal(data: IBuildingData): Partial<IResourceManifest> | null

	protected abstract getProductionManifestInternal(building: IBuildingData): Partial<IResourceManifest> | null

	getProductionManifest(building: IBuildingData) {
		let extra: Partial<IResourceManifest> = {};
		for (let key in building.upgrades) {
			const upgrade: Partial<IBuildingUpgradeEffect> = building.upgrades[key];
			extra = resourceManifestAdd(extra, upgrade.production);
		}
		const base = this.getProductionManifestInternal(building);
		return resourceManifestAdd(base, extra);
	}

	getConsumptionManifest(buildingData: IBuildingData) {
		let extra: Partial<IResourceManifest> = {};
		for (let key in buildingData.upgrades) {
			const upgrade: Partial<IBuildingUpgradeEffect> = buildingData.upgrades[key];
			extra = resourceManifestAdd(extra, upgrade.consumption);
		}
		const base = this.getConsumptionManifestInternal(buildingData);
		return resourceManifestAdd(base, extra);
	}

	getConstructableUpgrades(data: IBuildingData): IBuildingUpgradeOption[] {
		const upgrades: IBuildingUpgradeOption[] = [];
		for (let upgrade of this._basicUpgrades) {
			if (upgrade.level <= this.vv.level && !this.hasUpgrade(data, upgrade.name)) {
				upgrades.push(upgrade);
			}
		}
		return upgrades;
	}

	applyUpgrade(data: IBuildingData, upgrade: IBuildingUpgradeOption) {
		data.upgrades[upgrade.name] = upgrade.settings;
		data.buildTicksRemaining += upgrade.buildTime;
		data.housing = populationManifestAdd(data.housing, upgrade.settings.housing);
	}

	protected hasUpgrade(data: IBuildingData, name: string) {
		return data.upgrades.hasOwnProperty(name);
	}

	protected hasBuilding(tile: ITile, code: BuildingCode): boolean {

		if (!tile.buildingId) {
			return false;
		}

		const buildingData = this.vv.getBuildingData(tile.buildingId);
		return buildingData.code === code;
	}

	protected matches(tile: ITile, ...kinds: TileKind[]) {
		for (let kind of kinds) {
			if (tile.kind === kind) {
				return true;
			}
		}
		return false;
	}

	protected isClear(tile: ITile): boolean {
		return tile.buildingId === null;
	}

	protected registerBasicUpgrade(upgrade: IBuildingUpgradeOption) {
		this._basicUpgrades.push(upgrade);
	}
}

class HolyPlace extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.HolyPlace, vv);
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 2};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {

		let name = 'Holy Place';
		let multiplier = 1;

		if (tile.kind === 'grasslands') {
			name = 'Sanctuary';
		}

		if (tile.kind === 'mountains') {
			name = 'Deathly Stonehenge';
			multiplier = -1;
		}

		return {
			code: this.code,
			name: name,
			kind: 'production',
			level: 0,
			buildingCost: {gold: 300, wood: 10},
			workforce: {peasants: 5},
			housing: {},
			storage: {},
			buildTime: 5,
			field: {
				irrigation: 0,
				life: 2 * multiplier,
				range: 1,
			}
		};
	}

	meetsRequirements(tile: ITile): boolean {
		return this.isClear(tile) && this.matches(tile, 'plains', 'grasslands', 'mountains');
	}
}

class StoragePile extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.StoragePile, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Hidden Spot',
			buildingCost: {gold: 200, wood: 5},
			buildTime: 10,
			settings: {
				storage: {gold: 100},
				consumption: {gold: 1}
			}
		});
	}

	protected getConsumptionManifestInternal(building: IBuildingData): Partial<IResourceManifest> | null {
		return {gold: 3, wood: 3, produce: 3};
	}

	protected getProductionManifestInternal(building: IBuildingData): Partial<IResourceManifest> | null {
		return null;
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Storage Pile',
			kind: 'production',
			level: 0,
			buildingCost: {gold: 300, wood: 20},
			workforce: {peasants: 5},
			housing: {},
			storage: {produce: 10, meat: 10, wood: 10, gold: 100},
			buildTime: 5
		};
	}

	meetsRequirements(tile: ITile): boolean {
		return this.isClear(tile) && this.matches(tile, 'plains', 'forests');
	}
}

class Huts extends Building {
	private basePrice = {gold: 150, wood: 10};

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Huts, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Extra Beds',
			buildingCost: multiplyResourceManifest(2, this.basePrice),
			buildTime: 10,
			settings: {
				housing: {peasants: 5},
				storage: {gold: 10}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Straw Thatched Roof',
			buildingCost: multiplyResourceManifest(2.5, this.basePrice),
			buildTime: 10,
			settings: {
				housing: {peasants: 10},
				storage: {gold: 20}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Huts',
			kind: 'housing',
			level: 0,
			buildingCost: multiplyResourceManifest(1, this.basePrice),
			workforce: {},
			housing: {peasants: 10},
			storage: {gold: 20},
			buildTime: 4
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 1};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'grasslands';
	}
}

class Shrubbery extends Building {

	private basePrice = {gold: 300};

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Shrubbery, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Sharp Saw',
			buildingCost: {wood: 15, gold: 350},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {wood: 1},
				housing: {},
				consumption: {gold: 1}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Tree Planting',
			buildingCost: {gold: 500},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {wood: 2},
				housing: {},
				consumption: {gold: 5}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Shrubbery',
			kind: 'production',
			level: 0,
			buildingCost: multiplyResourceManifest(1, this.basePrice),
			workforce: {peasants: 12},
			housing: {},
			storage: {wood: 5},
			buildTime: 4
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return null;
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		return {wood: 1.5 + tile.waterCapacity / 10 + tile.lifeCapacity / 10};
	}

	meetsRequirements(tile: ITile): boolean {
		return this.isClear(tile) && this.matches(tile, 'grasslands');
	}
}

class Hovel extends Building {

	private basePrice = {gold: 150, wood: 10};

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Hovel, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Woodshed',
			buildingCost: multiplyResourceManifest(2, this.basePrice),
			buildTime: 10,
			settings: {
				housing: {peasants: 3},
				storage: {wood: 10, gold: 15},
			}
		});

		this.registerBasicUpgrade({
			level: 0,
			name: 'Extra Beds',
			buildingCost: multiplyResourceManifest(2, this.basePrice),
			buildTime: 10,
			settings: {
				housing: {peasants: 5},
				storage: {gold: 15}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Outhouse',
			buildingCost: {gold: 600, wood: 15},
			buildTime: 10,
			settings: {
				housing: {peasants: 5},
				storage: {gold: 15}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Hovel',
			kind: 'housing',
			level: 0,
			buildingCost: multiplyResourceManifest(1, this.basePrice),
			workforce: {},
			housing: {peasants: 10},
			storage: {gold: 20},
			buildTime: 4
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 1};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'plains';
	}
}

class Tavern extends Building {
	private basePrice = {gold: 150, wood: 10};

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Tavern, vv);
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Tavern',
			kind: 'production',
			level: 0,
			buildingCost: multiplyResourceManifest(1, this.basePrice),
			workforce: {peasants: 6},
			housing: {},
			storage: {gold: 30},
			buildTime: 20
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 5};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	meetsRequirements(tile: ITile): boolean {
		return this.isClear(tile) && this.matches(tile, 'plains', 'grasslands');
	}
}

class TreeHouse extends Building {

	private basePrice = {gold: 150, wood: 10};

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.TreeHouse, vv);
		this.registerBasicUpgrade({
			level: 0,
			name: 'Rain Shelter',
			buildingCost: multiplyResourceManifest(2, this.basePrice),
			buildTime: 10,
			settings: {
				housing: {peasants: 3},
				storage: {wood: 10, gold: 20},
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Tree House',
			kind: 'housing',
			level: 0,
			buildingCost: multiplyResourceManifest(1, this.basePrice),
			workforce: {},
			housing: {peasants: 6},
			storage: {gold: 30},
			buildTime: 4
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 0};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	meetsRequirements(tile: ITile): boolean {
		return this.isClear(tile) && tile.kind === 'forests';
	}
}

class WoodenCabin extends Building {

	private basePrice = {gold: 150, wood: 10};

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Hovel, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Wooden Cabin',
			buildingCost: multiplyResourceManifest(2, this.basePrice),
			buildTime: 10,
			settings: {
				housing: {peasants: 3},
				storage: {wood: 10, gold: 15},
			}
		});

		this.registerBasicUpgrade({
			level: 0,
			name: 'Extra Beds',
			buildingCost: multiplyResourceManifest(2, this.basePrice),
			buildTime: 10,
			settings: {
				housing: {peasants: 5},
				storage: {gold: 15}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Outhouse',
			buildingCost: {gold: 600, wood: 15},
			buildTime: 10,
			settings: {
				housing: {peasants: 5},
				storage: {gold: 15}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Hovel',
			kind: 'housing',
			level: 0,
			buildingCost: multiplyResourceManifest(1, this.basePrice),
			workforce: {},
			housing: {peasants: 10},
			storage: {gold: 20},
			buildTime: 4
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 1};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'plains';
	}
}

class WoodenHouse extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.WoodenHouse, vv);

		this.registerBasicUpgrade({
			level: 1,
			name: 'Basement Level',
			buildingCost: {gold: 500, stone: 20},
			buildTime: 10,
			settings: {
				housing: {craftsmen: 15},
				consumption: {gold: 1},
				storage: {gold: 25}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Second Floor',
			buildingCost: {gold: 500, wood: 40},
			buildTime: 10,
			settings: {
				housing: {craftsmen: 15},
				consumption: {gold: 1},
				storage: {gold: 25}
			}
		});

		this.registerBasicUpgrade({
			level: 2,
			name: 'Outbuilding',
			buildingCost: {gold: 350, wood: 20},
			buildTime: 10,
			settings: {
				housing: {peasants: 10},
				consumption: {gold: 1},
				storage: {gold: 25}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Wooden House',
			kind: 'housing',
			level: 1,
			buildingCost: {gold: 500, wood: 15},
			workforce: {},
			housing: {craftsmen: 10},
			storage: {gold: 30},
			buildTime: 2
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 2};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	meetsRequirements(tile: ITile): boolean {
		return this.isClear(tile) && this.matches(tile, 'plains');
	}
}

class StoneHouse extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.StoneHouse, vv);

		this.registerBasicUpgrade({
			level: 2,
			name: 'Cosy Attic',
			buildingCost: {gold: 350, wood: 20, stone: 10},
			buildTime: 10,
			settings: {
				housing: {workers: 10},
				consumption: {gold: 5}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Stone House',
			kind: 'housing',
			level: 2,
			buildingCost: {gold: 800, wood: 15, stone: 15},
			workforce: {},
			housing: {workers: 10},
			storage: {gold: 40},
			buildTime: 2
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 5};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	meetsRequirements(tile: ITile): boolean {
		return this.isClear(tile) && tile.kind === 'plains';
	}
}

class WoodCuttersHut extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.WoodCuttersHut, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Sharp Saw',
			buildingCost: {wood: 15, gold: 350},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {wood: 1},
				housing: {},
				consumption: {gold: 1}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Tree Planting',
			buildingCost: {gold: 500},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {wood: 2},
				housing: {},
				consumption: {gold: 5}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Woodcutter\'s Hut',
			kind: 'production',
			level: 0,
			buildingCost: {gold: 150},
			workforce: {peasants: 5, craftsmen: 2},
			housing: {},
			storage: {wood: 5},
			buildTime: 4
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return null;
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		return {wood: 1 + tile.waterCapacity / 8 + tile.lifeCapacity / 8};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'forests';
	}
}

class PineCopse extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.PineCopse, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Sharp Saw',
			buildingCost: {wood: 15, gold: 350},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {wood: 1},
				housing: {},
				consumption: {gold: 1}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Tree Planting',
			buildingCost: {gold: 500},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {wood: 2},
				housing: {},
				consumption: {gold: 5}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Pine Copse',
			kind: 'production',
			level: 0,
			buildingCost: {gold: 200},
			workforce: {peasants: 5, craftsmen: 2},
			housing: {},
			storage: {wood: 5},
			buildTime: 4
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return null;
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		return {wood: 1.5 + tile.waterCapacity / 10 + tile.lifeCapacity / 10};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'plains';
	}
}

class LumberMill extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.LumberMill, vv);

		/* this.registerBasicUpgrade({
			level: 0,
			name: 'Sharp Saw',
			buildingCost: {wood: 5, gold: 200},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {wood: 1},
				housing: {},
				consumption: {gold: 1}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Tree Planting',
			buildingCost: {gold: 500},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {wood: 2},
				housing: {},
				consumption: {gold: 5}
			}
		}); */
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Lumber Mill',
			kind: 'production',
			level: 1,
			buildingCost: {gold: 300, stone: 20, tools: 10},
			workforce: {craftsmen: 10, workers: 2},
			housing: {},
			storage: {wood: 30},
			buildTime: 20
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 10};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		return {wood: 15 + 2 * Math.floor(Math.pow(tile.waterCapacity * 10, 0.5))};
	}

	meetsRequirements(tile: ITile): boolean {
		return this.hasBuilding(tile, BuildingCode.WoodCuttersHut);
	}
}

class HuntersLodge extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.HuntersLodge, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Wild bore hunting',
			buildingCost: {wood: 5, gold: 200},
			buildTime: 5,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {meat: 2},
				housing: {},
				consumption: {wood: 1}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Trapping',
			buildingCost: {wood: 20, tools: 20, gold: 600},
			buildTime: 5,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {meat: 6},
				housing: {},
				consumption: {gold: 2, tools: 1, wood: 2}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Hunters\'s Lodge',
			kind: 'production',
			level: 1,
			buildingCost: {gold: 500, wood: 4},
			workforce: {peasants: 5, craftsmen: 2},
			housing: {},
			storage: {meat: 20},
			buildTime: 4
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return null;
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		return {meat: 1.7 + (tile.waterCapacity / 4)};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'forests';
	}
}

class ForagingShack extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.ForagingShack, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Sea Buckthorn Berries',
			buildingCost: {wood: 5, gold: 150},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {produce: 2},
				housing: {},
				consumption: {gold: 1}
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Coconut Climbing Harness',
			buildingCost: {tools: 5, gold: 200},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {produce: 4},
				housing: {},
				consumption: {gold: 2}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Foraging Shack',
			kind: 'production',
			level: 0,
			buildingCost: createResourceManifest({gold: 100, wood: 5}),
			workforce: createPopulationManifest({peasants: 5}),
			housing: createPopulationManifest(),
			storage: createResourceManifest({produce: 10}),
			buildTime: 5
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return null;
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		return {produce: (4.5 + Math.pow(tile.waterCapacity, 0.3)) * 0.5};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'forests';
	}
}

class StrawberryFarm extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.StrawberryFarm, vv);

		this.registerBasicUpgrade({
			level: 1,
			name: 'Garden Beds',
			buildingCost: {wood: 15, stone: 10, gold: 150},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {produce: 4},
				housing: {},
				consumption: {wood: 1, stone: 1, gold: 2}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Strawberry Farm',
			kind: 'production',
			level: 0,
			buildingCost: {wood: 5, gold: 150},
			workforce: {peasants: 8, craftsmen: 3},
			housing: {},
			storage: {produce: 10},
			buildTime: 5
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData): Partial<IResourceManifest> {
		return {gold: 2};
	}

	protected getProductionManifestInternal(building: IBuildingData): Partial<IResourceManifest> {
		const tile = this.vv.getTileUnder(building);
		return {produce: 5 + Math.floor(Math.pow(tile.waterCapacity * tile.lifeCapacity, 0.3))};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'plains';
	}
}

class Orchard extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Orchard, vv);
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Orchard',
			kind: 'production',
			level: 2,
			buildingCost: {wood: 20, gold: 600, tools: 10},
			workforce: {peasants: 5, craftsmen: 5},
			housing: {},
			storage: {produce: 10},
			buildTime: 12
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData): Partial<IResourceManifest> {
		return {gold: 15};
	}

	protected getProductionManifestInternal(building: IBuildingData): Partial<IResourceManifest> {
		const tile = this.vv.getTileUnder(building);
		return {produce: 8 + Math.pow(tile.waterCapacity + tile.lifeCapacity, 2) / 20};
	}

	meetsRequirements(tile: ITile): boolean {
		return this.hasBuilding(tile, BuildingCode.StrawberryFarm);
	}
}

class DrinkingWell extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.DrinkingWell, vv);

		this.registerBasicUpgrade({
			level: 0,
			name: 'Deep Wells',
			buildingCost: {wood: 30, gold: 600},
			buildTime: 10,
			settings: {
				irrigation: 2,
				range: 1,
				life: 0,
				production: {},
				housing: {},
				consumption: {gold: 15}
			}
		});
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 3};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return {};
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Drinking Well',
			kind: 'production',
			level: 1,
			buildingCost: {gold: 500, wood: 10},
			workforce: {peasants: 2},
			housing: {},
			storage: {},
			buildTime: 5,
			field: {
				life: 0,
				range: 1,
				irrigation: 2
			}
		};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && (tile.kind === 'plains' || tile.kind === 'grasslands');
	}
}

class Shrine extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Shrine, vv);
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 10};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Shrine',
			kind: 'production',
			level: 0,
			buildingCost: createResourceManifest({gold: 100, wood: 5}),
			workforce: createPopulationManifest({peasants: 5}),
			housing: createPopulationManifest(),
			storage: createResourceManifest(),
			buildTime: 5,
			field: {
				life: 1,
				range: 1,
				irrigation: 0
			}
		};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'plains';
	}
}

class Bank extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Bank, vv);
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Bank',
			kind: 'production',
			level: 1,
			buildingCost: {gold: 1000, wood: 5},
			workforce: {peasants: 50, craftsmen: 50},
			housing: {},
			storage: {gold: 10000},
			buildTime: 5
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 100};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		return null;
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'plains';
	}
}

class Warehouse extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Warehouse, vv);
	}

	protected getConsumptionManifestInternal(building: IBuildingData): Partial<IResourceManifest> | null {
		return {gold: 100};
	}

	protected getProductionManifestInternal(building: IBuildingData): Partial<IResourceManifest> | null {
		return null;
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Warehouse',
			kind: 'production',
			level: 3,
			buildingCost: createResourceManifest({gold: 1000, wood: 40}),
			workforce: createPopulationManifest({peasants: 20}),
			housing: createPopulationManifest(),
			storage: createResourceManifest({produce: 20, meat: 20, wood: 20}),
			buildTime: 5
		};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'plains';
	}
}

class FreedomTower extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.FreedomTower, vv);

		this.registerBasicUpgrade({
			name: 'Tier 1 Resources',
			level: 0,
			buildTime: 1,
			buildingCost: {},
			settings: {
				housing: {},
				consumption: {},
				range: 0,
				life: 0,
				irrigation: 0,
				production: {stone: 10000}
			}
		});

		this.registerBasicUpgrade({
			name: 'Tier 2 Resources',
			level: 0,
			buildTime: 1,
			buildingCost: {},
			settings: {
				housing: {},
				consumption: {},
				range: 0,
				life: 0,
				irrigation: 0,
				production: {tools: 10000, fish: 10000}
			}
		});
	}

	protected getConsumptionManifestInternal(building: IBuildingData): Partial<IResourceManifest> | null {
		return {gold: 0};
	}

	protected getProductionManifestInternal(building: IBuildingData): Partial<IResourceManifest> | null {
		return {produce: 2000, meat: 2000, wood: 2000, gold: 2000};
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Freedom Tower',
			kind: 'production',
			level: 0,
			buildingCost: {gold: 1},
			workforce: {},
			housing: {},
			storage: {produce: 20000, meat: 20000, wood: 20000, gold: 20000, stone: 20000, tools: 20000},
			buildTime: 5
		};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'plains';
	}
}

class StoneQuarry extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.StoneQuarry, vv);

		this.registerBasicUpgrade({
			level: 1,
			name: 'Wooden Cart',
			buildingCost: {wood: 20, gold: 600},
			buildTime: 10,
			settings: {
				irrigation: 0,
				range: 0,
				life: 0,
				production: {stone: 4},
				housing: {},
				consumption: {gold: 6}
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Stone Quarry',
			kind: 'production',
			level: 1,
			buildingCost: {gold: 500, wood: 30},
			workforce: {peasants: 5, craftsmen: 10},
			housing: {},
			storage: {stone: 20},
			buildTime: 5
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {wood: 1};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);

		const death = 10 - Math.min(10, tile.lifeCapacity);
		const water = tile.waterCapacity;

		return {stone: (2 + Math.pow(water, 0.3) + Math.pow(death, 0.3)) * 0.5};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'mountains';
	}
}

class StoneMason extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.StoneMason, vv);

		this.registerBasicUpgrade({
			level: 1,
			name: 'Stone workbench',
			buildingCost: {stone: 10, gold: 450},
			buildTime: 10,
			settings: {
				production: {tools: 2},
			}
		});

		this.registerBasicUpgrade({
			level: 1,
			name: 'Pulley Block',
			buildingCost: {stone: 10, wood: 50, gold: 450},
			buildTime: 10,
			settings: {
				production: {tools: 5},
			}
		});
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Stone Mason',
			kind: 'production',
			level: 1,
			buildingCost: {gold: 500, wood: 30, stone: 10},
			workforce: {craftsmen: 5, workers: 5},
			housing: {},
			storage: {tools: 30},
			buildTime: 5
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {stone: 2, wood: 2};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		const extra = tile.waterCapacity / 10;
		let base = 6;
		if (tile.kind === 'mountains') {
			base = 8;
		}

		return {tools: base * (1 + extra)};
	}

	meetsRequirements(tile: ITile): boolean {
		return this.isClear(tile) && this.matches(tile, 'plains', 'mountains');
	}
}

class Fishery extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.Fishery, vv);
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Fishery',
			kind: 'production',
			level: 1,
			buildingCost: {gold: 500, wood: 30, stone: 20, tools: 10},
			workforce: {peasants: 10, craftsmen: 10},
			housing: {},
			storage: {fish: 40},
			buildTime: 30
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 10};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		const extra = tile.lifeCapacity / 10;
		return {fish: 2 * (1 + extra)};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'waters';
	}
}

class SheepShed extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.SheepShed, vv);
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Sheep Shed',
			kind: 'production',
			level: 2,
			buildingCost: {gold: 600, wood: 20},
			workforce: {peasants: 10, craftsmen: 5, workers: 5},
			housing: {},
			storage: {meat: 30},
			buildTime: 20
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {gold: 10, wood: 2};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);
		return {meat: 10 + 4 * (tile.waterCapacity + tile.lifeCapacity) / 10};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'grasslands';
	}
}

class CoalMine extends Building {

	constructor(vv: VoxVilleBase) {
		super(BuildingCode.CoalMine, vv);
	}

	getConstructionOption(tile: ITile): IBuildingConstructionOption {
		return {
			code: this.code,
			name: 'Coal Mine',
			kind: 'production',
			level: 2,
			buildingCost: {gold: 800, tools: 30},
			workforce: {peasants: 5, craftsmen: 5, workers: 10},
			housing: {},
			storage: {coal: 40},
			buildTime: 30
		};
	}

	protected getConsumptionManifestInternal(building: IBuildingData) {
		return {tools: 1, gold: 20};
	}

	protected getProductionManifestInternal(building: IBuildingData) {
		const tile = this.vv.getTileUnder(building);

		const life = tile.lifeCapacity;
		const water = tile.waterCapacity;

		return {coal: (2 + Math.pow(water, 0.5) + Math.pow(life, 0.5))};
	}

	meetsRequirements(tile: ITile): boolean {
		return tile.buildingId === null && tile.kind === 'mountains';
	}
}

export function initBuildings(vv: VoxVilleBase) {
	return [

		new StoragePile(vv),

		new Huts(vv),

		new Hovel(vv),

		new TreeHouse(vv),

		new WoodenHouse(vv),
		new WoodCuttersHut(vv),
		new HuntersLodge(vv),
		new ForagingShack(vv),
		new StrawberryFarm(vv),
		new StoneQuarry(vv),
		new StoneMason(vv),

		//new Shrine(vv),
		//new Bank(vv),
		//new Warehouse(vv),
		//new FreedomTower(vv),
		new Fishery(vv),
		new DrinkingWell(vv),
		new LumberMill(vv),
		new StoneHouse(vv),
		new SheepShed(vv),
		new Orchard(vv),
		new CoalMine(vv),
		new PineCopse(vv),

		new HolyPlace(vv),

		new Tavern(vv)
	];
}
