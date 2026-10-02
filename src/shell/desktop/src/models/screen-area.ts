/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ScreenArea {
  public readonly x: number;
  public readonly y: number;
  public readonly width: number;
  public readonly height: number;

  public constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  public overlaps(x: number, y: number, width: number, height: number): boolean {
    return x < this.x + this.width && x + width > this.x && y < this.y + this.height && y + height > this.y;
  }
}
