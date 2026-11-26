/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { DataSource, DbContextOptionsBuilder, type DbContextOptions } from "@noldova/context.data";
import type { SqlConnection, SqlMigration } from "@noldova/context.data.sql";
import { DatabaseContext, Resources } from "@noldova/teamrun.core";

import { NormalSQLiteProvider } from "./normal-sqlite-provider.fixture.js";

export class TestDatabase {
  public static readonly FILE_NAME: string = Resources.databaseFileName;

  public static options(location: string): DbContextOptions<SqlConnection, SqlMigration> {
    return new DbContextOptionsBuilder().use(new NormalSQLiteProvider(), new DataSource("teamrun", location));
  }

  public static async openAsync(directory: string): Promise<DatabaseContext> {
    const context = DatabaseContext.attach(TestDatabase.options(join(directory, TestDatabase.FILE_NAME)), directory);
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
