import {LibriVoxMainActivity} from "./providers/librivox/LibriVoxActivities";
import {RollActivity} from "@voxmate/orc/RollActivity";

export class AudiobookLibraryChooserActivity extends RollActivity {

    async help() {
        return [
            "Audiobooks providers are organizations that have audiobooks available either for free, or via registering.",
            "We are working on adding more providers such as NLS Bard in the near future",
            "Swipe up and down to choose between audiobook providers, then swipe right to activate."
        ];
    }

    protected async run() {
        const dex = this.roll();
        dex.add("Librivox Audiobooks", async () => {
            voxmate.system.telemetry.inc("visit_librivox_audiobooks");
            await this.exec(new LibriVoxMainActivity());
        });
        dex.add("Calibre Audiobooks", async () => {
            voxmate.system.telemetry.inc("visit_calibre_audiobooks");
            await this.sayDynamicInfo("An update for Caliber Audiobooks is coming soon.");
        });
        await dex.run();
    }
}