/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SQLOutputValue } from "node:sqlite";

import type { IModuleDatabase } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { DataException, DataRecord, type DataValue } from "@noldova/context.data";
import { type SqlQuery, SqlSession } from "@noldova/context.data.sql";

import { Resources } from "../resources.js";

export class ModuleDatabaseSession extends SqlSession {
  private readonly database: IModuleDatabase;
  private open: boolean = true;

  public constructor(database: IModuleDatabase) {
    super();

    this.database = database;
  }

  public override get isOpen(): boolean {
    return this.open;
  }

  public override async executeAsync(query: SqlQuery): Promise<number> {
    return Number(this.database.run(query.text, ...query.parameters).changes);
  }

  public override async insertAsync(query: SqlQuery): Promise<number> {
    return Number(this.database.run(query.text, ...query.parameters).lastInsertRowid);
  }

  public override async queryAsync(query: SqlQuery): Promise<readonly DataRecord[]> {
    return this.database.readAll(query.text, ...query.parameters).map(t => ModuleDatabaseSession.toRecord(t));
  }

  public override async closeAsync(): Promise<void> {
    this.open = false;
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
