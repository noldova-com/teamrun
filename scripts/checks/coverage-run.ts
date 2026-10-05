/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import type ProcessRunner from "../processes/process-runner.ts";

export default class CoverageRun {
  private static readonly SERVICES_SEGMENTS: readonly string[] = ["node_modules", "@noldova", "teamrun-foundation-testing", "services"];
  private static readonly ENTRY_SEGMENTS: readonly string[] = ["coverage", "coverage-run-entry.js"];
  private static readonly COVERAGE_VARIABLE: string = "NODE_V8_COVERAGE";
  private static readonly NO_EXPERIMENTAL_WARNINGS: string = "--disable-warning=ExperimentalWarning";

  public static readonly NO_EXCLUSIONS: string = "[]";
  public static readonly NO_TEST_FOLDERS: readonly string[] = [];

  private readonly root: string;
  private readonly runner: ProcessRunner;

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public static formatProjectArguments(name: string, productionDirectory: string, sourceDirectory: string, exclusions: string, testFolders: readonly string[]): readonly string[] {
    return [name, productionDirectory, sourceDirectory, exclusions, JSON.stringify(testFolders)];
  }

  public static recordingIn(environment: NodeJS.ProcessEnv, coverageDirectory: string): NodeJS.ProcessEnv {
    return { ...environment, [CoverageRun.COVERAGE_VARIABLE]: coverageDirectory };
  }

  public locateService(...segments: readonly string[]): string {
    return path.join(this.root, ...CoverageRun.SERVICES_SEGMENTS, ...segments);
  }

  public async measureAsync(coverageDirectory: string, projects: readonly string[], environment: NodeJS.ProcessEnv): Promise<boolean> {
    return await this.runner.runAsync(process.execPath, [CoverageRun.NO_EXPERIMENTAL_WARNINGS, this.locateService(...CoverageRun.ENTRY_SEGMENTS), coverageDirectory, ...projects], this.root, environment) === 0;
  }
}
