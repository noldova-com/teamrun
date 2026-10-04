/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import type { IProcessEnder } from "../../interfaces/process-ender.js";
import type { IProcessTableReader } from "../../interfaces/process-table-reader.js";
import { KeptProgram } from "../../models/kept-program.js";
import { ProcessEnding } from "../../models/process-ending.js";
import type { ProcessExit } from "../../models/process-exit.js";
import type { ProcessRecord } from "../../models/process-record.js";
import type { ProcessSettings } from "../../models/process-settings.js";
import { ProcessTable } from "../../models/process-table.js";
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

  public async stopAsync(running: readonly RunningProcess[], kept: readonly KeptProgram[]): Promise<readonly ProcessEnding[]> {
    const table = kept.length === 0 ? new ProcessTable([]) : await this.reader.readAsync();
    const claimed = kept.filter(t => t.members.some(u => table.includes(u)));
    const left = kept.filter(t => !claimed.includes(t)).map(t => PosixProcessEnder.leave(table, t.record));
    return [...await this.endGroupsAsync([...running.map(t => t.record), ...claimed.map(t => t.record)]), ...left];
  }

  public async endAfterExitAsync(record: ProcessRecord, exit: ProcessExit): Promise<readonly ProcessEnding[] | KeptProgram> {
    if (!ProcessSignals.isRunning(-record.processId))
      return [new ProcessEnding(record)];
    if (!exit.isClean)
      return await this.endGroupsAsync([record]);
    return new KeptProgram(record, (await this.reader.readAsync()).listGroup(record.processId));
  }

  public async endLeftoversAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    if (records.every(t => !ProcessSignals.isRunning(-t.processId)))
      return records.map(t => new ProcessEnding(t));

    const table = await this.reader.readAsync();
    const claimed = records.filter(t => Object.isUndefined(table.find(t.processId))
      ? table.listGroup(t.processId).some(u => t.isSeenWith(u))
      : !Object.isUndefined(table.findLeader(t)));
    const others = records.filter(t => !claimed.includes(t)).map(t => Object.isUndefined(table.find(t.processId)) ? PosixProcessEnder.leave(table, t) : new ProcessEnding(t));
    return [...await this.killGroupsAsync(claimed, table), ...others];
  }

  private static leave(table: ProcessTable, record: ProcessRecord): ProcessEnding {
    return new ProcessEnding(record, [], [], table.listGroup(record.processId).map(t => t.processId));
  }

  private async endGroupsAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]> {
    for (const record of records)
      ProcessSignals.send(-record.processId, Resources.terminateSignal);
    if (await ProcessSignals.waitAsync(() => records.every(t => !ProcessSignals.isRunning(-t.processId)), this.settings.graceMilliseconds))
      return records.map(t => new ProcessEnding(t));
    return await this.killGroupsAsync(records, await this.reader.readAsync());
  }

  private async killGroupsAsync(records: readonly ProcessRecord[], table: ProcessTable): Promise<readonly ProcessEnding[]> {
    const targets = records.map(t => new ProcessEnding(t, table.listGroup(t.processId).map(u => u.processId)));
    const killed = targets.filter(t => t.forced.length > 0).map(t => t.record.processId);
    for (const processId of killed)
      ProcessSignals.send(-processId, Resources.killSignal);
    await ProcessSignals.waitAsync(() => killed.every(t => !ProcessSignals.isRunning(-t)), this.settings.endMilliseconds);
    return targets.map(t => new ProcessEnding(t.record, t.forced, t.forced.filter(u => ProcessSignals.isRunning(u))));
  }
}
