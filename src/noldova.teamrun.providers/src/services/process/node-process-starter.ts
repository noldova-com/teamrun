/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";

import "@noldova/context.core";

import type { IProcessStarter } from "../../interfaces/i-process-starter.js";
import type { ProcessCommand } from "../../models/process-command.js";
import { Resources } from "../../resources.js";
import type { ProcessTerminator } from "./process-terminator.js";
import { StartedProcess } from "./started-process.js";

export class NodeProcessStarter implements IProcessStarter {
  private readonly terminator: ProcessTerminator;

  public constructor(terminator: ProcessTerminator) {
    this.terminator = terminator;
  }

  public start(command: ProcessCommand, environment: NodeJS.ProcessEnv, directory: string | null): StartedProcess {
    const started = new StartedProcess();
    const child = spawn(command.executable, command.arguments, {
      ...(Object.isNull(directory) ? {} : { cwd: directory }),
      env: environment,
      stdio: "pipe",
      detached: command.ownsGroup && process.platform !== Resources.windowsPlatform,
      windowsHide: true,
      windowsVerbatimArguments: command.isVerbatim
    });
    child.once(Resources.spawnEvent, () => started.attach(Number(child.pid), child.stdin, child.stdout, child.stderr, () => this.terminator.terminate(child)));
    child.on(Resources.errorEvent, (error: Error) => started.fail(error));
    child.once(Resources.closeEvent, (code: number | null, signal: NodeJS.Signals | null) => started.end(code, signal));

    return started;
  }

  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return Promise.resolve(own);
  }
}
