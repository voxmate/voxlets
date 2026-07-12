import {formatAmount, unpack} from "./utility/utility";
import {
    createPopulationManifest,
    IPopulationManifest,
    IResourceManifest
} from "../game/types";
import {VoxvilleUIBaseActivity} from "./VoxvilleUIBaseActivity";


export class VoxvilleResourceOverviewActivity extends VoxvilleUIBaseActivity<any> {

    protected async run() {

        const trackedResources = this.getTrackedResources();
        const rolodex = this.roll();

        for (let resource of Object.keys(trackedResources)) {
            rolodex.add(async () => {
                const amount = this.vv.game.resources[resource];
                const cap = this.vv.calculateResourceCap(resource as keyof IResourceManifest);
                let resourceString = formatAmount(amount) + " " + resource;
                if (amount === cap && amount > 0) {
                    resourceString += " maxed out";
                } else {
                    if (cap > 0)
                        resourceString += " out of maximum " + formatAmount(cap);
                }
                return resourceString
            });
        }

        const trackedVillagers = createPopulationManifest(this.vv.populationManifest);
        for (let kind of Object.keys(trackedVillagers)) {
            if (!trackedVillagers[kind]) {
                delete trackedVillagers[kind];
            }
        }


        const hapiness = this.vv.getVillagerAverageHappinessManifest();

        for (let kind of Object.keys(trackedVillagers)) {
            rolodex.add(async () => {

                const count = this.vv.populationManifest[kind];
                return count + " " + kind;
            }, async () => {

                const villagerDetailsRoll = this.roll();

                const employed = this.vv.employmentManifest[kind];
                if (employed > 0) {
                    villagerDetailsRoll.add(`${employed} ${kind} are working`);
                } else {
                    villagerDetailsRoll.add(`no ${kind} are working`);
                }

                let happinessState = "";
                const vh = hapiness[kind];

                if (vh < 20) {
                    happinessState = "very angry"
                } else if (vh < 30) {
                    happinessState = "unhappy"
                } else if (vh < 60) {
                    happinessState = "content"
                } else if (vh < 80) {
                    happinessState = "happy"
                } else if (vh < 100) {
                    happinessState = "ecstatic"
                }

                villagerDetailsRoll.add(kind + " are " + happinessState + " about their living conditions");
                const totalConsumption = this.vv.getVillagerConsumption(kind as keyof IPopulationManifest);
                villagerDetailsRoll.add(kind + " would consume " + unpack(totalConsumption) + " per turn");

                await villagerDetailsRoll.run();
            });
        }

        await rolodex.run({isDynamic: true});
    }

}