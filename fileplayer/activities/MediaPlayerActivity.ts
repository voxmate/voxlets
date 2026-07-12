import voxmate, {IMediaFile, IMediaFileFolder} from "@voxmate/voxmate";
import {RollActivity} from "@voxmate/orc/RollActivity";
import {BasePlayer, SeekPastZero} from "@voxmate/orc/player";
import {RichActivity} from "@voxmate/orc/RichActivity";

class ExternalPlayerActivity extends BasePlayer {
    constructor(private readonly file: IMediaFile) {
        super({seekPastZeroBehavior: SeekPastZero.SeekToStart});
    }

    protected getPlayerResourceId(): string {
        return this.file.resourceId;
    }
}

export class MediaFileBrowser extends RollActivity {
    constructor(private readonly folder: IMediaFileFolder) {
        super();
    }

    protected async run(): Promise<void | any> {
        const files = this.folder.files;
        const folders = this.folder.folders;

        if (folders.length === 0 && files.length === 0) {
            await this.sayInfo("No media files");
            return;
        }

        const dex = this.roll();
        for (let i = 0; i < folders.length; i++) {
            let folder = folders[i];
            dex.add(async () => {
                await this.sayDynamicInfo(folder.name);
                await dex.paginate(i, this.folder.folders.length, "Folder");
            }, async () => {
                await this.exec(new MediaFileBrowser(folder));
            });
        }

        for (let i = 0; i < files.length; i++) {
            let file = files[i];
            dex.add(async () => {
                const info = await this.wrap(voxmate.system.external.info(file.resourceId));
                await this.sayDynamicContent(file.title);

                if (info.artist)
                    await this.sayDynamicInfo(`by ${info.artist}`);

                await dex.paginate(i, files.length, "File");
            }, async () => {
                await this.exec(new ExternalPlayerActivity(file));
            });
        }

        await dex.run();
    }

}

export class MediaPlayerActivity extends RollActivity {

    private root: IMediaFileFolder;

    protected async init(): Promise<void> {
        await super.init();
        this.root = await this.wrap(voxmate.system.external.list());
    }

    protected async run() {
        await this.exec(new MediaFileBrowser(this.root));
    }
}

export class MediaPlayerStartActivity extends RichActivity {
    protected async run() {
        await this.guardPermissions({"storage": "Voxmate needs your permission to access media files on your device"});
        await this.exec(new MediaPlayerActivity());
    }
}