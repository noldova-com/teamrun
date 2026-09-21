/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Migration } from "@noldova/teamrun-foundation-data";
import { MigrationBuilder, SqlMigration } from "@noldova/teamrun-foundation-data-sql";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { NotesMigration } from "../fixtures/notes-migration.fixture.js";

@TestClass
export class SqlMigrationTests {
  @TestMethod
  public isAMigrationThatDeclaresItsSchema(): void {
    const migration = new NotesMigration();
    const builder = new MigrationBuilder();
    migration.up(builder);

    Assert.isInstanceOf(migration, SqlMigration);
    Assert.isInstanceOf(migration, Migration);
    Assert.areEqual("20260908130000_Notes", migration.id);
    Assert.areEqual(2, builder.toOperations().length);
  }

  @TestMethod
  public rejectsMalformedIds(): void {
    Assert.throws(() => new NotesMigration("notes"), ArgumentException);
  }
}
