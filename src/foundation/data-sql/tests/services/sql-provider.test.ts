/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataProvider, DataSource, Migrator } from "@noldova/teamrun-foundation-data";
import { SqlChangeFeed, SqlMigrator, SqlProvider } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { NotesMigration } from "../fixtures/notes-migration.fixture.js";
import { RecordingProvider } from "../fixtures/recording-provider.fixture.js";

@TestClass
export class SqlProviderTests {
  @TestMethod
  public opensConnectionsAndCreatesSqlMigratorsAndChangeFeeds(): void {
    const provider = new RecordingProvider();
    const dataSource = new DataSource("notes", ":memory:");

    const connection = provider.openConnection(dataSource);
    const migrator = provider.createMigrator(connection, [new NotesMigration()]);

    Assert.isInstanceOf(provider, SqlProvider);
    Assert.isInstanceOf(provider, DataProvider);
    Assert.areEqual(dataSource, connection.dataSource);
    Assert.isInstanceOf(migrator, SqlMigrator);
    Assert.isInstanceOf(migrator, Migrator);
    Assert.areEqual(1, migrator.getPendingMigrations().length);
    Assert.isInstanceOf(provider.createChangeFeed(connection), SqlChangeFeed);
  }
}
