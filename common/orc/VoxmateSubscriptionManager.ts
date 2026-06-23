import {RichActivity} from "./RichActivity";
import voxmate, {Sound, SubscriptionOffer, SubscriptionStatus} from "../voxmate";

export class VoxmateSubscriptionManager extends RichActivity {

    offer: SubscriptionOffer;

    protected async init(): Promise<void> {
        await super.init();
        this.offer = await this.wrap(voxmate.system.subscriptions.getSubscriptionOffer());
    }

    protected async run() {

        const status = voxmate.system.subscriptions.getSubscriptionStatus(); // == SubscriptionStatus.Unsubscribed

        if (status == SubscriptionStatus.Unknown) {
            await this.sayContent("Voxmate can't determine your current subscription status. Maybe you are not connected to the internet");
            return;
        }

        if (status == SubscriptionStatus.Subscribed) {
            await this.sayContent("Thank you for being subscribed. Your contribution makes continuous Voxmate development possible.");
        }

        const dex = this.roll();

        if (status == SubscriptionStatus.Unsubscribed) {
            await this.asSayGroup(async () => {
                await this.sayInfo(this.offer.offer);
                await this.sayContent(this.offer.promo);
            });

            for (let sku of this.offer.skus) {
                dex.add(async () => {
                    await this.sayInfo(sku.name);
                    await this.sayContent(sku.assistiveText);
                }, async () => {
                    if (await this.confirmVisualWarning("show Google Play subscription dialog")) {
                        const gotSubscription = await this.wrap(voxmate.system.subscriptions.subscribe(sku.sku));
                        if (gotSubscription) {
                            await this.sound(Sound.Good);
                            await this.sayContent("Your subscription is now active. Thank you for supporting us!");
                            await this.sayContent("Try setting Voxmate as your launcher or one of our high-quality voice packs.");
                            dex.unwind();
                        } else {
                            await this.sayContent("Unable to complete subscription.");
                        }
                    }
                });
            }
        }

        dex.add("Manage your Google Play Subscriptions", async () => {
            if (await this.confirmVisualWarning("open Google Play subscriptions page")) {
                await this.wrap(voxmate.system.subscriptions.manage());
                dex.unwind();
            }
        });

        await dex.run();
    }
}