import * as questions from "./qdata.json"

export interface IQuestion {
    qst: string;
    ans: string[];
    key: number;
    dif: number;
    category: string;
}

export interface IQuizData {
    [name: string]: IQuestion[]
}

function fixCategoryName(name: string): string {
    const prefixes = ["Entertainment: ", "Science: "];
    for (let prefix of prefixes) {
        if (name.startsWith(prefix))
            return name.replace(prefix, "");
    }
    return name;
}

export function getQuizData(): IQuizData {

    const bucket: IQuizData = {};
    const copy = JSON.parse(JSON.stringify(questions["default"])) as IQuizData;
    let counter = 0;
    for (let category in copy) {
        const catQuestions = copy[category];
        const name = fixCategoryName(category);
        for (let question of catQuestions) {
            ++counter;
            question.category = name;
        }
        bucket[name] = catQuestions;
    }

    console.log("Questions: ", counter);

    return bucket;
}