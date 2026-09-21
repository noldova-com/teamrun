/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CoverageReportRow {
  public readonly fileCell: string;
  public readonly sourceCell: string;
  public readonly blocksCell: string;
  public readonly color: string;
  public readonly colorsFileCell: boolean;

  public constructor(fileCell: string, sourceCell: string, blocksCell: string, color: string, colorsFileCell: boolean) {
    this.fileCell = fileCell;
    this.sourceCell = sourceCell;
    this.blocksCell = blocksCell;
    this.color = color;
    this.colorsFileCell = colorsFileCell;
  }
}
