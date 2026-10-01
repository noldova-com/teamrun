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
  Assert, AssertFailedException, GitHubSummaryWriter, TestClass, TestClassResult, TestMethod, TestMethodResult, TestOutcome, TestRunResult
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
          new TestMethodResult("Package", "SampleTests", "passes", undefined, [], TestOutcome.Passed, 1000, undefined, undefined),
          new TestMethodResult("Package", "SampleTests", "fails", 0, ["row"], TestOutcome.Failed, 200, new AssertFailedException("</pre><script>&", 1, 2), undefined)
        ]),
        new TestClassResult("Package", "OtherTests", "sample.test.js", [
          new TestMethodResult("Package", "OtherTests", "skips", undefined, [], TestOutcome.Skipped, 0, undefined, "not available")
        ]),
        new TestClassResult("OtherPackage", "SampleTests", "sample.test.js", [
          new TestMethodResult("OtherPackage", "SampleTests", "passes", undefined, [], TestOutcome.Passed, 50, undefined, undefined)
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
          new TestMethodResult("Package", "SampleTests", "waits", undefined, [], TestOutcome.Unreached, 0, undefined, undefined)
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
      new GitHubSummaryWriter(undefined).writeFailure("ignored");
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
