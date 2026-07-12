export type IManifest<K> = {
	[P in keyof K]: number;
};


export interface IResourceManifest {
	gold: number;
	wood: number;
	produce: number;
	meat: number;
	coal: number;
	stone: number;
	fish: number;
	tools: number;
}

export interface IPopulationManifest {
	peasants: number;
	craftsmen: number;
	workers: number;
}

export type TileKind = 'forests' | 'mountains' | 'grasslands' | 'plains' | 'waters'
export const TileKinds: TileKind[] = ['plains', 'forests', 'mountains', 'grasslands', 'waters'];

export type BuildingKind = 'housing' | 'production'

export interface IPosition {
	i: number;
	j: number;
}

export interface ITile extends IPosition {
	kind: TileKind
	waterCapacity: number
	lifeCapacity: number
	buildingId: string | null;
	occupiedByEnemyGroupId?: string;
}

export enum BuildingCode {

	Hovel,
	WoodenHouse,

	TreeHouse,
	WoodenCabin,
	Huts,

	WoodCuttersHut,
	LumberMill,
	ForagingShack,
	StrawberryFarm,
	DrinkingWell,
	HuntersLodge,
	Bank,
	Shrine,
	StoragePile,
	Warehouse,
	StoneQuarry,
	StoneMason,
	FreedomTower,
	Fishery,
	StoneHouse,
	SheepShed,
	Orchard,
	CoalMine,
	PineCopse,
	Shrubbery,
	HolyPlace,

	Tavern
}

export interface IBuildingUpgradeEffect {
	irrigation: number,
	life: number,
	range: number,
	production: Partial<IResourceManifest>,
	consumption: Partial<IResourceManifest>,
	housing: Partial<IPopulationManifest>,
	storage: Partial<IResourceManifest>
}

export interface IBuildingFieldGenerator {
	range: number;
	irrigation: number;
	life: number;
}

export interface IBuildingData extends IPosition {
	id: string;
	kind: 'housing' | 'production';
	code: BuildingCode;
	name: string;
	villagerIds: string[];
	buildTicksRemaining: number;
	constructionCompletedAtTick: number;
	buildingCost: Partial<IResourceManifest>;
	storage: Partial<IResourceManifest>;
	workers: Partial<IPopulationManifest>;
	housing: Partial<IPopulationManifest>;
	upgrades: { [id: string]: Partial<IBuildingUpgradeEffect> }
	field?: IBuildingFieldGenerator | null
}

export interface IBaseConstructionOption {
	name: string;
	buildingCost: Partial<IResourceManifest>;
	buildTime: number;
}

export interface IBuildingUpgradeOption extends IBaseConstructionOption {
	level: number;
	settings: Partial<IBuildingUpgradeEffect>;
}

export interface IBuildingConstructionOption extends IBaseConstructionOption {
	kind: BuildingKind;
	code: BuildingCode;
	level: number;
	storage: Partial<IResourceManifest>;
	workforce: Partial<IPopulationManifest>;
	housing: Partial<IPopulationManifest>;
	field?: IBuildingFieldGenerator | null
}

export interface IVillager {
	id: string;
	kind: keyof IPopulationManifest;
	happiness: number;
	luxuryHappiness: number;
	workplaceId: string;
	houseId: string;
	consumes: Partial<IResourceManifest>;
	consumesLuxury: Partial<IResourceManifest>;
	debug: any;
}

export interface IRegion {
	name: string;
	tiles: ITile[];
	kind: TileKind;
	locked: boolean;
}

export enum HeroKind {
	Warrior,
	Wizard,
	Scout,
	Druid
}

export enum EnemyKind {
	Brigand,
	Barbarian,
	Orge,
	Swarm
}

export enum AbilityKind {
	DoubleSlash,
	Dash,
	FrostBolt,
	Storm,
	Rejuvenate,
	Infect,
	Evasion,
	EagleEye
}

export interface IHero {
	name: string;
	level: number;
	experience: number;
	kind: HeroKind;
	hitPoints: number;
	abilityPoints: number;
	abilities: AbilityKind[];
	happiness: number;
}

export interface IHeroPurchaseOption {
	hero: IHero;
	cost: Partial<IResourceManifest>;
	upkeep: Partial<IResourceManifest>;
	ticksRemaining: number;
}

