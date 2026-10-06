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
import { ProcessKilling } from "../../models/process-killing.js";
import { ProcessTable } from "../../models/process-table.js";
import type { ProcessTableEntry } from "../../models/process-table-entry.js";
import { Resources } from "../../resources.js";
import { ProcessSignals } from "./process-signals.js";
import { WindowsProcessTableReader } from "./windows-process-table.reader.js";

export class WindowsProcessKiller {
  private readonly api: IWindowsProcessApi;
  private readonly reader: IProcessTableReader;

  public constructor(api: IWindowsProcessApi, reader: IProcessTableReader) {
    this.api = api;
    this.reader = reader;
  }

  public async killAsync(targets: readonly ProcessTableEntry[], milliseconds: number, lists: boolean): Promise<ProcessKilling> {
    const deadline = Date.now() + milliseconds;
    const opened: bigint[] = [];
    const held: (readonly [number, bigint])[] = [];
    const killed: number[] = [];
    const replaced: number[] = [];
    const denied: number[] = [];
    try {
      for (const target of targets) {
        const handle = this.api.openProcess(target.processId, Resources.windowsEndAccess);
        if (Object.isNumber(handle)) {
          if (handle !== Resources.windowsGoneError)
            denied.push(target.processId);
          continue;
        }
        opened.push(handle);
        const created = this.api.readCreationTime(handle);
        if (Object.isNull(created))
          denied.push(target.processId);
        else if (WindowsProcessTableReader.toMilliseconds(created) !== target.started)
          replaced.push(target.processId);
        else {
          if (this.api.terminateProcess(handle))
            killed.push(target.processId);
          held.push([target.processId, handle]);
        }
      }
      const table = lists ? await this.reader.readAsync() : new ProcessTable([]);
      await ProcessSignals.waitAsync(() => held.every(([, t]) => this.api.hasExited(t)), Math.max(0, deadline - Date.now()));
      return new ProcessKilling(killed, replaced, [...denied, ...held.filter(([, t]) => !this.api.hasExited(t)).map(([t]) => t)], table);
    }
    finally {
      for (const handle of opened)
        this.api.closeHandle(handle);
    }
  }
}
