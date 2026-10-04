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

  public static of(rectangle: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): ScreenArea {
    return new ScreenArea(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
  }

  public overlapArea(x: number, y: number, width: number, height: number): number {
    const across = Math.min(x + width, this.x + this.width) - Math.max(x, this.x);
    const down = Math.min(y + height, this.y + this.height) - Math.max(y, this.y);
    return across > 0 && down > 0 ? across * down : 0;
  }

  public fits(width: number, height: number): boolean {
    return width <= this.width && height <= this.height;
  }
}
