import {Gesture} from "../voxmate";

export interface INavGridLocation {
    i: number;
    j: number;
}

export class NavGrid {
    private _i = 0;
    private _j = 0;

    constructor(private readonly width: number, private readonly height: number) {

    }

    isSteppingGesture(gesture: Gesture): boolean {
        switch (gesture) {
            case Gesture.Right:
                return true;
            case Gesture.Left:
                return true;
            case Gesture.Up:
                return true;
            case Gesture.Down:
                return true;
            default:
                return false;
        }
    }

    step(gesture: Gesture) {

        if (gesture == Gesture.Right)
            this._i += 1;

        if (gesture == Gesture.Left)
            this._i -= 1;

        if (gesture == Gesture.Up)
            this._j -= 1;

        if (gesture == Gesture.Down)
            this._j += 1;
    }

    jump(location: INavGridLocation) {
        this._i = location.i;
        this._j = location.j;
    }

    stepBackToGrid() {
        while (this._i < 0)
            ++this._i;

        while (this._i == this.width)
            --this._i;

        while (this._j < 0)
            ++this._j;

        while (this._j == this.height)
            --this._j;
    }

    private getMiddleIndex(dim: number) {
        if (dim === 1) return 0;
        if (dim === 2) return 0;
        const pos = Math.floor(dim / 2);
        if (dim % 2 === 1) return pos;
        return pos - 1;
    }

    stepToCenter(): this {
        this.jump({i: this.getMiddleIndex(this.width), j: this.getMiddleIndex(this.height)});
        return this;
    }

    matches(location: INavGridLocation) {
        return this.i === location.i && this.j === location.j;
    }

    get i() {
        return this._i;
    }

    get j() {
        return this._j;
    }

    get loc(): INavGridLocation {
        return {i: this.i, j: this.j};
    }

    get isOutsideBounds() {
        if (this._i < 0)
            return true;

        if (this._i == this.width)
            return true;

        if (this._j < 0)
            return true;

        if (this._j == this.height)
            return true;

        return false;
    }
}
