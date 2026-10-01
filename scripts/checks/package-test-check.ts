/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";

import BuildLayout from "../packages/build-layout.ts";
import type PackageBuild from "../packages/package-build.ts";
import PackageCatalog from "../packages/package-catalog.ts";
import PackageException from "../packages/package.exception.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";
import type ICheck from "./interfaces/check.ts";

export default class PackageTestCheck implements ICheck {
  private static readonly TESTING_PACKAGE: string = "@noldova/teamrun-foundation-testing";
  private static readonly ENTRY_SEGMENTS: readonly string[] = ["node_modules", "@noldova", "teamrun-foundation-testing", "services", "execution", "test-run-entry.js"];
  private static readonly SOURCE_MAPS_OPTION: string = "--enable-source-maps";
  private static readonly FILTERS_VARIABLE: string = "TEAMRUN_TEST_FILTERS";
  private static readonly ALL_TESTS: string = "[]";
  private static readonly NO_TESTS: string = "No package has tests.\n";
  private static readonly NO_FRAMEWORK: string = `Packages have tests, but ${PackageTestCheck.TESTING_PACKAGE} is not a package under src/.\n`;

  private readonly root: string;
  private readonly build: PackageBuild;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public readonly title: string = "Package tests";

  public constructor(root: string, build: PackageBuild, runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.build = build;
    this.runner = runner;
    this.environment = environment;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    try {
      await this.build.requireCurrentAsync();
      const layout = new BuildLayout(this.root);
      const packages = await new PackageCatalog(this.root).listPackagesAsync();
      const tested = packages.filter(t => existsSync(layout.locateTestOutput(t)));
      if (tested.length === 0) {
        output.write(PackageTestCheck.NO_TESTS);
        return true;
      }
      if (!packages.some(t => t.name === PackageTestCheck.TESTING_PACKAGE)) {
        output.write(PackageTestCheck.NO_FRAMEWORK);
        return false;
      }

      const projects = tested.flatMap(t => [t.name, layout.locateTestOutput(t)]);
      const entry = path.join(this.root, ...PackageTestCheck.ENTRY_SEGMENTS);
      const environment = { ...this.environment, [PackageTestCheck.FILTERS_VARIABLE]: PackageTestCheck.ALL_TESTS };
      return await this.runner.runAsync(process.execPath, [PackageTestCheck.SOURCE_MAPS_OPTION, entry, ...projects], this.root, environment) === 0;
    }
    catch (error) {
      if (!(error instanceof PackageException || error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }
}
