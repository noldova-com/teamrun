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

  public async stopAsync(running: readonly RunningProcess[]): Promise<readonly ProcessEnding[]> {
    const exited = new Map<RunningProcess, number>();
    for (const item of running.filter(t => !t.process.input.writableEnded))
      item.process.input.end();
    await ProcessSignals.waitAsync(() => {
      for (const item of running.filter(t => t.process.hasExited && !exited.has(t)))
        exited.set(item, Date.now());
      return exited.size === running.length;
    }, this.settings.graceMilliseconds);
    const table = await this.reader.readAsync();
    return await this.killTreesAsync(running.map(t => [t.record, WindowsProcessEnder.findTree(table, t.record, exited.get(t)), []] as const));
  }

  public endAfterExitAsync(record: ProcessRecord): Promise<readonly ProcessEnding[]> {
    return Promise.resolve([new ProcessEnding(record)]);
  }

  public async endLeftoversAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    const table = await this.reader.readAsync();
    return await this.killTreesAsync(records.map(t => WindowsProcessEnder.findLeftovers(table, t)));
  }

  private static findTree(table: ProcessTable, record: ProcessRecord, exited: number | undefined): readonly ProcessTableEntry[] {
    const leader = Object.isUndefined(exited) ? table.findLeader(record) : undefined;
    return Object.isUndefined(leader) ? table.findOrphans(record, exited ?? Date.now()) : table.findTree(leader);
  }

  private static findLeftovers(table: ProcessTable, record: ProcessRecord): readonly [ProcessRecord, readonly ProcessTableEntry[], readonly number[]] {
    const holder = table.find(record.processId);
    if (!Object.isUndefined(holder) && record.isStartOf(holder) && WindowsProcessEnder.isRunBy(holder, record))
      return [record, table.findTree(holder), []];
    const end = Object.isUndefined(holder) ? Number.POSITIVE_INFINITY : holder.started - 1;
    const orphans = table.findOrphans(record, Math.min(record.seen, end));
    return [record, orphans, table.findOrphans(record, end).filter(t => !orphans.includes(t)).map(t => t.processId)];
  }

  private static isRunBy(leader: ProcessTableEntry, record: ProcessRecord): boolean {
    return !Object.isNull(leader.executable) && path.win32.normalize(leader.executable).toLowerCase() === path.win32.normalize(record.executable).toLowerCase();
  }

  private async killTreesAsync(trees: readonly (readonly [ProcessRecord, readonly ProcessTableEntry[], readonly number[]])[]): Promise<readonly ProcessEnding[]> {
    const killed = trees.flatMap(([, t]) => t);
    if (killed.length === 0)
      return trees.map(([record, , left]) => new ProcessEnding(record, [], [], left));
    for (const entry of killed)
      ProcessSignals.send(entry.processId, Resources.killSignal);
    const until = Date.now();
    const after = await this.reader.readAsync();
    const forced = trees.map(([record, tree, left]) => {
      const late = after.findLateChildren(tree, until);
      for (const entry of late)
        ProcessSignals.send(entry.processId, Resources.killSignal);
      return [record, [...tree, ...late].map(t => t.processId), left] as const;
    });
    await ProcessSignals.waitAsync(() => forced.every(([, t]) => t.every(u => !ProcessSignals.isRunning(u))), this.settings.endMilliseconds);
    return forced.map(([record, processIds, left]) => new ProcessEnding(record, processIds, processIds.filter(t => ProcessSignals.isRunning(t)), left));
  }
}
