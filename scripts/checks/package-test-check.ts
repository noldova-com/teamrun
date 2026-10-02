/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
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
import type ICheck from "./interfaces/check.ts";

export default class PackageTestCheck implements ICheck {
  private static readonly TESTING_PACKAGE: string = "@noldova/teamrun-foundation-testing";
  private static readonly FRAMEWORK_SEGMENTS: readonly string[] = ["node_modules", "@noldova", "teamrun-foundation-testing", "services"];
  private static readonly TEST_ENTRY_SEGMENTS: readonly string[] = ["execution", "test-run-entry.js"];
  private static readonly COVERAGE_ENTRY_SEGMENTS: readonly string[] = ["coverage", "coverage-run-entry.js"];
  private static readonly COVERAGE_SEGMENTS: readonly string[] = ["_build", "coverage"];
  private static readonly COVERAGE_VARIABLE: string = "NODE_V8_COVERAGE";
  private static readonly SOURCE_FOLDER: string = "src";
  private static readonly SOURCE_MAPS_OPTION: string = "--enable-source-maps";
  private static readonly FILTERS_VARIABLE: string = "TEAMRUN_TEST_FILTERS";
  private static readonly ALL_TESTS: string = "[]";
  private static readonly NO_TESTS: string = "No package has tests.\n";
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
    try {
      await this.build.requireCurrentAsync(BuildVariant.REGULAR);
      const layout = new BuildLayout(this.root);
      const packages = await new PackageCatalog(this.root).listPackagesAsync(false);
      const tested = packages.filter(t => existsSync(layout.locateTestOutput(t)));
      if (tested.length === 0) {
        output.write(PackageTestCheck.NO_TESTS);
        return true;
      }
      if (!packages.some(t => t.name === PackageTestCheck.TESTING_PACKAGE)) {
        output.write(PackageTestCheck.NO_FRAMEWORK);
        return false;
      }

      const coverage = path.join(this.root, ...PackageTestCheck.COVERAGE_SEGMENTS);
      await rm(coverage, { recursive: true, force: true });
      await mkdir(coverage, { recursive: true });
      const tests = tested.flatMap(t => [t.name, layout.locateTestOutput(t)]);
      const environment = { ...this.environment, [PackageTestCheck.FILTERS_VARIABLE]: PackageTestCheck.ALL_TESTS, [PackageTestCheck.COVERAGE_VARIABLE]: coverage };
      const testsPassed = await this.runner.runAsync(process.execPath, [PackageTestCheck.SOURCE_MAPS_OPTION, this.locateEntry(PackageTestCheck.TEST_ENTRY_SEGMENTS), ...tests], this.root, environment) === 0;
      const projects = packages.flatMap(t => [t.name, layout.locateInstalled(t), layout.locateSource(t, PackageTestCheck.SOURCE_FOLDER), t.coverageExclusions]);
      const coverageComplete = await this.runner.runAsync(process.execPath, [this.locateEntry(PackageTestCheck.COVERAGE_ENTRY_SEGMENTS), coverage, ...projects], this.root, this.environment) === 0;
      return testsPassed && coverageComplete;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException || error instanceof ModuleException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }

  private locateEntry(segments: readonly string[]): string {
    return path.join(this.root, ...PackageTestCheck.FRAMEWORK_SEGMENTS, ...segments);
  }
}
