import {IPopulationManifest, IVillager} from './types';
import {randomId} from "@voxmate/voxmate/utility/random";

export const PopulationSpawnPriorityOrder: (keyof IPopulationManifest)[] = ['peasants', 'craftsmen', 'workers'];

export const PopulationTaxRevenue: { [kind in keyof IPopulationManifest]: number } = {
	'peasants': 0.005,
	'craftsmen': 0.01,
	'workers': 0.02
};

let vid = 1;

export function mintVillager(kind: keyof IPopulationManifest, houseId: string): IVillager {

	const id = `${(vid++)}_${randomId()}`;

	if (kind === 'peasants') {
		return {
			id: id,
			kind: kind,
			happiness: 30,
			luxuryHappiness: 0,
			houseId: houseId,
			workplaceId: null,
			consumes: {produce: 0.09, wood: 0.02},
			consumesLuxury: {meat: 0.01},
			debug: {}
		};
	}

	if (kind === 'craftsmen') {
		return {
			id: id,
			kind: kind,
			happiness: 30,
			luxuryHappiness: 0,
			houseId: houseId,
			workplaceId: null,
			consumes: {produce: 0.04, wood: 0.06, meat: 0.04, tools: 0.04, fish: 0.02},
			consumesLuxury: {coal: 0.02},
			debug: {}
		};
	}

	if (kind === 'workers') {
		return {
			id: id,
			kind: kind,
			happiness: 30,
			luxuryHappiness: 0,
			houseId: houseId,
			workplaceId: null,
			consumes: {produce: 0.04, meat: 0.04, tools: 0.04, fish: 0.02, coal: 0.02},
			consumesLuxury: {},
			debug: {}
		};
	}
}
