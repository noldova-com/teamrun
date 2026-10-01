/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ProcessResult from "../../processes/process-result.ts";
import ProcessRunner from "../../processes/process-runner.ts";

export default class ProcessRunnerFixture extends ProcessRunner {
  private readonly exitCodes: (number | null)[];
  private readonly captures: ProcessResult[];

  public readonly runs: (readonly string[])[] = [];
  public readonly captured: (readonly string[])[] = [];

  public constructor(exitCodes: readonly (number | null)[] = [], captures: readonly ProcessResult[] = []) {
    super();

    this.exitCodes = [...exitCodes];
    this.captures = [...captures];
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number): Promise<ProcessResult> {
    const capture = this.captures.shift();
    if (capture === undefined)
      return super.captureAsync(command, commandArguments, directory, timeout);
    this.captured.push([command, directory, ...commandArguments]);
    return capture;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string): Promise<number | null> {
    this.runs.push([command, directory, ...commandArguments]);
    return this.exitCodes.length === 0 ? 0 : this.exitCodes.shift() ?? null;
  }
}
