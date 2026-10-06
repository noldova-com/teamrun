/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/teamrun-foundation-core";

import type { IProcessEnder } from "../../interfaces/i-process-ender.js";
import type { IProcessTableReader } from "../../interfaces/i-process-table.reader.js";
import { ProcessEnding } from "../../models/process-ending.js";
import type { ProcessRecord } from "../../models/process-record.js";
import type { ProcessSettings } from "../../models/process-settings.js";
import type { ProcessTable } from "../../models/process-table.js";
import type { ProcessTableEntry } from "../../models/process-table-entry.js";
import type { RunningProcess } from "../../models/running-process.js";
import type { ProcessClock } from "./process-clock.js";
import { ProcessSignals } from "./process-signals.js";
import type { WindowsProcessKiller } from "./windows-process-killer.js";

export class WindowsProcessEnder implements IProcessEnder {
  private readonly reader: IProcessTableReader;
  private readonly killer: WindowsProcessKiller;
  private readonly settings: ProcessSettings;
  private readonly clock: ProcessClock;

  public constructor(reader: IProcessTableReader, killer: WindowsProcessKiller, settings: ProcessSettings, clock: ProcessClock) {
    this.reader = reader;
    this.killer = killer;
    this.settings = settings;
    this.clock = clock;
  }

  public async stopAsync(running: readonly RunningProcess[]): Promise<readonly ProcessEnding[]> {
    const t0 = Date.now();
    for (const item of running.filter(t => !t.process.input.writableEnded))
      item.process.input.end();
    const exits = await Promise.all(running.map(async t => [t.record, await ProcessSignals.waitForAsync(t.exitTime, this.settings.graceMilliseconds)] as const));
    const t1 = Date.now();
    const table = await this.reader.readAsync();
    const t2 = Date.now();
    const trees = exits.map(([record, exited]) => [record, this.findTree(table, record, exited), []] as const);
    const result = await this.killTreesAsync(trees);
    process.stderr.write(`DIAG593 E ${process.pid} at=${t0} exited=${exits.map(([, t]) => String(!Object.isUndefined(t))).join(",")} targets=${trees.flatMap(([, t]) => t).length} grace=${t1 - t0} read=${t2 - t1} kill=${Date.now() - t2}\n`);
    return result;
  }

  public endAfterExitAsync(record: ProcessRecord): Promise<readonly ProcessEnding[]> {
    return Promise.resolve([new ProcessEnding(record)]);
  }

  public async endLeftoversAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    const table = await this.reader.readAsync();
    return await this.killTreesAsync(records.map(t => WindowsProcessEnder.findLeftovers(table, t)));
  }

  private static findLeftovers(table: ProcessTable, record: ProcessRecord): readonly [ProcessRecord, readonly ProcessTableEntry[], readonly number[]] {
    const holder = table.find(record.processId);
    if (!Object.isUndefined(holder) && record.isStartOf(holder) && WindowsProcessEnder.isRunBy(holder, record))
      return [record, table.findTree(holder), []];
    const before = holder?.started ?? Number.POSITIVE_INFINITY;
    const orphans = table.findOrphans(record, record.seen, before);
    return [record, orphans, table.findOrphans(record, Number.POSITIVE_INFINITY, before).filter(t => !orphans.includes(t)).map(t => t.processId)];
  }

  private static isRunBy(leader: ProcessTableEntry, record: ProcessRecord): boolean {
    return !Object.isNull(leader.executable) && path.win32.normalize(leader.executable).toLowerCase() === path.win32.normalize(record.executable).toLowerCase();
  }

  private findTree(table: ProcessTable, record: ProcessRecord, exited: number | undefined): readonly ProcessTableEntry[] {
    const leader = Object.isUndefined(exited) ? table.findLeader(record) : undefined;
    return Object.isUndefined(leader) ? table.findOrphans(record, exited ?? this.clock.now()) : table.findTree(leader);
  }

  private async killTreesAsync(trees: readonly (readonly [ProcessRecord, readonly ProcessTableEntry[], readonly number[]])[]): Promise<readonly ProcessEnding[]> {
    const targets = trees.flatMap(([, t]) => t);
    if (targets.length === 0)
      return trees.map(([record, , left]) => new ProcessEnding(record, [], [], left));
    const first = await this.killer.killAsync(targets, this.settings.endMilliseconds, true);
    const until = this.clock.now();
    const grown = trees.map(([record, tree, left]) => [record, tree, first.table.findLateChildren(tree.filter(t => !first.replaced.includes(t.processId)), until), left] as const);
    const late = grown.flatMap(([, , t]) => t);
    const second = late.length === 0 ? undefined : await this.killer.killAsync(late, this.settings.endMilliseconds, false);
    const killed = [...first.killed, ...second?.killed ?? []];
    const running = [...first.running, ...second?.running ?? []];
    return grown.map(([record, tree, children, left]) => {
      const processIds = [...tree, ...children].map(t => t.processId);
      return new ProcessEnding(record, processIds.filter(t => killed.includes(t)), processIds.filter(t => running.includes(t)), left);
    });
  }
}
