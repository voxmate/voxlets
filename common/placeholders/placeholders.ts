import {RollActivity} from "../orc/RollActivity";
import voxmate, {Actor} from "../voxmate";

export interface IPlaceholderConfig {
    ident: string;
    description: string;
    name?: string;
    feature?: string;
}

const VOTE_URL = "https://misc-dot-voxlet-sys.appspot.com/api/voting_booth";

class PlaceholderVote extends RollActivity {

    private votedAlready = false;
    private previousVote: number = null;
    private userId: string;

    constructor(private readonly voxletPrototype: string) {
        super();
    }

    protected async init(): Promise<void> {
        await super.init();

        const profile = await this.wrap(voxmate.system.profile());
        this.userId = profile.userId;

        const data = await this.httpPostJson(VOTE_URL, {
            action: "check",
            userId: this.userId,
            voxletPrototype: this.voxletPrototype
        });

        const result = JSON.parse(data.content) as { voted: boolean, power?: number };
        if (result.voted) {
            this.votedAlready = true;
            this.previousVote = result.power ?? 0;
        }
    }

    private async castVote(power: number) {
        await this.freeze(this.httpPostJson(VOTE_URL, {
            action: "vote",
            userId: this.userId,
            voxletPrototype: this.voxletPrototype,
            power: power
        }));
    }

    protected async run(): Promise<void | any> {
        const dex = this.roll().setActor(Actor.Content);

        let cast = false;

        const decoder = {
            0: "don't like it",
            1: "like it",
            2: "want it",
            3: "need it"
        };

        if (this.votedAlready) {
            await this.say("You've already voted, that you " + decoder[this.previousVote]);
            await this.say("But you can change your vote here.")
        }

        dex.add("I don't like it", async () => {
            await this.castVote(0);
            cast = true;
            dex.unwind();
        });

        dex.add("I like it", async () => {
            await this.castVote(1);
            cast = true;
            dex.unwind();
        });

        dex.add("I want it", async () => {
            await this.castVote(2);
            cast = true;
            dex.unwind();
        });

        dex.add("I need it", async () => {
            await this.castVote(3);
            cast = true;
            dex.unwind();
        });

        await dex.run();
        if (cast) {
            await this.say("Thank you. Your vote has been cast. You can change it later here. And check back soon for updates.");
        }
    }
}

export class PlaceholderActivity extends RollActivity {
    constructor(private readonly config: IPlaceholderConfig) {
        super();
    }

    protected async run(): Promise<void | any> {
        const name = this.config.name ?? this.config.ident;
        const feature = this.config.feature ?? "voxlet";

        await this.say(`We are still working on ${name}`);
        await this.say(`If you think this ${feature} will be useful to you, vote for it here, and we'll prioritize it.`);

        const dex = this.roll().setActor(Actor.Content);
        dex.add(`What is ${name} ${feature}?`, async () => {
            await this.say(this.config.description);
        });

        dex.add("Cast Your Vote", async () => {
            await this.exec(new PlaceholderVote(this.config.ident));
            dex.unwind();
        });

        await dex.run()
    }

}