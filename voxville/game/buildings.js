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
var Building = /** @class */ (function () {
    function Building(code, vv) {
        this.code = code;
        this.vv = vv;
    }
    Building.prototype.getUpgradeOptions = function (building) {
    };
    return Building;
}());
exports.Building = Building;
var Huts = /** @class */ (function (_super) {
    __extends(Huts, _super);
    function Huts(vv) {
        return _super.call(this, types_1.BuildingCode.Huts, vv) || this;
    }
    Huts.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Huts',
            kind: 'housing',
            buildingCost: types_1.createResourceManifest({ gold: 500, wood: 5 }),
            workerCapacity: types_1.createPopulationManifest(),
            housingCapacity: types_1.createPopulationManifest({ peasant: 30 }),
            resourceCapacity: types_1.createResourceManifest({ gold: 100 }),
            buildTime: 2
        };
    };
    Huts.prototype.getConsumptionManifest = function (building) {
        return null;
    };
    Huts.prototype.getProductionManifest = function (building) {
        return null;
    };
    Huts.prototype.meetsRequirements = function (tile) {
        return tile.kind == 'plains';
    };
    return Huts;
}(Building));
var WoodCuttersHut = /** @class */ (function (_super) {
    __extends(WoodCuttersHut, _super);
    function WoodCuttersHut(vv) {
        return _super.call(this, types_1.BuildingCode.WoodCuttersHut, vv) || this;
    }
    WoodCuttersHut.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Woodcutter\'s Hut',
            kind: 'production',
            buildingCost: types_1.createResourceManifest({ gold: 250 }),
            workerCapacity: types_1.createPopulationManifest({ peasant: 10, craftsmen: 2 }),
            housingCapacity: types_1.createPopulationManifest(),
            resourceCapacity: types_1.createResourceManifest({ wood: 10 }),
            buildTime: 4
        };
    };
    WoodCuttersHut.prototype.getConsumptionManifest = function (building) {
        return null;
    };
    WoodCuttersHut.prototype.getProductionManifest = function (building) {
        var tile = this.vv.getTile(building.i, building.j);
        return { wood: 3 + Math.floor(Math.pow(tile.waterCapacity * tile.lifeCapacity, 0.3)) };
    };
    WoodCuttersHut.prototype.meetsRequirements = function (tile) {
        return tile.kind == 'forests';
    };
    return WoodCuttersHut;
}(Building));
var HuntersLodge = /** @class */ (function (_super) {
    __extends(HuntersLodge, _super);
    function HuntersLodge(vv) {
        return _super.call(this, types_1.BuildingCode.HuntersLodge, vv) || this;
    }
    HuntersLodge.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Hunters\'s Lodge',
            kind: 'production',
            buildingCost: types_1.createResourceManifest({ gold: 500, wood: 4 }),
            workerCapacity: types_1.createPopulationManifest({ peasant: 10, craftsmen: 2 }),
            housingCapacity: types_1.createPopulationManifest(),
            resourceCapacity: types_1.createResourceManifest({ meat: 20 }),
            buildTime: 4
        };
    };
    HuntersLodge.prototype.getConsumptionManifest = function (building) {
        return null;
    };
    HuntersLodge.prototype.getProductionManifest = function (building) {
        var tile = this.vv.getTile(building.i, building.j);
        return { meat: 3 + (tile.waterCapacity / 2) };
    };
    HuntersLodge.prototype.meetsRequirements = function (tile) {
        return tile.kind == 'forests';
    };
    return HuntersLodge;
}(Building));
var ForagingShack = /** @class */ (function (_super) {
    __extends(ForagingShack, _super);
    function ForagingShack(vv) {
        return _super.call(this, types_1.BuildingCode.ForagingShack, vv) || this;
    }
    ForagingShack.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Foraging Shack',
            kind: 'production',
            buildingCost: types_1.createResourceManifest({ gold: 250, wood: 5 }),
            workerCapacity: types_1.createPopulationManifest({ peasant: 10, craftsmen: 2 }),
            housingCapacity: types_1.createPopulationManifest(),
            resourceCapacity: types_1.createResourceManifest({ berries: 10 }),
            buildTime: 5
        };
    };
    ForagingShack.prototype.getConsumptionManifest = function (building) {
        return null;
    };
    ForagingShack.prototype.getProductionManifest = function (building) {
        var tile = this.vv.getTile(building.i, building.j);
        return { berries: 3 + Math.floor(Math.pow(tile.waterCapacity * tile.lifeCapacity, 0.3)) };
    };
    ForagingShack.prototype.meetsRequirements = function (tile) {
        return tile.kind == 'forests';
    };
    return ForagingShack;
}(Building));
var StrawberryFarm = /** @class */ (function (_super) {
    __extends(StrawberryFarm, _super);
    function StrawberryFarm(vv) {
        return _super.call(this, types_1.BuildingCode.StrawberryFarm, vv) || this;
    }
    StrawberryFarm.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Strawberry Farm',
            kind: 'production',
            buildingCost: types_1.createResourceManifest({ wood: 20 }),
            workerCapacity: types_1.createPopulationManifest({ peasant: 10, craftsmen: 2 }),
            housingCapacity: types_1.createPopulationManifest(),
            resourceCapacity: types_1.createResourceManifest({ berries: 10 }),
            buildTime: 5
        };
    };
    StrawberryFarm.prototype.getConsumptionManifest = function (building) {
        return { wood: 2 };
    };
    StrawberryFarm.prototype.getProductionManifest = function (building) {
        var tile = this.vv.getTile(building.i, building.j);
        return { berries: 3 + Math.floor(Math.pow(tile.waterCapacity * tile.lifeCapacity, 0.3)) };
    };
    StrawberryFarm.prototype.meetsRequirements = function (tile) {
        return tile.kind == 'plains';
    };
    return StrawberryFarm;
}(Building));
var DrinkingWell = /** @class */ (function (_super) {
    __extends(DrinkingWell, _super);
    function DrinkingWell(vv) {
        return _super.call(this, types_1.BuildingCode.DrinkingWell, vv) || this;
    }
    DrinkingWell.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Drinking Well',
            kind: 'production',
            buildingCost: types_1.createResourceManifest({ gold: 100, wood: 5 }),
            workerCapacity: types_1.createPopulationManifest({ peasant: 5 }),
            housingCapacity: types_1.createPopulationManifest(),
            resourceCapacity: types_1.createResourceManifest({ water: 30 }),
            buildTime: 5
        };
    };
    DrinkingWell.prototype.getConsumptionManifest = function (building) {
        return { gold: 10 };
    };
    DrinkingWell.prototype.getProductionManifest = function (building) {
        var tile = this.vv.getTile(building.i, building.j);
        return { water: 5 + Math.sqrt(tile.waterCapacity) };
    };
    DrinkingWell.prototype.meetsRequirements = function (tile) {
        return tile.kind == 'plains' || tile.kind == 'grasslands';
    };
    return DrinkingWell;
}(Building));
var Shrine = /** @class */ (function (_super) {
    __extends(Shrine, _super);
    function Shrine(vv) {
        return _super.call(this, types_1.BuildingCode.Shrine, vv) || this;
    }
    Shrine.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Shrine',
            kind: 'production',
            buildingCost: types_1.createResourceManifest({ gold: 100, wood: 5 }),
            workerCapacity: types_1.createPopulationManifest({ peasant: 5 }),
            housingCapacity: types_1.createPopulationManifest(),
            resourceCapacity: types_1.createResourceManifest(),
            buildTime: 5
        };
    };
    Shrine.prototype.getConsumptionManifest = function (building) {
        return { gold: 10 };
    };
    Shrine.prototype.getProductionManifest = function (building) {
        return null;
    };
    Shrine.prototype.meetsRequirements = function (tile) {
        return tile.kind == 'plains';
    };
    return Shrine;
}(Building));
var Bank = /** @class */ (function (_super) {
    __extends(Bank, _super);
    function Bank(vv) {
        return _super.call(this, types_1.BuildingCode.Bank, vv) || this;
    }
    Bank.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Bank',
            kind: 'production',
            buildingCost: types_1.createResourceManifest({ gold: 1000, wood: 5 }),
            workerCapacity: types_1.createPopulationManifest({ peasant: 50 }),
            housingCapacity: types_1.createPopulationManifest(),
            resourceCapacity: types_1.createResourceManifest({ gold: 10000 }),
            buildTime: 5
        };
    };
    Bank.prototype.getConsumptionManifest = function (building) {
        return { gold: 100 };
    };
    Bank.prototype.getProductionManifest = function (building) {
        return null;
    };
    Bank.prototype.meetsRequirements = function (tile) {
        return tile.kind == 'plains';
    };
    return Bank;
}(Building));
var Warehouse = /** @class */ (function (_super) {
    __extends(Warehouse, _super);
    function Warehouse(vv) {
        return _super.call(this, types_1.BuildingCode.Warehouse, vv) || this;
    }
    Warehouse.prototype.getConstructionOption = function (tile) {
        return {
            code: this.code,
            name: 'Warehouse',
            kind: 'production',
            buildingCost: types_1.createResourceManifest({ gold: 1000, wood: 40, water: 30 }),
            workerCapacity: types_1.createPopulationManifest({ peasant: 20 }),
            housingCapacity: types_1.createPopulationManifest(),
            resourceCapacity: types_1.createResourceManifest({ berries: 20, water: 20, meat: 20, wood: 20 }),
            buildTime: 5
        };
    };
    Warehouse.prototype.getConsumptionManifest = function (building) {
        return { gold: 100, water: 50 };
    };
    Warehouse.prototype.getProductionManifest = function (building) {
        return null;
    };
    Warehouse.prototype.meetsRequirements = function (tile) {
        return tile.kind === 'plains';
    };
    return Warehouse;
}(Building));
function getAllBuildings(vv) {
    return [
        new Huts(vv),
        new WoodCuttersHut(vv),
        new ForagingShack(vv),
        new StrawberryFarm(vv),
        new DrinkingWell(vv),
        new HuntersLodge(vv),
        new Bank(vv),
        new Shrine(vv),
        new Warehouse(vv)
    ];
}
exports.getAllBuildings = getAllBuildings;
