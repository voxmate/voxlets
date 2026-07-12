"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var types_1 = require("./types");
exports.PopulationSpawnPriorityOrder = ['peasant', 'craftsmen'];
exports.PopulationTaxRevenue = {
    'peasant': 0.01,
    'craftsmen': 2
};
function mintVillager(kind, id, houseId) {
    if (kind == 'peasant') {
        return {
            id: id,
            kind: kind,
            happiness: 70,
            houseId: houseId,
            workplaceId: null,
            consumes: types_1.createResourceManifest({ berries: 0.05, wood: 0.01, water: 0.01 }),
        };
    }
    if (kind == 'craftsmen') {
        return {
            id: id,
            kind: kind,
            happiness: 70,
            houseId: houseId,
            workplaceId: null,
            consumes: types_1.createResourceManifest({ berries: 0.05, meat: 0.01 }),
        };
    }
}
exports.mintVillager = mintVillager;
