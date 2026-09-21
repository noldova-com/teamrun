/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DataSource } from "../models/data-source.js";
import type { Migration } from "../models/migration.js";
import type { ChangeFeed } from "./change-feed.js";
import type { Connection } from "./connection.js";
import type { Migrator } from "./migrator.js";

export abstract class DataProvider<TConnection extends Connection, TMigration extends Migration> {
  public abstract openConnection(dataSource: DataSource): TConnection;

  public abstract createMigrator(connection: TConnection, migrations: readonly TMigration[]): Migrator<TMigration>;

  public abstract createChangeFeed(connection: TConnection): ChangeFeed;
}
