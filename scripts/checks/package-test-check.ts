/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import BuildVariant from "../modules/build-variant.ts";
import ModuleException from "../modules/module.exception.ts";
import BuildLayout from "../packages/build-layout.ts";
import type PackageBuild from "../packages/package-build.ts";
import PackageCatalog from "../packages/package-catalog.ts";
import PackageException from "../packages/package.exception.ts";
import type PackageManifest from "../packages/package-manifest.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";
import RunnerResult from "../totals/runner-result.ts";
import TotalsException from "../totals/totals.exception.ts";
import CheckSelection from "./check-selection.ts";
import CoverageRun from "./coverage-run.ts";
import type FlakyRecord from "./flaky-record.ts";
import FlakyTest from "./flaky-test.ts";
import type ISelectableCheck from "./interfaces/i-selectable-check.ts";

export default class PackageTestCheck implements ISelectableCheck {
  public static readonly RUNNER: string = "package";

  private static readonly TESTING_PACKAGE: string = "@noldova/teamrun-foundation-testing";
  private static readonly TEST_ENTRY_SEGMENTS: readonly string[] = ["execution", "test-run-entry.js"];
  private static readonly COVERAGE_SEGMENTS: readonly string[] = ["_build", "coverage"];
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly SOURCE_MAPS_OPTION: string = "--enable-source-maps";
  private static readonly FILTERS_VARIABLE: string = "TEAMRUN_TEST_FILTERS";
  private static readonly RESULT_VARIABLE: string = "TEAMRUN_TEST_RESULT_FILE";
  private static readonly RESULT_SEGMENTS: readonly string[] = ["_build", "test-result.json"];
  private static readonly RERUN_RESULT_SEGMENTS: readonly string[] = ["_build", "test-rerun-result.json"];
  private static readonly COVERAGE_RESULT_SEGMENTS: readonly string[] = ["_build", "package-coverage.json"];
  private static readonly TOTALS_TITLE: string = "Package tests";
  private static readonly RESULTS_VARIABLE: string = "TEAMRUN_TEST_RESULTS_FILE";
  private static readonly RESULTS_SEGMENTS: readonly string[] = ["_build", "package-test-results.json"];
  private static readonly RERUNNING: string = "Running the failed package tests once more.\n";
  private static readonly RESULTS_ENCODING: BufferEncoding = "utf8";
  private static readonly UNIT: string = "package tests";
  private static readonly ALL_TESTS: readonly string[] = [];
  private static readonly NO_TESTS: string = "No package has tests.\n";
  private static readonly NONE_DISCOVERED: string = "Packages have test output, but the test framework discovered no test in it.\n";
  private static readonly NO_FRAMEWORK: string = `Packages have tests, but ${PackageTestCheck.TESTING_PACKAGE} is not a package under src/.\n`;

  private readonly root: string;
  private readonly build: PackageBuild;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly flaky: FlakyRecord | null;
  private readonly selected?: readonly string[];

  public readonly title: string = "Package tests and coverage";

  public constructor(root: string, build: PackageBuild, runner: ProcessRunner, environment: NodeJS.ProcessEnv, flaky: FlakyRecord | null, selected?: readonly string[]) {
    this.root = root;
    this.build = build;
    this.runner = runner;
    this.environment = environment;
    this.flaky = flaky;
    if (selected !== undefined)
      this.selected = selected;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return (await this.checkAsync(output, PackageTestCheck.ALL_TESTS)).isPassing;
  }

  public runSelectedAsync(filters: readonly string[], output: Writable): Promise<CheckSelection> {
    return this.checkAsync(output, filters);
  }

