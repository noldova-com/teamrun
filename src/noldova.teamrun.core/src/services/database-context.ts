/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import "@noldova/context.data.sql.sqlite";
import { DbContext, type DbContextOptions, DbContextOptionsBuilder } from "@noldova/context.data";
import type { SqlConnection, SqlMigration } from "@noldova/context.data.sql";
import { ArgumentException } from "@noldova/context.exceptions";
import { ErrorCode } from "@noldova/teamrun.protocol";
import { ServiceException } from "@noldova/teamrun.services";

import { Resources } from "../resources.js";
import { ChatFolders } from "./conversations/chat-folders.js";
import { MigrationCatalog } from "./migrations/migration-catalog.js";
import { ProjectActivity } from "./projects/project-activity.js";

export class DatabaseContext extends DbContext<SqlConnection, SqlMigration> {
  public readonly projectActivity: ProjectActivity = new ProjectActivity();
  public readonly dataDirectory: string;
  public readonly chatFolders: ChatFolders;

  private constructor(options: DbContextOptions<SqlConnection, SqlMigration>, dataDirectory: string) {
    super(options, MigrationCatalog.all);

    this.dataDirectory = dataDirectory;
    this.chatFolders = new ChatFolders(dataDirectory);
  }

  public static async openAsync(dataDirectory: string): Promise<DatabaseContext> {
    ArgumentException.throwIfNullOrWhitespace(dataDirectory, Resources.dataDirectoryParameterName);

    const context = new DatabaseContext(new DbContextOptionsBuilder().useSQLite(join(dataDirectory, Resources.databaseFileName)), dataDirectory);
    try {
      DatabaseContext.assertCompatible(await context.database.getAppliedMigrationsAsync());
      await context.database.migrateAsync();
      return context;
    }
    catch (error) {
      await context[Symbol.asyncDispose]();
      throw error;
    }
  }

  public static attach(options: DbContextOptions<SqlConnection, SqlMigration>, dataDirectory: string): DatabaseContext {
    ArgumentException.throwIfNullOrWhitespace(dataDirectory, Resources.dataDirectoryParameterName);

    return new DatabaseContext(options, dataDirectory);
  }

  private static assertCompatible(applied: readonly string[]): void {
    const known = MigrationCatalog.all;
    if (applied.some((id, index) => known[index]?.id !== id))
      throw new ServiceException(ErrorCode.VersionMismatch, Resources.databaseVersionUnsupported, []);
  }
}
