"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var types_1 = require("./types");
var buildings_1 = require("./buildings");
var VoxVilleBase = /** @class */ (function () {
    function VoxVilleBase(size) {
        this.size = size;
        this.state = null;
        this.buildings = [];
        this.buildingTypeLookup = {};
        this.lookup = null;
        this.buildings = buildings_1.getAllBuildings(this);
        for (var _i = 0, _a = this.buildings; _i < _a.length; _i++) {
            var building = _a[_i];
            this.buildingTypeLookup[building.code] = building;
        }
    }
    VoxVilleBase.prototype.makeId = function () {
        return Math.random().toString(36).substring(7);
    };
    VoxVilleBase.prototype.makeBuilding = function (tile, option) {
        return {
            id: this.makeId(),
            kind: option.kind,
            code: option.code,
            i: tile.i,
            j: tile.j,
            buildTicksRemaining: option.buildTime,
            name: option.name,
            workers: option.workerCapacity,
            housing: option.housingCapacity,
            buildingCost: option.buildingCost,
            storage: option.resourceCapacity,
            villagerIds: [],
            improvements: {}
        };
    };
    VoxVilleBase.prototype.subtract = function (res, toMax) {
        if (toMax === void 0) { toMax = false; }
        var canAfford = true;
        if (res === null) {
            return canAfford;
        }
        for (var key in res) {
            if (this.state.resources[key] < res[key]) {
                canAfford = false;
                break;
            }
        }
        if (!canAfford && !toMax) {
            return false;
        }
        for (var key in res) {
            this.state.resources[key] = Math.max(0, this.state.resources[key] - res[key]);
        }
        return canAfford;
    };
    VoxVilleBase.prototype.calculateResourceCap = function (resource) {
        var base = this.state.baseResourceCapacity[resource];
        for (var _i = 0, _a = this.state.buildings; _i < _a.length; _i++) {
            var building = _a[_i];
            base += building.storage[resource];
        }
        return base;
    };
    VoxVilleBase.prototype.calculateCapacity = function (manifest) {
        var count = 0;
        for (var key in manifest) {
            count += manifest[key];
        }
        return count;
    };
    VoxVilleBase.prototype.add = function (res, adjustCap) {
        if (adjustCap === void 0) { adjustCap = true; }
        for (var key in res) {
            if (adjustCap) {
                var cap = this.calculateResourceCap(key);
                this.state.resources[key] = Math.min(cap, this.state.resources[key] + res[key]);
            }
            else {
                this.state.resources[key] += res[key];
            }
        }
    };
    VoxVilleBase.prototype.applyCaps = function () {
        for (var key in this.state.resources) {
            var cap = this.calculateResourceCap(key);
            this.state.resources[key] = Math.min(cap, this.state.resources[key]);
        }
    };
    VoxVilleBase.prototype.registerChanges = function () {
        var lookup = {
            employers: {},
            housing: {},
            buildings: {},
            villagers: {},
            occupancy: {}
        };
        for (var _i = 0, _a = this.state.villagers; _i < _a.length; _i++) {
            var villager = _a[_i];
            lookup.villagers[villager.id] = villager;
        }
        for (var _b = 0, _c = this.state.buildings; _b < _c.length; _b++) {
            var building = _c[_b];
            lookup.buildings[building.id] = building;
            if (building.kind === 'housing') {
                for (var _d = 0, _e = building.villagerIds; _d < _e.length; _d++) {
                    var id = _e[_d];
                    lookup.housing[id] = building;
                }
            }
            if (building.kind === 'production') {
                for (var _f = 0, _g = building.villagerIds; _f < _g.length; _f++) {
                    var id = _g[_f];
                    lookup.employers[id] = building;
                }
            }
            var occupancy = types_1.createPopulationManifest();
            for (var _h = 0, _j = building.villagerIds; _h < _j.length; _h++) {
                var villagerId = _j[_h];
                var villager = lookup.villagers[villagerId];
                occupancy[villager.kind] += 1;
            }
            lookup.occupancy[building.id] = occupancy;
        }
        for (var _k = 0, _l = this.state.villagers; _k < _l.length; _k++) {
            var villager = _l[_k];
            lookup.villagers[villager.id] = villager;
        }
        this.lookup = lookup;
    };
    VoxVilleBase.prototype.getTile = function (i, j) {
        return this.state.tiles[i * this.size + j];
    };
    VoxVilleBase.prototype.getVillager = function (villagerId) {
        return this.lookup.villagers[villagerId];
    };
    VoxVilleBase.prototype.getBuilding = function (buildingId) {
        return this.lookup.buildings[buildingId];
    };
    VoxVilleBase.prototype.getEmployer = function (villagerId) {
        return this.lookup.employers[villagerId];
    };
    VoxVilleBase.prototype.getBuildingOccupancyManifest = function (buildingId) {
        return this.lookup.occupancy[buildingId];
    };
    VoxVilleBase.prototype.getBuildingHappinessManifest = function (buildingId) {
        var building = this.getBuilding(buildingId);
        var counts = types_1.createPopulationManifest();
        for (var _i = 0, _a = building.villagerIds; _i < _a.length; _i++) {
            var villagerId = _a[_i];
            var villager = this.getVillager(villagerId);
            counts[villager.kind] += villager.happiness;
        }
        var occupancy = this.getBuildingOccupancyManifest(buildingId);
        for (var _b = 0, _c = Object.keys(occupancy); _b < _c.length; _b++) {
            var kind = _c[_b];
            counts[kind] = Math.floor(counts[kind] / occupancy[kind]);
        }
        return counts;
    };
    VoxVilleBase.prototype.evict = function (villager, fixHouse) {
        if (fixHouse === void 0) { fixHouse = true; }
        var idx = this.state.villagers.indexOf(villager);
        this.state.villagers.splice(idx, 1);
        if (fixHouse) {
            var house = this.getBuilding(villager.houseId);
            var jdx = house.villagerIds.indexOf(villager.id);
            house.villagerIds.splice(jdx, 1);
        }
        if (villager.workplaceId != null) {
            var work = this.getBuilding(villager.workplaceId);
            work.villagerIds.splice(work.villagerIds.indexOf(villager.id), 1);
            console.log('Removed worker');
        }
        if (fixHouse) {
            this.registerChanges();
        }
    };
    VoxVilleBase.prototype.getNeighbouringTiles = function (i, j, dist) {
        if (dist === void 0) { dist = 1; }
        var neighbours = [];
        for (var idx = i - dist; idx <= i + dist; idx += dist) {
            for (var jdx = j - dist; jdx <= j + dist; jdx += dist) {
                if (idx >= 0 && jdx >= 0 && idx < this.size && jdx < this.size) {
                    neighbours.push(this.getTile(idx, jdx));
                }
            }
        }
        return neighbours;
    };
    VoxVilleBase.prototype.getBuildingFromData = function (building) {
        return this.buildingTypeLookup[building.code];
    };
    return VoxVilleBase;
}());
exports.VoxVilleBase = VoxVilleBase;
