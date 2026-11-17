/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DataException, DataSource } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { SQLiteDialect } from "@noldova/context.data.sql.sqlite";
import { ModuleDatabaseConnection, ModuleDatabaseProvider, Resources } from "@noldova/teamrun.runtime";

import { MemoryModuleDatabase } from "../fixtures/memory-module-database.fixture.js";

@TestClass
export class ModuleDatabaseConnectionTests {
  @TestMethod
  public async writesAndReadsTheModulesDatabaseWithForeignKeysOn(): Promise<void> {
    using database = new MemoryModuleDatabase();
    await using connection = new ModuleDatabaseProvider(database).openConnection(new DataSource("teamrun", "/module"));

    await connection.executeAsync(new SqlQuery("CREATE TABLE notes (id INTEGER PRIMARY KEY, text TEXT, size REAL)"));
    const first = await connection.insertAsync(new SqlQuery("INSERT INTO notes (text, size) VALUES (?, ?)", ["one", 1.5]));
    const second = await connection.insertAsync(new SqlQuery("INSERT INTO notes (text, size) VALUES (?, ?)", [null, 2]));
    const changed = await connection.executeAsync(new SqlQuery("UPDATE notes SET size = size + 1"));
    const rows = await connection.queryAsync(new SqlQuery("SELECT id, text, size FROM notes ORDER BY id"));

    Assert.areEqual(Resources.foreignKeysStatement, database.statements[0]);
    Assert.isInstanceOf(connection.dialect, SQLiteDialect);
    Assert.areEqual(1, first);
    Assert.areEqual(2, second);
    Assert.areEqual(2, changed);
    Assert.areEqual("one", rows[0]?.readString("text"));
    Assert.areEqual(2.5, rows[0]?.readValue("size"));
    Assert.isNull(rows[1]?.readNullableString("text"));
  }

  @TestMethod
  public async commitsAndRollsBackThroughTheModulesDatabase(): Promise<void> {
    using database = new MemoryModuleDatabase();
    await using connection = new ModuleDatabaseConnection(new DataSource("teamrun", "/module"), database);
    await connection.executeAsync(new SqlQuery("CREATE TABLE notes (id INTEGER PRIMARY KEY)"));

    await connection.runInTransactionAsync(async t => t.insertAsync(new SqlQuery("INSERT INTO notes (id) VALUES (1)")));
    await Assert.throwsAsync(async () => connection.runInTransactionAsync(async t => {
      await t.insertAsync(new SqlQuery("INSERT INTO notes (id) VALUES (2)"));
      throw new Error("The test rolls back.");
    }), Error);
    const rows = await connection.queryAsync(new SqlQuery("SELECT id FROM notes"));

    Assert.areEqual(1, rows.length);
    Assert.areEqual(1, rows[0]?.readInteger("id"));
  }

  @TestMethod
  public async refusesABinaryValueAndAnyWorkOnceClosed(): Promise<void> {
    using database = new MemoryModuleDatabase();
    const connection = new ModuleDatabaseConnection(new DataSource("teamrun", "/module"), database);

    await Assert.throwsAsync(async () => connection.queryAsync(new SqlQuery("SELECT x'00' AS bytes")), DataException);
    await connection.closeAsync();

    Assert.isFalse(connection.isOpen);
    await Assert.throwsAsync(async () => connection.executeAsync(new SqlQuery("SELECT 1")), DataException);
    await Assert.throwsAsync(async () => connection.insertAsync(new SqlQuery("SELECT 1")), DataException);
    await Assert.throwsAsync(async () => connection.queryAsync(new SqlQuery("SELECT 1")), DataException);
  }
}
