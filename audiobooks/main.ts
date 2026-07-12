import {Orchestrator} from "@voxmate/orc/orc";
import {BookShelf} from "./BookShelf";
import {AudiobookLibraryChooserActivity} from "./activities/AudiobookLibraryChooserActivity";
import {ResourceCache} from "./ResourceCache";

export async function main() {
    await new Orchestrator()
        .startWithServices(AudiobookLibraryChooserActivity, BookShelf, ResourceCache)
}
