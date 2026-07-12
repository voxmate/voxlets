import {Activity} from "@voxmate/orc/orc";
import {Actor, Gesture} from "@voxmate/voxmate";

import * as blackjack from "engine-blackjack";

const actions = blackjack.actions as any;
const Game = blackjack.Game;

interface ICard {
    text: "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
    value: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 1;
    suite: "spades" | "diamonds" | "hearts" | "clubs";
    color: "R" | "B";
}

interface HandValue {
    hi: number,
    lo: number
}

interface AvailableActions {
    double: boolean,
    split: boolean,
    insurance: boolean,
    hit: boolean,
    stand: boolean,
    surrender: boolean
}

interface Hand {

    cards: ICard[],
    playerValue: HandValue,
    playerHasBlackjack: boolean,
    playerHasBusted: boolean,
    playerHasSurrendered: boolean,
    close: boolean,
    availableActions: AvailableActions

}

interface HandInfo {
    left: any | Hand,
    right: Hand
}

interface Rule {
    decks: number,
    standOnSoft17: boolean,
    double: string,
    doubleAfterSplit: boolean,
    split: boolean,
    surrender: boolean,
    insurance: boolean,
    showdownAfterAceSplit: boolean
}

interface SideBets {
    luckyLucky: boolean,
    perfectPairs: boolean,
    royalMatch: boolean,
    luckyLadies: boolean,
    inBet: boolean,
    MatchTheDealer: boolean
}

interface IGameState {

    hits: number,
    initialBet: number,
    finalBet: number,
    finalWin: number,
    wonOnRight: number,
    wonOnLeft: Number,
    stage: string,
    deck: ICard[],
    handInfo: HandInfo,
    history: Array<any>,
    availableBets: SideBets,
    sideBetsInfo: any,
    rules: Rule,
    dealerCards: ICard[],
    dealerValue: HandValue;

    dealerHoleCard?: ICard,
    dealerHasBlackjack: boolean,
    dealerHasBusted: boolean
}

export class PlayBlackJackActivity extends Activity {

    private game;
    private cash: number = 100;
    private bet: number = 10;
    private rulesAnnounceCount = 0;

    constructor() {
        super();
        this.cash = parseInt(localStorage.getItem("CASH") ?? "100");
    }

    startGame() {
        console.log("**** RESTART ****");
        this.game = new Game(null, {
            decks: 1,
            standOnSoft17: true,
            double: 'none',
            split: false,
            doubleAfterSplit: true,
            surrender: false,
            insurance: false,
            showdownAfterAceSplit: false
        });

        this.game.dispatch(actions.deal());
        this.cash -= this.bet;

        this.save();
    }

    printCards(cards: ICard[]) {
        if (cards) {
            const short = [];
            for (let card of cards) {
                short.push(card.text + card.suite[0].toUpperCase());
            }
            return short.join(" ");
        }
        return "-";
    }

    printValue(hand: Hand) {
        if (hand && hand.playerValue) {
            return hand.playerValue.hi + "/" + hand.playerValue.lo;
        }
        return "-";
    }

    printState() {

        const state = this.game.getState() as IGameState;

        console.log("DEALER", this.printCards(state.dealerCards), JSON.stringify(state["dealerValue"]));
        if (state.handInfo) {
            console.log("ME", this.printCards(state.handInfo.right.cards), this.printValue(state.handInfo.right));
            console.log("ACTIONS", JSON.stringify(state.handInfo.right.availableActions));
        }
        console.log("STATE", state.stage);
        if (state.stage === "done") {
            console.log("WIN", state.wonOnRight);
        }

        console.log("\n");
    }

    async help() {
        return [
            "This is a simple demo game of black jack.",
            "We made it to showcase Voxmate for 2018 Vision Village event in Solihull, UK"
        ];
    }

    private buildTotal(lo: number, hi: number): string {

        let s = "I have ";
        if (hi > 21)
            s += lo.toString();
        else s += hi.toString();

        return s;
    }

