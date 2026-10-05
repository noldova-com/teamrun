/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DataDirectory, ModuleDatabase } from "@noldova/teamrun-shell-runtime";

import { ModuleDatabaseFixture } from "../../fixtures/module-database.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class MigratedDatabaseTests {
  @TestMethod
  public async commitsATransactionAndRollsItBackWhenItsActionThrows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using database = await ModuleDatabase.openAsync(new DataDirectory(folder.path), "notes", [ModuleDatabaseFixture.NOTES]);

    const count = database.transaction(() => {
      database.run("INSERT INTO notes (title) VALUES (?)", "First");
      database.run("INSERT INTO notes (title) VALUES (?)", "Second");
      return database.readAll("SELECT id FROM notes").length;
    });
    const failure = Assert.throws(() => database.transaction(() => {
      database.run("INSERT INTO notes (title) VALUES (?)", "Third");
      throw new RangeError("stop");
    }), RangeError);

    Assert.areEqual(2, count);
    Assert.areEqual("stop", failure.message);
    Assert.areEqual("First,Second", database.readAll("SELECT title FROM notes ORDER BY id").map(t => t["title"]).join(","));
  }

  @TestMethod
  public async refusesATransactionWhoseActionReturnsAThenableAndCommitsNothing(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    using database = await ModuleDatabase.openAsync(new DataDirectory(folder.path), "notes", [ModuleDatabaseFixture.NOTES]);
    const sneaky = (): unknown => {
      database.run("INSERT INTO notes (title) VALUES (?)", "Too early");
      return { then: (): void => undefined };
    };

    const failure = Assert.throws(() => database.transaction(sneaky), ArgumentException);

    Assert.isTrue(failure.message.startsWith("A transaction's action must finish before it returns"));
    Assert.areEqual(0, database.readAll("SELECT title FROM notes").length);
    database.transaction(() => database.run("INSERT INTO notes (title) VALUES (?)", "After"));
    Assert.areEqual(1, database.readAll("SELECT title FROM notes").length);
  }
}
