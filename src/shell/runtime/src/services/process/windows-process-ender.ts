/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";

import type { IProcessEnder } from "../../interfaces/process-ender.js";
import type { IProcessTableReader } from "../../interfaces/process-table-reader.js";
import { ProcessEnding } from "../../models/process-ending.js";
import type { ProcessRecord } from "../../models/process-record.js";
import type { ProcessSettings } from "../../models/process-settings.js";
import type { ProcessTable } from "../../models/process-table.js";
import type { ProcessTableEntry } from "../../models/process-table-entry.js";
import type { RunningProcess } from "../../models/running-process.js";
import { Resources } from "../../resources.js";
import { ProcessSignals } from "./process-signals.js";

export class WindowsProcessEnder implements IProcessEnder {
  private readonly reader: IProcessTableReader;
  private readonly settings: ProcessSettings;

  public constructor(reader: IProcessTableReader, settings: ProcessSettings) {
    this.reader = reader;
    this.settings = settings;
  }

  public async stopAsync(running: readonly RunningProcess[], leftovers: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    for (const item of running.filter(t => !t.process.input.writableEnded))
      item.process.input.end();
    await ProcessSignals.waitAsync(() => running.every(t => t.process.hasExited), this.settings.graceMilliseconds);
    return await this.endTreesAsync([...running.map(t => t.record), ...leftovers], (table, record) => table.findTree(record));
  }

  public endAfterExitAsync(record: ProcessRecord): Promise<readonly ProcessEnding[] | null> {
    return Promise.resolve([new ProcessEnding(record, [], [])]);
  }

  public endLeftoversAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    return this.endTreesAsync(records, (table, record) => WindowsProcessEnder.isRunBy(table.find(record.processId), record) ? table.findTree(record) : []);
  }

  private static isRunBy(leader: ProcessTableEntry | undefined, record: ProcessRecord): boolean {
    return Object.isUndefined(leader) || (!Object.isNull(leader.executable) && path.win32.normalize(leader.executable).toLowerCase() === path.win32.normalize(record.executable).toLowerCase());
  }

  private async endTreesAsync(records: readonly ProcessRecord[], find: (table: ProcessTable, record: ProcessRecord) => readonly ProcessTableEntry[]): Promise<readonly ProcessEnding[]> {
    const table = await this.reader.readAsync();
    const targets = records.map(t => new ProcessEnding(t, find(table, t).map(u => u.processId).reverse(), []));
    const processIds = targets.flatMap(t => t.forced);
    for (const processId of processIds)
      ProcessSignals.send(processId, Resources.killSignal);
    await ProcessSignals.waitAsync(() => processIds.every(t => !ProcessSignals.isRunning(t)), this.settings.endMilliseconds);
    return targets.map(t => new ProcessEnding(t.record, t.forced, t.forced.filter(u => ProcessSignals.isRunning(u))));
  }
}
