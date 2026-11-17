/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type CommandResult, CommandRunner, NodeProcessStarter, ProcessTerminator, type ProcessCommand } from "@noldova/teamrun.providers";

export class TimedCommandRunner extends CommandRunner {
  public readonly timeouts: (number | null)[] = [];

  public constructor() {
    super(new NodeProcessStarter(new ProcessTerminator(process.platform)));
  }

  public override run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number | null, cancel: AbortSignal | null = null): Promise<CommandResult> {
    this.timeouts.push(timeoutMilliseconds);
    return super.run(command, environment, timeoutMilliseconds, cancel);
  }
}
