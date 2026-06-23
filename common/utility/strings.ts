import {IGeoLocation} from "../voxmate";
import {getDomainDescriptorFromUrl} from "./patterns";

const secondsFactor = 1000;
const minutesFactor = secondsFactor * 60;
const hoursFactor = minutesFactor * 60;
const daysFactor = hoursFactor * 24;

interface IDuration {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

const units = {
    "days": "day",
    "hours": "hour",
    "minutes": "minute",
    "seconds": "second"
};

function parseDuration(duration: number): IDuration {

    let remainingDuration = duration;

    const days = Math.floor(remainingDuration / daysFactor);
    remainingDuration = remainingDuration % daysFactor;

    const hours = Math.floor(remainingDuration / hoursFactor);
    remainingDuration = remainingDuration % hoursFactor;

    const minutes = Math.floor(remainingDuration / minutesFactor);
    remainingDuration = remainingDuration % minutesFactor;

    const seconds = Math.floor(remainingDuration / secondsFactor);

    return {
        days: days,
        hours: hours,
        minutes: minutes,
        seconds: seconds,
    };
}

export function formatDuration(durationInMilliseconds: number): string {
    const duration = parseDuration(durationInMilliseconds);

    if (durationInMilliseconds < 1000)
        return "0 seconds";

    const parts: string[] = [];

    function add(value: number, unit: string) {
        let ret = value + " " + unit + (value > 1 ? "s" : "");
        if (value > 0 && parts.length < 2)
            parts.push(ret);
    }

    for (let prop in duration)
        if (duration.hasOwnProperty(prop)) {
            const unit = (units as Record<string, string>)[prop];
            add((duration as unknown as Record<string, number>)[prop], unit);
        }

    const durationText = parts.join(" and ");
    if (durationText == "")
        return "0 seconds";

    return durationText;
}

export function formatPercent(number: number) {
    const percent = (number * 100).toFixed(0);
    return `${percent}%`;
}

export function capitalizeString(text: string): string {
    if (!text || text.length === 0) {
        return text;
    }
    return text.charAt(0).toUpperCase() + text.slice(1);
}

export function mult(singularForm: string, n: number, multipleForm: string | null = null): string {
    n = Math.abs(n);

    if (n == 1)
        return singularForm;

    if (multipleForm) return multipleForm;
    return singularForm + "s";
}

export function formatUrl(url: string): string {
    return `Link to ${getDomainDescriptorFromUrl(url)}`;
}

export function formatPhoneNumber(phoneNumber: string): string {
    return phoneNumber.split("").join(" ");
}

export function approximateDistanceInMeters(a: IGeoLocation, b: IGeoLocation) {

    const R = 6378137;

    function deg2rad(deg: number): number {
        return deg * Math.PI / 180.0;
    }

    function hav(x: number) {
        const h = Math.sin(x / 2);
        return h * h;
    }

    const aLat = deg2rad(a.latitude);
    const aLong = deg2rad(a.longitude);

    const bLat = deg2rad(b.latitude);
    const bLong = deg2rad(b.longitude);

    const ht = hav(bLat - aLat) + Math.cos(aLat) * Math.cos(bLat) * hav(bLong - aLong);
    return 2 * R * Math.asin(Math.sqrt(ht));
}

export function formatApproximateDistance(a: IGeoLocation, b: IGeoLocation, imperial: boolean): string {
    const dist = approximateDistanceInMeters(a, b);

    if (imperial) {
        const feet = 0.3048 * dist;
        const yards = feet / 3;
        const miles = feet / 5280;

        if (feet < 300)
            return `${feet.toFixed(0)} feet`;

        if (yards < 880) {
            const yardsFixed = yards.toFixed(0);
            return `${yardsFixed} yards`;
        }

        if (miles < 1) {
            const tenths = (miles * 10).toFixed(0);
            return `point ${tenths} miles`;
        }

        if (miles < 50)
            return `${(miles.toFixed(1))} miles`;

        return `${(miles.toFixed(0))} miles`;

    } else {

        if (dist < 100)
            return `${dist.toFixed(1)} meters`;

        if (dist < 1000)
            return `${dist.toFixed(0)} meters`;

        const km = (dist / 1000);
        if (km < 50)
            return `${km.toFixed(1)} kilometers`;

        return `${(km.toFixed(0))} kilometers`;
    }
}

interface IShortenStringOptions {
    suffix?: string;
    preserveWordBoundary?: boolean;
    separator?: string;
}

export function shortenString(text: string, maxLength: number, options: IShortenStringOptions = {}) {

    if (text.length <= maxLength)
        return text;

    if (maxLength <= 0)
        return "";

    const {
        suffix = ", etc.",
        preserveWordBoundary = true,
        separator = " "
    } = options;

    if (suffix.length > maxLength)
        return text.substr(0, maxLength);

    // Compute the index at which we have to cut the text
    const maxActualLength = maxLength - suffix.length;

    let index = maxActualLength;
    if (preserveWordBoundary) {
        let lastUsableWord = text.lastIndexOf(separator, maxActualLength + 1);
        index = lastUsableWord > 0 ? lastUsableWord : maxActualLength;
    }

    return text.substr(0, index) + suffix;
}