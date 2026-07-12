import {Orchestrator} from "@voxmate/orc/orc";
import {RichActivity} from "@voxmate/orc/RichActivity";


class ExampleActivity extends RichActivity {
    protected async run(): Promise<any> {
        await this.sayDynamicInfo("Hello world!");
    }
}

export async function main() {
    await new Orchestrator()
        .startWithServices(ExampleActivity);
}