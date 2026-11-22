/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class BadgeBox {
  public readonly inset: number;
  public readonly width: number;
  public readonly height: number;

  public constructor(inset: number, width: number, height: number) {
    this.inset = inset;
    this.width = width;
    this.height = height;
  }
}
