/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";

import type { IProcessTableReader } from "../../interfaces/i-process-table.reader.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";
import { PosixProcessTableReader } from "../process/posix-process-table.reader.js";
import { ProcessClock } from "../process/process-clock.js";
import { WindowsPowerShell } from "../process/windows-power-shell.js";
import { WindowsProcessTableReader } from "../process/windows-process-table.reader.js";

export class ProcessPresence {
  private readonly reader: IProcessTableReader;

  private constructor(reader: IProcessTableReader) {
    this.reader = reader;
  }

  public static create(platform: string, command: SystemCommand, environment: NodeJS.ProcessEnv): ProcessPresence {
    return new ProcessPresence(platform === Resources.windowsPlatform
      ? new WindowsProcessTableReader(new WindowsPowerShell(command, environment))
      : new PosixProcessTableReader(command, ProcessClock.create(platform)));
  }

  public async stampAsync(processes: readonly (readonly [number, string])[]): Promise<readonly UpdateProcess[]> {
    if (processes.length === 0)
      return [];
    const table = await this.reader.readAsync();
    return processes.flatMap(([processId, role]) => {
      const entry = table.find(processId);
      return Object.isUndefined(entry) ? [] : [new UpdateProcess(processId, entry.earliest, entry.latest, role)];
    });
  }

  public async isRunningAsync(process: UpdateProcess): Promise<boolean> {
    const entry = (await this.reader.readAsync()).find(process.processId);
    return !Object.isUndefined(entry) && entry.earliest <= process.latest && process.earliest <= entry.latest;
  }
}
