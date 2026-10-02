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
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Assert, CoverageEnvironment, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CompiledScriptFixture } from "../../fixtures/coverage/compiled-script.fixture.js";
import { EntryRun } from "../../fixtures/execution/entry-run.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CoverageRunEntryTests {
  @TestMethod
  public passesAPackageWhoseFilesAreFullyCovered(): Promise<void> {
    return this.runPackageAsync(true, async (run, summary) => {
      Assert.areEqual(0, run.exitCode, run.errorOutput);
      Assert.isTrue(summary.includes("| Coverage gate | Passed |"), summary);
    });
  }

  @TestMethod
  public failsAPackageBelowFullCoverage(): Promise<void> {
    return this.runPackageAsync(false, async (run, summary) => {
      Assert.areEqual(1, run.exitCode, run.errorOutput);
      Assert.isTrue(summary.includes("| Coverage gate | Failed |"), summary);
      Assert.isTrue(summary.includes("orphan.js"), summary);
    });
  }

  @TestMethod
  public passesAPackageWhoseOnlyUncoveredFileItExcludes(): Promise<void> {
    return this.runPackageAsync(false, async (run, summary) => {
      Assert.areEqual(0, run.exitCode, run.errorOutput);
      Assert.isTrue(summary.includes("| Coverage gate | Passed |"), summary);
      Assert.isTrue(summary.includes("| Excluded files | 1 |"), summary);
      Assert.isTrue(summary.includes("excluded: Runs only inside Electron."), summary);
    }, JSON.stringify([{ file: "orphan.js", reason: "Runs only inside Electron." }]));
  }

  @TestMethod
  public failsForAnExclusionOfAFileThePackageDoesNotHave(): Promise<void> {
    return this.runPackageAsync(true, async run => {
      Assert.areEqual(1, run.exitCode, run.errorOutput);
      Assert.isTrue(run.errorOutput.includes("Sample excludes files it does not have: main.js."), run.errorOutput);
    }, JSON.stringify([{ file: "main.js", reason: "Runs only inside Electron." }]));
  }

  @TestMethod
  public async failsForExclusionsThatAreNotAListOfFilesAndReasons(): Promise<void> {
    for (const exclusions of ["{", "{}", "[1]", "[{\"file\":\"a.js\"}]", "[{\"reason\":\"Why.\"}]"])
      await this.expectFailureAsync(["coverage", "Sample", "production", "production", exclusions], "exclusions must be a JSON array");
  }

  @TestMethod
  public failsWithoutTheCoverageFolder(): Promise<void> {
    return this.expectFailureAsync([], "requires the folder of the V8 coverage reports");
  }

  @TestMethod
  public failsForAnIncompleteProject(): Promise<void> {
    return this.expectFailureAsync(["coverage", "Sample", "production", "production"], "requires a package name, a production folder, a source folder and its exclusions");
  }

  @TestMethod
  public async failsForMalformedCoverage(): Promise<void> {
    using directory = new TemporaryDirectory();
    const production = join(directory.path, "production");
    const coverage = join(directory.path, "coverage");
    await mkdir(production);
    await mkdir(coverage);
    await CompiledScriptFixture.writeAsync(join(production, "sample.js"), "sample;\n");
    await writeFile(join(coverage, "coverage-1.json"), "not json");

    const run = await this.runEntryAsync([coverage, "Sample", production, production, "[]"]);

    Assert.areEqual(1, run.exitCode);
    Assert.isTrue(run.errorOutput.includes("malformed"), run.errorOutput);
  }

  private async expectFailureAsync(entryArguments: readonly string[], message: string): Promise<void> {
    using directory = new TemporaryDirectory();
    const summaryPath = join(directory.path, "summary.md");

    const run = await this.runEntryAsync(entryArguments, summaryPath);

    Assert.areEqual(1, run.exitCode);
    Assert.isTrue(run.errorOutput.includes(message), run.errorOutput);
    Assert.isTrue((await readFile(summaryPath, "utf8")).includes(message));
  }

  private async runPackageAsync(isComplete: boolean, verify: (run: EntryRun, summary: string) => Promise<void>, exclusions: string = "[]"): Promise<void> {
    using directory = new TemporaryDirectory();
    const production = join(directory.path, "production");
    const coverage = join(directory.path, "coverage");
    await mkdir(production);
    await mkdir(coverage);
    const sampleText = "sample;\n";
    const samplePath = join(production, "sample.js");
    await CompiledScriptFixture.writeAsync(samplePath, sampleText);
    if (!isComplete)
      await CompiledScriptFixture.writeAsync(join(production, "orphan.js"), "orphan;\n");
    const report = { result: [{ url: pathToFileURL(samplePath).href, functions: [{ ranges: [{ startOffset: 0, endOffset: sampleText.length, count: 1 }] }] }] };
    await writeFile(join(coverage, "coverage-1.json"), JSON.stringify(report));
    const summaryPath = join(directory.path, "summary.md");

    const run = await this.runEntryAsync([coverage, "Sample", production, production, exclusions], summaryPath);

    await verify(run, await readFile(summaryPath, "utf8"));
  }

  private async runEntryAsync(entryArguments: readonly string[], summaryPath?: string): Promise<EntryRun> {
    using directory = new TemporaryDirectory();
    const environment = CoverageEnvironment.forChild(process.env);
    delete environment["GITHUB_STEP_SUMMARY"];
    if (!Object.isUndefined(summaryPath))
      environment["GITHUB_STEP_SUMMARY"] = summaryPath;
    const errorPath = join(directory.path, "stderr.log");
    const errorFile = openSync(errorPath, "w");
    try {
      const exitCode = await new Promise<number>((resolve, reject) => {
        const child = spawn(
          process.execPath,
          ["node_modules/@noldova/teamrun-foundation-testing/services/coverage/coverage-run-entry.js", ...entryArguments],
          { env: environment, shell: false, timeout: 30_000, stdio: ["ignore", "ignore", errorFile] });
        child.on("close", t => resolve(t ?? -1));
        child.on("error", reject);
      });
      return new EntryRun(exitCode, await readFile(errorPath, "utf8"));
    }
    finally {
      closeSync(errorFile);
    }
  }
}
