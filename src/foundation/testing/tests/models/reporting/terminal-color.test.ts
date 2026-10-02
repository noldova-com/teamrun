/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestClassResult, TestMethod, TestMethodResult, TestMethodResultOptions, TestOutcome, TestReportWriter, TestRunResult } from "@noldova/teamrun-foundation-testing";

@TestClass
export class TerminalColorTests {
  @TestMethod
  public colorsOutcomesCanonically(): void {
    const results = [
      new TestMethodResult("Sample.Package", "SampleTests", "passes", TestOutcome.Passed, 1),
      new TestMethodResult("Sample.Package", "SampleTests", "fails", TestOutcome.Failed, 1, new TestMethodResultOptions({ failure: new Error("failure") })),
      new TestMethodResult("Sample.Package", "SampleTests", "skips", TestOutcome.Skipped, 0, new TestMethodResultOptions({ skipReason: "reason" })),
      new TestMethodResult("Sample.Package", "SampleTests", "waits", TestOutcome.Unreached, 0)
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
