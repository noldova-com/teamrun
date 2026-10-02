/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FileCoverage } from "./file-coverage.js";

export class CoverageResult {
  public readonly fileCoverages: readonly FileCoverage[];
  public readonly isComplete: boolean;
  public readonly executableFileCoverages: readonly FileCoverage[];
  public readonly incompleteFileCoverages: readonly FileCoverage[];
  public readonly totalLength: number;
  public readonly uncoveredLength: number;
  public readonly blockCount: number;
  public readonly takenBlockCount: number;

  public constructor(fileCoverages: readonly FileCoverage[]) {
    this.fileCoverages = [...fileCoverages];
    this.executableFileCoverages = this.fileCoverages.filter(t => t.isExecutable);
    this.incompleteFileCoverages = this.executableFileCoverages.filter(t => !t.isFullyCovered);
    this.isComplete = this.incompleteFileCoverages.length === 0;
    this.totalLength = this.fileCoverages.reduce((sum, fileCoverage) => sum + fileCoverage.totalLength, 0);
    this.uncoveredLength = this.fileCoverages.reduce((sum, fileCoverage) => sum + fileCoverage.uncoveredLength, 0);
    this.blockCount = this.fileCoverages.reduce((sum, fileCoverage) => sum + fileCoverage.blockCount, 0);
    this.takenBlockCount = this.fileCoverages.reduce((sum, fileCoverage) => sum + fileCoverage.takenBlockCount, 0);
  }
}
