/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ColorCount {
  public readonly color: string;
  public readonly count: number;

  public constructor(color: string, count: number) {
    this.color = color;
    this.count = count;
  }
}
