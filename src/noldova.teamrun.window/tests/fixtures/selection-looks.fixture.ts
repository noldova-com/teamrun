/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SelectionLooks {
  public readonly active: readonly string[];
  public readonly others: readonly string[];

  public constructor(active: readonly string[], others: readonly string[]) {
    this.active = active;
    this.others = others;
  }
}
