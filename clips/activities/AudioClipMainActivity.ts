import {RichActivity} from "@voxmate/orc/RichActivity";
import {Sound} from "@voxmate/voxmate";
import {ClipsSettings} from "../voxlet.types";

function getName(idx: number, str: string) {
    try {
        const regex = /\.com\/s\/.*?\/(.*)\./gm;
        let m;

        while ((m = regex.exec(str)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }

            return decodeURIComponent(m[1]).toLowerCase().replace(/[^a-z0-9]/gi, " ");
        }
    } catch (e) {
        return null;
    }

    return null;
}

function getDownloadURL(url: string) {
    return url.replace("https://www.dropbox.com/", "https://dl.dropboxusercontent.com/");
}

function allSounds(): string[] {
    const values: string[] = [];
    for (let value in Sound) {
        if (typeof Sound[value] === 'number' && value !== "StopSounds") {
            values.push(value);
        }
    }
    return values;

}

export class AudioClipMainActivity extends RichActivity {
    protected async run(): Promise<void | any> {

        const dex = this.roll();

        dex.add("Load Files From the Portal", async () => {

            const settings = await this.getVoxletSettings(true) as ClipsSettings;
            const files = settings.urls.split("\n");

            if (files.length === 0) {
                await this.sayDynamicInfo("Go add some files in the portal, you dolt");
                return;
            }

            const fileDex = this.roll();
            for (let i = 0; i < files.length; i++) {
                let filename = files[i];
                const name = getName(i, filename);
                fileDex.add(name, async () => {
                    const url = getDownloadURL(filename);
                    await this.exec(new class extends RichActivity {
                        protected async run(): Promise<void | any> {
                            const controller = await this.playInBackground(url);
                            await controller.done();
                        }
                    });
                });
            }

            await fileDex.run();
        });

        dex.add("Try Existing Sound Effects", async () => {
            const sounds = allSounds();
            const soundDex = this.roll();
            let lastSaid = "";
            for (let sound of sounds) {
                soundDex.add(async () => {
                    if (sound != lastSaid) {
                        lastSaid = sound;
                        await this.sayDynamicInfo(sound);
                    }
                }, async () => {
                    const s = Sound[sound];
                    this.sound(s);
                });
            }
            await soundDex.run();
        });

        await dex.run();
    }
}