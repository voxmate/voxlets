import {Activity} from "@voxmate/orc/orc";
import voxmate, {DeregisterFunction, Gesture, Sound, UserInput} from "@voxmate/voxmate";
import {GameRoomActivity} from "@voxmate/orc/GameRoomActivity";
import {RichActivity} from "@voxmate/orc/RichActivity";
import {clientRPC, RPCSocketOptions, subscribe} from "@voxmate/orc/RPCSocketActivity";
import {CancellationToken} from "@voxmate/orc/RPCUtility";
import {backendSocketUrl} from "@voxmate/orc/backend";
import {
    GameCenterServiceLauncher,
    IGameCenterPlayLaunch,
    IGameCenterServiceLaunch,
    IGameCenterServiceResult,
} from "@voxmate/orc/gamecenter";
import {AsyncAction} from "@voxmate/orc/types";
import {ControllablePromise} from "@voxmate/voxmate/utility/common";
import {mult} from "@voxmate/voxmate/utility/strings";
import {arrayToText, elementInArray, removeArrayElement} from "@voxmate/voxmate/utility/array";
import {randomIntegerMaxInclusive} from "@voxmate/voxmate/utility/random";

const FOURCOLORS_IDENT = "github.com/voxmate/voxlets/fourcolors";

function resolveSocketUrl(server: string | undefined, roomId: string): string {
    const encodedRoom = encodeURIComponent(roomId);
    if (!server) {
        return backendSocketUrl(FOURCOLORS_IDENT, `/ws/fourcolors/${encodedRoom}`);
    }
    if (/\/ws\/[^/]+\/?$/.test(server)) {
        return `${server.replace(/\/+$/, "")}/${encodedRoom}`;
    }
    return server;
}

type ColorType = "R" | "G" | "B" | "Y";
type CardType = "wild" | "wd4" | "skip" | "dr2" | "rev" | "num";

interface ICard {
    id: number;
    type: CardType;
    number?: number;
    color?: ColorType;
}

interface ITurnEnd {
    me: boolean; // true if it was my turn
    meNext: boolean; // true if my turn is next, if me and meNext then my turn continues
    changes: {
        pickedUp: ICard[];
        played: ICard | null;
    };
    nick: string;
    nextNick: string;
    kind: "card" | "draw" | "last";
    card: ICard | null;
    color?: ColorType;
    cards: number;
    forgotToConfirm: boolean;
}

const ColorMap: Record<ColorType, string> = {
    "R": "Red",
    "G": "Green",
    "B": "Blue",
    "Y": "Yellow"
};

interface IGameState {
    playing: boolean; // game state is otherwise undefined if playing == false (missing properties)
    turn: boolean; // true if it's my turn
    turnCount: number;
    cards: ICard[];
    top: ICard;
    color?: ColorType;
    opponents: {
        nick: string;
        cards: number;
        turn: boolean; // true if it's this player's turns
    }[];
}

interface Move {
    kind: "card" | "draw";
    cardId?: number;
}

enum SelectionKind {
    Card, DrawButton, LastCardButton
}

interface ISelection {
    card?: ICard;
    kind: SelectionKind;
}

interface IBareGameRoomConfig {
    server?: string;
    roomId: string;
    partyId?: string;
    matchTicket?: string;
    resultToken?: string;
    players?: Record<string, { nick: string }>;
    parameters?: any;
}

interface IFourColorsResult {
    type?: "clean" | "timeout" | "abandonment";
    winner?: string | null;
    moves?: number;
    scores?: Record<string, number>;
}

function getCardName(card: ICard): string {

    if (card.type == "wild")
        return "Wild";

    if (card.type == "wd4")
        return "Wild Draw Four";

    const color = card.color ? ColorMap[card.color] : "";
    if (card.type == "skip")
        return `${color} Skip Turn`;

    if (card.type === "dr2")
        return `${color} Draw Two`;

    if (card.type === "rev")
        return `${color} Reverse`;

    return `${color} ${card.number}`;

}

