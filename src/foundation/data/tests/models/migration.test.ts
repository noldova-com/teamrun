/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException, Migration } from "@noldova/teamrun-foundation-data";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { NotesMigration } from "../fixtures/notes-migration.fixture.js";

@TestClass
export class MigrationTests {
  @TestMethod
  public holdsAWellFormedId(): void {
    const migration = new NotesMigration();

    Assert.isInstanceOf(migration, Migration);
    Assert.areEqual("20260908130000_Notes", migration.id);
  }

  @TestMethod
  public rejectsMalformedIds(): void {
    Assert.areEqual("id", Assert.throws(() => new NotesMigration("notes"), ArgumentException).parameterName);
    Assert.throws(() => new NotesMigration("20260908130000_notes"), ArgumentException);
    Assert.throws(() => new NotesMigration("2026090813000_Notes"), ArgumentException);
  }

  @TestMethod
  public validatesUniqueAscendingOrder(): void {
    Assert.doesNotThrow(() => Migration.validateOrder([]));
    Assert.doesNotThrow(() => Migration.validateOrder([new NotesMigration("20260908130000_A"), new NotesMigration("20260908130001_B")]));
    Assert.throws(() => Migration.validateOrder([new NotesMigration(), new NotesMigration()]), DataException);
    Assert.throws(() => Migration.validateOrder([new NotesMigration("20260908130001_B"), new NotesMigration("20260908130000_A")]), DataException);
  }
}
