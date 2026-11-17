/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type IProcessStarter, type ProcessCommand, Resources, type StartedProcess } from "@noldova/teamrun.providers";

import { CountWaiter } from "./count-waiter.fixture.js";

export class ProgramRecorder {
  private static readonly PROCESS_LISTINGS: readonly string[] = [Resources.psExecutable, Resources.powershellExecutable];
  private static readonly STDERR_TAIL: number = 800;

  private readonly ending: CountWaiter = new CountWaiter();
  private readonly closing: Map<number, PromiseWithResolvers<void>> = new Map();

  public readonly started: { processId: number; executable: string; arguments: readonly string[] }[] = [];
  public readonly ended: number[] = [];
  public readonly closed: { processId: number; arguments: readonly string[]; code: number | null; signal: string | null; stderr: string }[] = [];

  public wrap(inner: Pick<IProcessStarter, "start"> & Partial<IProcessStarter>): IProcessStarter {
    return {
      start: (command, environment, directory) => this.record(command, inner.start(command, environment, directory)),
      readEnvironmentAsync: own => inner.readEnvironmentAsync?.(own) ?? Promise.resolve(own)
    };
  }

  public endedAt(count: number): Promise<void> {
    return this.ending.reach(count);
  }

  public endOf(processId: number): Promise<void> {
    return this.closingOf(processId).promise;
  }

  private closingOf(processId: number): PromiseWithResolvers<void> {
    const closing = this.closing.get(processId) ?? Promise.withResolvers<void>();
    this.closing.set(processId, closing);
    return closing;
  }

  private record(command: ProcessCommand, child: StartedProcess): StartedProcess {
    if (ProgramRecorder.PROCESS_LISTINGS.includes(command.executable))
      return child;
    child.once("spawn", () => {
      const processId = child.pid;
      if (Object.isUndefined(processId))
        return;
      this.started.push({ processId, executable: command.executable, arguments: command.arguments });
      let stderr = String.empty;
      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr = `${stderr}${String(chunk)}`.slice(-ProgramRecorder.STDERR_TAIL);
      });
      child.once("close", (code: number | null, signal: string | null) => {
        this.closed.push({ processId, arguments: command.arguments, code, signal, stderr });
        this.ended.push(processId);
        this.ending.add();
        this.closingOf(processId).resolve();
      });
    });
    return child;
  }
}
