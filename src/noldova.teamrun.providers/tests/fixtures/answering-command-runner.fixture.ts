/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type CommandResult, CommandRunner, NodeProcessStarter, ProcessTerminator, type ProcessCommand } from "@noldova/teamrun.providers";

export class AnsweringCommandRunner extends CommandRunner {
  private readonly answer: CommandResult | null;

  public readonly commands: ProcessCommand[] = [];
  public readonly environments: NodeJS.ProcessEnv[] = [];
  public readonly timeouts: (number | null)[] = [];
  public readonly cancels: (AbortSignal | null)[] = [];

  public constructor(answer: CommandResult | null) {
    super(new NodeProcessStarter(new ProcessTerminator(process.platform)));
    this.answer = answer;
  }

  public override run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number | null, cancel: AbortSignal | null = null): Promise<CommandResult> {
    this.commands.push(command);
    this.environments.push(environment);
    this.timeouts.push(timeoutMilliseconds);
    this.cancels.push(cancel);
    return Object.isNull(this.answer) ? Promise.reject(new Error("The program could not start.")) : Promise.resolve(this.answer);
  }
}
