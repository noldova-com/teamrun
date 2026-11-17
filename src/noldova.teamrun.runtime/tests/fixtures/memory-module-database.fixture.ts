/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DatabaseSync, type SQLInputValue, type SQLOutputValue, type StatementResultingChanges } from "node:sqlite";

import type { IModuleDatabase, Migration } from "@noldova/desktop.runtime";

export class MemoryModuleDatabase implements IModuleDatabase, Disposable {
  private readonly connection: DatabaseSync = new DatabaseSync(":memory:");

  public readonly statements: string[] = [];

  public constructor(migrations: readonly Migration[] = []) {
    for (const migration of migrations)
      for (const statement of migration.statements)
        this.connection.exec(statement);
  }

  public read(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue> | undefined {
    return this.connection.prepare(statement).get(...values);
  }

  public readAll(statement: string, ...values: SQLInputValue[]): Record<string, SQLOutputValue>[] {
    return this.connection.prepare(statement).all(...values);
  }

  public run(statement: string, ...values: SQLInputValue[]): StatementResultingChanges {
    this.statements.push(statement);
    return this.connection.prepare(statement).run(...values);
  }

  public transaction<T>(action: () => T): T {
    this.connection.exec("BEGIN");
    try {
      const result = action();
      this.connection.exec("COMMIT");
      return result;
    }
    catch (error) {
      this.connection.exec("ROLLBACK");
      throw error;
    }
  }

  public [Symbol.dispose](): void {
    this.connection.close();
  }
}
