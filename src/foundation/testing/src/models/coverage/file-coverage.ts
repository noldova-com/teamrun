/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { nameof } from "@noldova/teamrun-foundation-core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../../resources.js";
import type { BlockCoverage } from "./block-coverage.js";
import type { LineRange } from "./line-range.js";

export class FileCoverage {
  public readonly projectName: string;
  public readonly relativePath: string;
  public readonly uncoveredLineRanges: readonly LineRange[];
  public readonly totalLength: number;
  public readonly uncoveredLength: number;
  public readonly blockCoverages: readonly BlockCoverage[];
  public readonly isFullyCovered: boolean;
  public readonly isExecutable: boolean;
  public readonly blockCount: number;
  public readonly takenBlockCount: number;

  public constructor(
    projectName: string,
    relativePath: string,
    uncoveredLineRanges: readonly LineRange[],
    totalLength: number,
    uncoveredLength: number,
    blockCoverages: readonly BlockCoverage[]) {
    ArgumentException.throwIfNullOrWhitespace(projectName, nameof<FileCoverage>(t => t.projectName));
    ArgumentException.throwIfNullOrWhitespace(relativePath, nameof<FileCoverage>(t => t.relativePath));
    if (!Number.isInteger(totalLength) || totalLength < 0)
      throw new ArgumentOutOfRangeException(nameof<FileCoverage>(t => t.totalLength), totalLength, Resources.totalLengthInvalid);

    if (!Number.isInteger(uncoveredLength) || uncoveredLength < 0 || uncoveredLength > totalLength)
      throw new ArgumentOutOfRangeException(nameof<FileCoverage>(t => t.uncoveredLength), uncoveredLength, Resources.uncoveredLengthInvalid);

    if ((uncoveredLength === 0) !== (uncoveredLineRanges.length === 0))
      throw new ArgumentException(Resources.uncoveredRangesInvalid, nameof<FileCoverage>(t => t.uncoveredLineRanges));

    if (totalLength === 0 && blockCoverages.length > 0)
      throw new ArgumentException(Resources.nonExecutableBlocksInvalid, nameof<FileCoverage>(t => t.blockCoverages));

    this.projectName = projectName;
    this.relativePath = relativePath;
    this.uncoveredLineRanges = [...uncoveredLineRanges];
    this.totalLength = totalLength;
    this.uncoveredLength = uncoveredLength;
    this.blockCoverages = [...blockCoverages];
    this.isExecutable = this.totalLength > 0;
    this.isFullyCovered = this.isExecutable && this.uncoveredLineRanges.length === 0;
    this.blockCount = this.blockCoverages.length;
    this.takenBlockCount = this.blockCoverages.filter(t => t.isTaken).length;
  }
}
