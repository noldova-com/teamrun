/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProcessEnder } from "../../interfaces/process-ender.js";
import type { IProcessTableReader } from "../../interfaces/process-table-reader.js";
import { ProcessEnding } from "../../models/process-ending.js";
import type { ProcessExit } from "../../models/process-exit.js";
import type { ProcessRecord } from "../../models/process-record.js";
import type { ProcessSettings } from "../../models/process-settings.js";
import type { ProcessTableEntry } from "../../models/process-table-entry.js";
import type { RunningProcess } from "../../models/running-process.js";
import { Resources } from "../../resources.js";
import { ProcessSignals } from "./process-signals.js";

export class PosixProcessEnder implements IProcessEnder {
  private readonly reader: IProcessTableReader;
  private readonly settings: ProcessSettings;

  public constructor(reader: IProcessTableReader, settings: ProcessSettings) {
    this.reader = reader;
    this.settings = settings;
  }

  public async stopAsync(running: readonly RunningProcess[], leftovers: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    for (const item of running)
      ProcessSignals.send(-item.record.processId, Resources.terminateSignal);
    const orphans = leftovers.length === 0 ? [] : await this.findMembersAsync(leftovers);
    for (const orphan of orphans)
      ProcessSignals.send(orphan.processId, Resources.terminateSignal);

    await ProcessSignals.waitAsync(
      () => running.every(t => !ProcessSignals.isRunning(-t.record.processId)) && orphans.every(t => !ProcessSignals.isRunning(t.processId)),
      this.settings.graceMilliseconds);
    return await this.killAsync([...running.map(t => t.record), ...leftovers]);
  }

  public async endAfterExitAsync(record: ProcessRecord, exit: ProcessExit): Promise<readonly ProcessEnding[] | null> {
    if (!ProcessSignals.isRunning(-record.processId))
      return [new ProcessEnding(record, [], [])];
    return exit.isClean ? null : await this.stopAsync([], [record]);
  }

  public endLeftoversAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    return this.killAsync(records);
  }

  private async findMembersAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessTableEntry[]> {
    const table = await this.reader.readAsync();
    return records.flatMap(t => table.findGroup(t));
  }

  private async killAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    if (records.every(t => !ProcessSignals.isRunning(-t.processId)))
      return records.map(t => new ProcessEnding(t, [], []));

    const table = await this.reader.readAsync();
    const targets = records.map(t => new ProcessEnding(t, table.findGroup(t).map(u => u.processId), []));
    const processIds = targets.flatMap(t => t.forced);
    for (const processId of processIds)
      ProcessSignals.send(processId, Resources.killSignal);
    await ProcessSignals.waitAsync(() => processIds.every(t => !ProcessSignals.isRunning(t)), this.settings.endMilliseconds);
    return targets.map(t => new ProcessEnding(t.record, t.forced, t.forced.filter(u => ProcessSignals.isRunning(u))));
  }
}
