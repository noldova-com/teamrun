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
  private static readonly ENTRY_SEGMENTS: readonly string[] = ["node_modules", "@noldova", "teamrun-foundation-testing", "services", "coverage", "coverage-run-entry.js"];
  private static readonly NO_EXCLUSIONS: string = "[]";
  private static readonly QUIET_STRIPPING: string = "--disable-warning=ExperimentalWarning";

  private readonly root: string;
  private readonly runner: ProcessRunner;

  public constructor(root: string, runner: ProcessRunner) {
    this.root = root;
    this.runner = runner;
  }

  public static project(name: string, productionDirectory: string, sourceDirectory: string, exclusions: string = CoverageRun.NO_EXCLUSIONS, testFolders: readonly string[] = []): readonly string[] {
    return [name, productionDirectory, sourceDirectory, exclusions, JSON.stringify(testFolders)];
  }

  public async measureAsync(coverageDirectory: string, projects: readonly string[], environment: NodeJS.ProcessEnv): Promise<boolean> {
    return await this.runner.runAsync(process.execPath, [CoverageRun.QUIET_STRIPPING, path.join(this.root, ...CoverageRun.ENTRY_SEGMENTS), coverageDirectory, ...projects], this.root, environment) === 0;
  }
}
