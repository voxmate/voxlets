export type Action = () => void;
export type AsyncAction<T = any> = () => Promise<T>
export type AsyncTask<TParameter, TReturn = void> = (param: TParameter) => Promise<TReturn>

export type SubType<Base, Condition> = Pick<Base, { [Key in keyof Base]: Base[Key] extends Condition ? Key : never }[keyof Base]>;