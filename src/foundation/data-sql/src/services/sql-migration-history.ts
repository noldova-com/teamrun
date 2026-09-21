/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { MigrationHistory } from "@noldova/teamrun-foundation-data";

import { SqlQuery } from "../models/sql-query.js";
import { Resources } from "../resources.js";
import type { SqlConnection } from "./sql-connection.js";

export class SqlMigrationHistory extends MigrationHistory {
  private readonly connection: SqlConnection;

  public constructor(connection: SqlConnection) {
    super();

    this.connection = connection;
  }

  public override getApplied(): readonly string[] {
    this.connection.execute(new SqlQuery(Resources.createMigrationsTable));
    return this.connection.query(new SqlQuery(Resources.selectAppliedMigrations)).map(t => t.readString(Resources.idColumn));
  }

  public override record(id: string): void {
    this.connection.execute(new SqlQuery(Resources.insertMigration, [id, new Date().toISOString()]));
  }
}
