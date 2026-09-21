/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { ChangeOperation, DbContext } from "@noldova/teamrun-foundation-data";
import { SqlChangeFeed } from "@noldova/teamrun-foundation-data-sql";
import { SQLiteConnection } from "@noldova/teamrun-foundation-data-sql-sqlite";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ChangeEntity, DatabaseContext, Resources } from "@noldova/teamrun-core";

import { TemporaryDataDirectory } from "../fixtures/temporary-data-directory.fixture.js";

@TestClass
export class DatabaseContextTests {
  @TestMethod
  public opensTheDatabaseFileWithTheSchemaCurrent(): void {
    using directory = new TemporaryDataDirectory();
    const nested = join(directory.path, "nested");
    using context = DatabaseContext.open(nested);

    Assert.isInstanceOf(context, DbContext);
    Assert.isTrue(existsSync(join(nested, "teamrun.db")));
    Assert.isInstanceOf(context.database.connection, SQLiteConnection);
    Assert.areEqual("teamrun", context.database.connection.dataSource.name);
    Assert.isTrue(context.database.connection.isOpen);
    Assert.areEqual(Resources.initialMigrationId, context.database.getAppliedMigrations()[0]);
    Assert.areEqual(0, context.database.getPendingMigrations().length);
    Assert.isInstanceOf(context.database.changeFeed, SqlChangeFeed);
    Assert.areEqual(1, context.database.changeFeed.append(ChangeEntity.Project, "prj-1", ChangeOperation.Insert, "{}").sequence);
  }

  @TestMethod
  public rejectsABlankDataDirectory(): void {
    Assert.throws(() => DatabaseContext.open(" "), ArgumentException);
  }

  @TestMethod
  public reopensAnExistingDataDirectoryWithoutReapplyingMigrations(): void {
    using directory = new TemporaryDataDirectory();
    {
      using context = DatabaseContext.open(directory.path);
      context.database.changeFeed.append(ChangeEntity.Project, "prj-1", ChangeOperation.Insert, "{}");
    }
    using reopened = DatabaseContext.open(directory.path);

    Assert.areEqual(1, reopened.database.changeFeed.readAfter(0).length);
    Assert.areEqual(2, reopened.database.getAppliedMigrations().length);
  }

  @TestMethod
  public disposalClosesTheConnection(): void {
    using directory = new TemporaryDataDirectory();
    const context = DatabaseContext.open(directory.path);
    context[Symbol.dispose]();

    Assert.isFalse(context.database.connection.isOpen);
  }
}