export interface IEnemy {
	kind: EnemyKind;
	level: number;
	strength: number;
	abilities: AbilityKind[];
}

export interface IEnemyGroup {
	id: string;
	enemies: IEnemy[];
	ticksBeforeOccupation: number;
	occupies: IPosition;
}

export interface IVoxVilleState {
	tick: number;
	maxLevelReached: number;
	resources: IResourceManifest;
	baseRate: IResourceManifest;
	baseResourceCapacity: IResourceManifest;
	buildings: IBuildingData[];
	regions: IRegion[];
	villagers: IVillager[];
	heroes: IHero[];
	enemies: IEnemyGroup[];
	visitingHeroes: IHeroPurchaseOption[];
}

export interface ILookupCache {
	employers: { [villagerId: string]: IBuildingData }
	housing: { [villagerId: string]: IBuildingData }
	villagers: { [villagerId: string]: IVillager }
	buildings: { [buildingId: string]: IBuildingData }
	occupancy: { [buildingId: string]: IPopulationManifest }
	work: { [buildingId: string]: IPopulationManifest }
	population: IPopulationManifest;
	employment: IPopulationManifest;
	level: number;
}

export function createResourceManifest(partial: Partial<IResourceManifest> = {}): IResourceManifest {
	return {
		gold: 0,
		wood: 0,
		produce: 0,
		meat: 0,
		coal: 0,
		stone: 0,
		fish: 0,
		tools: 0,
		...partial
	};
}

export function createPopulationManifest(partial: Partial<IPopulationManifest> = {}): IPopulationManifest {
	return {
		peasants: 0,
		craftsmen: 0,
		workers: 0,
		...partial
	};
}

export function multiplyResourceManifest(n: number, manifest: Partial<IResourceManifest> | null): IResourceManifest {
	const copy = createResourceManifest(manifest);
	for (let key in manifest) {
		copy[key] = n * manifest[key];
	}
	return copy;
}

function manifestAdd<T>(a: IManifest<T>, b: IManifest<T>, target: IManifest<T>): Partial<T> | null {

	if (a == null && b == null) {
		return null;
	}

	if (a == null) {
		return b as any;
	}

	if (b == null) {
		return a as any;
	}

	for (let key in target) {
		const av = a[key] || 0;
		const bv = b[key] || 0;
		const delta = av + bv;
		if (delta === 0) {
			delete target[key];
		} else {
			target[key] = delta;
		}
	}

	return target as any;
}

export function manifestDelta(a: Partial<IResourceManifest>, b: Partial<IResourceManifest>): Partial<IResourceManifest> {
	const manifest = createResourceManifest();

	for (let key in manifest) {
		const av = a[key] || 0;
		const bv = b[key] || 0;
		const delta = av - bv;
		if (delta === 0) {
			delete manifest[key];
		} else {
			manifest[key] = delta;
		}
	}
	return manifest;
}

export function resourceManifestAdd(a: Partial<IResourceManifest>, b: Partial<IResourceManifest>): Partial<IResourceManifest> | null {
	return manifestAdd<Partial<IResourceManifest>>(a, b, createResourceManifest());
}

export function popManifestDelta(a: Partial<IPopulationManifest>, b: Partial<IPopulationManifest>): Partial<IPopulationManifest> {
	const manifest = createPopulationManifest();

	for (let key in manifest) {
		const av = a[key] || 0;
		const bv = b[key] || 0;
		const delta = av - bv;
		if (delta === 0) {
			delete manifest[key];
		} else {
			manifest[key] = delta;
		}
	}

	return manifest;
}

export function populationManifestAdd(a: Partial<IPopulationManifest>, b: Partial<IPopulationManifest>): Partial<IPopulationManifest> | null {
	return manifestAdd<Partial<IPopulationManifest>>(a, b, createPopulationManifest());
}

export function populationManifestMean(manifest: Partial<IPopulationManifest>) {
	let mean = 0;
	let count = 0;

	for (let key in manifest) {
		const rating = manifest[key];
		mean += rating;
		if (rating > 0) {
			count += 1;
		}
	}
	mean /= Math.max(1, count);

	return mean;
}

export function populationManifestMin(manifest: Partial<IPopulationManifest>) {
	let min = Infinity;

	for (let key in manifest) {
		const rating = manifest[key];
		if (rating < min) {
			min = rating;
		}
	}

	return min;
}