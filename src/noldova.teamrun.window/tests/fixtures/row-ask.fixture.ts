/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class RowAsk {
  public readonly row: () => HTMLElement;
  public readonly label: string;

  public constructor(row: () => HTMLElement, label: string) {
    this.row = row;
    this.label = label;
  }
}
