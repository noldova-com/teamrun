/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { BuildLayout } from "../packages/build-layout.ts";
import type { PackageBuild } from "../packages/package-build.ts";
import { PackageCatalog } from "../packages/package-catalog.ts";
import type { PackageManifest } from "../packages/package-manifest.ts";
import { PackageException } from "../packages/package.exception.ts";
import type { ProcessEnd } from "../processes/process-end.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { ProcessTimeoutException } from "../processes/process-timeout.exception.ts";
import { ProcessException } from "../processes/process.exception.ts";
import type { TestOptions } from "../test-options.ts";
import { RunnerResult } from "../totals/runner-result.ts";
import { TotalsException } from "../totals/totals.exception.ts";
import { CheckSelection } from "./check-selection.ts";
import { FailedTest } from "./failed-test.ts";
import type { FlakyRecord } from "./flaky-record.ts";
import { FlakyTest } from "./flaky-test.ts";
import type { ISelectableCheck } from "./interfaces/i-selectable-check.ts";
import { IsolatedTest } from "./isolated-test.ts";
import { PackageCoverage } from "./package-coverage.ts";
import { PackageTestEntry } from "./package-test-entry.ts";
import { ShardProgress } from "./shard-progress.ts";
import { ShardResults } from "./shard-results.ts";

export class PackageTestCheck implements ISelectableCheck {
  public static readonly RUNNER: string = "package";

  private static readonly ENTRY_SEGMENTS: readonly string[] = ["scripts", "checks", "package-test-entry.ts"];
  private static readonly COVERAGE_SEGMENTS: readonly string[] = ["_build", "coverage"];
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly WINDOW_ENTRY: string = "api/window.ts";
  private static readonly SOURCE_MAPS_OPTION: string = "--enable-source-maps";
  private static readonly RUN_LIMIT_MILLISECONDS: number = 600_000;
  private static readonly RESULT_SEGMENTS: readonly string[] = ["_build", "test-result.json"];
  private static readonly RERUN_RESULT_SEGMENTS: readonly string[] = ["_build", "test-rerun-result.json"];
  private static readonly PROGRESS_SEGMENTS: readonly string[] = ["_build", "test-progress.txt"];
  private static readonly CLAIMS_SEGMENTS: readonly string[] = ["_build", "test-claims"];
  private static readonly SHARDS_VARIABLE: string = "NOLDOVA_TEST_SHARDS";
  private static readonly SHARD_LIMIT: number = 4;
  private static readonly SOURCE_EXTENSION: RegExp = /\.ts$/u;
  private static readonly COMPILED_EXTENSION: string = ".js";
  private static readonly NO_EXCLUSIONS: string = "[]";
  private static readonly TOTALS_TITLE: string = "Package tests";
  private static readonly RESULTS_SEGMENTS: readonly string[] = ["_build", "package-test-results.json"];
  private static readonly RERUNNING: string = "Running the failed package tests once more.\n";
  private static readonly RESULTS_ENCODING: BufferEncoding = "utf8";
  private static readonly UNIT: string = "package tests";
  private static readonly ALL_TESTS: readonly string[] = [];
  private static readonly NO_TESTS: string = "No package has tests.\n";
  private static readonly NONE_DISCOVERED: string = "Packages have test output, but the test framework discovered no test in it.\n";
  private static readonly TIMED_OUT: string = "The package test run was stopped at its limit; a test that blocks the process without awaiting is never timed out by the test runner.\n";
  private static readonly EXCLUSIONS_UNSUPPORTED: string = "exclude files from coverage, which the coverage measurement can't leave out; cover them or remove the exclusions.\n";

  private readonly root: string;
  private readonly build: PackageBuild;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly flaky: FlakyRecord | null;
  private readonly skipsTestDetails: boolean;
  private readonly coverage: PackageCoverage;

  public readonly title: string = "Package tests and coverage";

