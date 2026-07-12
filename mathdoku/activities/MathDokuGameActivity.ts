import {IBackgroundSoundController, RollActivity} from "@voxmate/orc/RollActivity";
import {MathDokuDifficulty, MathDokuGame, MathDokuGameVictory, Region} from "./MathDokuGame";
import {NavigatorActivity} from "@voxmate/orc/navigation/NavigatorActivity";
import {Actor, Sound} from "@voxmate/voxmate";
import {MathDokuGameManager} from "../manager";
import {MathDokuHelpActivity} from "./MathDokuHelpActivity";
import {formatDuration} from "@voxmate/voxmate/utility/strings";
import {VoxletSettingsManager} from "@voxmate/orc/VoxletSettingsManager";
import {MathdokuSettings} from "../voxlet.types";

const decoder = {
    "A": "addition",
    "S": "subtraction",
    "D": "division",
    "M": "multiplication"
};

export class MathDokuGridActivity extends NavigatorActivity {

    get manager(): MathDokuGameManager {
        return this[MathDokuGameManager.inject];
    }

    private _music: IBackgroundSoundController;
    private _currentRegion: Region | null;
    private _previousRegion: Region | null;
    private _playMusic = true;
    private _settings: MathdokuSettings;

    protected async init(): Promise<void> {
        await super.init();
        this._settings = await this.manager.getOptions();
        this._playMusic = this._settings.playMusicInCages;
    }

    constructor(private readonly game: MathDokuGame) {
        super(game.size, game.size, false);
        this.onEnd(async () => {
            this.stopMusic();
        });
    }

    private buildDirectionDex(data: number[]) {
        const demo = this.roll();
        let pi;
        for (let i = 0; i < data.length; ++i) {
            const v = data[i];
            demo.add(async () => {
                const upDown = i === data.length - 1 && pi === 0;
                const downUp = i === 0 && pi === data.length - 1;
                if (upDown || downUp)
                    this.sound(Sound.SoftClick);
                pi = i;
                if (v !== null) {
                    await this.sayDynamicContent(v.toString());
                } else {
                    if (this._settings.announceEmptySpaces)
                        await this.sayDynamicContent("Not set");
                    this.sound(Sound.Empty);
                }
            });
        }

        return demo;
    }

    async describeMapTile(i: number, j: number) {

        const currentValue = this.game.getValue(i, j);
        if (currentValue === null) {
            this.sound(Sound.Empty);
            if (this._settings.announceEmptySpaces)
                await this.sayDynamicContent("Not set");
        } else {
            await this.sayDynamicContent(currentValue.toString());
        }

        const region = this.game.getRegion(i, j);
        if (region !== this._previousRegion) {
            let text = region.result.toString();
            const count = region.cells.length;
            if (count > 1)
                text += " by " + decoder[region.operation];

            if (count > 1)
                text += ` in ${count} spaces`;
            else text += " in one space";

            await this.sayDynamicInfo(text);
        }
    }

    async descend(i: number, j: number) {

        const roll = this.roll();
        for (let v = 1; v <= this.game.size; ++v)
            roll.add(`Set ${v}`, async () => {
                this.game.setValue(i, j, v);
                if (this.game.isWrong) {
                    this.sound(Sound.Bad);
                    await this.sayDynamicInfo("Your solution isn't quite right...");
                } else {
                    this.sound(Sound.Good);
                }

                roll.unwind();
            });

        if (this.game.getValue(i, j) !== null) {
            roll.add("Clear", async () => {
                this.game.setValue(i, j, null);
                this.sound(Sound.Good);
                roll.unwind();
            });
        }

        roll.add(async () => {
            await this.sayDynamicInfo("Check Column");
        }, async () => {
            await this.buildDirectionDex(this.game.getColumn(i)).run();
        });

        roll.add(async () => {
            await this.sayDynamicInfo("Check Row");
        }, async () => {
            await this.buildDirectionDex(this.game.getRow(j)).run();
        });

        await roll.run();
        return false;
    }

    private async switchMusic(color: number) {
        if (!this._playMusic)
            return;

        const resourceId = `~color_${color + 1}.mp3`;
        await this.stopMusic();
        this._music = await this.playInBackground(resourceId, {volume: 10});
    }

    private async stopMusic() {
        if (this._music) {
            await this._music.stop();
            this._music = null;
        }
    }

