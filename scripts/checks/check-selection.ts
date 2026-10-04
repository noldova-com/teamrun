/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class CheckSelection {
  public readonly isPassing: boolean;
  public readonly unit: string;
  public readonly discovered: number;
  public readonly selected: number;

  public constructor(isPassing: boolean, unit: string, discovered: number, selected: number) {
    this.isPassing = isPassing;
    this.unit = unit;
    this.discovered = discovered;
    this.selected = selected;
  }

  public get unselected(): number {
    return this.discovered - this.selected;
  }
}
