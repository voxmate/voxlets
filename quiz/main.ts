import {Orchestrator} from "@voxmate/orc/orc";
import {RollActivity} from "@voxmate/orc/RollActivity";
import {getQuizData, IQuestion} from "./data";
import {randomChoice, shuffleArray} from "@voxmate/voxmate/utility/random";

import * as _ from "lodash";
import {Actor, Sound} from "@voxmate/voxmate";
import {formatPercent} from "@voxmate/voxmate/utility/strings";


// Generate 5 Random Categories
// Generate 6 Questions in Each Category
// Shuffle it All Up

// Ask Questions, Up to 3 Errors OK
// Life Lines:
// 1. 2x On a Multiple Choice Question throw two Wrong Answers Away
// 2. 2x Replace Question with a question from ANY Category of your Choosing

// You lose when you are out of lives.
// Scores: The level on your quiz ladder. And count stats.

const CATEGORIES_IN_GAME = 5;
const QUESTIONS_EZ = 2;
const QUESTIONS_MED = 1;
const QUESTIONS_HARD = 1;
const TOTAL_LIVES = 3;
const FIFTY_FIFTY_CARDS = 2;
const SWITCHAROO_CARDS = 2;

const LS_WINS = "wins";
const LS_SAVE = "save";
const LS_HIGHSCORE = "highscore";
const LS_STATS = "stats";
const LS_STATS_COUNTER = "stats_counter";

enum GameStatus {
    Playing,
    Lost,
    Won
}

interface IQuizGame {
    currentQuestionIndex: number;
    scores: number[];
    questions: IQuestion[];
    switcheroo: number;
    filter: number;
    lives: number;
}

interface IStats {
    [name: string]: boolean[]
}

interface IStatItem {
    category: string;
    accuracy: number;
    count: number;
    improving?: boolean;
}

class Stats {

    registerStat(category: string, pickedCorrectly: boolean) {
        const statsJson = localStorage.getItem(LS_STATS) ?? "{}";
        const stats = JSON.parse(statsJson) as IStats;

        if (!stats.hasOwnProperty(category))
            stats[category] = [];

        const container = stats[category];
        container.push(pickedCorrectly);
        while (container.length > 100)
            container.splice(0, 1);

        localStorage.setItem(LS_STATS, JSON.stringify(stats));

        const counts = JSON.parse(localStorage.getItem(LS_STATS_COUNTER) ?? "{}");
        counts[category] = (counts[category] ?? 0) + 1;
        localStorage.setItem(LS_STATS_COUNTER, JSON.stringify(counts));
    }

    allStats(): IStatItem[] {
        const statsJson = localStorage.getItem(LS_STATS) ?? "{}";
        const stats = JSON.parse(statsJson) as IStats;
        const keys = Object.keys(stats);
        const items: IStatItem[] = [];

        const counts = JSON.parse(localStorage.getItem(LS_STATS_COUNTER) ?? "{}");

        for (let category of keys) {
            const answers = stats[category];
            const accuracy = _.sumBy(answers, it => it ? 1 : 0) / answers.length;

            const item: IStatItem = {
                category: category,
                accuracy: accuracy,
                count: counts[category] ?? 0
            };

            if (answers.length > 20) {
                const half = Math.floor(answers.length / 2);
                const early = _.take(answers, half);
                const later = _.takeRight(answers, half);

                const ea = _.sumBy(early, it => it ? 1 : 0) / early.length;
                const la = _.sumBy(later, it => it ? 1 : 0) / later.length;

                item.improving = la > ea;
            }

            items.push(item);
        }

        return items;
    }

    clearStats() {
        localStorage.removeItem(LS_STATS);
        localStorage.removeItem(LS_STATS_COUNTER);
    }
}

class QuizGame {

    private _state: IQuizGame;
    private _categories: string[];

    private makeNewGame(): IQuizGame {
        const quizData = getQuizData();
        this._categories = Object.keys(quizData);
        const categories = _.take(shuffleArray(Object.keys(quizData)), CATEGORIES_IN_GAME);

        const questions: IQuestion[] = [];
        for (let category of categories) {
            const categoryQuestions = shuffleArray(quizData[category]);

            const extra = Math.min(this.wins, 5);
            const easyQuestions = _.take(categoryQuestions.filter(it => it.dif === 1), QUESTIONS_EZ + extra);
            const mediumQuestions = _.take(categoryQuestions.filter(it => it.dif === 2), QUESTIONS_MED + extra);
            const hardQuestions = _.take(categoryQuestions.filter(it => it.dif === 3), QUESTIONS_HARD + extra);

            questions.push(...easyQuestions, ...mediumQuestions, ...hardQuestions);
        }

        shuffleArray(questions);
        const sorted = _.sortBy(questions, q => q.dif);

        return {
            currentQuestionIndex: 0,
            scores: [],
            filter: FIFTY_FIFTY_CARDS,
            lives: TOTAL_LIVES,
            questions: sorted,
            switcheroo: SWITCHAROO_CARDS,
        };
    }

    newGame() {
        this.finishGame();
        this._state = this.makeNewGame();
        return this._state;
    }

