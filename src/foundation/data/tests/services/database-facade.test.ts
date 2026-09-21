/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeFeed, DatabaseFacade, DataSource, DbContextOptions } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryProvider } from "../fixtures/memory-provider.fixture.js";
import { NotesMigration } from "../fixtures/notes-migration.fixture.js";

@TestClass
export class DatabaseFacadeTests {
  @TestMethod
  public opensTheConnectionWithItsChangeFeedAndMigrates(): void {
    const provider = new MemoryProvider();
    const facade = new DatabaseFacade(new DbContextOptions(provider, new DataSource("notes", ":memory:")), [new NotesMigration()]);

    Assert.areEqual(provider.connections[0], facade.connection);
    Assert.areEqual("notes", facade.connection.dataSource.name);
    Assert.areEqual(provider.changeFeeds[0], facade.changeFeed);
    Assert.isInstanceOf(facade.changeFeed, ChangeFeed);
    Assert.areEqual(1, facade.getPendingMigrations().length);
    Assert.areEqual("20260908130000_Notes", facade.migrate().join(","));
    Assert.areEqual("20260908130000_Notes", facade.getAppliedMigrations().join(","));
    Assert.areEqual(0, facade.getPendingMigrations().length);
  }

  @TestMethod
  public beginsAndRunsTransactionsOnItsConnection(): void {
    const provider = new MemoryProvider();
    const facade = new DatabaseFacade(new DbContextOptions(provider, new DataSource("notes", ":memory:")), []);

    using transaction = facade.beginTransaction();
    const result = facade.transaction(() => 42);

    Assert.isFalse(transaction.isCompleted);
    Assert.areEqual(42, result);
    Assert.areEqual(2, facade.connection.transactions.length);
    Assert.areEqual(1, facade.connection.transactions[1]?.commits);
  }
}
