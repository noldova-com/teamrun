/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ProcessRunner from "../../processes/process-runner.ts";

export default class ProcessRunnerFixture extends ProcessRunner {
  private readonly exitCodes: (number | null)[];

  public readonly runs: (readonly string[])[] = [];

  public constructor(exitCodes: readonly (number | null)[] = []) {
    super();

    this.exitCodes = [...exitCodes];
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string): Promise<number | null> {
    this.runs.push([command, directory, ...commandArguments]);
    return this.exitCodes.length === 0 ? 0 : this.exitCodes.shift() ?? null;
  }
}
