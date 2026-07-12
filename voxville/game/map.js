"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var types_1 = require("./types");
function createRandomMap(n) {
    var tiles = [];
    while (true) {
        tiles.length = 0;
        var waterCount = 0;
        var mountainCount = 0;
        for (var i = 0; i < n; ++i) {
            for (var j = 0; j < n; ++j) {
                var kind = types_1.biasedChoice({
                    'forests': 3,
                    'mountains': 3,
                    'grasslands': 3,
                    'plains': 10,
                    'waters': 2
                });
                //TODO: Affix Luxury
                tiles.push({
                    i: i,
                    j: j,
                    kind: kind,
                    waterCapacity: 0,
                    lifeCapacity: 0,
                    luxury: null,
                    buildingId: null
                });
                if (kind === 'waters') {
                    ++waterCount;
                }
                if (kind === 'mountains') {
                    ++mountainCount;
                }
            }
        }
        if (waterCount > 2 && mountainCount > 2) {
            break;
        }
    }
    return tiles;
}
function initGameState(size) {
    return {
        tick: 0,
        buildings: [],
        baseRate: types_1.createResourceManifest({ gold: 1, wood: 1, water: 1, berries: 1 }),
        baseRateLimit: types_1.createResourceManifest({ gold: 100, wood: 5, water: 5, berries: 5 }),
        baseResourceCapacity: types_1.createResourceManifest({ gold: 1000, wood: 30, water: 30, berries: 30 }),
        resources: types_1.createResourceManifest({ gold: 1000, wood: 30, water: 30, berries: 30 }),
        tiles: createRandomMap(size),
        villagers: []
    };
}
exports.initGameState = initGameState;