  public constructor(root: string, build: PackageBuild, runner: ProcessRunner, environment: NodeJS.ProcessEnv, flaky: FlakyRecord | null, options: TestOptions) {
    this.root = root;
    this.build = build;
    this.runner = runner;
    this.environment = environment;
    this.flaky = flaky;
    this.skipsTestDetails = options.skipsTestDetails;
    this.coverage = new PackageCoverage(options.skipsCoverageDetails);
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return (await this.checkAsync(output, PackageTestCheck.ALL_TESTS)).isPassing;
  }

  public runSelectedAsync(filters: readonly string[], output: Writable): Promise<CheckSelection> {
    return this.checkAsync(output, filters);
  }

  public static formatEnded(end: ProcessEnd, place: string): string {
    return `The test process ended ${end.describe()} before writing its result, ${place}.
`;
  }

  public static formatRan(index: number, count: number, milliseconds: number): string {
    return `Test process ${index + 1} of ${count} ran for ${(milliseconds / 1000).toFixed(1)} s.
`;
  }

  public static formatStopped(place: string): string {
    return `The test process was stopped at its limit ${place}.
`;
  }

  public static formatPlace(progress: ShardProgress | null): string {
    if (Object.isNull(progress))
      return "before any test started";
    return progress.isRunning ? `while ${progress.test} was running` : `after ${progress.test} ended`;
  }

