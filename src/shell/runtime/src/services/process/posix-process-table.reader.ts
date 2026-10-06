/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { SystemCommandException } from "../../exceptions/system-command.exception.js";
import type { IProcessTableReader } from "../../interfaces/i-process-table.reader.js";
import { ProcessTable } from "../../models/process-table.js";
import { ProcessTableEntry } from "../../models/process-table-entry.js";
import { Resources } from "../../resources.js";
import type { SystemCommand } from "../commands/system-command.js";
import type { ProcessClock } from "./process-clock.js";

export class PosixProcessTableReader implements IProcessTableReader {
  private readonly command: SystemCommand;
  private readonly clock: ProcessClock;

  public constructor(command: SystemCommand, clock: ProcessClock) {
    this.command = command;
    this.clock = clock;
  }

  public async readAsync(): Promise<ProcessTable> {
    const before = this.clock.now();
    const output = await this.command.runAsync(Resources.processTableCommand, Resources.processTableArguments);
    const after = this.clock.now();
    return new ProcessTable(output.split(Resources.lineBreakPattern).filter(t => !String.isNullOrWhitespace(t)).map(t => PosixProcessTableReader.parse(t, before, after)));
  }

  private static parse(row: string, before: number, after: number): ProcessTableEntry {
    const match = Resources.processTableRowPattern.exec(row);
    if (Object.isNull(match))
      throw new SystemCommandException(Resources.formatProcessTableRowUnreadable(row));
    const [, processId, parentId, groupId, days, hours, minutes, seconds] = match;
    const elapsed = (((Number(days ?? 0) * 24 + Number(hours ?? 0)) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000;
    return new ProcessTableEntry(
      Number(processId),
      Number(parentId),
      Number(groupId),
      before - elapsed,
      before - elapsed - Resources.posixStartMargin,
      after - elapsed + Resources.posixStartMargin,
      null);
  }
}
