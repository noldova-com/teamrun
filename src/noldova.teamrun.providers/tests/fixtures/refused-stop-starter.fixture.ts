/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IProcessStarter, NodeProcessStarter, type ProcessCommand, ProcessTerminator, type StartedProcess } from "@noldova/teamrun.providers";

export class RefusedStopStarter implements IProcessStarter {
  private readonly inner: IProcessStarter = new NodeProcessStarter(new ProcessTerminator(process.platform));
  private readonly providerEnvironment: NodeJS.ProcessEnv;
  private readonly everyCommand: boolean;

  public constructor(providerEnvironment: NodeJS.ProcessEnv, everyCommand: boolean = false) {
    this.providerEnvironment = providerEnvironment;
    this.everyCommand = everyCommand;
  }

  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess {
    if (!this.everyCommand && Object.isNullOrUndefined(command.origin?.providerId))
      return this.inner.start(command, environment, directory);

    const started = this.inner.start(command, { ...environment, ...this.providerEnvironment }, directory);
    const stop = started.stopAsync.bind(started);
    started.stopAsync = async (): Promise<void> => {
      await stop();
      throw new Error("stop refused");
    };
    return started;
  }

  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return this.inner.readEnvironmentAsync(own);
  }
}
