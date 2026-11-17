/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IProcessStarter, NodeProcessStarter, type ProcessCommand, ProcessTerminator, Resources, type StartedProcess } from "@noldova/teamrun.providers";

export class WatchingProcessStarter implements IProcessStarter {
  private static readonly PROCESS_LISTINGS: readonly string[] = [Resources.psExecutable, Resources.powershellExecutable];

  private readonly inner: IProcessStarter = new NodeProcessStarter(new ProcessTerminator(process.platform));
  private readonly onStart: (command: ProcessCommand, started: StartedProcess) => void;

  public readonly started: ProcessCommand[] = [];
  public readonly environments: NodeJS.ProcessEnv[] = [];
  public current: NodeJS.ProcessEnv = {};
  public reading: Promise<void> = Promise.resolve();
  public reads: number = 0;

  public constructor(onStart: (command: ProcessCommand, started: StartedProcess) => void) {
    this.onStart = onStart;
  }

  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess {
    const started = this.inner.start(command, environment, directory);
    if (WatchingProcessStarter.PROCESS_LISTINGS.includes(command.executable))
      return started;
    this.started.push(command);
    this.environments.push(environment);
    this.onStart(command, started);
    return started;
  }

  public async readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    this.reads += 1;
    await this.reading;
    return { ...own, ...this.current };
  }
}
