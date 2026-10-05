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
  public readonly width: number;

  public constructor(x: number, y: number, width: number) {
    this.x = x;
    this.y = y;
    this.width = width;
  }
}
