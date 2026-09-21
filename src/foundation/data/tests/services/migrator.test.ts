/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryMigrationHistory } from "../fixtures/memory-migration-history.fixture.js";
import { NotesMigration } from "../fixtures/notes-migration.fixture.js";
import { RecordingMigrator } from "../fixtures/recording-migrator.fixture.js";

@TestClass
export class MigratorTests {
  @TestMethod
  public appliesPendingMigrationsOnceInOrder(): void {
    const history = new MemoryMigrationHistory();
    const migrator = new RecordingMigrator([new NotesMigration("20260908130000_A"), new NotesMigration("20260908130001_B")], history);

    const applied = migrator.migrate();
    const appliedAgain = migrator.migrate();

    Assert.areEqual("20260908130000_A,20260908130001_B", applied.join(","));
    Assert.areEqual(0, appliedAgain.length);
    Assert.areEqual("20260908130000_A,20260908130001_B", migrator.getAppliedMigrations().join(","));
    Assert.areEqual(0, migrator.getPendingMigrations().length);
  }

  @TestMethod
  public appliesOnlyWhatTheHistoryDoesNotRecord(): void {
    const history = new MemoryMigrationHistory();
    history.record("20260908130000_A");
    const migrator = new RecordingMigrator([new NotesMigration("20260908130000_A"), new NotesMigration("20260908130001_B")], history);

    Assert.areEqual("20260908130001_B", migrator.getPendingMigrations().map(t => t.id).join(","));
    Assert.areEqual("20260908130001_B", migrator.migrate().join(","));
    Assert.areEqual("20260908130001_B", migrator.applied.join(","));
  }

  @TestMethod
  public stopsAtTheFirstMigrationThatFails(): void {
    const history = new MemoryMigrationHistory();
    const migrator = new RecordingMigrator([new NotesMigration("20260908130000_A"), new NotesMigration("20260908130001_B")], history);
    migrator.failingId = "20260908130000_A";

    Assert.throws(() => migrator.migrate(), Error);
    Assert.areEqual(0, migrator.getAppliedMigrations().length);
    Assert.areEqual(2, migrator.getPendingMigrations().length);
  }

  @TestMethod
  public requiresUniqueAscendingIds(): void {
    Assert.throws(() => new RecordingMigrator([new NotesMigration(), new NotesMigration()], new MemoryMigrationHistory()), DataException);
    Assert.doesNotThrow(() => new RecordingMigrator([], new MemoryMigrationHistory()));
  }
}
