import {regexGetFirstGroup} from "./common";

export function findYoutubeVideoInUrl(url: string): string | null {
    const youtubeVideoRegex = /(?:youtube(?:-nocookie)?\.com\/(?:(?:v|e(?:mbed)?)\/|.*[?&]v=|[^\/]+\/.+\/)|youtu\.be\/)([^"&?\/ ]+)/ig;
    return regexGetFirstGroup(youtubeVideoRegex, url);
}

export function getDomainDescriptorFromUrl(url: string): string | null {
    const domainNameRegex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n?=]+)/im;
    return regexGetFirstGroup(domainNameRegex, url);
}