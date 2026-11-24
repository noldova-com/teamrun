/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RowEnd {
  public readonly inset: number;
  public readonly width: number;

  public constructor(inset: number, width: number) {
    this.inset = inset;
    this.width = width;
  }
}
