/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Migration } from "../models/migration.js";
import type { MigrationHistory } from "./migration-history.js";

export abstract class Migrator<TMigration extends Migration> {
  private readonly migrations: readonly TMigration[];

  protected readonly history: MigrationHistory;

  protected constructor(migrations: readonly TMigration[], history: MigrationHistory) {
    Migration.validateOrder(migrations);

    this.migrations = [...migrations];
    this.history = history;
  }

  public migrate(): readonly string[] {
    const pending = this.getPendingMigrations();
    for (const migration of pending)
      this.apply(migration);

    return pending.map(t => t.id);
  }

  public getPendingMigrations(): readonly TMigration[] {
    const applied = new Set(this.history.getApplied());
    return this.migrations.filter(t => !applied.has(t.id));
  }

  public getAppliedMigrations(): readonly string[] {
    return this.history.getApplied();
  }

  protected abstract apply(migration: TMigration): void;
}
