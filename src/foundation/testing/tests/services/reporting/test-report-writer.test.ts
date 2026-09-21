/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  Assert,
  AssertFailedException,
  TestClass,
  TestClassResult,
  TestData,
  TestMethod,
  TestMethodResult,
  TestOutcome,
  TestReportWriter,
  TestRunResult
} from "@noldova/teamrun-foundation-testing";

import { ConsoleCapture } from "../../fixtures/reporting/console-capture.fixture.js";

@TestClass
export class TestReportWriterTests {
  @TestMethod
  @TestData(842, "Time:    842 ms")
  @TestData(999, "Time:    999 ms")
  @TestData(1_000, "Time:    1.00 s")
  @TestData(1_091, "Time:    1.09 s")
  @TestData(59_999, "Time:    1 min 0.00 s")
  @TestData(134_320, "Time:    2 min 14.32 s")
  @TestData(3_599_999, "Time:    1 h 0 min 0.00 s")
  @TestData(11_224_510, "Time:    3 h 7 min 4.51 s")
  public formatsTotalDuration(durationMilliseconds: number, expectedLine: string): void {
    const lines = this.format(new TestMethodResult(
      "TestPackage",
      "SampleTests",
      "passes",
      undefined,
      [],
      TestOutcome.Passed,
      durationMilliseconds,
      undefined,
      undefined));

    Assert.isTrue(lines.includes(expectedLine));
  }

  @TestMethod
  public formatsAPassedTest(): void {
    const lines = this.format(new TestMethodResult("TestPackage", "SampleTests", "passes", undefined, [], TestOutcome.Passed, 3, undefined, undefined));

    Assert.isTrue(lines.some(t => t.includes("passes") && t.includes("✓")));
  }

  @TestMethod
  public identifiesThePackageFileAndClass(): void {
    const lines = this.format(new TestMethodResult("TestPackage", "SampleTests", "passes", undefined, [], TestOutcome.Passed, 3, undefined, undefined));

    Assert.isTrue(lines.includes("TestPackage/sample.test.js — SampleTests"));
  }

  @TestMethod
  public formatsAnAssertionFailureWithItsValues(): void {
    const failure = new AssertFailedException("mismatch", 1, 2);
    const lines = this.format(new TestMethodResult("TestPackage", "SampleTests", "fails", undefined, [], TestOutcome.Failed, 3, failure, undefined));

    Assert.isTrue(lines.some(t => t.includes("AssertFailedException: mismatch")));
    Assert.isTrue(lines.some(t => t.includes("expected: 1")));
    Assert.isTrue(lines.some(t => t.includes("actual:   2")));
  }

  @TestMethod
  public formatsAnErrorFailure(): void {
    const lines = this.format(new TestMethodResult("TestPackage", "SampleTests", "fails", undefined, [], TestOutcome.Failed, 3, new Error("boom"), undefined));

    Assert.isTrue(lines.some(t => t.includes("Error: boom")));
  }

  @TestMethod
  public formatsAThrownValueThatIsNotAnError(): void {
    const lines = this.format(new TestMethodResult("TestPackage", "SampleTests", "fails", undefined, [], TestOutcome.Failed, 3, "boom", undefined));

    Assert.isTrue(lines.some(t => t.includes("threw: \"boom\"")));
  }

  @TestMethod
  public formatsErrorValuesInsideAssertionFailures(): void {
    const failure = new AssertFailedException("mismatch", new Error("expected error"), 2);
    const lines = this.format(new TestMethodResult("TestPackage", "SampleTests", "fails", undefined, [], TestOutcome.Failed, 3, failure, undefined));

    Assert.isTrue(lines.some(t => t.includes("expected: Error: expected error")));
  }

  @TestMethod
  public omitsValuelessAssertionDetails(): void {
    const failure = new AssertFailedException("Assertion failed.");
    const lines = this.format(new TestMethodResult("TestPackage", "SampleTests", "fails", undefined, [], TestOutcome.Failed, 3, failure, undefined));

    Assert.isTrue(lines.some(t => t.includes("AssertFailedException: Assertion failed.")));
    Assert.isTrue(lines.every(t => !t.includes("expected:")));
    Assert.isTrue(lines.every(t => !t.includes("actual:")));
  }

  @TestMethod
  public formatsASkippedTestWithItsReason(): void {
    const lines = this.format(new TestMethodResult("TestPackage", "SampleTests", "skips", undefined, [], TestOutcome.Skipped, 0, undefined, "pending"));

    Assert.isTrue(lines.some(t => t.includes("skips") && t.includes("skipped: pending")));
  }

  @TestMethod
  public formatsAParameterizedTestWithItsIndexAndValues(): void {
    const lines = this.format(new TestMethodResult(
      "TestPackage",
      "SampleTests",
      "accepts",
      2,
      ["value", undefined],
      TestOutcome.Passed,
      3,
      undefined,
      undefined));

    Assert.isTrue(lines.some(t => t.includes("accepts[2](\"value\", undefined)")));
  }