    finishGame() {

        if (this._state)
            if (this.score > this.highScore)
                localStorage.setItem(LS_HIGHSCORE, this.score.toString());

        this._state = null;
        localStorage.removeItem(LS_SAVE);
    }

    saveGame() {
        const save = JSON.stringify(this.state);
        localStorage.setItem(LS_SAVE, save);
    }

    answer(correctly: boolean) {

        if (correctly) {
            const question = this.state.questions[this.state.currentQuestionIndex];
            this.state.scores.push(question.dif * 2 + this.wins);
        } else {
            this.state.scores.push(0);
            --this.state.lives;
        }

        this.state.currentQuestionIndex++;
        if (this.status === GameStatus.Won) {
            localStorage.setItem(LS_WINS, (this.wins + 1).toString());
        }
    }

    get wins(): number {
        return parseInt(localStorage.getItem(LS_WINS) ?? "0");
    }

    get highScore(): number {
        return parseInt(localStorage.getItem(LS_HIGHSCORE) ?? "0");
    }

    get state() {
        if (!this._state) {
            if (this.haveRunningGame) {
                const json = localStorage.getItem(LS_SAVE);
                this._state = JSON.parse(json);
            } else return this.newGame();
        }
        return this._state;
    }

    get status(): GameStatus {
        if (this.state.currentQuestionIndex == this.state.questions.length)
            return GameStatus.Won;

        if (this.state.lives > 0)
            return GameStatus.Playing;

        return GameStatus.Lost;
    }

    get haveRunningGame() {
        return !!localStorage.getItem(LS_SAVE);
    }

    get score(): number {
        let total = 0;
        for (let score of this.state.scores) {
            total += score;
        }
        return total;
    }

    get categories(): string[] {

        if (!this._categories) {
            const quizData = getQuizData();
            this._categories = Object.keys(quizData);
        }

        return this._categories;
    }
}

abstract class QuizBaseActivity<T = any> extends RollActivity<T> {
    protected readonly game: QuizGame;
    protected readonly stats: Stats;

    async promptForCategory(): Promise<string | undefined> {
        await this.sayDynamicInfo("Please pick a question category");
        const dex = this.roll();
        for (let category of this.game.categories)
            dex.add(category, async () => category);
        return await dex.run();
    }

    getSwitchARooQuestionFromCategory(category: string, difficulty: number): IQuestion {
        const quizData = getQuizData();
        let questions = quizData[category];
        questions = questions.filter(it => it.dif === difficulty);
        return randomChoice(questions);
    }
}

class QuizQuestionActivity extends QuizBaseActivity<boolean> {
    constructor(private readonly index: number) {
        super();
    }

    protected async run(): Promise<boolean> {
        const question = this.game.state.questions[this.index];
        await this.sayDynamicInfo(`Question ${this.index + 1} - ${question.category}`);

        const dex = this.roll().setActor(Actor.DynamicInformational);
        let skippedPromptToOption = false;
        dex.add(async () => {
            await this.sayDynamicContent(question.qst);
            if (!skippedPromptToOption) {
                skippedPromptToOption = true;
                dex.goto(1);
            }
        });

        console.log("Answer: " + question.ans[question.key]);

        for (let idx = 0; idx < question.ans.length; idx++) {
            const option = question.ans[idx].trim();

            dex.add(async () => {
                await this.sayDynamicInfo(option);
            }, async () => {
                const isCorrectAnswer = question.key === idx;

                if (isCorrectAnswer) {
                    this.stats.registerStat(question.category, true);
                    this.game.answer(true);
                    await this.sayDynamicContent("That's right!");
                } else {
                    this.stats.registerStat(question.category, false);
                    this.game.answer(false);

                    const rotation = randomChoice([
                        "I'm sorry that's wrong. The correct answer was:",
                        "That's not quite right, I was looking for:",
                        "The right answer was:",
                        "That's not the right answer, I'm afraid the right answer is:",
                        "Nope. I have it on good authority, that the right answer is:"
                    ]);

                    await this.sayDynamicContent(`${rotation} ${question.ans[question.key]}`);
                    if (this.game.state.lives > 1) {
                        await this.sayDynamicInfo(`You have ${this.game.state.lives} lives left`);
                    }
                    if (this.game.state.lives === 1) {
                        await this.sayDynamicInfo(`You have just one life left.`);
                    }
                }
                dex.unwind();
            });
        }

        if (this.game.state.switcheroo > 0) {
            dex.add(`Use Switch-A-Roo Card - ${this.game.state.switcheroo} remain`, async () => {
                const category = await this.promptForCategory();
                if (!category)
                    return;

                this.game.state.questions[this.index] = this.getSwitchARooQuestionFromCategory(category, question.dif);
                --this.game.state.switcheroo;
                return true;
            });
        }

        if (this.game.state.filter > 0 && question.ans.length === 4) {
            dex.add(`Use Fifty-Fifty Card - ${this.game.state.filter} remain`, async () => {
                const answers = question.ans;
                const correctAnswer = question.ans[question.key];
                const wrongAnswers = answers.filter(it => it != correctAnswer);

                const newAnswers = shuffleArray([correctAnswer, shuffleArray(wrongAnswers)[0]]);
                const newKey = newAnswers.indexOf(correctAnswer);

                question.ans = newAnswers;
                question.key = newKey;
                --this.game.state.filter;

                await this.sayDynamicInfo("Removed two wrong answers.");
                return true;
            });
        }

        return await dex.run({
            haltReturn: false,
            defaultReturn: true
        });
    }
}

