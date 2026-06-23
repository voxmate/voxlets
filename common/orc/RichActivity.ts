import {IStringEditFieldConfig, RollActivity} from "./RollActivity";
import {Activity, CascadeEnd, Sayable} from "./orc";
import {ControllablePromise} from "../utility/common";
import {
    AnyFunction,
    IHttpResult,
    IKeyPress,
    KeyKind,
    QRCode,
    RecordingId,
    ResourceId,
    ScannedText,
    Sound,
    voxmate
} from "../voxmate";
import {PickerRejectedInput} from "./pickers";
import {RolodexEntryBuilder} from "./rolodex";
import {AsyncTask} from "./types";
import {Message, MessageRecorder, MessageRecorderSettings} from "./recorder";

export type TaskQueueHandler<T> = (item: T) => void | Promise<void>

export class TaskQueue<TTask> {

    private _running = true;
    private readonly _taskQueue: TTask[] = [];
    private trap: ControllablePromise<boolean> = new ControllablePromise<boolean>();

    constructor(readonly activity: Activity, readonly handler: TaskQueueHandler<TTask>) {
        this.setupTrap();
    }

    private setupTrap() {
        this.trap = new ControllablePromise<boolean>();
    }

    private springTrap() {
        this.trap.resolve(this._running);
    }

    private wrapTask(task: TTask): AnyFunction {
        return async () => {
            try {
                await this.handler(task);
            } catch (e) {

                if (this.activity.isFlowControl(e))
                    throw e;

                if (e == CascadeEnd) {
                    this.stop();
                    return;
                }

                let json = "";
                try {
                    json = JSON.stringify(e);
                } catch (e) {
                    json = "<NO REPR>";
                }

                console.error("Error in task queue: ", e, json, typeof e, (e as any).description);
            }
        };
    }

    start() {
        this.activity.setTimeout(async () => {
            while (this._running) {
                const execute = await this.trap;
                if (!execute) return;

                let task = this._taskQueue.shift();
                while (task) {
                    if (this._running)
                        await this.wrapTask(task)();
                    task = this._taskQueue.shift();
                }

                if (this._running)
                    this.setupTrap();
            }
        });
    }

    stop() {
        this._running = false;
        this.springTrap();
    }

    enqueue(task: TTask) {
        this._taskQueue.push(task);
        this.springTrap();
    }
}

export class FHTTPError extends Error {
    constructor(override readonly message: string) {
        super(message);
    }
}

type FormFieldValidationResult = { error: string } | true | false
type FormFieldValidator = (value: string) => FormFieldValidationResult;

type FormFieldPresenter = { name: string, description?: string }

interface ITextFormFieldExtras extends IStringEditFieldConfig {
    readonly validators?: FormFieldValidator[];
    readonly useDialPad?: true | false;
    readonly presenter?: AsyncTask<string>;
    readonly minLength?: number;
}

type SelectOptions = { [key: string]: FormFieldPresenter | string }
type SelectFormField = { type: "select", options: SelectOptions } & FormFieldPresenter
type TextFormField = { type: "text", require: "yes" | "no" } & FormFieldPresenter & ITextFormFieldExtras

type FormFieldSpec = TextFormField | SelectFormField

interface IForm {
    prompt: Sayable;
    submitPrompt?: Sayable;
    fields: { [fieldName: string]: FormFieldSpec };
}

type FormResponse<Form extends IForm> = {
    [P in keyof Form["fields"]]:
    Form["fields"][P] extends infer Spec ?
        Spec extends { type: "text", require: infer Optional } ? Optional extends "no" ? string | undefined : string :
            Spec extends { type: "select", options: infer U } ? keyof U :
                never : never
}

function isValid(validation: FormFieldValidationResult) {
    if (!validation)
        return false;

    if (typeof validation == "object" && validation.error)
        return false;

    return true;
}

function isInvalid(validation: FormFieldValidationResult) {
    return !isValid(validation);
}

class FormActivity extends RollActivity {

    private responses: Record<string, any> = {};

