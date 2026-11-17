/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { CommandExit, type ICommandStarter, type IRunningCommand } from "@noldova/teamrun.core";
import { type IProcessStarter, ProcessCommand, type StartedProcess } from "@noldova/teamrun.providers";

import { Resources } from "../resources.js";

export class RuntimeCommandStarter implements ICommandStarter {
  private readonly starter: IProcessStarter;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly platform: string;

  public constructor(starter: IProcessStarter, environment: NodeJS.ProcessEnv = process.env, platform: string = process.platform) {
    this.starter = starter;
    this.environment = environment;
    this.platform = platform;
  }

  public refusalOf(command: string): string | null {
    return this.platform === Resources.windowsPlatform && Resources.windowsLineBreaks.test(command) ? Resources.windowsCommandLineBreak : null;
  }

  public start(command: string, directory: string, output: (text: string) => void): IRunningCommand {
    const stoppedFirst = Promise.withResolvers<CommandExit>();
    let isStopped = false;
    let started: StartedProcess | null = null;
    const following = this.starter.readEnvironmentAsync(this.environment).then(environment => {
      if (isStopped)
        return stoppedFirst.promise;
      started = this.starter.start(this.shellOf(command, environment), environment, directory);
      return RuntimeCommandStarter.follow(started, output);
    });
    const exited = Promise.race([stoppedFirst.promise,
      following.catch((error: unknown) => new CommandExit(null, null, error instanceof Error ? error.message : String(error)))]);
    return {
      exited,
      stopAsync: async () => {
        isStopped = true;
        if (Object.isNull(started))
          stoppedFirst.resolve(new CommandExit(null, null));
        else
          await started.stopAsync();
      }
    };
  }

  private static follow(started: StartedProcess, output: (text: string) => void): Promise<CommandExit> {
    for (const stream of [started.stdout, started.stderr]) {
      stream.setEncoding(Resources.utf8Encoding);
      stream.on(Resources.dataEvent, (text: string) => output(text));
    }
    return new Promise<CommandExit>(resolve => {
      started.once(Resources.closeEvent, (code: number | null, signal: string | null) => resolve(new CommandExit(code, signal)));
      started.once(Resources.errorEvent, (error: Error) => resolve(new CommandExit(null, null, error.message)));
    });
  }

  private shellOf(command: string, environment: NodeJS.ProcessEnv): ProcessCommand {
    if (this.platform === Resources.windowsPlatform)
      return new ProcessCommand(RuntimeCommandStarter.shellIn(environment, Resources.windowsShellVariable, Resources.windowsShell), [...Resources.windowsShellFlags, Resources.formatWindowsShellCommand(command)], null, true);
    return new ProcessCommand(RuntimeCommandStarter.shellIn(environment, Resources.posixShellVariable, Resources.posixShell), [Resources.posixShellFlag, command]);
  }

  private static shellIn(environment: NodeJS.ProcessEnv, variable: string, usual: string): string {
    const shell = environment[variable] ?? String.empty;
    return String.isNullOrWhitespace(shell) ? usual : shell;
  }
}
