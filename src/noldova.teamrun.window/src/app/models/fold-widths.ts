/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FoldWidths {
  public readonly full: number;
  public readonly folded: number;

  public constructor(full: number, folded: number) {
    this.full = full;
    this.folded = folded;
  }

  public widthAt(folded: boolean): number {
    return folded ? this.folded : this.full;
  }
}
