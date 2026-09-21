/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, BlockCoverage, CoverageResult, FileCoverage, LineRange, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class CoverageResultTests {
  @TestMethod
  public aggregatesAcrossFiles(): void {
    const result = new CoverageResult([
      new FileCoverage("Sample", "covered.js", [], 100, 0, [new BlockCoverage(1, true)]),
      new FileCoverage("Sample", "partial.js", [new LineRange(2, 2)], 100, 30, [new BlockCoverage(2, false)]),
      new FileCoverage("Sample", "types.js", [], 0, 0, []),
    ]);

    Assert.areEqual(200, result.totalLength);
    Assert.areEqual(30, result.uncoveredLength);
    Assert.areEqual(2, result.blockCount);
    Assert.areEqual(1, result.takenBlockCount);
    Assert.isFalse(result.isComplete);
    Assert.areEqual(1, result.incompleteFileCoverages.length);
    Assert.areEqual(2, result.executableFileCoverages.length);
  }

  @TestMethod
  public treatsAnEmptyResultAsComplete(): void {
    Assert.isTrue(new CoverageResult([]).isComplete);
  }

  @TestMethod
  public excludesNonExecutableFilesFromCompletion(): void {
    const result = new CoverageResult([new FileCoverage("Sample", "types.js", [], 0, 0, [])]);

    Assert.isTrue(result.isComplete);
    Assert.areEqual(0, result.executableFileCoverages.length);
    Assert.areEqual(0, result.incompleteFileCoverages.length);
  }

  @TestMethod
  public copiesTheFileCoverages(): void {
    const fileCoverages = [new FileCoverage("Sample", "sample.js", [], 100, 0, [])];
    const result = new CoverageResult(fileCoverages);
    fileCoverages.push(new FileCoverage("Sample", "other.js", [], 100, 0, []));

    Assert.areEqual(1, result.fileCoverages.length);
    Assert.areEqual(1, result.executableFileCoverages.length);
  }
}