  private async checkAsync(output: Writable, filters: readonly string[]): Promise<CheckSelection> {
    const isFiltered = filters.length > 0;
    try {
      if (!await this.build.isCurrentReportedAsync(BuildVariant.REGULAR, output))
        return new CheckSelection(false, PackageTestCheck.UNIT, 0, 0);
      const layout = new BuildLayout(this.root);
      const all = await new PackageCatalog(this.root).listPackagesAsync(false);
      const packages = this.select(all, output);
      const tested = packages.filter(t => existsSync(layout.locateTestOutput(t)));
      if (tested.length === 0) {
        output.write(PackageTestCheck.NO_TESTS);
        return new CheckSelection(true, PackageTestCheck.UNIT, 0, 0);
      }
      if (!all.some(t => t.name === PackageTestCheck.TESTING_PACKAGE)) {
        output.write(PackageTestCheck.NO_FRAMEWORK);
        return new CheckSelection(false, PackageTestCheck.UNIT, 0, 0);
      }

      const coverage = path.join(this.root, ...PackageTestCheck.COVERAGE_SEGMENTS);
      const resultFile = path.join(this.root, ...PackageTestCheck.RESULT_SEGMENTS);
      const coverageResult = path.join(this.root, ...PackageTestCheck.COVERAGE_RESULT_SEGMENTS);
      const tests = tested.flatMap(t => [t.name, layout.locateTestOutput(t)]);
      await mkdir(path.dirname(resultFile), { recursive: true });
      await rm(resultFile, { force: true });
      let environment: NodeJS.ProcessEnv = { ...this.environment, [PackageTestCheck.FILTERS_VARIABLE]: JSON.stringify(filters), [PackageTestCheck.RESULT_VARIABLE]: resultFile };
      if (!isFiltered) {
        await rm(coverage, { recursive: true, force: true });
        await mkdir(coverage, { recursive: true });
        environment = CoverageRun.recordingIn(environment, coverage);
      }
      const commandArguments = [PackageTestCheck.SOURCE_MAPS_OPTION, new CoverageRun(this.root, this.runner).locateService(...PackageTestCheck.TEST_ENTRY_SEGMENTS), ...tests];
      const testsPassed = this.flaky === null || isFiltered
        ? await this.runner.runAsync(process.execPath, commandArguments, this.root, environment) === 0
        : await this.runRerunningFailedAsync(commandArguments, environment, this.flaky, output);
      const result = await RunnerResult.readAsync(this.root, resultFile);
      if (isFiltered) {
        if (result.discovered === 0)
          output.write(PackageTestCheck.NONE_DISCOVERED);
        return new CheckSelection(testsPassed && result.discovered > 0, PackageTestCheck.UNIT, result.discovered, result.selected);
      }
      await rm(coverageResult, { force: true });
      const projects = packages.flatMap(t => CoverageRun.formatProjectArguments(t.name, layout.locateInstalled(t), layout.locateSource(t, PackageTestCheck.SOURCE_FOLDER), t.coverageExclusions, CoverageRun.NO_TEST_FOLDERS));
      const coverageComplete = await new CoverageRun(this.root, this.runner).measureAsync(coverage, projects, CoverageRun.countingIn(this.environment, coverageResult));
      const recorded = await result.toTotals(PackageTestCheck.RUNNER, PackageTestCheck.TOTALS_TITLE, await CoverageRun.readCountAsync(this.root, coverageResult), result.files).recordAsync(this.root, output);
      return new CheckSelection(testsPassed && coverageComplete && recorded, PackageTestCheck.UNIT, 0, 0);
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException || error instanceof ModuleException || error instanceof TotalsException))
        throw error;
      output.write(`${error.message}\n`);
      return new CheckSelection(false, PackageTestCheck.UNIT, 0, 0);
    }
  }

  private select(packages: readonly PackageManifest[], output: Writable): readonly PackageManifest[] {
    const names = this.selected;
    if (names === undefined)
      return packages;
    const unknown = names.filter(t => !packages.some(p => p.name === t));
    if (unknown.length > 0)
      throw new PackageException(`No package is named ${unknown.join(", ")}. The packages are ${packages.map(t => t.name).join(", ") || "none"}.`);
    const selected = packages.filter(t => names.includes(t.name));
    output.write(`Testing ${selected.length} of ${packages.length} packages, with their coverage: ${selected.map(t => t.name).join(", ")}.\n`);
    return selected;
  }

  private async runRerunningFailedAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, flaky: FlakyRecord, output: Writable): Promise<boolean> {
    const results = path.join(this.root, ...PackageTestCheck.RESULTS_SEGMENTS);
    const recording = { ...environment, [PackageTestCheck.RESULTS_VARIABLE]: results };
    await rm(results, { force: true });
    if (await this.runner.runAsync(process.execPath, commandArguments, this.root, recording) === 0)
      return true;
    const first = await this.readResultsAsync(results);
    if (first === null || !first.isComplete || first.failed.length === 0)
      return false;
    output.write(PackageTestCheck.RERUNNING);
    await rm(results, { force: true });
    const rerunResult = path.join(this.root, ...PackageTestCheck.RERUN_RESULT_SEGMENTS);
    const rerun = { ...recording, [PackageTestCheck.FILTERS_VARIABLE]: JSON.stringify(first.failed.map(t => t.identity)), [PackageTestCheck.RESULT_VARIABLE]: rerunResult };
    const isPassing = await this.runner.runAsync(process.execPath, commandArguments, this.root, rerun) === 0;
    const second = await this.readResultsAsync(results);
    if (second === null || !second.isComplete)
      return false;
    const failedAgain = new Set(second.failed.map(t => t.identity));
    await flaky.addAsync(first.failed.filter(t => !failedAgain.has(t.identity)).map(t => new FlakyTest(PackageTestCheck.TOTALS_TITLE, t.file, t.identity, t.failure)), output);
    return isPassing && failedAgain.size === 0;
  }

  private async readResultsAsync(file: string): Promise<{ isComplete: boolean; failed: readonly { identity: string; file: string; failure: string }[] } | null> {
    let results: unknown;
    try {
      results = JSON.parse(await readFile(file, PackageTestCheck.RESULTS_ENCODING));
    }
    catch {
      return null;
    }
    const fields = typeof results === "object" && results !== null ? results as Record<string, unknown> : {};
    const failed = fields["failed"];
    if (typeof fields["isComplete"] !== "boolean" || !Array.isArray(failed) || failed.some(t => typeof t !== "object" || t === null || ["identity", "file", "failure"].some(u => typeof (t as Record<string, unknown>)[u] !== "string")))
      return null;
    return { isComplete: fields["isComplete"], failed: failed as { identity: string; file: string; failure: string }[] };
  }
}
