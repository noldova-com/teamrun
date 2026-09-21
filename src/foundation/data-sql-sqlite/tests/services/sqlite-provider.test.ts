/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { SqlMigrator, SqlProvider } from "@noldova/teamrun-foundation-data-sql";
import { SQLiteConnection, SQLiteProvider } from "@noldova/teamrun-foundation-data-sql-sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

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
}
