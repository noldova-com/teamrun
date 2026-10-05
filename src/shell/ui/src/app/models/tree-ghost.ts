/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TreeGhost {
  public readonly x: number;
  public readonly y: number;
  public readonly maxWidth: number;

  public constructor(x: number, y: number, maxWidth: number) {
    this.x = x;
    this.y = y;
    this.maxWidth = maxWidth;
  }
}