    constructor(private readonly form: IForm) {
        super();

        for (let field in form.fields) {
            const spec = this.getFieldSpec(field);
            if (spec.type == "text") {
                this.responses[field] = spec.initialText ?? null;
            } else if (spec.type == "select") {
                this.responses[field] = null;
            }
        }
    }

    private async editFormField(field: string, typed: IKeyPress | null = null) {
        const current = this.responses[field];
        const spec = this.getFieldSpec(field);

        if (spec.type == "text") {
            if (spec.useDialPad) {
                this.responses[field] = await this.editDialPadField(current, {
                    initial: spec.initialText ?? undefined,
                    maxInputLength: spec.maxLength ?? undefined
                });
            } else {
                this.responses[field] = await this.editField(current, {
                    typed: typed ?? undefined,
                    initialText: spec.initialText,
                    maxLength: spec.maxLength,
                    allowEmojiInput: spec.allowEmojiInput
                });
            }
        }
    }

    private async announceValidationError(field: string, validation: FormFieldValidationResult) {

        if (isValid(validation))
            return;

        const spec = this.getFieldSpec(field);
        let text = `${spec.name} is`;
        if (typeof validation === "object")
            text += " " + validation.error;
        else text += " invalid";
        await this.sayDynamicInfo(text);
    }

    private async announceFirstValidationError() {
        for (let field in this.form.fields) {
            const validation = this.validateField(field);
            if (isInvalid(validation)) {
                await this.announceValidationError(field, validation);
                return;
            }
        }
    }

    private async fillResponses(): Promise<boolean | undefined> {

        await this.sayDynamicInfo(this.form.prompt);

        const fields = Object.keys(this.form.fields);
        let currentField: string | null = null;

        while (this.isActive) {

            const dex = await this.roll();

            const options: RolodexEntryBuilder[] = [];

            for (let i = 0; i < fields.length; i++) {

                const field = fields[i];
                const spec = this.form.fields[field];

                const option = dex.add(async () => {

                    currentField = field;

                    const value = this.responses[field];
                    const validation = this.validateField(field);

                    let empty = value === null;

                    if (spec.type == "text") {

                        let fieldShortDescriptor = "";
                        if (spec.require == "no")
                            fieldShortDescriptor += "Optional" + (empty ? " empty " : " ") + "text field";
                        else fieldShortDescriptor += "Required" + (empty ? " empty " : " ") + "text field";

                        if (empty) {
                            await this.sayDynamicContent(spec.name);
                        } else {

                            if (isInvalid(validation)) {
                                this.sound(Sound.Bad);
                                fieldShortDescriptor += " with invalid value";
                            }

                            if (spec.presenter) {
                                await spec.presenter(value);
                            } else {
                                await this.sayDynamicContent(value);
                            }

                            await this.announceValidationError(field, validation);
                        }

                        if (empty) {
                            await this.sayDynamicInfo(fieldShortDescriptor);
                            await this.sayDynamicInfo("Swipe right to set");
                        } else {

                            if (isValid(validation))
                                await this.sayDynamicInfo(spec.name);

                            if (spec.require == "no") {
                                await this.sayDynamicInfo("Swipe right to change or clear");
                            } else {
                                await this.sayDynamicInfo("Swipe right to change");
                            }
                        }

                        if (spec.description) {
                            await this.delay(1000);
                            await this.sayDynamicInfo(spec.description);
                        }

                    }

                    if (spec.type == "select") {

                        if (!empty) {
                            const option = spec.options[value];
                            if (typeof option == "string") {
                                await this.sayDynamicContent(option);
                            } else {
                                await this.sayDynamicContent(option.name);
                            }
                        }

                        await this.sayDynamicInfo(spec.name);
                        await this.sayDynamicInfo("Swipe left to select");
                    }

                }, async () => {

                    if (spec.type == "text") {
                        const value = this.responses[field];
                        let empty = value === null;
                        if (spec.require == "no" && !empty) {
                            // Allow clearing of value
                            const editFieldDex = this.roll();
                            editFieldDex.add("Edit", async () => {
                                await this.editFormField(field);
                                return true;
                            });
                            editFieldDex.add("Clear", async () => {
                                this.responses[field] = null;
                                return true;
                            });
                            await editFieldDex.run();
                        } else {
                            await this.editFormField(field);
                        }
                    }

                    if (spec.type == "select") {
                        const selector = this.roll();
                        const keys = Object.keys(spec.options);
                        let page: RolodexEntryBuilder | null = null;
                        for (let key of keys) {
                            const option = spec.options[key];
                            const keyPage = selector.add(async () => {
                                if (typeof option == "string") {
                                    await this.sayDynamicContent(option);
                                } else {
                                    await this.sayDynamicContent(option.name);
                                    if (option.description)
                                        await this.sayDynamicInfo(option.description);
                                    await this.delay(1000);
                                    await this.sayDynamicInfo("Swipe right to set");
                                }
                            }, async () => {
                                this.responses[field] = key;
                                this.sound(Sound.Good);
                                selector.unwind();
                            });

                            if (this.responses[field] === key)
                                page = keyPage;
                        }

                        if (page != null)
                            selector.rotateIntoFocus(page);

                        await selector.run();
                    }
                });

                options.push(option);
            }

            dex.add(async () => {
                if (this.ready) {
                    this.sound(Sound.Good);
                    await this.sayDynamicInfo(this.form.submitPrompt ?? "Submit form");
                } else {
                    this.sound(Sound.Bad);
                    await this.announceFirstValidationError();
                }
            }, async () => {
                return true;
            });

            if (currentField) {
                let idx = fields.indexOf(currentField);
                let option = options[idx];
                dex.rotateIntoFocus(option);
            }

            try {
                return await dex.run({
                    throwRejectedInput: true
                });
            } catch (e) {
                if (this.isFlowControl(e))
                    throw e;

                if (e instanceof PickerRejectedInput) {
                    if (e.ui && e.ui.kind == "keyPress") {
                        if (e.ui.keyKind === KeyKind.Regular) {
                            await this.editFormField(currentField!, e.ui);
                        } else return undefined;
                    }
                } else {
                    throw e;
                }
            }
        }
    }