    private buildCardString(cards: ICard[], skip: number = 0): string[] {

        const nameMap = {"J": "Jack", "Q": "Queen", "K": "King", "A": "Ace"};

        const items: string[] = [];
        for (let i = 0; i < cards.length; ++i) {
            if (i < skip) continue;

            const card = cards[i];
            if (nameMap.hasOwnProperty(card.text)) {
                items.push(nameMap[card.text] + " of " + card.suite);
            } else {
                items.push(card.text + " of " + card.suite);
            }
        }

        return items;
    }

    get state() {
        return this.game.getState() as IGameState;
    }

    async describeState(skipMe: number, skipDealer: number, userFirst: boolean) {
        const state = this.state;
        const handInfo = state.handInfo.right;
        const dealerCards = state.dealerCards;
        const dealerValue = state.dealerValue;

        const myCards = this.buildCardString(handInfo.cards, skipMe);
        const myValue = this.buildTotal(handInfo.playerValue.lo, handInfo.playerValue.hi);
        const dealersCards = this.buildCardString(dealerCards, skipDealer);
        const dealersValue = this.buildTotal(dealerValue.lo, dealerValue.hi);

        if (userFirst) {
            if (myCards.length - skipMe)
                await this.saySkippingMultiple(Actor.Informational, ...myCards, myValue);

            if (dealerCards.length - skipDealer)
                await this.saySkippingMultiple(Actor.Content, ...dealersCards, dealersValue);
        } else {
            if (dealerCards.length - skipDealer)
                await this.saySkippingMultiple(Actor.Content, ...dealersCards, dealersValue);

            if (myCards.length - skipMe)
                await this.saySkippingMultiple(Actor.Informational, ...myCards, myValue);
        }
    }

    hit() {
        this.game.dispatch(actions.hit({position: "right"}));
    }

    stand() {
        this.game.dispatch(actions.stand({position: "right"}));
    }

    done() {
        return (this.game.getState() as IGameState).stage == "done";
    }

    save() {
        localStorage.setItem("CASH", this.cash.toString());
    }

    private async announceCash() {
        await this.sayDynamicContent(`You've got ${this.cash} dollars`);
    }

    protected async run() {

        await this.saySkippingContent("I'll be your dealer today");
        await this.announceCash();

        while (this.cash > 0) {

            await this.saySkippingContent(`Swipe down to place ${this.bet} dollar bet`);
            await this.get();

            this.startGame();

            let [myCount, dealerCount] = [0, 0];
            let stage = 0;

            do {

                await this.describeState(myCount, dealerCount, stage == 1);

                if (stage === 0)
                    stage = 1;

                dealerCount = this.state.dealerCards.length;
                myCount = this.state.handInfo.right.cards.length;


                if (this.state.dealerHasBlackjack) {
                    await this.saySkippingContent("I got blackjack!");
                    break;
                }

                if (this.state.handInfo.right.playerHasBlackjack) {
                    await this.saySkippingContent("You got blackjack");
                    break;
                }

                if (this.state.handInfo.right.playerHasBusted) {
                    await this.sayInfo("I am busted", {forwardInterrupt: true});
                }

                if (this.state.wonOnRight) {
                    await this.saySkippingContent("You won!");
                    break;
                }

                if (this.done()) {
                    break;
                }

                if (this.rulesAnnounceCount < 3) {
                    await this.saySkippingContent("Swipe up to stand, double tap to hit");
                    ++this.rulesAnnounceCount;
                }

                const ui = await this.get();
                if (ui.kind == "gesture") {

                    if (ui.gesture === Gesture.DoubleTap) {
                        this.hit();
                    }

                    if (ui.gesture === Gesture.Up) {
                        stage = 2;
                        this.stand();
                    }

                    if (ui.gesture === Gesture.Hat) {
                        await this.describeState(0, 0, stage == 1);
                    }
                }
            } while (this.isActive);

            if (this.state.wonOnRight) {
                this.cash += 2 * this.bet;
                this.save();
            } else {
                await this.saySkippingContent("I won this time.");
            }

            await this.announceCash();
        }

        await this.saySkippingContent(
            "You run out of cash buddy.",
            "Come back when you got some more");

        localStorage.clear();
    }
}