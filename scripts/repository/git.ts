/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ExecutableLocator from "../processes/executable-locator.ts";
import type ProcessResult from "../processes/process-result.ts";
import type ProcessRunner from "../processes/process-runner.ts";
import ProcessException from "../processes/process.exception.ts";

export default class Git {
  private static readonly NAME: string = "git";
  private static readonly TIMEOUT: number = 60_000;
  private static readonly SUCCESS: readonly number[] = [0];

  private readonly directory: string;
  private readonly runner: ProcessRunner;
  private readonly executable: string;

  public constructor(directory: string, runner: ProcessRunner) {
    this.directory = directory;
    this.runner = runner;
    this.executable = ExecutableLocator.locate(Git.NAME);
  }

  public async readOutputAsync(gitArguments: readonly string[], exitCodes: readonly number[] = Git.SUCCESS): Promise<string> {
    const result = await this.executeAsync(gitArguments);
    if (!exitCodes.some(t => t === result.exitCode))
      throw new ProcessException(`"git ${gitArguments.join(" ")}" failed with exit code ${result.exitCode}: ${result.errorOutput.trim()}`);
    return result.output;
  }

  public async succeedsAsync(gitArguments: readonly string[]): Promise<boolean> {
    return (await this.executeAsync(gitArguments)).isSuccessful;
  }

  private executeAsync(gitArguments: readonly string[]): Promise<ProcessResult> {
    return this.runner.captureAsync(this.executable, gitArguments, this.directory, Git.TIMEOUT);
  }
}
