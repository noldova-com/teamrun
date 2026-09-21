/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChangeFeed, DataProvider, type Migrator } from "@noldova/teamrun-foundation-data";

import { SqlChangeFeed } from "./sql-change-feed.js";
import type { SqlConnection } from "./sql-connection.js";
import type { SqlMigration } from "./sql-migration.js";
import { SqlMigrator } from "./sql-migrator.js";

export abstract class SqlProvider extends DataProvider<SqlConnection, SqlMigration> {
  public override createMigrator(connection: SqlConnection, migrations: readonly SqlMigration[]): Migrator<SqlMigration> {
    return new SqlMigrator(connection, migrations);
  }

  public override createChangeFeed(connection: SqlConnection): ChangeFeed {
    return new SqlChangeFeed(connection);
  }
}
