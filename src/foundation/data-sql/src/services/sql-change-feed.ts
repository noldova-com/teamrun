/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Change, ChangeFeed, ChangeOperation, DataException, type DataRecord } from "@noldova/teamrun-foundation-data";

import { SqlQuery } from "../models/sql-query.js";
import { Resources } from "../resources.js";
import type { SqlConnection } from "./sql-connection.js";

export class SqlChangeFeed extends ChangeFeed {
  private readonly connection: SqlConnection;

  public constructor(connection: SqlConnection) {
    super();

    this.connection = connection;
  }

  protected override appendCore(entity: string, entityId: string, operation: ChangeOperation, payload: string): Change {
    this.prepare();
    const createdAt = new Date().toISOString();
    const sequence = this.connection.insert(new SqlQuery(Resources.insertChange, [entity, entityId, operation, payload, createdAt]));
    return new Change(sequence, entity, entityId, operation, payload, createdAt);
  }

  protected override readAfterCore(sequence: number, limit: number): readonly Change[] {
    this.prepare();
    return this.connection.query(new SqlQuery(Resources.selectChangesAfter, [sequence, limit])).map(t => SqlChangeFeed.toChange(t));
  }

  private prepare(): void {
    this.connection.execute(new SqlQuery(Resources.createChangesTable));
    this.connection.execute(new SqlQuery(Resources.createChangesIndex));
  }

  private static toChange(record: DataRecord): Change {
    return new Change(
      record.readInteger(Resources.sequenceColumn),
      record.readString(Resources.entityColumn),
      record.readString(Resources.entityIdColumn),
      SqlChangeFeed.parseOperation(record.readString(Resources.operationColumn)),
      record.readString(Resources.payloadColumn),
      record.readString(Resources.createdAtColumn));
  }

  private static parseOperation(text: string): ChangeOperation {
    const operation = Object.values(ChangeOperation).find(t => t === text);
    if (Object.isUndefined(operation))
      throw new DataException(Resources.unknownOperation);

    return operation;
  }
}
