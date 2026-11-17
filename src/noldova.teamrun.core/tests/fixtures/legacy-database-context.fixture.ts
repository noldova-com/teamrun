/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";
import "@noldova/context.data.sql.sqlite";
import { DbContext, DbContextOptionsBuilder } from "@noldova/context.data";
import type { SqlConnection, SqlMigration } from "@noldova/context.data.sql";
import { InitialMigration } from "@noldova/teamrun.core";

export class LegacyDatabaseContext extends DbContext<SqlConnection, SqlMigration> {
  private constructor(directory: string, migrations: readonly SqlMigration[]) {
    super(new DbContextOptionsBuilder().useSQLite(join(directory, "teamrun.db")), migrations);
  }

  public static async openAsync(directory: string, migrations: readonly SqlMigration[] = [new InitialMigration()]): Promise<LegacyDatabaseContext> {
    const context = new LegacyDatabaseContext(directory, migrations);
    try {
      await context.database.migrateAsync();
      return context;
    }
    catch (error) {
      await context[Symbol.asyncDispose]();
      throw error;
    }
  }
}
