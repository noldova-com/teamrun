/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";

import type { ProcessCommand } from "../../models/process-command.js";
import { Resources } from "../../resources.js";
import type { CommandRunner } from "../process/command-runner.js";

export class ExecutableVersionReader {
  private readonly runner: CommandRunner;
  private readonly timeoutMilliseconds: number;

  public constructor(runner: CommandRunner, timeoutMilliseconds: number) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(timeoutMilliseconds, Resources.timeoutParameterName);

    this.runner = runner;
    this.timeoutMilliseconds = timeoutMilliseconds;
  }

  public async read(command: ProcessCommand, environment: NodeJS.ProcessEnv): Promise<string | null> {
    try {
      const result = await this.runner.run(command.withArguments(Resources.versionArgument), environment, this.timeoutMilliseconds);
      const match = Resources.versionPattern.exec(result.output);
      return Object.isNull(match) ? null : match[0];
    }
    catch {
      return null;
    }
  }
}
