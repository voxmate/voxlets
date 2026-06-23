type VoxmateFeature = "beta" | "beta-update-1" | "beta-update-2" | "beta-update-6";

type IInjectionMap = { [name: string]: any }

type AnyFunction = () => Promise<any> | any | void

type ActivityConstructor<T> = new() => Activity<T>


abstract class BaseActivity {

    async init() {

    }

    scheduleTaskInActivityScope(task: AnyFunction) {

    }
}

abstract class Activity<T> extends BaseActivity {

    private say() {
    }

    async sayInfo() {
    }

    async sayDynamicInfo() {
    }

    async sayContent() {
    }

    async sayDynamicContent() {
    }

    abstract run(): Promise<T | undefined>
}

export class Elf {

    private readonly injections: IInjectionMap = {};
    private readonly requiredFeatures: VoxmateFeature[] = ["beta-update-6"];

    inject(property: string, value: any): this {
        this.injections[property] = value;
        return this;
    }

    require(feature: VoxmateFeature): this {
        this.requiredFeatures.push(feature);
        return this;
    }

    async start<T>(activity: ActivityConstructor<T>): Promise<T | undefined> {
        return undefined;
    }
}