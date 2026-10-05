/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TreeLine {
  public readonly top: number;
  public readonly start: number;
  public readonly width: number;

  public constructor(top: number, start: number, width: number) {
    this.top = top;
    this.start = start;
    this.width = width;
  }
}