    private getFieldSpec(field: string): FormFieldSpec {
        return this.form.fields[field];
    }

    private validateField(field: string): FormFieldValidationResult {
        const spec = this.getFieldSpec(field);
        const value = this.responses[field];

        if (spec.type == "text") {

            if (value === null) {

                if (spec.require == "no")
                    return true;

                return {error: "not set"};
            }

            if (spec.validators) {
                for (let validator of spec.validators) {
                    const validation = validator(value);
                    if (isInvalid(validation))
                        return validation;
                }
            }

            if (spec.minLength) {
                const minLength = spec.minLength;
                const validator = (s: string) => s.length < minLength ? {valid: false, error: "too short"} : true;
                const validation = validator(value);
                if (isInvalid(validation))
                    return validation;
            }
        }

        if (spec.type == "select") {
            if (value == null) {
                return {error: "not set"};
            }
        }

        return true;
    }

    private get ready(): boolean {
        for (let field in this.form.fields)
            if (isInvalid(this.validateField(field)))
                return false;
        return true;
    }

    protected override async run() {
        while (this.isActive) {
            const ok = await this.fillResponses();

            console.log("READY", this.ready);

            if (ok && this.ready)
                return this.responses;

            this.sound(Sound.Bad);
            if (await this.confirm("Are you sure you want to skip this form?"))
                return undefined;
        }
    }
}

export type AMSUploadResult = {
    durationInSeconds: number;
    id: string;
    ok: boolean;
    url: string;
}

export abstract class RichActivity<T = any> extends RollActivity<T> {

    static FHTTP_HOST = "https://apis.voxmate.com/v1/";
    static AMS_HOST = "https://ams.run.voxmate.com/upload";

    override async start(): Promise<void | T | null> {
        try {
            return await super.start();
        } catch (e) {
            if (this.isFlowControl(e))
                throw e;
            if (e instanceof FHTTPError) {
                await this.sayDynamicInfo("An error has occurred while communicating with Voxmate servers");
            } else throw e;
        }
    }

