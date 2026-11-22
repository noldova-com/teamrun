/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UsageFillCase {
  public readonly used: number;
  public readonly fill: string;

  public constructor(used: number, fill: string) {
    this.used = used;
    this.fill = fill;
  }
}
