import {createResourceManifest, IRegion, ITile, IVoxVilleState, TileKind} from './types';
import {generateRegionName} from './generators/generators';
import {biasedChoice, shuffleArray} from "@voxmate/voxmate/utility/random";


function generateRegion(regionKind: TileKind): IRegion {


    const weightMap = {
        'forests': 1,
        'mountains': 1,
        'grasslands': 1,
        'plains': 1,
        'waters': 1
    };

    weightMap[regionKind] = 10;

    if (regionKind === 'mountains') {
        weightMap['plains'] = 0;
    }

    const tiles: ITile[] = [];
    for (let i = 0; i < 3; ++i) {
        for (let j = 0; j < 3; ++j) {

            let kind = biasedChoice<TileKind>(weightMap);

            if (i === 1 && j === 1) {
                kind = regionKind;
            }

            tiles.push({
                i: 0,
                j: 0,
                kind: kind,
                waterCapacity: 0,
                lifeCapacity: 0,
                buildingId: null,
            });
        }
    }

    let minLifeCapacity = 10;
    for (let tile of tiles) {
        if (tile.kind == 'plains') {
            let amount = Math.ceil(Math.random() * 3);
            if (amount > minLifeCapacity) {
                amount = minLifeCapacity;
            }

            minLifeCapacity -= amount;
            tile.lifeCapacity += amount;
        }
    }

    shuffleArray(tiles);

    return {
        name: generateRegionName(regionKind),
        kind: regionKind,
        tiles: tiles,
        locked: true
    };
}

function generateMap(): IRegion[] {

    const regions: IRegion[] = [];

    regions.push(generateRegion('mountains'));
    regions.push(generateRegion('waters'));
    regions.push(generateRegion('forests'));
    regions.push(generateRegion('grasslands'));
    regions.push(generateRegion('plains'));
    regions.push(generateRegion('plains'));

    for (let i = 0; i < 3; ++i) {

        const regionKind = biasedChoice<TileKind>({
            'forests': 6,
            'mountains': 0,
            'grasslands': 3,
            'plains': 24,
            'waters': 0
        });

        regions.push(generateRegion(regionKind));
    }

    return shuffleArray(regions);
}

export function initGameState(): IVoxVilleState {
    return {
        tick: 0,
        maxLevelReached: 0,
        buildings: [],
        baseRate: createResourceManifest({gold: 5, wood: 5, produce: 5}),
        baseResourceCapacity: createResourceManifest({gold: 1000, wood: 30, produce: 30}),
        resources: createResourceManifest({gold: 1000, wood: 30, produce: 30}),
        regions: generateMap(),
        villagers: [],
        heroes: [],
        enemies: [],
        visitingHeroes: []
    };
}
