/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException, Migrator } from "@noldova/teamrun-foundation-data";
import { SqlMigrator } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { NotesMigration } from "../fixtures/notes-migration.fixture.js";
import { RecordingConnection } from "../fixtures/recording-connection.fixture.js";

@TestClass
export class SqlMigratorTests {
  @TestMethod
  public appliesEachPendingMigrationInOneTransaction(): void {
    const connection = new RecordingConnection();
    const migrator = new SqlMigrator(connection, [new NotesMigration()]);

    const applied = migrator.migrate();
    const appliedAgain = migrator.migrate();

    Assert.isInstanceOf(migrator, Migrator);
    Assert.areEqual("20260908130000_Notes", applied.join(","));
    Assert.areEqual(0, appliedAgain.length);
    Assert.areEqual("20260908130000_Notes", migrator.getAppliedMigrations().join(","));
    Assert.areEqual("BEGIN", connection.statements[2]);
    Assert.areEqual("CREATE TABLE notes (id TEXT NOT NULL, text TEXT NOT NULL, PRIMARY KEY (id))", connection.statements[3]);
    Assert.areEqual("CREATE INDEX IX_notes_text ON notes (text)", connection.statements[4]);
    Assert.isTrue(connection.statements[5]?.startsWith("INSERT INTO __migrations") === true);
    Assert.areEqual("COMMIT", connection.statements[6]);
  }

  @TestMethod
  public appliesOnlyTheMigrationsAfterThoseRecorded(): void {
    const connection = new RecordingConnection();
    new SqlMigrator(connection, [new NotesMigration()]).migrate();
    const migrator = new SqlMigrator(connection, [new NotesMigration(), new NotesMigration("20260908140000_Later")]);

    Assert.areEqual("20260908140000_Later", migrator.migrate().join(","));
    Assert.areEqual(2, migrator.getAppliedMigrations().length);
  }

  @TestMethod
  public rollsBackAMigrationThatFails(): void {
    const connection = new RecordingConnection();
    connection.failingStatement = "IX_notes_text";
    const migrator = new SqlMigrator(connection, [new NotesMigration()]);

    Assert.throws(() => migrator.migrate(), Error);
    Assert.areEqual("ROLLBACK", connection.statements[connection.statements.length - 1]);
    Assert.areEqual(0, migrator.getAppliedMigrations().length);
  }

  @TestMethod
  public requiresUniqueAscendingIds(): void {
    Assert.throws(() => new SqlMigrator(new RecordingConnection(), [new NotesMigration(), new NotesMigration()]), DataException);
  }
}
