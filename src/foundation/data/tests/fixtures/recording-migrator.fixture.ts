/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type MigrationHistory, Migrator } from "@noldova/teamrun-foundation-data";

import type { MemoryConnection } from "./memory-connection.fixture.js";
import type { NotesMigration } from "./notes-migration.fixture.js";

export class RecordingMigrator extends Migrator<NotesMigration> {
  public readonly applied: string[] = [];
  public readonly connection: MemoryConnection | null;
  public failingId?: string;

  public constructor(migrations: readonly NotesMigration[], history: MigrationHistory, connection: MemoryConnection | null = null) {
    super(migrations, history);

    this.connection = connection;
  }

  protected override apply(migration: NotesMigration): void {
    if (migration.id === this.failingId)
      throw new Error(migration.id);

    this.applied.push(migration.id);
    this.history.record(migration.id);
  }
}
