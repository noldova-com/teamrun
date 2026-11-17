/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataException } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { ModuleDatabaseSession, Resources } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";

@TestClass
export class ModuleDatabaseSessionTests {
  @TestMethod
  public async executesInsertsAndQueriesTheModulesDatabase(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const session = new ModuleDatabaseSession(database);

    await session.executeAsync(new SqlQuery("CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT, size REAL)"));
    const first = await session.insertAsync(new SqlQuery("INSERT INTO notes (text, size) VALUES (?, ?)", ["one", 1.5]));
    const second = await session.insertAsync(new SqlQuery("INSERT INTO notes (text, size) VALUES (?, ?)", [null, 2]));
    const changed = await session.executeAsync(new SqlQuery("UPDATE notes SET size = size + 1"));
    const rows = await session.queryAsync(new SqlQuery("SELECT id, text, size FROM notes ORDER BY id"));

    Assert.isTrue(session.isOpen);
    Assert.areEqual(1, first);
    Assert.areEqual(2, second);
    Assert.areEqual(2, changed);
    Assert.areEqual(2, rows.length);
    Assert.areEqual(1, rows[0]?.readInteger("id"));
    Assert.areEqual("one", rows[0]?.readString("text"));
    Assert.areEqual(2.5, rows[0]?.readValue("size"));
    Assert.isNull(rows[1]?.readNullableString("text"));
    Assert.areEqual(3, rows[1]?.readValue("size"));
  }

  @TestMethod
  public async closeAsyncLeavesTheSessionClosed(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const session = new ModuleDatabaseSession(database);

    await session.closeAsync();

    Assert.isFalse(session.isOpen);
  }

  @TestMethod
  public async refusesABinaryValue(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const session = new ModuleDatabaseSession(database);

    const exception = await Assert.throwsAsync(async () => session.queryAsync(new SqlQuery("SELECT x'00' AS bytes")), DataException);

    Assert.areEqual(Resources.unsupportedValue, exception.message);
  }
}
