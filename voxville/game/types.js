"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var BuildingCode;
(function (BuildingCode) {
    BuildingCode[BuildingCode["Huts"] = 0] = "Huts";
    BuildingCode[BuildingCode["WoodCuttersHut"] = 1] = "WoodCuttersHut";
    BuildingCode[BuildingCode["ForagingShack"] = 2] = "ForagingShack";
    BuildingCode[BuildingCode["StrawberryFarm"] = 3] = "StrawberryFarm";
    BuildingCode[BuildingCode["DrinkingWell"] = 4] = "DrinkingWell";
    BuildingCode[BuildingCode["HuntersLodge"] = 5] = "HuntersLodge";
    BuildingCode[BuildingCode["Bank"] = 6] = "Bank";
    BuildingCode[BuildingCode["Shrine"] = 7] = "Shrine";
    BuildingCode[BuildingCode["Warehouse"] = 8] = "Warehouse";
})(BuildingCode = exports.BuildingCode || (exports.BuildingCode = {}));
function createResourceManifest(partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ gold: 0, wood: 0, berries: 0, water: 0, meat: 0 }, partial);
}
exports.createResourceManifest = createResourceManifest;
function createPopulationManifest(partial) {
    if (partial === void 0) { partial = {}; }
    return __assign({ peasant: 0, craftsmen: 0 }, partial);
}
exports.createPopulationManifest = createPopulationManifest;
function multiplyResourceManifest(n, manifest) {
    var copy = createResourceManifest(manifest);
    for (var key in manifest) {
        copy[key] = n * manifest[key];
    }
    return copy;
}
exports.multiplyResourceManifest = multiplyResourceManifest;
function shuffle(array) {
    var _a;
    for (var i = array.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        _a = [array[j], array[i]], array[i] = _a[0], array[j] = _a[1];
    }
    return array;
}
exports.shuffle = shuffle;
function biasedChoice(map) {
    var rand = Math.random();
    var keys = Object.keys(map);
    var totalWeight = 0;
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        totalWeight += map[key];
    }
    var probabilities = [];
    for (var i = 0; i < keys.length; i++) {
        probabilities[i] = map[keys[i]] / totalWeight;
    }
    var cumulativeProb = 0;
    for (var i = 0; i < keys.length; i++) {
        cumulativeProb += probabilities[i];
        if (rand < cumulativeProb) {
            return keys[i];
        }
    }
    return keys[keys.length - 1];
}
exports.biasedChoice = biasedChoice;
