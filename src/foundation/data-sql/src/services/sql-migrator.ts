/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Migrator } from "@noldova/teamrun-foundation-data";

import { SqlQuery } from "../models/sql-query.js";
import { MigrationBuilder } from "./schema/migration-builder.js";
import type { SqlConnection } from "./sql-connection.js";
import { SqlMigrationHistory } from "./sql-migration-history.js";
import type { SqlMigration } from "./sql-migration.js";

export class SqlMigrator extends Migrator<SqlMigration> {
  private readonly connection: SqlConnection;

  public constructor(connection: SqlConnection, migrations: readonly SqlMigration[]) {
    super(migrations, new SqlMigrationHistory(connection));

    this.connection = connection;
  }

  protected override apply(migration: SqlMigration): void {
    const builder = new MigrationBuilder();
    migration.up(builder);
    this.connection.transaction(() => {
      for (const operation of builder.toOperations())
        this.connection.execute(new SqlQuery(operation.render(this.connection.dialect)));
      this.history.record(migration.id);
    });
  }
}
