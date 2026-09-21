/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeFeed, ChangeOperation, DataProvider, DataSource, Migrator } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryProvider } from "../fixtures/memory-provider.fixture.js";
import { NotesMigration } from "../fixtures/notes-migration.fixture.js";

@TestClass
export class DataProviderTests {
  @TestMethod
  public opensConnectionsAndCreatesMigratorsAndChangeFeedsForItsStoreKind(): void {
    const provider = new MemoryProvider();
    const dataSource = new DataSource("notes", ":memory:");

    const connection = provider.openConnection(dataSource);
    const migrator = provider.createMigrator(connection, [new NotesMigration()]);
    const changeFeed = provider.createChangeFeed(connection);

    Assert.isInstanceOf(provider, DataProvider);
    Assert.areEqual(dataSource, connection.dataSource);
    Assert.isInstanceOf(migrator, Migrator);
    Assert.areEqual(1, migrator.getPendingMigrations().length);
    Assert.isInstanceOf(changeFeed, ChangeFeed);
    Assert.areEqual(1, changeFeed.append("note", "a", ChangeOperation.Insert, "{}").sequence);
  }
}
