/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, BlockCoverage, FileCoverage, LineRange, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class FileCoverageTests {
  @TestMethod
  public computesTheDerivedCounts(): void {
    const fileCoverage = new FileCoverage("Sample", "sample.js", [], 100, 0, [new BlockCoverage(1, true), new BlockCoverage(2, false)]);

    Assert.areEqual("Sample", fileCoverage.projectName);
    Assert.areEqual("sample.js", fileCoverage.relativePath);
    Assert.isTrue(fileCoverage.isFullyCovered);
    Assert.isTrue(fileCoverage.isExecutable);
    Assert.areEqual(2, fileCoverage.blockCount);
    Assert.areEqual(1, fileCoverage.takenBlockCount);
  }

  @TestMethod
  public reportsAnUncoveredFileAsIncomplete(): void {
    Assert.isFalse(new FileCoverage("Sample", "sample.js", [new LineRange(1, 2)], 100, 40, []).isFullyCovered);
  }

  @TestMethod
  public identifiesAFileWithoutExecutableRanges(): void {
    const fileCoverage = new FileCoverage("Sample", "types.js", [], 0, 0, []);

    Assert.isFalse(fileCoverage.isExecutable);
    Assert.isFalse(fileCoverage.isFullyCovered);
  }

  @TestMethod
  public rejectsBlocksForANonExecutableFile(): void {
    Assert.throws(() => new FileCoverage("Sample", "types.js", [], 0, 0, [new BlockCoverage(1, true)]), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceProjectName(): void {
    Assert.throws(() => new FileCoverage(" ", "sample.js", [], 0, 0, []), ArgumentException);
  }

  @TestMethod
  public rejectsAWhitespaceRelativePath(): void {
    Assert.throws(() => new FileCoverage("Sample", " ", [], 0, 0, []), ArgumentException);
  }

  @TestMethod
  public rejectsANegativeTotalLength(): void {
    Assert.throws(() => new FileCoverage("Sample", "sample.js", [], -1, 0, []), ArgumentException);
  }

  @TestMethod
  public rejectsAnUncoveredLengthBeyondTheTotal(): void {
    Assert.throws(() => new FileCoverage("Sample", "sample.js", [new LineRange(1, 1)], 10, 11, []), ArgumentException);
  }

  @TestMethod
  public rejectsAnUncoveredLengthWithoutRanges(): void {
    Assert.throws(() => new FileCoverage("Sample", "sample.js", [], 10, 5, []), ArgumentException);
  }

  @TestMethod
  public rejectsRangesWithoutAnUncoveredLength(): void {
    Assert.throws(() => new FileCoverage("Sample", "sample.js", [new LineRange(1, 1)], 10, 0, []), ArgumentException);
  }

  @TestMethod
  public copiesTheCoverageCollections(): void {
    const uncoveredLineRanges = [new LineRange(1, 1)];
    const blockCoverages = [new BlockCoverage(1, false)];
    const fileCoverage = new FileCoverage("Sample", "sample.js", uncoveredLineRanges, 10, 5, blockCoverages);
    uncoveredLineRanges.push(new LineRange(2, 2));
    blockCoverages.push(new BlockCoverage(2, true));

    Assert.areEqual(1, fileCoverage.uncoveredLineRanges.length);
    Assert.areEqual(1, fileCoverage.blockCoverages.length);
  }
}
