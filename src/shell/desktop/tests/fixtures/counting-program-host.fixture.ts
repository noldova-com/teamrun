/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChildProgramHost, type IProgramHost, type StartedProgram } from "@noldova/teamrun-shell-desktop";

export class CountingProgramHost implements IProgramHost {
  private readonly host: ChildProgramHost = new ChildProgramHost(5000);

  public answered: number = 0;

  public async runAsync(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv): Promise<string> {
    try {
      return await this.host.runAsync(file, programArguments, environment);
    }
    finally {
      this.answered++;
    }
  }

  public start(file: string, programArguments: readonly string[], environment: NodeJS.ProcessEnv, onOutput: (text: string) => void, onExit: () => void): StartedProgram {
    return this.host.start(file, programArguments, environment, onOutput, onExit);
  }
}
