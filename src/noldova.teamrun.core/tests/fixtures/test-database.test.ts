/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { join } from "node:path";

import { SqlQuery } from "@noldova/context.data.sql";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { MigrationCatalog } from "@noldova/teamrun.core";

import { TemporaryDataDirectory } from "./temporary-data-directory.fixture.js";
import { TestDatabase } from "./test-database.fixture.js";

@TestClass
export class TestDatabaseTests {
  private static readonly SYNCHRONOUS_NORMAL: number = 1;

  @TestMethod
  public async opensTheDataDirectorysDatabaseMigratedWithoutWaitingOnTheDiskAtEachCommit(): Promise<void> {
    using directory = new TemporaryDataDirectory();
    await using context = await TestDatabase.openAsync(directory.path);

    const rows = await context.database.connection.queryAsync(new SqlQuery("PRAGMA synchronous"));

    Assert.areEqual(TestDatabaseTests.SYNCHRONOUS_NORMAL, rows[0]?.readInteger("synchronous"));
    Assert.areEqual(join(directory.path, TestDatabase.FILE_NAME), context.database.connection.dataSource.location);
    Assert.areEqual(MigrationCatalog.all.map(t => t.id).join(","), (await context.database.getAppliedMigrationsAsync()).join(","));
  }
}
