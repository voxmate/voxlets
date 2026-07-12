import {RollActivity} from "@voxmate/orc/RollActivity";
import voxmate from "@voxmate/voxmate";

export class About extends RollActivity {
    constructor(private readonly text: string) {
        super();
    }

    protected async run(): Promise<void | any> {
        const dex = this.roll();
        const sentences = voxmate.utility.splitIntoSentences(this.text);
        for (let sentence of sentences)
            dex.add(sentence);

        return await dex.run({autoskip: true});
    }
}