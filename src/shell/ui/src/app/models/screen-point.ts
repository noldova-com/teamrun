/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ScreenPoint {
  public readonly x: number;
  public readonly y: number;

  public constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  public static of(event: MouseEvent): ScreenPoint {
    return new ScreenPoint(Math.floor(event.screenX), Math.floor(event.screenY));
  }

  public equals(other: ScreenPoint): boolean {
    return this.x === other.x && this.y === other.y;
  }
}
