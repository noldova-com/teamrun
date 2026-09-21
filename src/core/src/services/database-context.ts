/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/teamrun-foundation-data-sql-sqlite";
import { DbContext, type DbContextOptions, DbContextOptionsBuilder } from "@noldova/teamrun-foundation-data";
import type { SqlConnection, SqlMigration } from "@noldova/teamrun-foundation-data-sql";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import { Resources } from "../resources.js";
import { MigrationCatalog } from "./migrations/migration-catalog.js";
import { ProjectActivity } from "./projects/project-activity.js";
import { DatabaseRecovery } from "./database-recovery.js";

export class DatabaseContext extends DbContext<SqlConnection, SqlMigration> {
  public readonly projectActivity: ProjectActivity = new ProjectActivity();
  public readonly dataDirectory: string;

  private constructor(options: DbContextOptions<SqlConnection, SqlMigration>, dataDirectory: string) {
    super(options, MigrationCatalog.all);

    this.dataDirectory = dataDirectory;
  }

  public static open(dataDirectory: string): DatabaseContext {
    ArgumentException.throwIfNullOrWhitespace(dataDirectory, Resources.dataDirectoryParameterName);

    const context = new DatabaseContext(new DbContextOptionsBuilder().useSQLite(join(dataDirectory, Resources.databaseFileName)), dataDirectory);
    try {
      DatabaseRecovery.assertCompatible(context.database.getAppliedMigrations());
      context.database.transaction(() => context.database.migrate());
      return context;
    }
    catch (error) {
      context[Symbol.dispose]();
      throw error;
    }
  }
}
