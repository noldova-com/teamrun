/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { fileURLToPath } from "node:url";
import { type IProcessStarter, NodeProcessStarter, ProcessCommand, type ProcessTerminator, Resources, type StartedProcess } from "@noldova/teamrun.providers";

export class FakeGrokStarter implements IProcessStarter {
  public readonly started: ProcessCommand[] = [];
  private readonly starter: IProcessStarter;

  public constructor(terminator: ProcessTerminator) {
    this.starter = new NodeProcessStarter(terminator);
  }

  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess {
    if (command.executable === Resources.psExecutable || command.executable === Resources.powershellExecutable)
      return this.starter.start(command, environment, directory);
    this.started.push(command);
    return this.starter.start(new ProcessCommand(process.execPath, [fileURLToPath(new URL("./fake-grok-agent.fixture.js", import.meta.url))]),
      { ...process.env, ...environment }, directory);
  }

  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return this.starter.readEnvironmentAsync(own);
  }
}
