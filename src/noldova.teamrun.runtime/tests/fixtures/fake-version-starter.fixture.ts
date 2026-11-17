/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IProcessStarter, NodeProcessStarter, ProcessCommand, type ProcessTerminator, type StartedProcess } from "@noldova/teamrun.providers";

export class FakeVersionStarter implements IProcessStarter {
  public readonly started: { readonly command: ProcessCommand; readonly environment: NodeJS.ProcessEnv }[] = [];
  private readonly starter: IProcessStarter;
  private readonly version: string;

  public constructor(terminator: ProcessTerminator, version: string) {
    this.starter = new NodeProcessStarter(terminator);
    this.version = version;
  }

  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess {
    this.started.push({ command, environment });
    return this.starter.start(new ProcessCommand(process.execPath, ["-e", `process.stdout.write(${JSON.stringify(`${this.version}\n`)})`]),
      { ...process.env }, directory);
  }

  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return this.starter.readEnvironmentAsync(own);
  }
}