    async uploadAudioResourceToAMS(recordingId: RecordingId): Promise<AMSUploadResult> {
        const task = this.wrap(voxmate.http.uploadResource(RichActivity.AMS_HOST, recordingId, {}));
        const result = await this.freeze(task, "Uploading...");
        return JSON.parse(result!.content!);
    }

    startTaskQueue<T>(handler: TaskQueueHandler<T>): TaskQueue<T> {
        const taskQueue = new TaskQueue(this, handler);

        this.onEnd(() => {
            taskQueue.stop();
        });

        taskQueue.start();

        return taskQueue;
    }

    async fhttp<T = any>(fn: string, action: string, payload: any = {}, retrying: boolean = false): Promise<T | null> {

        let host = RichActivity.FHTTP_HOST;

        let response: IHttpResult;
        try {
            response = await this.httpMakeRequest(
                host + fn, "POST", JSON.stringify({action: action, ...payload}), {
                    "User-Agent": "VOXMATE"
                }, true);
        } catch (e) {
            if (this.isFlowControl(e))
                throw e;
            console.error("FHTTP", host + fn, e);
            throw new FHTTPError("Unable to connect to voxmate");
        }

        if (response.code == 502) {
            if (!retrying) {
                await this.delay(1000);
                return this.fhttp(fn, action, payload, true);
            } else {
                throw new FHTTPError(`Error FHTTP response code to ${fn}.${action}() => ${response.code}`);
            }
        }

        if (this.isSimulator) {
            try {
                const data = JSON.parse(response.content!);
                if (data.error) {
                    console.error("FHTTP ERROR => ", data.error);
                }
            } catch (e) {

            }
        }

        if (response.isValidJson) {
            const responseObject = JSON.parse(response.content!) as
                { "ok": boolean, "error": string, "data": T };

            if (responseObject.ok)
                return responseObject.data;

            if (responseObject.error) {
                throw new FHTTPError(responseObject.error);
            }
        }

        throw new FHTTPError(`Invalid FHTTP request to ${fn}.${action}()`);
    }

    async fillForm<TForm extends IForm>(form: TForm): Promise<FormResponse<TForm>> {
        return await this.exec(new FormActivity(form));
    }

    async scanQRCode(): Promise<QRCode> {
        class ScanQRCodeActivity extends Activity<QRCode> {
            protected async run(): Promise<any> {
                const postId = await this.wrap(voxmate.system.billboard.show("Find A QR Code"));
                this.onEnd(async () => {
                    await this.wrap(voxmate.system.billboard.close(postId));
                });

                const code = await this.wrap(voxmate.vision.scanQRCode());
                if (code) {
                    this.sound(Sound.Good);
                    await this.sayInfo("Captured");
                }

                return code;
            }
        }

        return await this.exec(new ScanQRCodeActivity());
    }

    async scanText(): Promise<ScannedText> {
        class CaptureTextActivity extends RollActivity<ScannedText> {
            protected async run(): Promise<any> {
                await this.guardPermissions({"camera": "Voxmate needs your permission to scan text"});

                const postId = await this.wrap(voxmate.system.billboard.show("Find Text"));
                this.onEnd(async () => {
                    await this.wrap(voxmate.system.billboard.close(postId));
                });

                const text = await this.wrap(voxmate.vision.scanText());
                if (!text)
                    return;

                if (text)
                    this.sound(Sound.Good);

                return text;
            }
        }

        return await this.exec(new CaptureTextActivity());
    }

    async showImage(fileResourceId: ResourceId) {
        const ok = await this.wrap(voxmate.vision.showImage(fileResourceId));
        if (!ok) {
            this.sound(Sound.Bad);
            await this.sayDynamicInfo("Unable to open image");
        }
    }

    async getMessage(prompt: Sayable | undefined, settings: MessageRecorderSettings = {}): Promise<Message | undefined> {
        return await this.exec(new MessageRecorder(prompt, settings));
    }
}