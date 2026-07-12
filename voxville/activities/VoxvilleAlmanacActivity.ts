import {RollActivity} from "@voxmate/orc/RollActivity";
import {Actor} from "@voxmate/voxmate";
import {Rolodex} from "@voxmate/orc/rolodex";

export class VoxvilleAlmanacActivity extends RollActivity {

    private rule(dex: Rolodex, name: string, ...texts: string[]) {
        dex.add(name, async () => {
            await this.roll(...texts).setActor(Actor.DynamicInformational).run({autoskip: true});
        });
    }

    protected async run(): Promise<void | any> {
        const dex = this.roll();

        dex.add("General Rules", async () => {

            const sub = this.roll();

            this.rule(sub, "Goal of the Game",
                "The goal of Voxville is to build a village, full of happy inhabitants without any enemies disturbing their lives."
            );

            this.rule(sub, "Gestures",
                "The map area of Voxville is arranged in several 3 by 3 grids. To learn more about navigation grids, visit the second tutorial in Voxmates help menu."
            );

            this.rule(sub, "Map Rules",
                "Your village is located on a map that is a 3 by 3 grid of regions.",
                "At the start of your game, you will unlock one of the 9 regions.",
                "More regions can be unlocked later in the game with gold.",
                "Double tapping a region opens a map of districts in that region, " +
                "again presented in a grid of 3 by 3 districts.",
                "Each district has a type: waters, grasslands, plains, forests or mountains.",
                "Different types of districts can host certain types of buildings.",
                "For example, you can not build a fishery in the mountains or a lumber mill on a grassland.",
                "Each district also has 2 values: life and water.",
                "The higher the value, the more productive the building in that district is.");

            await sub.run();
        });

        dex.add("Buildings", async () => {
            const sub = this.roll();

            this.rule(sub, "General",
                "There are 3 main types of buildings, like housing, supportive and production buildings.",
                "Each building costs you gold and some type of resource.",
                "Buildings can be upgraded with additional production power or storage capacity."
            );

            this.rule(sub, "Housing buildings",
                "In order for your villagers to move in, build housing buildings.",
                "Peasants live in huts, hovels and tree houses, that can be built on different types of districts.",
                "Once your level is increased, new kinds of villagers are ready to move into your village.",
                "They require new types of housing. Villagers will move in only to buildings that have enough life",
                "capacity in their district. Each Housing building increases your maximum gold capacity."
            );

            this.rule(sub, "Production Buildings",
                "Production buildings make various resources for the villagers as well as are a place to work at.",
                "Efficiency of these buildings depends on the amount of water and life of the district, " +
                "as well as number of employees. "
            );

            this.rule(sub, "Support Buildings",
                "Supportive buildings can increase or decrease either life or water value of surrounding districts.",
                "Some supportive buildings can also provide additional storage for resources.",
                "Sanctuary, holy place or forest grove.",
                "These buildings give extra life to adjacent districts which in turn, increases their productivity.",
                "Be careful of Deadly Stonehenge, though - mountains can be so unpredictable sometimes!");

            this.rule(sub, "Water providing buildings",
                "You can build wells on grasslands, plains and forests to increase their water capacity.",
                "The more water capacity some buildings have the more productive they are."
            );

            this.rule(sub, "Gold Capacity Buildings",
                "Once you see that there is not enough storage room for all the gold that your villagers pay you, " +
                "build a storage pile - building, that is quite expensive to keep, but that gives you so much needed " +
                "additional gold capacity to move on in a game.");

            await sub.run();
        });


        this.rule(dex, "Villagers",
            "There are peasants, craftsmen and workers who can move into your village once you’ve reached a particular level.",
            "When they are employed and have all needed resources, they pay you taxes - this is how you gather gold.",
            "Villagers require common and luxury resources.",
            "Once all their required resources are depleted, they become unhappy and leave your village.",
            "The more resources you provide them, the happier they are and the more taxes they pay you as a gratitude."
        );

        await dex.run();
    }

}