  @TestMethod
  public reportsFailedAndSkippedTotalsOnlyWhenPresent(): void {
    const mixed = this.formatRun([
      new TestMethodResult("TestPackage", "SampleTests", "passes", undefined, [], TestOutcome.Passed, 1, undefined, undefined),
      new TestMethodResult("TestPackage", "SampleTests", "fails", undefined, [], TestOutcome.Failed, 1, new Error("boom"), undefined),
      new TestMethodResult("TestPackage", "SampleTests", "skips", undefined, [], TestOutcome.Skipped, 0, undefined, "pending"),
    ]);
    const allPassing = this.formatRun([
      new TestMethodResult("TestPackage", "SampleTests", "passes", undefined, [], TestOutcome.Passed, 1, undefined, undefined),
    ]);

    Assert.isTrue(mixed.some(t => t.includes("Failed:  1")));
    Assert.isTrue(mixed.some(t => t.includes("Skipped: 1")));
    Assert.isTrue(allPassing.every(t => !t.includes("Failed:")));
    Assert.isTrue(allPassing.every(t => !t.includes("Skipped:")));
  }

  @TestMethod
  public skipsPassingDetailsOnRequest(): void {
    const result = new TestRunResult([
      new TestClassResult("TestPackage", "QuietTests", "quiet.test.js", [
        new TestMethodResult("TestPackage", "QuietTests", "passes", undefined, [], TestOutcome.Passed, 1, undefined, undefined),
        new TestMethodResult("TestPackage", "QuietTests", "fails", undefined, [], TestOutcome.Failed, 1, new Error("boom"), undefined),
        new TestMethodResult("TestPackage", "QuietTests", "skips", undefined, [], TestOutcome.Skipped, 0, undefined, "pending"),
      ]),
    ]);
    const lines = new TestReportWriter().formatLines(result, true);

    Assert.isTrue(lines.every(t => !t.includes("passes")));
    Assert.isTrue(lines.some(t => t.includes("fails")));
    Assert.isTrue(lines.some(t => t.includes("skips") && t.includes("pending")));
    Assert.isTrue(lines.some(t => t.includes("Total:   3")));
    Assert.isTrue(lines.some(t => t.includes("Time:    2 ms")));
  }

  @TestMethod
  public hidesFullyPassingClassesOnRequest(): void {
    const result = new TestRunResult([
      new TestClassResult("TestPackage", "AllGreenTests", "green.test.js", [
        new TestMethodResult("TestPackage", "AllGreenTests", "passes", undefined, [], TestOutcome.Passed, 1, undefined, undefined),
      ]),
    ]);
    const lines = new TestReportWriter().formatLines(result, true);

    Assert.isTrue(lines.every(t => !t.includes("AllGreenTests")));
    Assert.isTrue(lines.some(t => t.includes("Total:   1")));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public preservesTheExactReportWhenWritingCompletedClasses(skipPassingDetails: boolean): void {
    const passed = new TestClassResult("TestPackage", "GreenTests", "green.test.js", [
      new TestMethodResult("TestPackage", "GreenTests", "passes", undefined, [], TestOutcome.Passed, 1, undefined, undefined),
    ]);
    const mixed = new TestClassResult("TestPackage", "MixedTests", "mixed.test.js", [
      new TestMethodResult("TestPackage", "MixedTests", "accepts", 0, ["value"], TestOutcome.Passed, 3, undefined, undefined),
      new TestMethodResult("TestPackage", "MixedTests", "fails", undefined, [], TestOutcome.Failed, 2, new AssertFailedException("mismatch", 1, 2), undefined),
      new TestMethodResult("TestPackage", "MixedTests", "skips", undefined, [], TestOutcome.Skipped, 0, undefined, "pending"),
    ]);
    const result = new TestRunResult([passed, mixed]);
    const firstLines = skipPassingDetails ? [] : [
      "TestPackage/green.test.js — GreenTests",
      "  \u001b[32m✓\u001b[0m passes (1 ms)",
      "",
    ];
    const classLines = [
      ...firstLines,
      "TestPackage/mixed.test.js — MixedTests",
      ...(skipPassingDetails ? [] : ["  \u001b[32m✓\u001b[0m accepts[0](\"value\") (3 ms)"]),
      "  \u001b[31m✘\u001b[0m fails (2 ms)",
      "    AssertFailedException: mismatch",
      "    expected: 1",
      "    actual:   2",
      "  \u001b[33m○\u001b[0m skips — skipped: pending",
      "",
    ];
    const expected = [
      ...classLines,
      "----------------------------------------",
      "Total:   4",
      "Time:    6 ms",
      "\u001b[32mPassed:  2\u001b[0m",
      "\u001b[31mFailed:  1\u001b[0m",
      "\u001b[33mSkipped: 1\u001b[0m",
    ];
    using capture = new ConsoleCapture();
    const writer = new TestReportWriter(skipPassingDetails);

    writer.onClassCompleted(passed);
    Assert.areEqual(firstLines.join("\n"), capture.lines.join("\n"));
    writer.onClassCompleted(mixed);
    Assert.areEqual(classLines.join("\n"), capture.lines.join("\n"));
    writer.writeSummary(result);
    Assert.areEqual(expected.join("\n"), capture.lines.join("\n"));

    capture.lines.length = 0;
    writer.write(result, skipPassingDetails);
    Assert.areEqual(expected.join("\n"), capture.lines.join("\n"));
  }

  private format(methodResult: TestMethodResult): string[] {
    return this.formatRun([methodResult]);
  }

  private formatRun(methodResults: readonly TestMethodResult[]): string[] {
    const result = new TestRunResult([new TestClassResult("TestPackage", "SampleTests", "sample.test.js", methodResults)]);

    return new TestReportWriter().formatLines(result, false);
  }
}
