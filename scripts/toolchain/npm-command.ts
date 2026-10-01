/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProcessResult from "../processes/process-result.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";

export default class NpmCommand {
  private static readonly PATH_VARIABLE: string = "npm_execpath";
  private static readonly TIMEOUT: number = 600_000;
  private static readonly UNAVAILABLE: string = "npm_execpath is not set; run this through npm, such as npm run build or npm test.";

  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.environment = environment;
  }

  public async runAsync(npmArguments: readonly string[], directory: string): Promise<ProcessResult> {
    const npm = this.environment[NpmCommand.PATH_VARIABLE];
    if (npm === undefined || npm.length === 0)
      throw new ProcessException(NpmCommand.UNAVAILABLE);
    return this.runner.captureAsync(process.execPath, [npm, ...npmArguments], directory, NpmCommand.TIMEOUT);
  }
}
