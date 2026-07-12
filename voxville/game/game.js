"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var types_1 = require("./types");
var population_1 = require("./population");
var map_1 = require("./map");
var voxVilleBase_1 = require("./voxVilleBase");
var VoxVille = /** @class */ (function (_super) {
    __extends(VoxVille, _super);
    function VoxVille(size) {
        var _this = _super.call(this, size) || this;
        _this.state = map_1.initGameState(size);
        _this.distributeWaterCapacity();
        _this.registerChanges();
        return _this;
    }
    VoxVille.prototype.distributeWaterCapacity = function () {
        for (var _i = 0, _a = this.state.tiles; _i < _a.length; _i++) {
            var tile = _a[_i];
            tile.waterCapacity = 0;
            tile.lifeCapacity = 0;
        }
        for (var _b = 0, _c = this.state.tiles; _b < _c.length; _b++) {
            var tile = _c[_b];
            if (tile.kind === 'waters') {
                tile.waterCapacity = 10;
                var neighbours = this.getNeighbouringTiles(tile.i, tile.j);
                for (var _d = 0, neighbours_1 = neighbours; _d < neighbours_1.length; _d++) {
                    var neighbor = neighbours_1[_d];
                    if (neighbor.kind != 'waters') {
                        neighbor.waterCapacity += 2;
                    }
                }
            }
            if (tile.kind === 'forests' || tile.kind === 'grasslands') {
                var amount = 10;
                if (tile.kind === 'grasslands') {
                    amount = 3;
                }
                tile.lifeCapacity = amount;
                var neighbours = this.getNeighbouringTiles(tile.i, tile.j);
                for (var _e = 0, neighbours_2 = neighbours; _e < neighbours_2.length; _e++) {
                    var neighbor = neighbours_2[_e];
                    if (neighbor.kind != 'forests' && neighbor.kind != 'grasslands') {
                        neighbor.lifeCapacity += Math.floor(amount / 3);
                    }
                }
            }
            if (tile.buildingId != null) {
                var building = this.getBuilding(tile.buildingId);
                if (building.code === types_1.BuildingCode.DrinkingWell) {
                    var neighbours = this.getNeighbouringTiles(tile.i, tile.j);
                    for (var _f = 0, neighbours_3 = neighbours; _f < neighbours_3.length; _f++) {
                        var neighbor = neighbours_3[_f];
                        if (neighbor.kind != 'waters') {
                            neighbor.waterCapacity += 1;
                        }
                    }
                }
                if (building.code === types_1.BuildingCode.Shrine) {
                    var neighbours = this.getNeighbouringTiles(tile.i, tile.j);
                    for (var _g = 0, neighbours_4 = neighbours; _g < neighbours_4.length; _g++) {
                        var neighbor = neighbours_4[_g];
                        if (neighbor.kind != 'forests' && neighbor.kind != 'grasslands') {
                            neighbor.lifeCapacity += 1;
                        }
                    }
                }
            }
        }
    };
    VoxVille.prototype.spawn = function (building) {
        var occupancy = this.getBuildingOccupancyManifest(building.id);
        for (var _i = 0, PopulationSpawnPriorityOrder_1 = population_1.PopulationSpawnPriorityOrder; _i < PopulationSpawnPriorityOrder_1.length; _i++) {
            var kind = PopulationSpawnPriorityOrder_1[_i];
            var capacity = building.housing[kind];
            if (occupancy[kind] < capacity) {
                var life = this.getTile(building.i, building.j).lifeCapacity;
                var check = Math.random() < life / 10;
                if (check) {
                    var id = this.makeId();
                    var villager = population_1.mintVillager(kind, id, building.id);
                    this.state.villagers.push(villager);
                    building.villagerIds.push(id);
                    return true;
                }
                else {
                    return false;
                }
            }
        }
        return false;
    };
    VoxVille.prototype.grantFreeResources = function () {
        for (var resource in this.state.resources) {
            var current = this.state.resources[resource];
            var baseTick = this.state.baseRate[resource];
            var freeLimit = this.state.baseRateLimit[resource];
            if (current < freeLimit) {
                this.state.resources[resource] = Math.min(current + baseTick, freeLimit);
            }
        }
    };
    VoxVille.prototype.getAJob = function (villager, building) {
        building.villagerIds.push(villager.id);
        villager.workplaceId = building.id;
        this.registerChanges();
    };
    VoxVille.prototype.getState = function () {
        return this.state;
    };
    VoxVille.prototype.tick = function () {
        ++this.state.tick;
        if (this.state.buildings.length === 0) {
            this.grantFreeResources();
        }
        var madeChanges = false;
        var notEnoughResources = false;
        this.state.villagers.sort(function (a, b) {
            return a.happiness - b.happiness;
        });
        var workQueue = [];
        for (var _i = 0, _a = this.state.buildings; _i < _a.length; _i++) {
            var buildingData = _a[_i];
            var building = this.getBuildingFromData(buildingData);
            if (buildingData.buildTicksRemaining > 0) {
                --buildingData.buildTicksRemaining;
            }
            else {
                var consumption = building.getConsumptionManifest(buildingData);
                if (buildingData.kind === 'housing') {
                    if (!this.subtract(consumption, true)) {
                        notEnoughResources = true;
                    }
                }
                if (buildingData.kind === 'production') {
                    var occupancy = buildingData.villagerIds.length;
                    var totalWorkerCapacity = this.calculateCapacity(buildingData.workers);
                    var efficacy = occupancy / totalWorkerCapacity;
                    this.add(types_1.multiplyResourceManifest(efficacy, building.getProductionManifest(buildingData)), false);
                    if (!this.subtract(types_1.multiplyResourceManifest(efficacy, consumption), true)) {
                        notEnoughResources = true;
                    }
                    if (occupancy < totalWorkerCapacity) {
                        workQueue.push(buildingData);
                    }
                }
            }
        }
        types_1.shuffle(workQueue);
        var tax = 0;
        for (var _b = 0, _c = this.state.villagers; _b < _c.length; _b++) {
            var villager = _c[_b];
            if (!this.subtract(villager.consumes, true)) {
                notEnoughResources = true;
                villager.happiness = Math.floor((0.9) * villager.happiness) - 1;
            }
            if (villager.workplaceId === null) {
                for (var _d = 0, workQueue_1 = workQueue; _d < workQueue_1.length; _d++) {
                    var building = workQueue_1[_d];
                    var occupancy = this.getBuildingOccupancyManifest(building.id)[villager.kind];
                    var capacity = building.workers[villager.kind];
                    if (occupancy < capacity) {
                        madeChanges = true;
                        this.getAJob(villager, building);
                        workQueue.splice(workQueue.indexOf(building), 1);
                        break;
                    }
                }
            }
            tax += villager.happiness * population_1.PopulationTaxRevenue[villager.kind];
        }
        this.add({ gold: tax });
        // Spawn Villagers if everything ok, or evict unhappy ones
        if (notEnoughResources) {
            for (var _e = 0, _f = this.state.villagers; _e < _f.length; _e++) {
                var villager = _f[_e];
                if (villager.happiness <= 0) {
                    this.evict(villager);
                    madeChanges = true;
                }
            }
        }
        else {
            for (var _g = 0, _h = this.state.villagers; _g < _h.length; _g++) {
                var villager = _h[_g];
                if (villager.workplaceId === null) {
                    if (villager.happiness > 30) {
                        villager.happiness = Math.floor(villager.happiness * 0.95);
                    }
                }
                else {
                    villager.happiness = Math.min(100, 1.1 * villager.happiness + 1);
                }
            }
            for (var _j = 0, _k = this.state.buildings; _j < _k.length; _j++) {
                var building = _k[_j];
                if (building.kind === 'housing') {
                    this.spawn(building);
                    madeChanges = true;
                }
            }
        }
        if (madeChanges) {
            this.registerChanges();
        }
        if (notEnoughResources) {
            this.grantFreeResources();
        }
        this.applyCaps();
    };
    VoxVille.prototype.getTileBuildingOptions = function (tile) {
        var options = [];
        if (tile.buildingId != null) {
            return options;
        }
        for (var _i = 0, _a = this.buildings; _i < _a.length; _i++) {
            var building = _a[_i];
            if (building.meetsRequirements(tile)) {
                options.push(building.getConstructionOption(tile));
            }
        }
        return options;
    };
    //Mutagens
    VoxVille.prototype.build = function (tile, option) {
        var building = this.makeBuilding(tile, option);
        if (this.subtract(option.buildingCost)) {
            this.state.buildings.push(building);
            tile.buildingId = building.id;
            this.registerChanges();
            this.distributeWaterCapacity();
            return true;
        }
        return false;
    };
    VoxVille.prototype.demolish = function (tile) {
        if (tile.buildingId === null) {
            return;
        }
        var building = this.getBuilding(tile.buildingId);
        tile.buildingId = null;
        var refund = types_1.multiplyResourceManifest(0.6, building.buildingCost);
        this.add(refund);
        for (var _i = 0, _a = building.villagerIds; _i < _a.length; _i++) {
            var villagerId = _a[_i];
            var villager = this.getVillager(villagerId);
            if (building.kind === 'housing') {
                this.evict(villager, false);
            }
            else {
                villager.workplaceId = null;
            }
        }
        var idx = this.state.buildings.indexOf(building);
        this.state.buildings.splice(idx, 1);
        this.registerChanges();
        this.distributeWaterCapacity();
    };
    return VoxVille;
}(voxVilleBase_1.VoxVilleBase));
exports.VoxVille = VoxVille;
