/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DatabaseSync, type SQLInputValue, type SQLOutputValue, type StatementResultingChanges } from "node:sqlite";

import "@noldova/teamrun-foundation-core";
import { ArgumentException, ExceptionOptions } from "@noldova/teamrun-foundation-exceptions";

import { MigrationException } from "../../exceptions/migration.exception.js";
import { UnknownSchemaException } from "../../exceptions/unknown-schema.exception.js";
import type { Migration } from "../../models/migration.js";
import { Resources } from "../../resources.js";
import { DatabaseBackup } from "./database-backup.js";

export class MigratedDatabase implements Disposable {
  private readonly connection: DatabaseSync;

  public readonly appliedMigrations: readonly string[];

  protected constructor(connection: DatabaseSync, appliedMigrations: readonly string[]) {
    this.connection = connection;
    this.appliedMigrations = [...appliedMigrations];
  }

  public read(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue> | undefined {
    return this.connection.prepare(statement).get(...values);
  }

  public readAll(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue>[] {
    return this.connection.prepare(statement).all(...values);
  }

  public run(statement: string, ...values: SQLInputValue[]): StatementResultingChanges {
    return this.connection.prepare(statement).run(...values);
  }

  public transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T {
    this.connection.exec(Resources.beginMigrationStatement);
    let result: T;
    try {
      result = action();
    }
    catch (error) {
      this.connection.exec(Resources.rollbackStatement);
      throw error;
    }
    if (Object.isObject(result) && Object.isFunction(Reflect.get(result, Resources.thenProperty))) {
      this.connection.exec(Resources.rollbackStatement);
      throw new ArgumentException(Resources.transactionNotSynchronous, Resources.actionParameterName);
    }
    this.connection.exec(Resources.commitStatement);
    return result;
  }

  public close(): void {
    if (this.connection.isOpen)
      this.connection.close();
  }

  public [Symbol.dispose](): void {
    this.close();
  }

  protected static async migrateAsync(
    file: string,
    name: string,
    migrations: readonly Migration[],
    backupsFolder: string,
    backupOwner: string,
    moment: Date): Promise<[DatabaseSync, readonly string[]]> {
    const connection = new DatabaseSync(file);
    try {
      connection.exec(Resources.writeAheadLogStatement);
      const applied = MigratedDatabase.prepareHistory(connection, name, migrations);
      const pending = migrations.slice(applied.length);
      if (applied.length > 0 && pending.length > 0)
        await DatabaseBackup.createAsync(connection, backupsFolder, Resources.formatBackupName(backupOwner, applied.length + 1, Resources.formatTimestamp(moment)));
      for (const [index, migration] of pending.entries())
        MigratedDatabase.apply(connection, name, migration, applied.length + index + 1);
      return [connection, migrations.map(t => t.id)];
    }
    catch (error) {
      connection.close();
      throw error;
    }
  }

  private static prepareHistory(connection: DatabaseSync, name: string, migrations: readonly Migration[]): readonly string[] {
    const tables = connection.prepare(Resources.readTablesStatement).all().map(t => t[Resources.nameColumn]);
    if (!tables.includes(Resources.historyTableName)) {
      if (tables.length > 0)
        throw new UnknownSchemaException(Resources.formatTablesWithoutHistory(name));
      connection.exec(Resources.createHistoryStatement);
      return [];
    }

    const history = connection.prepare(Resources.readHistoryStatement).all();
    if (history.length > migrations.length)
      throw new UnknownSchemaException(Resources.formatHistoryNewer(name));
    const known = migrations.map(t => t.id);
    if (!history.every((t, index) => t[Resources.positionColumn] === index + 1 && t[Resources.idColumn] === known[index]))
      throw new UnknownSchemaException(Resources.formatHistoryNotRecognized(name));
    return known.slice(0, history.length);
  }

  private static apply(connection: DatabaseSync, name: string, migration: Migration, position: number): void {
    connection.exec(Resources.beginMigrationStatement);
    try {
      for (const statement of migration.statements)
        connection.exec(statement);
      connection.prepare(Resources.insertHistoryStatement).run(position, migration.id);
      connection.exec(Resources.commitStatement);
    }
    catch (error) {
      connection.exec(Resources.rollbackStatement);
      throw new MigrationException(name, migration.id, new ExceptionOptions(error));
    }
  }
}
