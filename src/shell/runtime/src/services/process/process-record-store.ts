/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SQLOutputValue } from "node:sqlite";

import { ProcessRecord } from "../../models/process-record.js";
import { Resources } from "../../resources.js";
import type { ShellDatabase } from "../database/shell-database.js";

export class ProcessRecordStore {
  private readonly database: ShellDatabase;

  public constructor(database: ShellDatabase) {
    this.database = database;
  }

  public add(moduleId: string, processId: number, program: string, executable: string, boot: string, requested: number, started: number, clockOffset: number): ProcessRecord {
    const result = this.database.run(Resources.insertOwnedProcessStatement, moduleId, processId, program, executable, boot, requested, started, started, clockOffset);
    return new ProcessRecord(Number(result.lastInsertRowid), moduleId, processId, program, executable, boot, requested, started, started, clockOffset);
  }

  public markSeen(records: readonly ProcessRecord[], seen: number, clockOffset: number): void {
    this.database.transaction(() => {
      for (const record of records)
        this.database.run(Resources.updateOwnedProcessSeenStatement, seen, clockOffset, record.id);
    });
  }

  public remove(record: ProcessRecord): void {
    this.database.run(Resources.deleteOwnedProcessStatement, record.id);
  }

  public readAll(): readonly ProcessRecord[] {
    return this.database.readAll(Resources.readOwnedProcessesStatement).map(t => ProcessRecordStore.toRecord(t));
  }

  private static toRecord(row: Record<string, SQLOutputValue>): ProcessRecord {
    return new ProcessRecord(
      Number(row[Resources.idColumn]),
      String(row[Resources.moduleColumn]),
      Number(row[Resources.processIdColumn]),
      String(row[Resources.programColumn]),
      String(row[Resources.executableColumn]),
      String(row[Resources.bootColumn]),
      Number(row[Resources.requestedColumn]),
      Number(row[Resources.startedColumn]),
      Number(row[Resources.seenColumn]),
      Number(row[Resources.clockOffsetColumn]));
  }
}