function cardDetailText(card: ICard): string {

    if (card.type == "wild")
        return "Play this card on top of any other, then chose a replacement color. Next opponent skips turn.";

    if (card.type == "wd4")
        return "Play this card on top of any other, when you have no other legal moves, then chose a replacement color. " +
            "Your opponent has to take 4 cards, and skip a turn.";

    const color = card.color ? ColorMap[card.color] : "";
    if (card.type == "skip")
        return `Play this card on top of any ${color} card. Your opponent has to skip their turn.`;

    if (card.type === "dr2")
        return `Play this card on top of any ${color} card. Your opponent has to pick up 2 cards, and skip their turn.`;

    if (card.type === "rev")
        return `Play this card on top of any ${color} card. Your opponent has to skip their turn.`;

    return `Play this card on top of any ${color} card, or a numbered card with value ${card.number}.`;

}

function describeCards(cards: ICard[]): string {
    if (cards.length == 0) return "nothing";
    return arrayToText(cards.map(getCardName));
}

const visitCurrentGestures = [Gesture.Up, Gesture.Right, Gesture.Left, Gesture.DoubleLeft, Gesture.DoubleRight, Gesture.Poke];

type GameStateUpdateFunction = (state: IGameState) => Promise<void>;

class QueryError extends Error {
    constructor(msg: string) {
        super(msg);
    }
}

class UniqueQuery<T> {
    private _promise: ControllablePromise<T> | null = null;

    constructor(readonly name: string) {
    }

    begin(cancel: CancellationToken | undefined = undefined): Promise<T> {

        if (this.onGoing)
            throw new QueryError(`Can't begin a new query(${this.name}), another query is still onGoing`);

        this._promise = new ControllablePromise<T>();

        if (cancel) {
            const cancelFn = () => {
                this._promise = null;
            };
            cancel.then(cancelFn, cancelFn);
        }

        return this._promise;
    }

    get onGoing() {
        return this._promise !== null;
    }

    end(value: T) {
        if (this.onGoing) {
            this._promise!.resolve(value);
            this._promise = null;
        } else {
            throw new QueryError(`Can't end a query(${this.name}) it's not onGoing`);
        }
    }
}

class GameSession {

    private readonly _ready = new ControllablePromise();
    private readonly _gameBegun = new ControllablePromise();
    private readonly _gameOver = new ControllablePromise();

    private _state!: IGameState;

    private _updater: GameStateUpdateFunction | null = null;

    private _play = new ControllablePromise<FourColorsPlayActivity>();
    private _confirmedLastTurn = -1; // Marks the turn when a confirmation's been made.

    readonly move = new UniqueQuery<Move>("player move");
    readonly confirmLast = new UniqueQuery<boolean>("confirm last");

    constructor(private readonly room: FourColorsGameRoom) {

    }

    async updateState(state: IGameState) {

        this._state = state;

        if (state.playing)
            this._ready.resolve();

        if (this._updater)
            await this._updater(state);
    }

    connect(play: FourColorsPlayActivity) {
        this._play.resolve(play);
    }

    markGameOver() {
        this._gameOver.resolve();
    }

    markGameStart() {
        this._gameBegun.resolve();
    }

    confirmLastCard(): boolean {

        if (this._confirmedLastTurn == this.state.turnCount)
            return true;

        if (!this.confirmLast.onGoing)
            return false;

        this.confirmLast.end(true);
        this._confirmedLastTurn = this.state.turnCount;
        return true;
    }

    async playerGetColor() {
        const play = await this._play;
        return play.getColor();
    }

    get state() {
        return this._state;
    }

    get isMyTurn() {
        return this.state.turn;
    }

    get ready() {
        return this._ready;
    }

    get gameOver() {
        return this._gameOver;
    }

    get begun() {
        return this._gameBegun;
    }

    async canPlayCard(card: ICard): Promise<boolean> {
        return this.room.canPlayCard(card.id);
    }

