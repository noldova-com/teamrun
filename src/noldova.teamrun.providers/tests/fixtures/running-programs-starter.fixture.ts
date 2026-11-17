/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IProcessStarter, NodeProcessStarter, type ProcessCommand, ProcessTerminator, type StartedProcess } from "@noldova/teamrun.providers";

export class RunningProgramsStarter implements IProcessStarter {
  private readonly inner: IProcessStarter = new NodeProcessStarter(new ProcessTerminator(process.platform));
  private readonly exits: Promise<void>[] = [];

  public readonly running: ProcessCommand[] = [];

  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess {
    const started = this.inner.start(command, environment, directory);
    const exited = Promise.withResolvers<void>();
    this.exits.push(exited.promise);
    started.once("spawn", () => this.running.push(command));
    started.once("exit", () => {
      const index = this.running.indexOf(command);
      if (index >= 0)
        this.running.splice(index, 1);
      exited.resolve();
    });
    return started;
  }

  public async allExited(): Promise<void> {
    await Promise.all(this.exits);
  }

  public ofKind(kind: string): readonly ProcessCommand[] {
    return this.running.filter(t => t.origin?.kind === kind);
  }

  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return this.inner.readEnvironmentAsync(own);
  }
}
