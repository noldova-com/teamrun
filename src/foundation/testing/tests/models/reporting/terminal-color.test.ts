/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, CoverageReportWriter, CoverageResult, FileCoverage, LineRange, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TerminalColorTests {
  @TestMethod
  public colorsCoverageLevelsCanonically(): void {
    const lines = new CoverageReportWriter().formatLines(new CoverageResult([
      new FileCoverage("Noldova.Context.Core", "green.ts", [new LineRange(1, 1)], 100, 5, []),
      new FileCoverage("Noldova.Context.Core", "yellow.ts", [new LineRange(1, 1)], 100, 25, []),
      new FileCoverage("Noldova.Context.Core", "red.ts", [new LineRange(1, 2)], 100, 50, []),
    ]), false);

    Assert.isTrue(lines.some(t => t.includes("green.ts") && t.includes("\u001b[32m")));
    Assert.isTrue(lines.some(t => t.includes("yellow.ts") && t.includes("\u001b[33m")));
    Assert.isTrue(lines.some(t => t.includes("red.ts") && t.includes("\u001b[31m")));
  }
}
