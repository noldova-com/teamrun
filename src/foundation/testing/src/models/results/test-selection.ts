/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class TestSelection {
  public readonly filters: readonly string[];
  public readonly discovered: number;
  public readonly selected: number;
  public readonly unselected: number;
  public readonly isFiltered: boolean;

  public constructor(filters: readonly string[], discovered: number, selected: number) {
    this.filters = [...filters];
    this.discovered = discovered;
    this.selected = selected;
    this.unselected = discovered - selected;
    this.isFiltered = filters.length > 0;
  }
}
