/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DbContextOptions } from "../models/db-context-options.js";
import type { Migration } from "../models/migration.js";
import type { ChangeFeed } from "./change-feed.js";
import type { Connection } from "./connection.js";
import type { Migrator } from "./migrator.js";
import type { Transaction } from "./transaction.js";

export class DatabaseFacade<TConnection extends Connection, TMigration extends Migration> {
  private readonly migrator: Migrator<TMigration>;

  public readonly connection: TConnection;
  public readonly changeFeed: ChangeFeed;

  public constructor(options: DbContextOptions<TConnection, TMigration>, migrations: readonly TMigration[]) {
    this.connection = options.provider.openConnection(options.dataSource);
    this.migrator = options.provider.createMigrator(this.connection, migrations);
    this.changeFeed = options.provider.createChangeFeed(this.connection);
  }

  public migrate(): readonly string[] {
    return this.migrator.migrate();
  }

  public getAppliedMigrations(): readonly string[] {
    return this.migrator.getAppliedMigrations();
  }

  public getPendingMigrations(): readonly TMigration[] {
    return this.migrator.getPendingMigrations();
  }

  public beginTransaction(): Transaction {
    return this.connection.beginTransaction();
  }

  public transaction<T>(action: () => T): T {
    return this.connection.transaction(action);
  }
}
