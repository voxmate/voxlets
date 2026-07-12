import {Ding, Loop, VoxvilleUIBaseActivity} from "./VoxvilleUIBaseActivity";
import {Activity} from "@voxmate/orc/orc";
import voxmate, {Gesture, Sound} from "@voxmate/voxmate";
import {INavGridLocation, NavGrid} from "@voxmate/orc/navigation/NavGrid";
import {IBackgroundLoopController} from "@voxmate/orc/RollActivity";
import {Rolodex} from "@voxmate/orc/rolodex";

export abstract class VoxvilleMapBaseActivity extends VoxvilleUIBaseActivity<any> {
    private backgroundMusic: IBackgroundLoopController;
    private ng = new NavGrid(3, 3).stepToCenter();

    protected constructor() {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();
        const loop = this.getLoop();
        const resource = `~loops/${loop}.wav`;
        this.backgroundMusic = await this.playLoopEffect(resource, 10);
    }

    abstract describeMapTile(i: number, j: number);

    abstract descend(i: number, j: number): Activity | Rolodex;

    abstract getDing(): Ding;

    abstract getLoop(): Loop;

    abstract jumpTo(): INavGridLocation | undefined;

    private async descendInternal() {
        await this.backgroundMusic.pause();

        const target = this.descend(this.ng.i, this.ng.j);
        if (target instanceof Rolodex)
            await target.run();
        else {
            await this.exec(target);
        }

        await this.backgroundMusic.resume();
        this.playSoundEffect(this.getDing());
    }

    protected async run(): Promise<void | undefined> {

        const ng = this.ng;
        this.playSoundEffect(this.getDing());

        await this.execOutsideNavigationalScope(async () => {

                let bump: INavGridLocation = null;
                let jumped = false;

                while (this.isActive) {

                    if (!jumped) {
                        const location = this.jumpTo();
                        if (location) {
                            jumped = true;
                            ng.jump(location);
                            await this.descendInternal();
                        }
                    }

                    let ui = this.getInterrupt();
                    if (ui === null) {
                        ui = await this.asSayGroup(async () => await this.describeMapTile(ng.i, ng.j));
                    }

                    if (!ui) {
                        ui = await this.get();
                    }

                    if (ui.kind != "gesture") {
                        bump = null;
                        continue;
                    }

                    if (ng.isSteppingGesture(ui.gesture)) {
                        ng.step(ui.gesture);
                        if (ng.isOutsideBounds) {
                            if (!bump || !ng.matches(bump)) {
                                voxmate.audio.sound(Sound.Separator);
                                bump = ng.loc;
                                ng.stepBackToGrid();
                            } else {
                                return;
                            }
                        } else {
                            bump = null;
                        }

                    } else if (ui.gesture === Gesture.DoubleTap) {
                        await this.descendInternal();
                        bump = null;
                    } else if (ui.gesture === Gesture.Hat) {
                        return;
                    }

                    if (ng.isOutsideBounds)
                        ng.stepBackToGrid();
                }
            }
        );
    }
}