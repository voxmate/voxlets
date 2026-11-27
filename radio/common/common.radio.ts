import {RadioSettings} from "../voxlet.types";

export interface IStationDescriptor {
    id: string;
    name: string;
    description: string;
}

export interface IStation extends IStationDescriptor {
    id: string;
    name: string;
    description: string;
    url: string;
    group: string;
    isPlaylist?: boolean;
}

export interface IStationGroup {
    name: string;
    stations: IStation[];
}

export interface IRadioSettings extends RadioSettings {
    stations: IStation[];
}

export interface IFavoriteStations {
    freeStations: IStation[];
    stationGroups: IStationGroup[];
}

export const RestartRadio = Symbol();