/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";

import { ChangeOperation, DbContextOptions, DbContextOptionsBuilder } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { SQLiteProvider } from "@noldova/teamrun-foundation-data-sql-sqlite";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { NotesContext } from "../fixtures/notes-context.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class DbContextOptionsBuilderExtensionsTests {
  @TestMethod
  public buildsOptionsForASQLiteFile(): void {
    using directory = new TemporaryDirectory();
    const location = directory.location("app");

    const options = new DbContextOptionsBuilder().useSQLite(location);

    Assert.isInstanceOf(options, DbContextOptions);
    Assert.isInstanceOf(options.provider, SQLiteProvider);
    Assert.areEqual("app", options.dataSource.name);
    Assert.areEqual(location, options.dataSource.location);
  }

  @TestMethod
  public namesTheDataSourceAfterTheFile(): void {
    Assert.areEqual("teamrun", new DbContextOptionsBuilder().useSQLite("/data/teamrun.db").dataSource.name);
    Assert.areEqual(":memory:", new DbContextOptionsBuilder().useSQLite(":memory:").dataSource.name);
  }

  @TestMethod
  public rejectsABlankLocation(): void {
    Assert.areEqual("location", Assert.throws(() => new DbContextOptionsBuilder().useSQLite(" "), ArgumentException).parameterName);
  }

  @TestMethod
  public opensAContextThatMigratesTheFile(): void {
    using directory = new TemporaryDirectory();
    const location = directory.location("notes");
    using context = new NotesContext(new DbContextOptionsBuilder().useSQLite(location));

    Assert.areEqual("20260908130000_Notes", context.database.migrate().join(","));
    Assert.isTrue(existsSync(location));
    const names = context.database.connection.query(new SqlQuery("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'IX_notes_text'"));
    Assert.areEqual(1, names.length);
    Assert.areEqual(0, context.database.getPendingMigrations().length);
    Assert.areEqual(1, context.database.changeFeed.append("note", "a", ChangeOperation.Insert, "{}").sequence);
    Assert.areEqual(1, context.database.changeFeed.readAfter(0).length);
  }
}
