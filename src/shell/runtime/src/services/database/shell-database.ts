/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DatabaseSync } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { DataDirectoryState } from "../../enums/data-directory-state.js";
import { MigrationException } from "../../exceptions/migration.exception.js";
import { PreShellDataException } from "../../exceptions/pre-shell-data.exception.js";
import { UnknownSchemaException } from "../../exceptions/unknown-schema.exception.js";
import type { Migration } from "../../models/migration.js";
import { Resources } from "../../resources.js";
import { DataDirectoryInspector } from "../data-directory/data-directory-inspector.js";
import type { OwnershipLock } from "../ownership/ownership-lock.js";
import { DatabaseBackup } from "./database-backup.js";

export class ShellDatabase implements Disposable {
  private connection: DatabaseSync | null;

  public readonly appliedMigrations: readonly string[];

  private constructor(connection: DatabaseSync, appliedMigrations: readonly string[]) {
    this.connection = connection;
    this.appliedMigrations = [...appliedMigrations];
  }

  public static async openAsync(lock: OwnershipLock, migrations: readonly Migration[], moment: Date = new Date()): Promise<ShellDatabase> {
    lock.requireHeld();
    const directory = lock.dataDirectory;
    const inspection = await DataDirectoryInspector.inspectAsync(directory);
    if (inspection.state === DataDirectoryState.PreShell)
      throw new PreShellDataException(directory.root, inspection.entries);

    const connection = new DatabaseSync(directory.shellDatabase);
    try {
      connection.exec(Resources.writeAheadLogStatement);
      const applied = ShellDatabase.prepareHistory(connection, migrations);
      const pending = migrations.slice(applied.length);
      if (applied.length > 0 && pending.length > 0)
        await DatabaseBackup.createAsync(
          connection,
          directory.backupsFolder,
          Resources.formatBackupName(applied.length + 1, Resources.formatTimestamp(moment)));
      for (const [index, migration] of pending.entries())
        ShellDatabase.apply(connection, migration, applied.length + index + 1);
      return new ShellDatabase(connection, migrations.map(t => t.id));
    }
    catch (error) {
      connection.close();
      throw error;
    }
  }

  public close(): void {
    this.connection?.close();
    this.connection = null;
  }

  public [Symbol.dispose](): void {
    this.close();
  }

  private static prepareHistory(connection: DatabaseSync, migrations: readonly Migration[]): readonly string[] {
    const tables = connection.prepare(Resources.readTablesStatement).all().map(t => t[Resources.nameColumn]);
    if (!tables.includes(Resources.historyTableName)) {
      if (tables.length > 0)
        throw new UnknownSchemaException(Resources.tablesWithoutHistory);
      connection.exec(Resources.createHistoryStatement);
      return [];
    }

    const history = connection.prepare(Resources.readHistoryStatement).all();
    if (history.length > migrations.length)
      throw new UnknownSchemaException(Resources.historyNewer);
    const known = migrations.map(t => t.id);
    if (!history.every((t, index) => t[Resources.positionColumn] === index + 1 && t[Resources.idColumn] === known[index]))
      throw new UnknownSchemaException(Resources.historyNotRecognized);
    return known.slice(0, history.length);
  }

  private static apply(connection: DatabaseSync, migration: Migration, position: number): void {
    connection.exec(Resources.beginMigrationStatement);
    try {
      for (const statement of migration.statements)
        connection.exec(statement);
      connection.prepare(Resources.insertHistoryStatement).run(position, migration.id);
      connection.exec(Resources.commitStatement);
    }
    catch (error) {
      connection.exec(Resources.rollbackStatement);
      throw new MigrationException(migration.id, new ExceptionOptions(error));
    }
  }
}
