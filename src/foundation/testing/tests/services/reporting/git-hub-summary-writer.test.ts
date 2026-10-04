/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  Assert, AssertFailedException, BlockCoverage, CoverageResult, FileCoverage, GitHubSummaryWriter, LineRange, TestClass, TestClassResult, TestDataRow, TestMethod,
  TestMethodResult, TestMethodResultOptions, TestOutcome, TestRunResult, TestSelection
} from "@noldova/teamrun-foundation-testing";

@TestClass
export class GitHubSummaryWriterTests {
  @TestMethod
  public appendsCountsAndEscapedDetailsWithDistinctPackageFiles(): void {
    const directory = mkdtempSync(join(tmpdir(), "teamrun-summary-"));
    try {
      const path = join(directory, "summary.md");
      writeFileSync(path, "Existing step content\n");
      const result = new TestRunResult([
        new TestClassResult("Package", "SampleTests", "sample.test.js", [
          new TestMethodResult("Package", "SampleTests", "passes", TestOutcome.Passed, 1000),
          new TestMethodResult("Package", "SampleTests", "fails", TestOutcome.Failed, 200, new TestMethodResultOptions({ testDataRow: new TestDataRow(0, ["row"]), failure: new AssertFailedException("</pre><script>&", 1, 2) }))
        ]),
        new TestClassResult("Package", "OtherTests", "sample.test.js", [
          new TestMethodResult("Package", "OtherTests", "skips", TestOutcome.Skipped, 0, new TestMethodResultOptions({ skipReason: "not available" }))
        ]),
        new TestClassResult("OtherPackage", "SampleTests", "sample.test.js", [
          new TestMethodResult("OtherPackage", "SampleTests", "passes", TestOutcome.Passed, 50)
        ])
      ]);
      new GitHubSummaryWriter(path).writeTests(result);
      const report = readFileSync(path, "utf8");

      Assert.isTrue(report.startsWith("Existing step content\n"));
      for (const line of ["| Test files | 2 |", "| Total: | 4 |", "| Passed: | 2 |", "| Failed: | 1 |", "| Skipped: | 1 |", "| Unreached: | 0 |", "| Time: | 1.25 s |"])
        Assert.isTrue(report.includes(line), line);
      Assert.isTrue(report.includes('fails[0]("row")'));
      Assert.isTrue(report.includes("&lt;/pre&gt;&lt;script&gt;&amp;"));
      Assert.isTrue(report.includes("expected: 1"));
      Assert.isTrue(report.includes("actual:   2"));
      Assert.isTrue(report.includes("not available"));
      Assert.isFalse(report.includes("\u001b"));
      Assert.isFalse(report.includes("<script>"));
    }
    finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public listsTheFiltersAndTheCountsOfAFilteredRunOnly(): void {
    const directory = mkdtempSync(join(tmpdir(), "teamrun-summary-"));
    try {
      const path = join(directory, "summary.md");
      const writer = new GitHubSummaryWriter(path);
      const classResults = [new TestClassResult("Package", "SampleTests", "sample.test.js", [
        new TestMethodResult("Package", "SampleTests", "passes", TestOutcome.Passed, 1)
      ])];
      writer.writeTests(new TestRunResult(classResults));
      Assert.isFalse(readFileSync(path, "utf8").includes("Discovered:"));

      writer.writeTests(new TestRunResult(classResults, new TestSelection(["Sample", "Other"], 9, 1)));
      const report = readFileSync(path, "utf8");
      for (const line of ["| Filters: | Sample, Other |", "| Discovered: | 9 |", "| Selected: | 1 |", "| Unselected: | 8 |"])
        Assert.isTrue(report.includes(line), line);
    }
    finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public reportsAnEmptySelectionAndUnreachedTests(): void {
    const directory = mkdtempSync(join(tmpdir(), "teamrun-summary-"));
    try {
      const path = join(directory, "summary.md");
      const writer = new GitHubSummaryWriter(path);
      writer.writeTests(new TestRunResult([]));
      let report = readFileSync(path, "utf8");
      Assert.isTrue(report.includes("| Total: | 0 |"));
      Assert.isFalse(report.includes("<details>"));

      writer.writeTests(new TestRunResult([
        new TestClassResult("Package", "SampleTests", "sample.test.js", [
          new TestMethodResult("Package", "SampleTests", "waits", TestOutcome.Unreached, 0)
        ])
      ]));
      report = readFileSync(path, "utf8");
      Assert.isTrue(report.includes("| Unreached: | 1 |"));
      Assert.isTrue(report.includes("waits — not run"));
    }
    finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public reportsCompleteAndIncompleteCoverage(): void {
    const directory = mkdtempSync(join(tmpdir(), "teamrun-summary-"));
    try {
      const path = join(directory, "summary.md");
      const writer = new GitHubSummaryWriter(path);
      writer.writeCoverage(new CoverageResult([new FileCoverage("Package", "covered.ts", [], 100, 0, [new BlockCoverage(1, true)])]));
      let report = readFileSync(path, "utf8");
      Assert.isTrue(report.includes("| Coverage gate | Passed |"));
      Assert.isTrue(report.includes("| Fully covered executable files | 1/1 |"));
      Assert.isTrue(report.includes("| Excluded files | 0 |"));
      Assert.isTrue(report.includes("| Coverage | 100.0% |"));
      Assert.isTrue(report.includes("| Blocks | 1/1 |"));
      Assert.isFalse(report.includes("<details>"));

      writer.writeCoverage(new CoverageResult([new FileCoverage("Package", "<partial>.ts", [new LineRange(1, 2)], 100, 50, [new BlockCoverage(1, false)])]));
      writer.writeCoverage(new CoverageResult([]));
      report = readFileSync(path, "utf8");
      Assert.isTrue(report.includes("| Coverage gate | Failed |"));
      Assert.isTrue(report.includes("| Coverage | 50.0% |"));
      Assert.isTrue(report.includes("| Coverage | - |"));
      Assert.isTrue(report.includes("&lt;partial&gt;.ts"));
      Assert.isTrue(report.includes("uncovered lines 1-2"));

      writer.writeCoverage(new CoverageResult([new FileCoverage("Package", "main.ts", [new LineRange(1, 2)], 100, 100, [], "Runs only inside Electron.")]));
      report = readFileSync(path, "utf8");
      Assert.isTrue(report.includes("| Excluded files | 1 |"));
      Assert.isTrue(report.includes("excluded: Runs only inside Electron."));
    }
    finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public boundsExecutionFailureDetails(): void {
    const directory = mkdtempSync(join(tmpdir(), "teamrun-summary-"));
    try {
      const path = join(directory, "summary.md");
      new GitHubSummaryWriter(path).writeFailure("<".repeat(100_000));
      const report = readFileSync(path, "utf8");
      Assert.isTrue(report.includes("Package test execution failed"));
      Assert.isTrue(report.includes("Additional output omitted."));
      Assert.isTrue(report.includes("&lt;"));
      Assert.isTrue(Buffer.byteLength(report) < 128_000);
    }
    finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public disablesMissingPathsAndReportsWriteErrorsWithoutThrowing(): void {
    const directory = mkdtempSync(join(tmpdir(), "teamrun-summary-"));
    const messages: unknown[] = [];
    const previous = console.error;
    console.error = (value: unknown): void => { messages.push(value); };
    try {
      new GitHubSummaryWriter().writeFailure("ignored");
      new GitHubSummaryWriter(" ").writeFailure("ignored");
      Assert.areEqual(0, messages.length);
      new GitHubSummaryWriter(directory).writeFailure("cannot append to a directory");
      Assert.areEqual("Could not write the GitHub job summary; see the console report.", messages[0]);
    }
    finally {
      console.error = previous;
      rmSync(directory, { recursive: true, force: true });
    }
  }
}
