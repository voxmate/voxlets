import {RollActivity} from "../orc/RollActivity";
import {INavGridLocation, NavGrid} from "./NavGrid";
import voxmate, {Gesture, UserInput, Sound} from "../voxmate";

export abstract class NavigatorActivity<T = any> extends RollActivity<T> {
    private readonly ng: NavGrid;

    protected constructor(readonly width: number, readonly height: number, stepToCenter: (boolean | INavGridLocation) = true) {
        super();
        this.ng = new NavGrid(width, height);

        if (stepToCenter)
            if (typeof stepToCenter === "boolean")
                this.ng.stepToCenter();
            else this.ng.jump(stepToCenter);
    }

    abstract describeMapTile(i: number, j: number): Promise<void>;

    abstract descend(i: number, j: number): Promise<boolean>;

    async handleOtherInput(ui: UserInput): Promise<boolean> {
        return false;
    }

    async handleRepeatedBump(gesture: Gesture): Promise<void> {

    }

    async visit(i: number, j: number) {

    }

    jumpTo(i: number, j: number) {
        this.ng.jump({i: i, j: j});
    }

    protected override async run() {
        const ng = this.ng;
        await this.execOutsideNavigationalScope(async () => {

                let bump: INavGridLocation = null;
                let skipNextPrompt = false;

                while (this.isActive) {
                    let ui: UserInput = null;

                    if (skipNextPrompt) {
                        skipNextPrompt = false;
                    } else {
                        ui = this.getInterrupt();
                        if (ui === null) {
                            await this.visit(ng.i, ng.j);
                            ui = await this.asSayGroup(async () => await this.describeMapTile(ng.i, ng.j));
                        }
                    }

                    if (!ui) {
                        ui = await this.get();
                    }

                    if (ui.kind == "gesture" && ng.isSteppingGesture(ui.gesture)) {
                        ng.step(ui.gesture);
                        if (ng.isOutsideBounds) {
                            if (!bump || !ng.matches(bump)) {
                                voxmate.audio.sound(Sound.Separator);
                                bump = ng.loc;
                                ng.stepBackToGrid();
                            } else {
                                await this.handleRepeatedBump(ui.gesture);
                                return;
                            }
                        } else {
                            bump = null;
                        }

                    } else if (ui.kind == "gesture" && ui.gesture === Gesture.DoubleTap) {
                        skipNextPrompt = !!(await this.descend(ng.i, ng.j));
                    } else {
                        skipNextPrompt = await this.handleOtherInput(ui);
                        continue;
                    }

                    if (ng.isOutsideBounds)
                        ng.stepBackToGrid();
                }
            }
        );
    }
}