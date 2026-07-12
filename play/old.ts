import {Activity, Orchestrator} from "@voxmate/orc/orc";
import voxmate, {ResourceId, Sound} from "@voxmate/voxmate";
import {CalibreApiService} from "./CalibreApiService";
import {formatPhoneNumber} from "@voxmate/voxmate/utility/strings";
import {RichActivity} from "@voxmate/orc/RichActivity";
import {SmartStaticListActivity} from "@voxmate/orc/SmartListActivity";



class TestActivity extends RichActivity {

    get calibre(): CalibreApiService {
        return this[CalibreApiService.inject];
    }

    async showImage(fileResourceId: ResourceId) {
        const ok = await this.wrap(voxmate.vision.showImage(fileResourceId));
        if (!ok) {
            this.sound(Sound.Bad);
            await this.sayDynamicInfo("Unable to open image");
        }
    }

    async run(): Promise<void | any> {

        const dex = this.roll();

        dex.add("Hint sound", async () => {
            this.sound(Sound.Hint);
        });

        dex.add("Tutorial Part 3", async () => {
            await this.goto("tutorial", 3);
        });

        dex.add("Demo Crash", async () => {
            throw new Error("TEST CRASH");
        });

        dex.add("Scan Text", async () => {
            const scan = await this.scanText();
            if (scan) {
                const text = scan.blocks.map(it => it.text);
                await this.readLong(text);
            }
        });

        dex.add("Stream Test", async () => {
            const url = "https://22223.live.streamtheworld.com/WCVEFM.mp3";
            const playerId = await this.wrap(voxmate.audio.player.init(url, true, false, false));
            await this.wrap(voxmate.audio.player.prep(playerId));

            const task = await this.wrap(voxmate.audio.player.play(playerId));
            await this.editField();
        });

        dex.add("Fork", async () => {
            await this.goto("fourcolors", {
                "server": "ws://52204690f3b7.eu.ngrok.io/socket",
                "roomId": "dev-room-test-1"
            });
        });

        dex.add("Test Dialpad", async () => {
            const value = await this.editDialPadField();
            if (value)
                await this.sayDynamicInfo(formatPhoneNumber(value));
        });

        dex.add("Player Test", async () => {

        });

        dex.add("Diablo Test", async () => {
            const text = "Chris Metzen, a co-creator of Blizzard franchise Diablo who left the company in 2016, said: \"We failed, and I'm sorry... to all of you at Blizzard -- those of you I know and those of you whom I've never met -- I offer you my very deepest apologies for the part I played in a culture that fostered harassment, inequality, and indifference.\"";
            const splits = voxmate.utility.splitIntoSentences(text);
            console.log(splits);
            await this.sayDynamicContent(text);
        });

        dex.add("Annotation Test", async () => {

            const blocks = [
                "Hi Gleb, would you mind giving me a ring at 56 192 192, " +
                "or rather let's watch https://www.youtube.com/watch?v=VSqdBotRGG8"
            ];

            await this.readLong(blocks);
        });

        dex.add("Show Image", async () => {
            const url = "https://images.unsplash.com/photo-1452827073306-6e6e661baf57?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&dl=leonardo-wong-7pGehyH7o64-unsplash.jpg&w=1920";
            const image = await this.freeze(this.wrap(voxmate.filestore.save(url, false, {}, "image")));
            await this.showImage(image);
        });

        dex.add("Show Image Fail", async () => {
            const url = "https://cdn.voxmate.net/voxlets/system-debug/play/817/main.js";
            const image = await this.freeze(this.wrap(voxmate.filestore.save(url, false, {}, "code")));
            await this.showImage(image);
        });

        dex.add("Show QR Code", async () => {
            const code = localStorage.getItem("code");
            await this.wrap(voxmate.vision.showQRCode(code));
        }).showWhen(async () => !!localStorage.getItem("code"));

        dex.add("Capture QR Code", async () => {
            const code = await this.scanQRCode();
            {
                console.log("QRCODE", code);
                localStorage.setItem("code", code.data);

                if (code.type == "link")
                    await this.openURL(code.link.url, code.link.title);

                if (code.type == "phone")
                    await this.callPhone(code.phone);
            }
        });

        dex.add("Remove QR Code", async () => {
            localStorage.removeItem("code");
        }).showWhen(async () => !!localStorage.getItem("code"));

        await dex.run();
    }
}

export async function mainold() {

    type Item = {
        key: string,
        name: string;
    }

    const list: Item[] = [{
        key: "1",
        name: "bbc"
    }, {
        key: "2",
        name: "cnn"
    }, {
        key: "3",
        name: "cnn2"
    }, {
        key: "4",
        name: "postimees"
    }];


    class SmartListTest extends SmartStaticListActivity<Item> {
        getItemKey(item: Item): string {
            return item.key;
        }

        getItemLabel(item: Item): string {
            return item.name;
        }

        async openItem(item: Item) {
            await this.sayDynamicContent("Open " + item.name);
        }
    }

    class Populator extends Activity {
        protected async run(): Promise<any> {
            await this.exec(new SmartListTest(list, "ns1", {collectionName: "News"}));
        }
    }

    // await new Orchestrator().startWithServices(Populator);



    await new Orchestrator().startWithServices(Populator);
}