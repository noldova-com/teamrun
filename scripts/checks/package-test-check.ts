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
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";
import CheckSelection from "./check-selection.ts";
import CoverageRun from "./coverage-run.ts";
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

  public readonly title: string = "Package tests and coverage";

  public constructor(root: string, build: PackageBuild, runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.build = build;
    this.runner = runner;
    this.environment = environment;
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
      const packages = await new PackageCatalog(this.root).listPackagesAsync(false);
      const tested = packages.filter(t => existsSync(layout.locateTestOutput(t)));
      if (tested.length === 0) {
        output.write(PackageTestCheck.NO_TESTS);
        return new CheckSelection(true, PackageTestCheck.UNIT, 0, 0);
      }
      if (!packages.some(t => t.name === PackageTestCheck.TESTING_PACKAGE)) {
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
      const testsPassed = await this.runner.runAsync(process.execPath, [PackageTestCheck.SOURCE_MAPS_OPTION, new CoverageRun(this.root, this.runner).locateService(...PackageTestCheck.TEST_ENTRY_SEGMENTS), ...tests], this.root, environment) === 0;
      if (isFiltered)
        return await this.readSelectionAsync(selectionFile, testsPassed, output);
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