    async canDrawCard(): Promise<boolean> {
        return this.room.canDrawCard();
    }

    onUpdate(fn: GameStateUpdateFunction): DeregisterFunction {
        this._updater = fn;
        return () => {
            this._updater = null;
        };
    }
}

class FourColorsPlayActivity extends RichActivity {

    private leftBump = false;
    private position = 0;

    private fixedSelections: ISelection[] = [
        {kind: SelectionKind.DrawButton},
        {kind: SelectionKind.LastCardButton},
    ];

    constructor(private session: GameSession) {
        super();
    }

    private get state(): IGameState {
        return this.session.state;
    }

    private get cards(): ICard[] {
        if (!this.state) return [];
        if (!this.state.playing) return [];
        return this.state.cards;
    }

    private get isMyMove() {
        return this.session.move.onGoing;
    }

    private get isMyTurn() {
        return this.session.isMyTurn;
    }

    private get currentSelection(): ISelection {

        if (this.position < this.cards.length)
            return {
                card: this.cards[this.position],
                kind: SelectionKind.Card
            };

        const reduced = this.position - this.cards.length;
        return this.fixedSelections[reduced];
    }

    protected async init(): Promise<any> {
        await super.init();
        await this.preloadAssets();
    }

    private async visitGameState() {

        const top = this.state.top;
        let cardDescription = getCardName(top);

        if (this.state.color)
            cardDescription += ` with ${ColorMap[this.state.color]} Color`;
        cardDescription += " is on top";

        await this.sayDynamicInfo(cardDescription);

        for (const player of this.state.opponents) {
            let text = `${(player.nick)} has ${(player.cards)} ${mult("card", player.cards)} left`;
            if (player.turn)
                text += " and it's their turn";
            await this.sayDynamicInfo(text);
        }

        const cards = this.state.cards.length;
        let text = `You have ${(cards)} ${mult("card", cards)} left`;
        if (this.state.turn)
            text += " and it's your turn";

        return await this.sayDynamicInfo(text);
    }

    private moveLeft(quietly: boolean = false): boolean {

        if (this.position > 0) {
            this.position -= 1;
            return true;
        }
        if (!quietly) {
            this.leftBump = true;
            this.sound(Sound.EndContent);
        }
        return false;
    }

    private moveRight(quietly: boolean = false): boolean {
        const max = this.cards.length + this.fixedSelections.length - 1;
        if (this.position < max) {
            this.position++;
            return true;
        }

        if (!quietly)
            this.sound(Sound.EndContent);
        return false;

    }

    private async visitCurrentSelection() {
        const selection = this.currentSelection;

        if (selection.kind === SelectionKind.Card && selection.card) {
            await this.sayDynamicContent(getCardName(selection.card));
        }

        if (selection.kind === SelectionKind.DrawButton) {
            await this.sayDynamicInfo("Draw Card from Deck");
        }

        if (selection.kind === SelectionKind.LastCardButton) {
            await this.sayDynamicInfo("Last!");
        }
    }

    private async visitAllCards() {
        await this.sayDynamicInfo(`You've got: ${describeCards(this.cards)}`);
    }

    private async visitCurrentSelectionDetails() {
        const selection = this.currentSelection;

        if (selection.kind === SelectionKind.Card && selection.card) {
            await this.sayDynamicInfo(cardDetailText(selection.card));
        }

        if (selection.kind === SelectionKind.DrawButton) {
            await this.sayDynamicInfo("You can draw a new card from deck, but only if you can't play any cards from your hand");
            await this.sayDynamicInfo("If you draw a playable card, you can still play it on your turn.");
        }

        if (selection.kind === SelectionKind.LastCardButton) {
            await this.sayDynamicInfo("When you only have one card left, play this option within 10 seconds of your last move.");
            await this.sayDynamicInfo("If you forget, you'll pick up 2 extra cards from deck as penalty.");
        }
    }