  private async checkAsync(output: Writable, filters: readonly string[]): Promise<CheckSelection> {
    const isFiltered = filters.length > 0;
    try {
      if (!await this.build.compileTestsReportedAsync(output))
        return new CheckSelection(false, PackageTestCheck.UNIT, 0, 0);
      const layout = new BuildLayout(this.root);
      const packages = await new PackageCatalog(this.root).listPackagesAsync();
      const tested = packages.filter(t => existsSync(layout.locateTestOutput(t)));
      if (tested.length === 0) {
        output.write(PackageTestCheck.NO_TESTS);
        return new CheckSelection(true, PackageTestCheck.UNIT, 0, 0);
      }

      const coverage = path.join(this.root, ...PackageTestCheck.COVERAGE_SEGMENTS);
      const resultFile = path.join(this.root, ...PackageTestCheck.RESULT_SEGMENTS);
      const tests = tested.flatMap(t => [t.name, layout.locateCompiledTests(t)]);
      const isolated = tested.flatMap(t => t.isolatedTests.map(u => `${t.name}/${u.replace(PackageTestCheck.SOURCE_EXTENSION, PackageTestCheck.COMPILED_EXTENSION)}`));
      await mkdir(path.dirname(resultFile), { recursive: true });
      await rm(resultFile, { force: true });
      let environment: NodeJS.ProcessEnv = { ...this.environment, [PackageTestEntry.FILTERS_VARIABLE]: JSON.stringify(filters), [PackageTestEntry.RESULT_VARIABLE]: resultFile,
        [PackageTestEntry.SKIP_DETAILS_VARIABLE]: String(this.skipsTestDetails), [PackageTestEntry.ISOLATED_VARIABLE]: JSON.stringify(isolated) };
      if (!isFiltered) {
        await rm(coverage, { recursive: true, force: true });
        await mkdir(coverage, { recursive: true });
        environment = { ...environment, [PackageTestEntry.COVERAGE_VARIABLE]: coverage };
      }
      const commandArguments = [PackageTestCheck.SOURCE_MAPS_OPTION, path.join(this.root, ...PackageTestCheck.ENTRY_SEGMENTS), ...tests];
      const testsPassed = Object.isNull(this.flaky) || isFiltered
        ? await this.runEntryAsync(commandArguments, environment, isolated, output)
        : await this.runRerunningFailedAsync(commandArguments, environment, isolated, this.flaky, output);
      const result = await RunnerResult.readAsync(this.root, resultFile);
      if (isFiltered) {
        if (result.discovered === 0)
          output.write(PackageTestCheck.NONE_DISCOVERED);
        return new CheckSelection(testsPassed && result.discovered > 0, PackageTestCheck.UNIT, result.discovered, result.selected);
      }
      const covered = packages.filter(t => !t.isAngular);
      const count = await this.coverage.measureAsync(coverage, covered.map(t => ({ name: t.name, productionDirectory: layout.locateInstalled(t), sourceDirectory: layout.locateSource(t, PackageTestCheck.SOURCE_FOLDER) })), output,
        PackageTestCheck.listWindowEntries(covered, packages));
      const excluding = packages.filter(t => t.coverageExclusions !== PackageTestCheck.NO_EXCLUSIONS).map(t => t.name);
      if (excluding.length > 0)
        output.write(`${excluding.join(", ")} ${PackageTestCheck.EXCLUSIONS_UNSUPPORTED}`);
      const recorded = await result.toTotals(PackageTestCheck.RUNNER, PackageTestCheck.TOTALS_TITLE, count, result.files, null).recordAsync(this.root, output);
      return new CheckSelection(testsPassed && count.covered === count.total && excluding.length === 0 && recorded, PackageTestCheck.UNIT, 0, 0);
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException || error instanceof TotalsException))
        throw error;
      output.write(`${error.message}\n`);
      if (error instanceof ProcessTimeoutException)
        output.write(PackageTestCheck.TIMED_OUT);
      return new CheckSelection(false, PackageTestCheck.UNIT, 0, 0);
    }
  }

  private async runRerunningFailedAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, isolated: readonly string[], flaky: FlakyRecord,
    output: Writable): Promise<boolean> {
    const results = path.join(this.root, ...PackageTestCheck.RESULTS_SEGMENTS);
    const recording = { ...environment, [PackageTestEntry.RESULTS_VARIABLE]: results };
    await rm(results, { force: true });
    if (await this.runEntryAsync(commandArguments, recording, isolated, output))
      return true;
    const first = await this.readResultsAsync(results);
    if (Object.isNull(first) || !first.isComplete || first.failed.length === 0)
      return false;
    output.write(PackageTestCheck.RERUNNING);
    await rm(results, { force: true });
    const rerunResult = path.join(this.root, ...PackageTestCheck.RERUN_RESULT_SEGMENTS);
    const rerun = { ...recording, [PackageTestEntry.FILTERS_VARIABLE]: JSON.stringify(first.failed.map(t => t.identity)), [PackageTestEntry.RESULT_VARIABLE]: rerunResult };
    const isPassing = await this.runEntryAsync(commandArguments, rerun, isolated, output);
    const second = await this.readResultsAsync(results);
    if (Object.isNull(second) || !second.isComplete)
      return false;
    const failedAgain = new Set(second.failed.map(t => t.identity));
    await flaky.addAsync(first.failed.filter(t => !failedAgain.has(t.identity)).map(t => new FlakyTest(PackageTestCheck.TOTALS_TITLE, t.file, t.identity, t.failure)), output);
    return isPassing && failedAgain.size === 0;
  }

  private static listWindowEntries(covered: readonly PackageManifest[], packages: readonly PackageManifest[]): ReadonlySet<string> {
    const angular = new Set(packages.filter(t => t.isAngular).map(t => t.name));
    return new Set(covered.filter(t => t.dependencies.some(u => angular.has(u))).map(t => `${t.name}/${PackageTestCheck.WINDOW_ENTRY}`));
  }

  private static formatShards(count: number, isolated: number): string {
    const shards = count === 1 ? "Running the package tests in one process" : `Running the package tests in ${count} processes, each taking the next test file`;
    if (isolated === 0)
      return `${shards}.\n`;
    return `${shards}, after taking turns at ${isolated === 1 ? "1 test file that runs" : `${isolated} test files that run`} alone, each in a process of its own.\n`;
  }

  private static shardFile(file: string, index: number): string {
    const { dir, name, ext } = path.parse(file);
    return path.join(dir, `${name}-${index + 1}${ext}`);
  }

  private static async readShardsAsync(files: readonly string[]): Promise<Record<string, unknown>[] | null> {
    const shards: Record<string, unknown>[] = [];
    for (const file of files) {
      let shard: unknown;
      try {
        shard = JSON.parse(await readFile(file, PackageTestCheck.RESULTS_ENCODING));
      }
      catch {
        return null;
      }
      if (!Object.isObject(shard))
        return null;
      shards.push(shard as Record<string, unknown>);
    }
    return shards;
  }

  private static async mergeResultAsync(files: readonly string[], target: string): Promise<void> {
    const shards = await PackageTestCheck.readShardsAsync(files);
    if (Object.isNull(shards))
      return;
    const sum = (field: string): number => shards.reduce((total, t) => total + Number(t[field]), 0);
    const list = (field: string): unknown[] => shards.flatMap(t => Array.isArray(t[field]) ? t[field] as unknown[] : []);
    const wanted = Math.max(...shards.map(t => Number(t["wanted"])));
    await writeFile(target, JSON.stringify({
      discovered: Math.max(...shards.map(t => Number(t["discovered"]))),
      selected: wanted,
      passed: sum("passed"),
      failed: sum("failed"),
      skipped: sum("skipped"),
      unreached: wanted - sum("passed") - sum("failed") - sum("skipped"),
      skips: list("skips"),
      files: [...new Set(list("files"))]
    }));
  }

  private static async mergeResultsAsync(files: readonly string[], target: string, isEveryTestRun: boolean): Promise<void> {
    const shards = await PackageTestCheck.readShardsAsync(files);
    if (Object.isNull(shards))
      return;
    await writeFile(target, JSON.stringify({
      isComplete: isEveryTestRun && shards.every(t => t["isComplete"] === true),
      failed: shards.flatMap(t => Array.isArray(t["failed"]) ? t["failed"] as unknown[] : [])
    }));
  }

  private countShards(): number {
    const chosen = Number(this.environment[PackageTestCheck.SHARDS_VARIABLE]);
    return Number.isInteger(chosen) && chosen > 0 ? chosen : Math.min(PackageTestCheck.SHARD_LIMIT, availableParallelism());
  }

  private async runEntryAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv, isolated: readonly string[], output: Writable): Promise<boolean> {
    const resultFile = environment[PackageTestEntry.RESULT_VARIABLE];
    const resultsFile = environment[PackageTestEntry.RESULTS_VARIABLE];
    const claims = path.join(this.root, ...PackageTestCheck.CLAIMS_SEGMENTS);
    const count = this.countShards();
    await rm(claims, { recursive: true, force: true });
    await mkdir(claims, { recursive: true });
    if (!Object.isUndefined(resultFile))
      await rm(resultFile, { force: true });
    output.write(PackageTestCheck.formatShards(count, isolated.length));
    const total = count + isolated.length;
    const shards = Array.from({ length: total }, (_, t) => t);
    const alone = isolated.map((t, u) => new IsolatedTest(count + u, t));
    const ends = await Promise.allSettled(shards.slice(0, count).map(t => this.runLaneAsync(t, total, alone, commandArguments, environment, claims, output)));
    for (const end of ends)
      if (end.status === "rejected")
        throw end.reason;
    if (!Object.isUndefined(resultFile))
      await PackageTestCheck.mergeResultAsync(shards.map(t => PackageTestCheck.shardFile(resultFile, t)), resultFile);
    if (!Object.isUndefined(resultsFile) && !Object.isUndefined(resultFile) && existsSync(resultFile))
      await PackageTestCheck.mergeResultsAsync(shards.map(t => PackageTestCheck.shardFile(resultsFile, t)), resultsFile, (await RunnerResult.readAsync(this.root, resultFile)).unreached === 0);
    return ends.every(t => t.status === "fulfilled" && t.value);
  }

  private async runLaneAsync(index: number, total: number, alone: IsolatedTest[], commandArguments: readonly string[], environment: NodeJS.ProcessEnv,
    claims: string, output: Writable): Promise<boolean> {
    let isPassing = true;
    for (let next = alone.shift(); !Object.isUndefined(next); next = alone.shift())
      isPassing = await this.runShardAsync(next.index, total, commandArguments, { ...environment, [PackageTestEntry.ALONE_VARIABLE]: next.file }, output) && isPassing;
    return await this.runShardAsync(index, total, commandArguments, { ...environment, [PackageTestEntry.CLAIMS_VARIABLE]: claims }, output) && isPassing;
  }

  private async runShardAsync(index: number, count: number, commandArguments: readonly string[], environment: NodeJS.ProcessEnv, output: Writable): Promise<boolean> {
    const progressFile = PackageTestCheck.shardFile(path.join(this.root, ...PackageTestCheck.PROGRESS_SEGMENTS), index);
    const shardEnvironment: NodeJS.ProcessEnv = { ...environment, [PackageTestEntry.PROGRESS_VARIABLE]: progressFile };
    for (const variable of [PackageTestEntry.RESULT_VARIABLE, PackageTestEntry.RESULTS_VARIABLE]) {
      const file = environment[variable];
      if (!Object.isUndefined(file))
        shardEnvironment[variable] = PackageTestCheck.shardFile(file, index);
    }
    for (const file of [progressFile, shardEnvironment[PackageTestEntry.RESULT_VARIABLE], shardEnvironment[PackageTestEntry.RESULTS_VARIABLE]])
      if (!Object.isUndefined(file))
        await rm(file, { force: true });
    const place = async (): Promise<string> => `${PackageTestCheck.formatPlace(await PackageTestCheck.readProgressAsync(progressFile))} in process ${index + 1} of ${count}`;
    let end: ProcessEnd;
    const started = Date.now();
    try {
      end = await this.runner.runToEndAsync(process.execPath, commandArguments, this.root, shardEnvironment, PackageTestCheck.RUN_LIMIT_MILLISECONDS);
    }
    catch (error) {
      if (error instanceof ProcessTimeoutException)
        output.write(PackageTestCheck.formatStopped(await place()));
      throw error;
    }
    finally {
      output.write(PackageTestCheck.formatRan(index, count, Date.now() - started));
    }
    const resultFile = shardEnvironment[PackageTestEntry.RESULT_VARIABLE];
    if (!Object.isUndefined(resultFile) && !existsSync(resultFile))
      output.write(PackageTestCheck.formatEnded(end, await place()));
    return end.isSuccessful;
  }

  private static async readProgressAsync(file: string): Promise<ShardProgress | null> {
    let progress: unknown;
    try {
      progress = JSON.parse(await readFile(file, PackageTestCheck.RESULTS_ENCODING));
    }
    catch {
      return null;
    }
    const fields = Object.isObject(progress) ? progress as Record<string, unknown> : {};
    return Object.isString(fields["test"]) && Object.isBoolean(fields["isRunning"]) ? new ShardProgress(fields["test"], fields["isRunning"]) : null;
  }

  private async readResultsAsync(file: string): Promise<ShardResults | null> {
    let results: unknown;
    try {
      results = JSON.parse(await readFile(file, PackageTestCheck.RESULTS_ENCODING));
    }
    catch {
      return null;
    }
    const fields = Object.isObject(results) ? results as Record<string, unknown> : {};
    const failed = fields["failed"];
    if (!Object.isBoolean(fields["isComplete"]) || !Array.isArray(failed) || failed.some(t => !Object.isObject(t) || ["identity", "file", "failure"].some(u => !Object.isString((t as Record<string, unknown>)[u]))))
      return null;
    return new ShardResults(fields["isComplete"], failed.map(t => {
      const record = t as Record<string, unknown>;
      return new FailedTest(String(record["identity"]), String(record["file"]), String(record["failure"]));
    }));
  }
}
