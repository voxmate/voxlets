import {AbilityKind, HeroKind, IHero, IHeroPurchaseOption, IVoxVilleState} from './types';
import {randomChoice} from "@voxmate/voxmate/utility/random";

const kinds = [HeroKind.Warrior, HeroKind.Scout, HeroKind.Druid, HeroKind.Wizard];

function generateHeroName(kind: HeroKind): string {
	const names = ['Jack', 'Roufus', 'Jim', 'Samuel', 'Grant', 'Loke', 'Frot', 'Smeagol', 'Hodor', 'Turk'];
	const affix = ['Wise', 'Humble', 'Stringy', 'White', 'Grey', 'Faul', 'Gloomy', 'Swell', 'Mediocre'];
	return randomChoice(names) + ' the ' + randomChoice(affix);
}

const warriorAbilities: AbilityKind[] = [AbilityKind.DoubleSlash, AbilityKind.Dash];
const wizardAbilities: AbilityKind[] = [AbilityKind.FrostBolt, AbilityKind.Storm];
const druidAbilities: AbilityKind[] = [AbilityKind.Rejuvenate, AbilityKind.Infect];
const scoutAbilities: AbilityKind[] = [AbilityKind.Evasion, AbilityKind.EagleEye];

function getHeroBaseAbilities(hero: IHero) {
	switch (hero.kind) {
		case HeroKind.Druid:
			return druidAbilities;
		case HeroKind.Scout:
			return scoutAbilities;
		case HeroKind.Warrior:
			return warriorAbilities;
		case HeroKind.Wizard:
			return wizardAbilities;
	}
}

function arrayDifference<T>(a: T[], b: T[]): T[] {
	const result: T[] = [];
	for (let item of a) {
		if (b.indexOf(item) === -1) {
			result.push(item);
		}
	}
	return result;
}

function getHeroAbilityOptions(hero: IHero): AbilityKind[] {
	const baseAbilities = getHeroBaseAbilities(hero);
	return arrayDifference(baseAbilities, hero.abilities);
}

function addRandomAbility(hero: IHero) {
	const options = getHeroAbilityOptions(hero);
	if (options.length > 0) {
		hero.abilities.push(randomChoice(options));
	}
}

export function generateHeroOption(vv: IVoxVilleState): IHeroPurchaseOption {

	const kind = randomChoice(kinds);
	const name = generateHeroName(kind);
	const level = Math.floor(vv.maxLevelReached * 10 + (2 * (Math.random() - 0.5)) * 5);

	const hero: IHero = {
		kind: kind,
		experience: 0,
		abilities: [],
		hitPoints: 100,
		level: level,
		name: name,
		abilityPoints: Math.floor(level / 5),
		happiness: 50
	};

	for (let i = 0; i < hero.abilityPoints; ++i) {
		addRandomAbility(hero);
		hero.abilityPoints--;
	}

	const option: IHeroPurchaseOption = {
		cost: {gold: 100},
		upkeep: {gold: 5},
		hero: hero,
		ticksRemaining: 120
	};

	return option;
}
