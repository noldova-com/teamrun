/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChildProcessStarter, type IProcessStarter } from "@noldova/teamrun-shell-runtime";

export class ScriptedStarterFixture implements IProcessStarter {
  private readonly script: string;

  public readonly requests: (readonly string[])[] = [];
  public readonly errorFiles: string[] = [];
  public readonly processIds: number[] = [];

  public constructor(script: string) {
    this.script = script;
  }

  public async startAsync(executable: string, launchArguments: readonly string[], environment: NodeJS.ProcessEnv, errorFile: string): Promise<number> {
    this.requests.push([executable, ...launchArguments]);
    this.errorFiles.push(errorFile);
    const processId = await new ChildProcessStarter().startAsync(process.execPath, ["-e", this.script], environment, errorFile);
    this.processIds.push(processId);
    return processId;
  }
}