    private async notifyNotYourTurn() {
        if (this.session.confirmLast.onGoing)
            await this.sound(Sound.Bad);
        else await this.sayDynamicInfo("It's not your turn");
    }

    private async activateCurrentSelection() {

        if (!this.isMyTurn)
            return await this.notifyNotYourTurn();

        const selection = this.currentSelection;
        if (selection.kind === SelectionKind.Card && selection.card) {

            if (!this.isMyMove) return await this.notifyNotYourTurn();

            const legal = await this.session.canPlayCard(selection.card);
            if (!legal) {
                this.sound(Sound.Bad);
                await this.sayDynamicInfo("You can't play this card right now.");
                return;
            }

            // Temporary adjust the card set. It should echo back correct from the server.
            removeArrayElement(this.cards, selection.card);
            this.moveLeft(true);

            this.session.move.end({
                cardId: selection.card.id,
                kind: "card"
            });

            await this.playFlickCardSound(1);

        } else if (selection.kind === SelectionKind.DrawButton) {

            if (!this.isMyMove) return await this.notifyNotYourTurn();

            const legal = await this.session.canDrawCard();
            if (!legal) {
                this.sound(Sound.Bad);
                await this.sayDynamicInfo("You can't draw cards when you still have valid cards to play.");
                return;
            }

            this.session.move.end({kind: "draw"});
        } else if (selection.kind === SelectionKind.LastCardButton) {
            if (this.session.confirmLastCard()) {
                this.sound(Sound.Good);
            } else {
                this.sound(Sound.Bad);
                await this.sayDynamicInfo("You have more than 1 card left");
            }
        }
    }

    private async onNestedInterruption(gesture: Gesture, action: AsyncAction): Promise<boolean> {
        const ui = await this.asSayGroup(async () => {
            await action();
        }, false);

        if (ui && ui.kind === "gesture" && ui.gesture === gesture)
            return true;

        this.routeInterrupt(ui);
        return false;
    }

    private async handle(ui: UserInput) {

        if (ui.kind === "gesture") {
            if (ui.gesture === Gesture.DoubleTap) {
                await this.activateCurrentSelection();
            } else if (ui.gesture === Gesture.Left) {
                this.moveLeft();
            } else if (ui.gesture === Gesture.Right) {
                this.moveRight();
            } else if (ui.gesture === Gesture.DoubleLeft) {
                while (this.moveLeft(true)) {
                }
            } else if (ui.gesture === Gesture.DoubleRight) {
                while (this.moveRight(true)) {

                }
            }
        }

        const interrupt = await this.asSayGroup(async () => {

            let switchedBack = false;
            if (ui.kind === "gesture") {
                if (ui.gesture === Gesture.Up) {
                    switchedBack = await this.onNestedInterruption(Gesture.Down, async () => {
                        await this.visitGameState();
                    });
                } else if (ui.gesture === Gesture.Down) {
                    switchedBack = await this.onNestedInterruption(Gesture.Up, async () => {
                        await this.visitCurrentSelectionDetails();
                    });
                }
            }

            if (switchedBack)
                await this.visitCurrentSelection();
            else if (ui.kind === "gesture" && ui.gesture === Gesture.DoubleDown) {
                await this.visitAllCards();
            } else {
                if (ui.kind === "gesture") {
                    if (elementInArray(ui.gesture, visitCurrentGestures))
                        await this.visitCurrentSelection();
                }
            }
        });

        this.setInterrupt(interrupt);
    }

    private async playFlickCardSound(count: number = 1) {

        if (count <= 0)
            return;

        await this.haltIfEnded();
        const controller = await this.playInBackground(`~/flicks/flick_${randomIntegerMaxInclusive(1, 6)}.mp3`);

        this.setTimeout(async () => {
            await controller.done();
            await this.playFlickCardSound(count - 1);
        });
    }

