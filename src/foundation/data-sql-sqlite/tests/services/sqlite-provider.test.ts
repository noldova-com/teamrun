/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeOperation } from "@noldova/teamrun-foundation-data";
import { SqlMigrator, SqlProvider, SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { SQLiteConnection, SQLiteProvider } from "@noldova/teamrun-foundation-data-sql-sqlite";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class SQLiteProviderTests {
  @TestMethod
  public opensSQLiteConnectionsAndCreatesSqlMigrators(): void {
    using directory = new TemporaryDirectory();
    const provider = new SQLiteProvider();
    const dataSource = directory.dataSource("app");

    using connection = provider.openConnection(dataSource);

    Assert.isInstanceOf(provider, SqlProvider);
    Assert.isInstanceOf(connection, SQLiteConnection);
    Assert.areEqual(dataSource, connection.dataSource);
    Assert.isTrue(connection.isOpen);
    Assert.isInstanceOf(provider.createMigrator(connection, []), SqlMigrator);
  }

  @TestMethod
  @TestData(false, false)
  @TestData(false, true)
  @TestData(true, false)
  @TestData(true, true)
  public recoversChangeFeedPreparationAfterRollback(manualTransaction: boolean, readFirst: boolean): void {
    using directory = new TemporaryDirectory();
    const provider = new SQLiteProvider();
    using connection = provider.openConnection(directory.dataSource("change-feed"));
    const feed = provider.createChangeFeed(connection);

    if (manualTransaction) {
      using transaction = connection.beginTransaction();
      feed.append("note", "discarded", ChangeOperation.Insert, "{}");
      transaction.rollback();
    }
    else {
      const rollback = new Error("Rollback fixture");
      Assert.areEqual(rollback, Assert.throws(() => connection.transaction(() => {
        feed.append("note", "discarded", ChangeOperation.Insert, "{}");
        throw rollback;
      }), Error));
    }

    if (readFirst)
      Assert.areEqual(0, feed.readAfter(0).length);
    const change = feed.append("note", "kept", ChangeOperation.Insert, "{}");
    const changes = feed.readAfter(0);

    Assert.areEqual(1, change.sequence);
    Assert.areEqual(1, changes.length);
    Assert.areEqual("kept", changes[0]?.entityId);
    Assert.areEqual(1, connection.query(new SqlQuery("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'IX___changes_entity_entityId'")).length);
  }
}
