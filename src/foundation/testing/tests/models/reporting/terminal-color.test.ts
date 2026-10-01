/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestClassResult, TestMethod, TestMethodResult, TestOutcome, TestReportWriter, TestRunResult } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TerminalColorTests {
  @TestMethod
  public colorsOutcomesCanonically(): void {
    const results = [
      new TestMethodResult("Sample.Package", "SampleTests", "passes", undefined, [], TestOutcome.Passed, 1, undefined, undefined),
      new TestMethodResult("Sample.Package", "SampleTests", "fails", undefined, [], TestOutcome.Failed, 1, new Error("failure"), undefined),
      new TestMethodResult("Sample.Package", "SampleTests", "skips", undefined, [], TestOutcome.Skipped, 0, undefined, "reason"),
      new TestMethodResult("Sample.Package", "SampleTests", "waits", undefined, [], TestOutcome.Unreached, 0, undefined, undefined)
    ];
    const run = new TestRunResult([new TestClassResult("Sample.Package", "SampleTests", "sample.test.js", results)]);

    const lines = new TestReportWriter().formatLines(run, false);

    Assert.isTrue(lines.some(t => t.includes("passes") && t.includes("\u001b[32m")));
    Assert.isTrue(lines.some(t => t.includes("fails") && t.includes("\u001b[31m")));
    Assert.isTrue(lines.some(t => t.includes("skips") && t.includes("\u001b[33m")));
    Assert.isTrue(lines.some(t => t.includes("waits") && t.includes("\u001b[31m")));
    Assert.isTrue(lines.every(t => !t.includes("\u001b[") || t.includes("\u001b[0m")));
  }
}