    protected async run(): Promise<void | any> {

        this.session.connect(this);

        this.onEnd(this.session.onUpdate(async (update) => {
            await this.onGameStateUpdate(update);
        }));

        this.setTimeout(async () => {
            await this.session.begun;

            const controller = await this.playInBackground("~/game_start.mp3");
            await controller.done();

            await this.delay(500);

            if (this.state.turn)
                await this.playInBackground("~/move.mp3");

        });

        await this.freeze(this.session.ready, "Waiting for server...");

        await this.execOutsideNavigationalScope(async () => {

            await this.visitGameState();
            await this.visitCurrentSelection();

            while (this.isActive) {

                const ui = await this.get();

                if (ui.kind === "gesture" && ui.gesture === Gesture.Left) {
                    if (this.leftBump) {
                        const quit = await this.confirm("Do you want to abandon the game?", true);
                        if (quit) {
                            throw GameRoomActivity.AbandonGame;
                        }
                    }
                } else {
                    this.leftBump = false;
                }

                await this.handle(ui);
            }
        });

    }

    private async onGameStateUpdate(state: IGameState) {

        const initialCardCount = this.cards.length;

        const max = state.cards.length + this.fixedSelections.length - 1;

        while (this.position > max)
            this.position--;

        const addedCards = state.cards.length - initialCardCount;
        await this.playFlickCardSound(addedCards);
    }

    async getColor(): Promise<ColorType> {
        return await this.runSubActivityInIsolation(async () => {
            let color: ColorType | null = null;
            while (this.isActive && !color) {
                await this.sayDynamicInfo("Pick a color");
                const dex = await this.roll();
                dex.add("Red", async () => "R");
                dex.add("Green", async () => "G");
                dex.add("Blue", async () => "B");
                dex.add("Yellow", async () => "Y");
                color = await dex.run();
            }
            return color!;
        });
    }
}

export class FourColorsGameRoom extends GameRoomActivity {

    session: GameSession = new GameSession(this);

    protected async init(): Promise<void> {
        await super.init();
        await this.preloadAssets();
        const state = await this.getCurrentState();
        await this.session.updateState(state);
    }

    @subscribe("state", false)
    async updateState(state: IGameState) {
        await this.session.updateState(state);
    }

    @subscribe("beginGame", false)
    async markGameStart() {
        await this.session.markGameStart();
    }

    @subscribe("turnEnd")
    async onTurnEnd(turn: ITurnEnd) {

        let text = "";
        if (turn.me) {
            if (turn.changes.pickedUp.length > 0) {
                text += "You've picked up: " + describeCards(turn.changes.pickedUp);
            }
        } else {
            text += turn.nick + " ";

            if (turn.kind == "card" && turn.card) {
                const card = turn.card;
                text += `played ${getCardName(card)}`;
                if ((card.type === "wild" || card.type === "wd4") && turn.color) {
                    text += ` and picked ${ColorMap[turn.color]}.`;
                } else text += ".";
            }

            if (turn.kind == "draw") {
                text += "drew a card from deck";
            }

            if (turn.forgotToConfirm) {
                text += " They forgot to play Last and picked up 2 cards from deck.";
            }

            if (turn.cards == 1) {
                text += " They have 1 card left.";
            }

            if (turn.changes.pickedUp.length > 0)
                text += "You've picked up: " + describeCards(turn.changes.pickedUp);
        }

        await this.playInBackground("~/move.mp3");
        await this.sayDynamicInfo(text);

        if (turn.meNext) {
            if (turn.me)
                await this.sayDynamicInfo("It's your turn again.");
            else {
                await this.sayDynamicInfo("It's now your turn.");
            }
        } else {
            if (turn.me) await this.sayDynamicInfo(`It's ${turn.nextNick}'s turn`);
            else await this.sayDynamicInfo(`It's ${turn.nextNick}'s turn again`);
        }

    }

    @clientRPC("move", false)
    async beginMove(cancel: CancellationToken) {
        return this.registerPlayerAction(cancel, this.session.move.begin(cancel));
    }

