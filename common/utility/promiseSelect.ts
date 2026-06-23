import {Activity} from "../orc/orc";

type PromiseRacerAction<T, Q> = (input: T) => Promise<Q>

export class PromiseSelect<TReturn = never> {

    private tasks: Promise<any>[] = [];
    private actions = [];

    constructor(private readonly scope: Activity) {
    }

    when<T, Q>(task: Promise<T>, action: PromiseRacerAction<T, Q>): PromiseSelect<Exclude<TReturn | Q, never>> {
        const idx = this.tasks.length;
        const idxResolver = (result) => [idx, result];
        this.tasks.push(task.then(idxResolver));
        this.actions.push(action);
        return this as any;
    }

    async start(): Promise<TReturn> {
        const [idx, result] = await this.scope.race(...this.tasks);
        const action = this.actions[idx];
        return await action(result);
    }
}