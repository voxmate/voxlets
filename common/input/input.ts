import {DeregisterFunction, UserInput} from "../voxmate";

/*
        Since voxmate.input.get() got removed, some voxlets (those that don't use ORC) require a polyfill.
 */
export async function getNextInput(timeout: number = undefined): Promise<UserInput | null> {
    return new Promise<UserInput | null>((resolve) => {

        let subscription: DeregisterFunction = undefined;
        let handle: unknown = undefined;

        function finish(ui: UserInput | null) {
            if (handle) clearTimeout(handle);
            if (subscription) subscription();
            resolve(ui);
        }

        subscription = voxmate.input.subscribe((ui) => {
            finish(ui);
        }, false);

        if (timeout != undefined) {
            handle = setTimeout(() => {
                finish(null);
            }, timeout);
        }
    });
}