    @clientRPC("color", false)
    async beginPickingColor(cancel: CancellationToken) {
        return this.registerPlayerAction(cancel, this.session.playerGetColor());
    }

    @clientRPC("confirmLast", false)
    async beginConfirmingLastCard(cancel: CancellationToken) {
        return this.registerPlayerAction(cancel, this.session.confirmLast.begin(cancel));
    }

    async getCurrentState() {
        return await this.rpc.call("state") as IGameState;
    }

    async canPlayCard(cardId: number) {
        return await this.rpc.call("canPlayCard", cardId) as boolean;
    }

    async canDrawCard() {
        return await this.rpc.call("canDrawCard") as boolean;
    }

    async makePlayingActivity(): Promise<Activity> {
        return new FourColorsPlayActivity(this.session);
    }
}

export async function main(rawLaunch: IGameCenterServiceLaunch<IFourColorsResult> | IBareGameRoomConfig) {

    if (!rawLaunch) {
        voxmate.audio.sound(Sound.Bad);
        return;
    }

    const launch: IGameCenterServiceLaunch<IFourColorsResult> =
        "action" in rawLaunch && typeof rawLaunch.action === "string"
            ? rawLaunch
            : {
                action: "play",
                server: (rawLaunch as IBareGameRoomConfig).server ?? "",
                roomId: (rawLaunch as IBareGameRoomConfig).roomId,
                ...((rawLaunch as IBareGameRoomConfig).partyId ? {partyId: (rawLaunch as IBareGameRoomConfig).partyId} : {}),
                ...((rawLaunch as IBareGameRoomConfig).matchTicket ? {matchTicket: (rawLaunch as IBareGameRoomConfig).matchTicket} : {}),
                ...((rawLaunch as IBareGameRoomConfig).resultToken ? {resultToken: (rawLaunch as IBareGameRoomConfig).resultToken} : {}),
                ...((rawLaunch as IBareGameRoomConfig).players ? {players: (rawLaunch as IBareGameRoomConfig).players} : {}),
                ...((rawLaunch as IBareGameRoomConfig).parameters ? {parameters: (rawLaunch as IBareGameRoomConfig).parameters} : {}),
            };

    const launcher = new class extends GameCenterServiceLauncher<IFourColorsResult> {

        constructor() {
            super("fourcolors", launch);
        }

        async launchPlayActivity(server: string, service: string, roomId: string, playLaunch: IGameCenterPlayLaunch) {
            const socketUrl = resolveSocketUrl(server, roomId);
            const headers: Record<string, string> = {};
            if (playLaunch.resultToken) {
                headers["X-Result-Token"] = playLaunch.resultToken;
            }
            const socketOptions: RPCSocketOptions = {
                ...(playLaunch.matchTicket ? {matchTicket: playLaunch.matchTicket} : {}),
                ...(Object.keys(headers).length > 0 ? {headers} : {}),
            };
            return new FourColorsGameRoom(socketUrl, service, roomId, socketOptions);
        }

        async launchResultActivity(result: IGameCenterServiceResult<IFourColorsResult>) {
            return new class extends RichActivity {
                protected async run() {
                    const details = result.result;
                    const moves = details?.moves;

                    if (result.status === "abandoned" || details?.type === "abandonment") {
                        await this.sayDynamicInfo("This game was abandoned.");
                        return;
                    }

                    if (result.winner === true) {
                        await this.sayDynamicInfo(
                            moves !== undefined
                                ? `You won this game in ${moves} ${mult("move", moves)}`
                                : "You won this game"
                        );
                    } else if (result.winner === false) {
                        await this.sayDynamicInfo(
                            moves !== undefined
                                ? `You lost this game after ${moves} ${mult("move", moves)}`
                                : "You lost this game"
                        );
                    } else {
                        await this.sayDynamicInfo(
                            moves !== undefined
                                ? `The game ended after ${moves} ${mult("move", moves)}`
                                : "The game ended"
                        );
                    }
                }
            };
        }
    };

    return launcher.run();
}
