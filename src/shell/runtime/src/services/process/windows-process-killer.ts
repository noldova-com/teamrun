/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { ProcessKilling } from "../../models/process-killing.js";
import { ProcessTable } from "../../models/process-table.js";
import type { ProcessTableEntry } from "../../models/process-table-entry.js";
import { Resources } from "../../resources.js";
import type { WindowsPowerShell } from "./windows-power-shell.js";
import { WindowsProcessTableReader } from "./windows-process-table.reader.js";

export class WindowsProcessKiller {
  private readonly shell: WindowsPowerShell;

  public constructor(shell: WindowsPowerShell) {
    this.shell = shell;
  }

  public async killAsync(targets: readonly ProcessTableEntry[], milliseconds: number, lists: boolean): Promise<ProcessKilling> {
    const states: (readonly [number, string])[] = [];
    const rows: ProcessTableEntry[] = [];
    for (const line of await this.shell.runAsync(Resources.formatWindowsKillScript(targets.flatMap(t => [t.processId, t.started]), milliseconds, lists))) {
      const match = Resources.windowsKillRowPattern.exec(line);
      if (Object.isNull(match))
        rows.push(WindowsProcessTableReader.parse(line));
      else
        states.push([Number(match[1]), String(match[2])]);
    }
    return new ProcessKilling(
      states.filter(([, t]) => t === Resources.killedState).map(([t]) => t),
      states.filter(([, t]) => t === Resources.replacedState).map(([t]) => t),
      states.filter(([, t]) => t === Resources.runningState || t === Resources.deniedState).map(([t]) => t),
      new ProcessTable(rows));
  }
}