    async visit(i: number, j: number): Promise<any> {
        const region = this.game.getRegion(i, j);
        if (region !== this._currentRegion) {
            await this.switchMusic(region.color);
            if (this._currentRegion)
                await this.sound(Sound.SoftClick);
        }
        this._previousRegion = this._currentRegion;
        this._currentRegion = region;
    }
}

export class MathDokuMainActivity extends RollActivity {

    get manager(): MathDokuGameManager {
        return this[MathDokuGameManager.inject];
    }

    protected async init(): Promise<void> {
        await super.init();
        await this.preloadAssets();
    }

    async runGame() {

        const stopAutoSaving = this.setInterval(() => {
            this.manager.saveCurrentGame();
        }, 1000);

        const game = this.manager.game;
        try {
            await this.exec(new MathDokuGameActivity(game));
        } catch (e) {
            if (e instanceof MathDokuGameVictory) {
                stopAutoSaving();

                const score = this.manager.finishGame();
                await this.sayDynamicInfo("Congratulations, you've solved this MathDoku!");
                await this.sayDynamicInfo(`It only took you: ${formatDuration(game.getTicks() * 1000)}`);
                if (score.isHighScore) {
                    await this.sayDynamicInfo(`Congratulations, you have a new high score - ${score.score} points`);
                } else {
                    await this.sayDynamicInfo(`Your score is: ${score.score} points`);
                }
            }
        }
    }

    async help() {
        await this.exec(new MathDokuHelpActivity());
    }

    protected async run(): Promise<void | any> {
        const roll = this.roll().setActor(Actor.Content);

        const continueSolving = roll.add("Continue Solving", async () => {
            this.manager.loadGame();
            await this.runGame();
        }).showWhen(async () => this.manager.haveSaveGame);

        roll.add("Solve a new Puzzle", async () => {

            if (this.manager.haveSaveGame)
                if (!await this.confirm("Are you sure you want to erase your old game?"))
                    return;

            const sizeRoll = this.roll();
            for (let size = 3; size <= 6; ++size) {
                sizeRoll.add(`${size} by ${size} board`, async () => {
                    const difficultyRoll = this.roll();
                    difficultyRoll.add(async () => {
                            await this.sayInfo("Simple Mode");
                            await this.sayContent("In simple mode you only have plus and minus operators");
                        }
                        , async () => {
                            this.manager.newGame(size, MathDokuDifficulty.Reduced);
                            await this.runGame();
                            difficultyRoll.unwind();
                        });
                    difficultyRoll.add(async () => {
                        await this.sayInfo("Normal Mode");
                        await this.sayContent("In normal mode you have all the operators - plus, minus, times and division");
                    }, async () => {
                        this.manager.newGame(size, MathDokuDifficulty.Full);
                        await this.runGame();
                        difficultyRoll.unwind();
                    });
                    await difficultyRoll.run();
                    continueSolving.goto();
                });
            }
            await sizeRoll.run();
        });

        roll.add("My High-Score", async () => {
            if (this.manager.gamesPlayed > 0) {
                await this.sayDynamicInfo(`Your High-Score is ${this.manager.highScore} points`);
                await this.sayDynamicInfo(`Your have solved ${this.manager.gamesPlayed} Math-Dokus so far`);
            } else {
                await this.sayDynamicInfo(`You haven't solved any puzzles yet`);
            }
        });

        roll.add("How to Play", MathDokuHelpActivity);

        roll.add("Options", async () => {
            await this.exec(new VoxletSettingsManager());
        });

        roll.add("Clear all Game Data", async () => {
            if (await this.confirm()) {
                await this.sayDynamicInfo("Cleared all game data");
                localStorage.clear();
                this.quit();
            }
        });

        await roll.run();
    }


}

export class MathDokuGameActivity extends RollActivity {

    constructor(private readonly game: MathDokuGame) {
        super();
    }

    protected async run() {
        this.setInterval(() => this.game.tick(), 1000);

        const roll = this.roll().setActor(Actor.Informational);

        roll.add("Game Board", async () => {
            await this.exec(new MathDokuGridActivity(this.game));
        });

        roll.add("Restart the Game", async () => {
            if (await this.confirm()) {
                this.game.clearSolution();
                await this.sayDynamicContent("Cleared all cages");
            }
        });

        return roll.run();
    }
}