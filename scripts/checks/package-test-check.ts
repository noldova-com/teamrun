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
import CheckSelection from "./check-selection.ts";
import CoverageRun from "./coverage-run.ts";
import type FlakyRecord from "./flaky-record.ts";
import FlakyTest from "./flaky-test.ts";
import type ISelectableCheck from "./interfaces/selectable-check.ts";

export default class PackageTestCheck implements ISelectableCheck {
  private static readonly TESTING_PACKAGE: string = "@noldova/teamrun-foundation-testing";
  private static readonly TEST_ENTRY_SEGMENTS: readonly string[] = ["execution", "test-run-entry.js"];
  private static readonly COVERAGE_SEGMENTS: readonly string[] = ["_build", "coverage"];
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly SOURCE_MAPS_OPTION: string = "--enable-source-maps";
  private static readonly FILTERS_VARIABLE: string = "TEAMRUN_TEST_FILTERS";
  private static readonly SELECTION_VARIABLE: string = "TEAMRUN_TEST_SELECTION_FILE";
  private static readonly SELECTION_SEGMENTS: readonly string[] = ["_build", "test-selection.json"];
  private static readonly RESULTS_VARIABLE: string = "TEAMRUN_TEST_RESULTS_FILE";
  private static readonly RESULTS_SEGMENTS: readonly string[] = ["_build", "package-test-results.json"];
  private static readonly RUNNER: string = "Package tests";
  private static readonly RERUNNING: string = "Running the failed package tests once more.\n";
  private static readonly SELECTION_ENCODING: BufferEncoding = "utf8";
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
      const selectionFile = path.join(this.root, ...PackageTestCheck.SELECTION_SEGMENTS);
      const tests = tested.flatMap(t => [t.name, layout.locateTestOutput(t)]);
      let environment: NodeJS.ProcessEnv = { ...this.environment, [PackageTestCheck.FILTERS_VARIABLE]: JSON.stringify(filters) };
      if (isFiltered) {
        await rm(selectionFile, { force: true });
        environment[PackageTestCheck.SELECTION_VARIABLE] = selectionFile;
      }
      else {
        await rm(coverage, { recursive: true, force: true });
        await mkdir(coverage, { recursive: true });
        environment = CoverageRun.recordingIn(environment, coverage);
      }
      const commandArguments = [PackageTestCheck.SOURCE_MAPS_OPTION, new CoverageRun(this.root, this.runner).locateService(...PackageTestCheck.TEST_ENTRY_SEGMENTS), ...tests];
      if (isFiltered)
        return await this.readSelectionAsync(selectionFile, await this.runner.runAsync(process.execPath, commandArguments, this.root, environment) === 0, output);
      const testsPassed = this.flaky === null
        ? await this.runner.runAsync(process.execPath, commandArguments, this.root, environment) === 0
        : await this.runRerunningFailedAsync(commandArguments, environment, this.flaky, output);
      const projects = packages.flatMap(t => CoverageRun.formatProjectArguments(t.name, layout.locateInstalled(t), layout.locateSource(t, PackageTestCheck.SOURCE_FOLDER), t.coverageExclusions, CoverageRun.NO_TEST_FOLDERS));
      const coverageComplete = await new CoverageRun(this.root, this.runner).measureAsync(coverage, projects, this.environment);
      return new CheckSelection(testsPassed && coverageComplete, PackageTestCheck.UNIT, 0, 0);
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException || error instanceof ModuleException))
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
    const selection = path.join(this.root, ...PackageTestCheck.SELECTION_SEGMENTS);
    const rerun = { ...recording, [PackageTestCheck.FILTERS_VARIABLE]: JSON.stringify(first.failed.map(t => t.identity)), [PackageTestCheck.SELECTION_VARIABLE]: selection };
    const isPassing = await this.runner.runAsync(process.execPath, commandArguments, this.root, rerun) === 0;
    const second = await this.readResultsAsync(results);
    if (second === null || !second.isComplete)
      return false;
    const failedAgain = new Set(second.failed.map(t => t.identity));
    await flaky.addAsync(first.failed.filter(t => !failedAgain.has(t.identity)).map(t => new FlakyTest(PackageTestCheck.RUNNER, t.file, t.identity, t.failure)), output);
    return isPassing && failedAgain.size === 0;
  }

  private async readResultsAsync(file: string): Promise<{ isComplete: boolean; failed: readonly { identity: string; file: string; failure: string }[] } | null> {
    let results: unknown;
    try {
      results = JSON.parse(await readFile(file, PackageTestCheck.SELECTION_ENCODING));
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

  private async readSelectionAsync(file: string, testsPassed: boolean, output: Writable): Promise<CheckSelection> {
    const counts = existsSync(file) ? PackageTestCheck.parseSelection(await readFile(file, PackageTestCheck.SELECTION_ENCODING)) : null;
    if (counts === null)
      return new CheckSelection(false, PackageTestCheck.UNIT, 0, 0);
    if (counts.discovered === 0)
      output.write(PackageTestCheck.NONE_DISCOVERED);
    return new CheckSelection(testsPassed && counts.discovered > 0, PackageTestCheck.UNIT, counts.discovered, counts.selected);
  }

  private static parseSelection(text: string): { discovered: number; selected: number } | null {
    let counts: { discovered?: unknown; selected?: unknown } | null;
    try {
      counts = JSON.parse(text) as { discovered?: unknown; selected?: unknown } | null;
    }
    catch {
      return null;
    }
    const discovered = counts?.discovered;
    const selected = counts?.selected;
    return Number.isInteger(discovered) && Number.isInteger(selected) ? { discovered: discovered as number, selected: selected as number } : null;
  }
}
