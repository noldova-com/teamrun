/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { spawn } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Assert, CoverageEnvironment, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { EntryRun } from "../../fixtures/execution/entry-run.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class TestRunEntryTests {
  @TestMethod
  @TestData("finishesCleanly", 0, null)
  @TestData("keepsTheCoverageFolderOutOfItsEnvironment", 0, null)
  @TestData("passesButLeaksATimer", 1, "resources remain open: Timeout")
  @TestData("failsAndLeaksATimer", 1, "resources remain open: Timeout")
  @TestData("passesButLeaksAWorkerThread", 1, "Node names no open resource; a worker thread or a native handle keeps it alive")
  public async exitsAfterReportingEvenWhenATestLeaksAResource(method: string, code: number, failure: string | null): Promise<void> {
    const leaked = !Object.isNull(failure);
    const directory = await mkdtemp(join(tmpdir(), "teamrun-entry-lifetime-"));
    try {
      const fixture = new URL("../../fixtures/execution/entry-lifetime.fixture.js", import.meta.url).href;
      await writeFile(join(directory, "lifetime.test.js"), `export { EntryLifetimeFixture as EntryLifetimeTests } from ${JSON.stringify(fixture)};\n`);
      const summaryPath = join(directory, "summary.md");
      const result = await this.runEntryArgumentsAsync(["TestPackage", directory], JSON.stringify([method]), summaryPath);
      const summary = await readFile(summaryPath, "utf8");
      Assert.areEqual(code, result.exitCode, result.errorOutput);
      Assert.areEqual(leaked, result.errorOutput.includes("Failing the run"));
      if (!Object.isNull(failure))
        Assert.isTrue(result.errorOutput.includes(failure), result.errorOutput);
      Assert.isTrue(summary.includes("## TeamRun Package Test Report"));
      Assert.isTrue(summary.includes("| Total: | 1 |"));
      Assert.areEqual(leaked, summary.includes("### Package test execution failed"));
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  @TestData("usesTheRunsOwnTemporaryFolder", 0, null, false)
  @TestData("leavesATemporaryFolder", 1, "Tests finished but left entry-leftover-", false)
  @TestData("leavesATemporaryFolder", 1, "Tests finished but left entry-leftover-", true)
  public async leavesTheTemporaryFolderAsItFoundIt(method: string, code: number, failure: string | null, asRoot: boolean): Promise<void> {
    using directory = new TemporaryDirectory();
    const testsDirectory = join(directory.path, "tests");
    const temporaryDirectory = join(directory.path, "temporary");
    await mkdir(testsDirectory);
    await mkdir(temporaryDirectory);
    const fixture = new URL("../../fixtures/execution/entry-lifetime.fixture.js", import.meta.url).href;
    await writeFile(join(testsDirectory, "lifetime.test.js"), `export { EntryLifetimeFixture as EntryLifetimeTests } from ${JSON.stringify(fixture)};\n`);
    const summaryPath = join(directory.path, "summary.md");

    const result = await this.runEntryArgumentsAsync(["TestPackage", testsDirectory], JSON.stringify([method]), summaryPath,
      asRoot ? { TEAMRUN_TEMPORARY_ROOT: temporaryDirectory } : { TMPDIR: temporaryDirectory, TEMP: temporaryDirectory, TMP: temporaryDirectory });

    Assert.areEqual(code, result.exitCode, result.errorOutput);
    if (!Object.isNull(failure))
      Assert.isTrue(result.errorOutput.includes(failure), result.errorOutput);
    Assert.areEqual(!Object.isNull(failure), (await readFile(summaryPath, "utf8")).includes("### Package test execution failed"));
    Assert.areEqual(0, (await readdir(temporaryDirectory)).length);
  }

  @TestMethod
  public async failsAFilteredRunThatSelectsNothingAndSaysSo(): Promise<void> {
    using directory = new TemporaryDirectory();
    const testsDirectory = join(directory.path, "tests");
    await mkdir(testsDirectory);
    const fixture = new URL("../../fixtures/execution/entry-lifetime.fixture.js", import.meta.url).href;
    await writeFile(join(testsDirectory, "lifetime.test.js"), `export { EntryLifetimeFixture as EntryLifetimeTests } from ${JSON.stringify(fixture)};\n`);
    const summaryPath = join(directory.path, "summary.md");

    const result = await this.runEntryArgumentsAsync(["TestPackage", testsDirectory], JSON.stringify(["noTestIsNamedThis"]), summaryPath);

    Assert.areEqual(1, result.exitCode, result.errorOutput);
    Assert.isTrue(result.errorOutput.includes("No test matched the filters"), result.errorOutput);
    const summary = await readFile(summaryPath, "utf8");
    Assert.isTrue(summary.includes("| Filters: | <code>noTestIsNamedThis</code> |"));
    Assert.isTrue(summary.includes("| Selected: | 0 |"));
    Assert.isTrue(summary.includes("No test matched the filters"));
  }

  @TestMethod
  @TestData("[\"noTestIsNamedThis\"]", 0, 8)
  @TestData("[\"finishesCleanly\"]", 1, 8)
  @TestData("[\"finishesCleanly\",\"keepsTheCoverageFolderOutOfItsEnvironment\"]", 2, 8)
  public async writesWhatItDiscoveredAndSelectedToTheResultFileAndLeavesAnEmptySelectionToItsCaller(filters: string, selected: number, discovered: number): Promise<void> {
    using directory = new TemporaryDirectory();
    const testsDirectory = join(directory.path, "tests");
    await mkdir(testsDirectory);
    const fixture = new URL("../../fixtures/execution/entry-lifetime.fixture.js", import.meta.url).href;
    await writeFile(join(testsDirectory, "lifetime.test.js"), `export { EntryLifetimeFixture as EntryLifetimeTests } from ${JSON.stringify(fixture)};\n`);
    const resultPath = join(directory.path, "result.json");

    const result = await this.runEntryArgumentsAsync(["TestPackage", testsDirectory], filters, undefined, { TEAMRUN_TEST_RESULT_FILE: resultPath });

    Assert.areEqual(0, result.exitCode, result.errorOutput);
    Assert.isFalse(result.errorOutput.includes("No test matched the filters"), result.errorOutput);
    Assert.areEqual(
      JSON.stringify({ discovered, selected, passed: selected, failed: 0, skipped: 0, unreached: 0, skips: [], files: selected === 0 ? [] : ["TestPackage/lifetime.test.js"] }),
      await readFile(resultPath, "utf8"));
  }

  @TestMethod
  public async writesEachSkippedTestWithItsReasonToTheResultFile(): Promise<void> {
    using directory = new TemporaryDirectory();
    const testsDirectory = join(directory.path, "tests");
    await mkdir(testsDirectory);
    const fixture = new URL("../../fixtures/decorators/partly-skipped-fixture.fixture.js", import.meta.url).href;
    await writeFile(join(testsDirectory, "skipped.test.js"), `export { PartlySkippedFixtureTests } from ${JSON.stringify(fixture)};\n`);
    const resultPath = join(directory.path, "result.json");

    const result = await this.runEntryArgumentsAsync(["TestPackage", testsDirectory], "[]", undefined, { TEAMRUN_TEST_RESULT_FILE: resultPath });

    Assert.areEqual(0, result.exitCode, result.errorOutput);
    Assert.areEqual(
      JSON.stringify({
        discovered: 2, selected: 2, passed: 1, failed: 0, skipped: 1, unreached: 0,
        skips: [{ file: "TestPackage/skipped.test.js", names: ["PartlySkippedFixtureTests.pending"], reason: "this method is pending" }],
        files: ["TestPackage/skipped.test.js"]
      }),
      await readFile(resultPath, "utf8"));
  }

  @TestMethod
  @TestData("[\"failsAndLeaksATimer\",\"finishesCleanly\"]", "{}", true, "EntryLifetimeTests.failsAndLeaksATimer")
  @TestData("[\"finishesCleanly\",\"exceedsItsTimeLimit\"]", "{\"TEAMRUN_TEST_TIMEOUT_MILLISECONDS\":\"200\"}", false, "EntryLifetimeTests.exceedsItsTimeLimit")
  public async writesTheFailedTestsAndWhetherEveryTestRanToTheResultsFile(filters: string, variables: string, isComplete: boolean, identity: string): Promise<void> {
    using directory = new TemporaryDirectory();
    const testsDirectory = join(directory.path, "tests");
    await mkdir(testsDirectory);
    const fixture = new URL("../../fixtures/execution/entry-lifetime.fixture.js", import.meta.url).href;
    const testFile = join(testsDirectory, "lifetime.test.js");
    await writeFile(testFile, `export { EntryLifetimeFixture as EntryLifetimeTests } from ${JSON.stringify(fixture)};\n`);
    const resultsPath = join(directory.path, "results.json");

    const result = await this.runEntryArgumentsAsync(["TestPackage", testsDirectory], filters, undefined, { ...JSON.parse(variables) as Record<string, string>, TEAMRUN_TEST_RESULTS_FILE: resultsPath });

    const results = JSON.parse(await readFile(resultsPath, "utf8")) as { isComplete: boolean; failed: { identity: string; file: string; failure: string }[] };
    Assert.areEqual(1, result.exitCode, result.errorOutput);
    Assert.areEqual(JSON.stringify([isComplete, [identity], ["TestPackage/lifetime.test.js"]]), JSON.stringify([results.isComplete, results.failed.map(t => t.identity), results.failed.map(t => t.file)]));
    Assert.isTrue(results.failed.every(t => t.failure.length > 0), JSON.stringify(results.failed));
  }

  @TestMethod
  public async endsTheRunAfterATestExceedsItsTimeLimit(): Promise<void> {
    using directory = new TemporaryDirectory();
    const testsDirectory = join(directory.path, "tests");
    await mkdir(testsDirectory);
    const fixture = new URL("../../fixtures/execution/entry-lifetime.fixture.js", import.meta.url).href;
    await writeFile(join(testsDirectory, "lifetime.test.js"), `export { EntryLifetimeFixture as EntryLifetimeTests } from ${JSON.stringify(fixture)};
`);
    const summaryPath = join(directory.path, "summary.md");
    const start = performance.now();

    const result = await this.runEntryArgumentsAsync(["TestPackage", testsDirectory], JSON.stringify(["exceedsItsTimeLimit", "finishesCleanly"]), summaryPath,
      { TEAMRUN_TEST_TIMEOUT_MILLISECONDS: "200" });

    const summary = await readFile(summaryPath, "utf8");
    Assert.areEqual(1, result.exitCode, result.errorOutput);
    Assert.isTrue(performance.now() - start < 10_000);
    Assert.isTrue(result.errorOutput.includes("A test exceeded its time limit; the run ended after reporting it"), result.errorOutput);
    Assert.isTrue(summary.includes("| Failed: | 1 |"));
    Assert.isTrue(summary.includes("| Unreached: | 1 |"));
  }

  @TestMethod
  @TestData("0")
  @TestData("-5")
  @TestData("1.5")
  @TestData("010")
  @TestData("soon")
  public async rejectsAnInvalidTimeLimit(timeout: string): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "[]", undefined, { TEAMRUN_TEST_TIMEOUT_MILLISECONDS: timeout });

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("The timeout must be a positive integer of milliseconds."), entryRun.errorOutput);
  }

  @TestMethod
  public async reportsAContractViolationAsACleanVerdict(): Promise<void> {
    using directory = new TemporaryDirectory();
    const rootDirectory = directory.path;
    await writeFile(join(rootDirectory, "empty.test.js"), "export {};\n");

    const entryRun = await this.runEntryAsync("TestPackage", rootDirectory);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("TestingException"));
    Assert.isTrue(entryRun.errorOutput.includes("yields no test class"));
    Assert.isFalse(entryRun.errorOutput.includes("    at "));
  }

  @TestMethod
  public async failsAnEmptySelectionLoudly(): Promise<void> {
    using directory = new TemporaryDirectory();
    const rootDirectory = directory.path;

    const entryRun = await this.runEntryAsync("TestPackage", rootDirectory);

    Assert.areEqual(1, entryRun.exitCode);
  }

  @TestMethod
  public async rejectsAnIncompleteProjectPair(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync(["TestPackage"]);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("requires a package name and a root directory"));
  }

  @TestMethod
  public async reportsRunnerFailuresInTheJobSummary(): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), "teamrun-entry-summary-"));
    try {
      const summaryPath = join(directory, "summary.md");
      const result = await this.runEntryArgumentsAsync(["TestPackage"], "[]", summaryPath);
      Assert.areEqual(1, result.exitCode);
      const summary = await readFile(summaryPath, "utf8");
      Assert.isTrue(summary.includes("Package test execution failed"));
      Assert.isTrue(summary.includes("requires a package name and a root directory"));
    }
    finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async rejectsAnEmptyPackageName(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([String.empty, "compiled/tests"]);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("ArgumentException"));
  }

  @TestMethod
  public async rejectsAnEmptyRootDirectory(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync(["TestPackage", String.empty]);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("ArgumentException"));
  }

  @TestMethod
  public async rejectsMalformedFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "not-json");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of non-empty strings"));
  }

  @TestMethod
  public async rejectsMissingFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], null);

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of non-empty strings"));
  }

  @TestMethod
  public async rejectsFiltersThatAreNotAnArray(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "{}");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of non-empty strings"));
  }

  @TestMethod
  public async rejectsEmptyFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "[\"\"]");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of non-empty strings"));
  }

  @TestMethod
  public async rejectsNonStringFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "[1]");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isTrue(entryRun.errorOutput.includes("test filters must be a JSON array of non-empty strings"));
  }

  @TestMethod
  public async acceptsStringFilters(): Promise<void> {
    const entryRun = await this.runEntryArgumentsAsync([], "[\"sample\"]");

    Assert.areEqual(1, entryRun.exitCode);
    Assert.isFalse(entryRun.errorOutput.includes("test filters must be a JSON array of non-empty strings"));
  }

  private runEntryAsync(packageName: string, rootDirectory: string): Promise<EntryRun> {
    return this.runEntryArgumentsAsync([packageName, rootDirectory]);
  }

  private async runEntryArgumentsAsync(arguments_: readonly string[], filters: string | null = "[]", summaryPath?: string, variables: Readonly<Record<string, string>> = {}): Promise<EntryRun> {
    const environment = CoverageEnvironment.forChild(process.env);
    delete environment["GITHUB_STEP_SUMMARY"];
    if (!Object.isUndefined(summaryPath))
      environment["GITHUB_STEP_SUMMARY"] = summaryPath;
    delete environment["TEAMRUN_TEMPORARY_ROOT"];
    delete environment["TEAMRUN_TEST_TIMEOUT_MILLISECONDS"];
    delete environment["TEAMRUN_TEST_RESULT_FILE"];
    delete environment["TEAMRUN_TEST_RESULTS_FILE"];
    Object.assign(environment, variables);
    if (Object.isNull(filters))
      delete environment["TEAMRUN_TEST_FILTERS"];
    else
      environment["TEAMRUN_TEST_FILTERS"] = filters;

    const directory = await mkdtemp(join(tmpdir(), "teamrun-entry-output-"));
    environment["NODE_V8_COVERAGE"] ??= join(directory, "coverage");
    const errorPath = join(directory, "stderr.log");
    const errorFile = openSync(errorPath, "w");
    try {
      const exitCode = await new Promise<number>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["node_modules/@noldova/teamrun-foundation-testing/services/execution/test-run-entry.js", ...arguments_],
          { env: environment, shell: false, timeout: 30_000, stdio: ["ignore", "ignore", errorFile] });
        child.on("close", t => resolve(t ?? -1));
        child.on("error", reject);
      });
      return new EntryRun(exitCode, await readFile(errorPath, "utf8"));
    }
    finally {
      closeSync(errorFile);
      await rm(directory, { recursive: true, force: true });
    }
  }
}
