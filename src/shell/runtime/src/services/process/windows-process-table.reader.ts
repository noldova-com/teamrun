/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { IProcessTableReader } from "../../interfaces/i-process-table.reader.js";
import type { IWindowsProcessApi } from "../../interfaces/i-windows-process-api.js";
import { ProcessTable } from "../../models/process-table.js";
import { ProcessTableEntry } from "../../models/process-table-entry.js";
import { Resources } from "../../resources.js";
import type { ProcessClock } from "./process-clock.js";

export class WindowsProcessTableReader implements IProcessTableReader {
  private readonly api: IWindowsProcessApi;
  private readonly clock: ProcessClock;

  public constructor(api: IWindowsProcessApi, clock: ProcessClock) {
    this.api = api;
    this.clock = clock;
  }

  public static toMilliseconds(fileTime: bigint): number {
    return Number(fileTime / Resources.fileTimeUnitsPerMillisecond) - Resources.fileTimeEpochMilliseconds;
  }

  public async readAsync(): Promise<ProcessTable> {
    const taken = this.clock.now();
    const listed = this.api.listProcesses();
    return new ProcessTable(listed.flatMap(([processId, parentId]) => {
      const entry = this.read(processId, parentId);
      return Object.isNull(entry) || entry.started > taken ? [] : [entry];
    }));
  }

  private read(processId: number, parentId: number): ProcessTableEntry | null {
    const handle = this.api.openProcess(processId, Resources.windowsQueryAccess);
    if (Object.isNumber(handle))
      return null;
    try {
      const created = this.api.readCreationTime(handle);
      if (Object.isNull(created))
        return null;
      const started = WindowsProcessTableReader.toMilliseconds(created);
      return new ProcessTableEntry(
        processId,
        parentId,
        null,
        started,
        started - Resources.windowsStartMargin,
        started + Resources.windowsStartMargin,
        this.api.readImagePath(handle));
    }
    finally {
      this.api.closeHandle(handle);
    }
  }
}
