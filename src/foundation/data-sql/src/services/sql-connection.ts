/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Connection, type DataRecord, type Transaction } from "@noldova/teamrun-foundation-data";

import type { SqlQuery } from "../models/sql-query.js";
import type { SqlDialect } from "./sql-dialect.js";
import { SqlTransaction } from "./sql-transaction.js";

export abstract class SqlConnection extends Connection {
  public abstract get dialect(): SqlDialect;

  public abstract execute(query: SqlQuery): number;

  public abstract insert(query: SqlQuery): number;

  public abstract query(query: SqlQuery): readonly DataRecord[];

  public override beginTransaction(): Transaction {
    this.throwIfClosed();
    return new SqlTransaction(this);
  }
}