class QuizGameActivity extends QuizBaseActivity {

    private _stopPeriodicSaving: () => void;

    protected async init(): Promise<void> {
        await super.init();
        this._stopPeriodicSaving = this.setInterval(() => {
            this.game.saveGame();
        }, 3000);
    }

    protected async run(): Promise<any> {
        const game = this.game;

        if (game.status === GameStatus.Playing) {
            await this.sayDynamicInfo(`You have ${game.state.lives} lives.`);
        }

        while (game.status === GameStatus.Playing) {
            const nextQuestionIndex = game.state.currentQuestionIndex;
            const continuePlaying = await this.exec(new QuizQuestionActivity(nextQuestionIndex));

            if (!continuePlaying)
                break;
        }

        if (this.game.status === GameStatus.Playing) {
            this.game.saveGame();
            return;
        }

        this._stopPeriodicSaving();

        const score = this.game.score;
        const highScore = this.game.highScore;
        const status = this.game.status;

        this.game.finishGame();

        if (status === GameStatus.Lost)
            await this.sayDynamicInfo(`You have lost. Your total score is ` + score);

        if (status === GameStatus.Won)
            await this.sayDynamicInfo(`Congratulations Quiz master You Won! Your total score is ` + score);

        if (score > highScore)
            await this.sayDynamicInfo("This is your new high score!");
    }
}

class QuizGameStatsActivity extends QuizBaseActivity {
    protected async run(): Promise<void | any> {

        const allStats = this.stats.allStats();
        if (allStats.length === 0) {
            await this.sayDynamicInfo("There are no stats yet, play some quiz and come back!");
            return;
        }

        const dex = this.roll();

        const wins = this.game.wins;
        if (wins > 0)
            dex.add(`You have a total of ${wins} wins`);

        for (let item of allStats) {
            dex.add(async () => {
                await this.sayDynamicContent(`Your accuracy in ${item.category} is ${formatPercent(item.accuracy)}`);
                await this.sayDynamicContent(`You have answered ${item.count} questions in ${item.category}`);
                if (item.improving)
                    await this.sayDynamicContent(`Your accuracy in improving`);
            });
        }
        await dex.run();
    }
}

class QuizGameHelpActivity extends QuizBaseActivity {
    protected async run(): Promise<void | any> {

        const wins = this.game.wins;
        const count = (QUESTIONS_EZ + QUESTIONS_MED + QUESTIONS_HARD + 3 * Math.min(wins, 5));
        const total = CATEGORIES_IN_GAME * count;

        const dex = this.roll(
            "In Quiz you have to answer common general knowledge questions in order to score points.",
            "Each game consists of " + count + " questions from " + CATEGORIES_IN_GAME + " categories, a total of " + total,
            "Answer them all to be the Quiz Master",

            "You have " + TOTAL_LIVES + " lives, meaning that the game will continue even if you answer incorrectly",
            "You have " + SWITCHAROO_CARDS + " Switch-A-Roo cards, that allow you to switch out a question to any category",
            "You also have " + FIFTY_FIFTY_CARDS + " Fifty-Fifty cards that remove two wrong answers for you",
            "Once you win - the game will become more difficult, and you will need to answer 3 extra questions to win again",
            "Good Luck. Oh, right. You don't even need it."
        );
        await dex.run({autoskip: true});
    }
}

class QuizMainActivity extends QuizBaseActivity {
    protected async run(): Promise<void | any> {
        const dex = this.roll().setActor(Actor.Content);

        const continueOption = dex.add("Continue playing", async () => {
            await this.exec(new QuizGameActivity());
        }).showWhen(async () => this.game.haveRunningGame);

        dex.add("New Game of Quiz", async () => {
            if (this.game.haveRunningGame) {
                if (!(await this.confirm("Are you sure you want to start a new game, your previous game will be lost.")))
                    return;
            }
            this.game.newGame();
            await this.exec(new QuizGameActivity());
            if (this.game.haveRunningGame) {
                continueOption.goto();
            }
        });

        dex.add("Your Stats", async () => {
            await this.exec(new QuizGameStatsActivity());
        });

        dex.add("How to Play", async () => {
            await this.exec(new QuizGameHelpActivity());
        });

        dex.add("Reset Stats", async () => {
            if (await this.confirm()) {
                this.stats.clearStats();
                this.sound(Sound.Good);
                localStorage.clear(); //TODO: Remove
            }
        });
        await dex.run();
    }
}

export async function main() {
    await new Orchestrator()
        .inject("game", new QuizGame())
        .inject("stats", new Stats())
        .start(QuizMainActivity);
}
