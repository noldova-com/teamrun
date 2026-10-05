/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ToolbarDropTarget {
  public readonly row: number;
  public readonly index: number;
  public readonly isNewRow: boolean;
  public readonly x: number;
  public readonly y: number;
  public readonly rowWidth: number;

  public constructor(row: number, index: number, isNewRow: boolean, x: number, y: number, rowWidth: number) {
    this.row = row;
    this.index = index;
    this.isNewRow = isNewRow;
    this.x = x;
    this.y = y;
    this.rowWidth = rowWidth;
  }

  public equals(other: ToolbarDropTarget | null): boolean {
    return !Object.isNull(other) && other.row === this.row && other.index === this.index && other.isNewRow === this.isNewRow
      && other.x === this.x && other.y === this.y && other.rowWidth === this.rowWidth;
  }
}
