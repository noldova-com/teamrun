/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { DataException, DataRecord, type DataSource, type DataValue } from "@noldova/teamrun-foundation-data";
import { SqlConnection, type SqlDialect, type SqlQuery } from "@noldova/teamrun-foundation-data-sql";

import { Resources } from "../resources.js";
import { SQLiteDialect } from "./sqlite-dialect.js";

export class SQLiteConnection extends SqlConnection {
  private readonly handle: DatabaseSync;
  private readonly sqliteDialect: SqlDialect = new SQLiteDialect();

  private constructor(dataSource: DataSource, handle: DatabaseSync) {
    super(dataSource);

    this.handle = handle;
  }

  public static open(dataSource: DataSource): SQLiteConnection {
    mkdirSync(dirname(dataSource.location), { recursive: true });
    const handle = new DatabaseSync(dataSource.location);
    handle.exec(Resources.journalModePragma);
    handle.exec(Resources.foreignKeysPragma);
    return new SQLiteConnection(dataSource, handle);
  }

  public override get dialect(): SqlDialect {
    return this.sqliteDialect;
  }

  public override get isOpen(): boolean {
    return this.handle.isOpen;
  }

  public override execute(query: SqlQuery): number {
    this.throwIfClosed();
    return Number(this.handle.prepare(query.text).run(...query.parameters).changes);
  }

  public override insert(query: SqlQuery): number {
    this.throwIfClosed();
    return Number(this.handle.prepare(query.text).run(...query.parameters).lastInsertRowid);
  }

  public override query(query: SqlQuery): readonly DataRecord[] {
    this.throwIfClosed();
    return this.handle.prepare(query.text).all(...query.parameters).map(t => SQLiteConnection.toRecord(t));
  }

  public override close(): void {
    if (this.handle.isOpen)
      this.handle.close();
  }

  private static toRecord(row: Record<string, SQLOutputValue>): DataRecord {
    const values = new Map<string, DataValue>();
    for (const [name, value] of Object.entries(row)) {
      if (!Object.isNull(value) && !Object.isString(value) && !Object.isNumber(value))
        throw new DataException(Resources.unsupportedValue);

      values.set(name, value);
    }

    return new DataRecord(values);
  }
}
