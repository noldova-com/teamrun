/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import type { IProcessTableReader } from "../../interfaces/process-table-reader.js";
import { ProcessTable } from "../../models/process-table.js";
import { ProcessTableEntry } from "../../models/process-table-entry.js";
import { Resources } from "../../resources.js";
import type { WindowsPowerShell } from "./windows-power-shell.js";

export class WindowsProcessTableReader implements IProcessTableReader {
  private readonly shell: WindowsPowerShell;

  public constructor(shell: WindowsPowerShell) {
    this.shell = shell;
  }

  public static parse(row: string): ProcessTableEntry {
    const match = Resources.windowsProcessTableRowPattern.exec(row);
    if (Object.isNull(match))
      throw new SystemCommandException(Resources.formatProcessTableRowUnreadable(row));
    const [, processId, parentId, started, executable] = match;
    const time = Number(started);
    return new ProcessTableEntry(
      Number(processId),
      Number(parentId),
      null,
      time,
      time - Resources.windowsStartMargin,
      time + Resources.windowsStartMargin,
      String.isNullOrEmpty(executable) ? null : String(executable));
  }

  public async readAsync(): Promise<ProcessTable> {
    return new ProcessTable((await this.shell.runAsync(Resources.windowsProcessTableScript)).map(t => WindowsProcessTableReader.parse(t)));
  }
}
