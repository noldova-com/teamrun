/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, BlockCoverage, CoverageReportWriter, CoverageResult, FileCoverage, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

@TestClass
export class CoverageReportRowTests {
  @TestMethod
  public carriesTheProjectAndFileCellsIntoTheReport(): void {
    const lines = new CoverageReportWriter().formatLines(new CoverageResult([
      new FileCoverage("Noldova.Context.Core", "api/index.ts", [], 200, 0, [new BlockCoverage(1, true)]),
      new FileCoverage("Noldova.Context.Core", "extensions/string.extensions.ts", [], 200, 0, []),
      new FileCoverage("Noldova.Context.Testing", "assert.ts", [], 200, 0, []),
    ]), false);

    Assert.areEqual(1, lines.filter(t => t.includes(" Noldova.Context.Core ")).length);
    Assert.areEqual(1, lines.filter(t => t.includes(" Noldova.Context.Testing ")).length);
    Assert.isTrue(lines.some(t => t.includes("  api/index.ts") && t.includes("100.0%") && t.includes("1/1")));
    Assert.isTrue(lines.some(t => t.includes("  extensions/string.extensions.ts")));
  }
}
