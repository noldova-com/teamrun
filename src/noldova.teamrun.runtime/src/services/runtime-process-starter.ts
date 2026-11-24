/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import { type IRuntimePartContext, type OwnedProcess, ProcessRequest } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { Resources as CoreResources } from "@noldova/teamrun.core";
import { type IProcessStarter, type ProcessCommand, SharedMcpLauncher, StartedProcess } from "@noldova/teamrun.providers";

import { ProcessNotStartedException } from "../exceptions/process-not-started.exception.js";
import { Resources } from "../resources.js";

export class RuntimeProcessStarter implements IProcessStarter {
  private readonly context: IRuntimePartContext;
  private readonly workFolder: string;
  private readonly platform: string;

  public constructor(context: IRuntimePartContext, workFolder: string, platform: string) {
    this.context = context;
    this.workFolder = workFolder;
    this.platform = platform;
  }

  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess {
    const variables = RuntimeProcessStarter.toVariables(SharedMcpLauncher.environmentToStart(this.platform, environment));
    const request = new ProcessRequest(command.executable, command.arguments, directory ?? this.workFolder, variables, [], undefined, command.isVerbatim);
    const started = new StartedProcess();
    this.context.startProcessAsync(request).then(
      owned => RuntimeProcessStarter.attach(started, owned),
      (error: unknown) => {
        this.context.log.write(Resources.formatProgramNotStarted(path.basename(command.executable), command.origin, CoreResources.formatFailureKind(error)));
        RuntimeProcessStarter.refuse(started, error instanceof Error ? error : new ProcessNotStartedException(path.basename(command.executable), error));
      });

    return started;
  }

  public async readEnvironmentAsync(_own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return { ...await this.context.readEnvironmentAsync() };
  }

  private static attach(started: StartedProcess, owned: OwnedProcess): void {
    started.attach(owned.processId, owned.input, owned.output, owned.errors, async () => {
      await owned.stopAsync();
    });
    void owned.exited.then(exit => started.end(exit.code, exit.signal as NodeJS.Signals | null));
  }

  private static refuse(started: StartedProcess, error: Error): void {
    started.fail(error);
    started.end(null, null);
  }

  private static toVariables(environment: NodeJS.ProcessEnv): Record<string, string> {
    const variables: Record<string, string> = {};
    for (const [name, value] of Object.entries(environment))
      if (!Object.isUndefined(value) && Resources.environmentNamePattern.test(name) && name !== Resources.crashPipeVariable)
        variables[name] = value;

    return variables;
  }
}
