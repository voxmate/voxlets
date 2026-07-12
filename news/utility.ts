import voxmate from "@voxmate/voxmate";

export function clean(text: string) {
    text = text.trim();
    text = text.replace(/”/g, "");
    text = text.replace(/“/g, "");
    text = text.replace(/\s+/g, ' ');
    text = text.trim();
    return text;
}


export function splitSentence(text: string): string[] {
    return voxmate.utility.splitIntoSentences(text).map((it: string) => it.trim());
}