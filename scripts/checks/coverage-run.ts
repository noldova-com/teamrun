/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import type ProcessRunner from "../processes/process-runner.ts";
import type ICoverageCount from "../totals/interfaces/coverage-count.ts";
import JsonFields from "../totals/json-fields.ts";

export default class CoverageRun {
  public static readonly NO_EXCLUSIONS: string = "[]";
  public static readonly NO_TEST_FOLDERS: readonly string[] = [];

  private static readonly SERVICES_SEGMENTS: readonly string[] = ["node_modules", "@noldova", "teamrun-foundation-testing", "services"];
  private static readonly ENTRY_SEGMENTS: readonly string[] = ["coverage", "coverage-run-entry.js"];
  private static readonly COVERAGE_VARIABLE: string = "NODE_V8_COVERAGE";
  private static readonly NO_EXPERIMENTAL_WARNINGS: string = "--disable-warning=ExperimentalWarning";
  private static readonly RESULT_VARIABLE: string = "TEAMRUN_COVERAGE_RESULT_FILE";
  private static readonly UNIT: string = "files";
  private static readonly ENCODING: BufferEncoding = "utf8";

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

  public static countingIn(environment: NodeJS.ProcessEnv, resultFile: string): NodeJS.ProcessEnv {
    return { ...environment, [CoverageRun.RESULT_VARIABLE]: resultFile };
  }

  public static async readCountAsync(root: string, resultFile: string): Promise<ICoverageCount | null> {
    if (!existsSync(resultFile))
      return null;
    const fields = JsonFields.parse(await readFile(resultFile, CoverageRun.ENCODING), path.relative(root, resultFile).split(path.sep).join(path.posix.sep));
    return { unit: CoverageRun.UNIT, covered: fields.count("covered"), total: fields.count("total") };
  }

  public locateService(...segments: readonly string[]): string {
    return path.join(this.root, ...CoverageRun.SERVICES_SEGMENTS, ...segments);
  }

  public async measureAsync(coverageDirectory: string, projects: readonly string[], environment: NodeJS.ProcessEnv): Promise<boolean> {
    return await this.runner.runAsync(process.execPath, [CoverageRun.NO_EXPERIMENTAL_WARNINGS, this.locateService(...CoverageRun.ENTRY_SEGMENTS), coverageDirectory, ...projects], this.root, environment) === 0;
  }
}
