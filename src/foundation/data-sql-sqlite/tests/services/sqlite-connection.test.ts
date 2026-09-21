/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";

import { DataException, DataSource } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { SQLiteConnection, SQLiteDialect } from "@noldova/teamrun-foundation-data-sql-sqlite";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class SQLiteConnectionTests {
  private static readonly createNotes: SqlQuery = new SqlQuery("CREATE TABLE notes (id TEXT PRIMARY KEY, text TEXT NOT NULL, count INTEGER)");
  private static readonly selectNotes: SqlQuery = new SqlQuery("SELECT id, text, count FROM notes ORDER BY id");

  @TestMethod
  public opensTheFileCreatingItsDirectoryWhenAbsent(): void {
    using directory = new TemporaryDirectory();
    const dataSource = new DataSource("app", join(directory.path, "nested", "app.db"));
    using connection = SQLiteConnection.open(dataSource);

    Assert.areEqual(dataSource, connection.dataSource);
    Assert.isTrue(existsSync(dataSource.location));
    Assert.isTrue(connection.isOpen);
    Assert.isInstanceOf(connection.dialect, SQLiteDialect);
  }

  @TestMethod
  public executesInsertsAndQueriesRecords(): void {
    using directory = new TemporaryDirectory();
    using connection = SQLiteConnection.open(directory.dataSource("app"));
    connection.execute(SQLiteConnectionTests.createNotes);

    Assert.areEqual(1, connection.execute(new SqlQuery("INSERT INTO notes (id, text, count) VALUES (?, ?, ?)", ["a", "first", 1])));
    Assert.areEqual(2, connection.insert(new SqlQuery("INSERT INTO notes (id, text, count) VALUES (?, ?, ?)", ["b", "second", null])));
    const records = connection.query(SQLiteConnectionTests.selectNotes);
    Assert.areEqual(2, records.length);
    Assert.areEqual("first", records[0]?.readString("text"));
    Assert.areEqual(1, records[0]?.readInteger("count"));
    Assert.isNull(records[1]?.readNullableInteger("count"));
    Assert.areEqual(1, connection.query(new SqlQuery("SELECT id FROM notes WHERE text = ?", ["second"])).length);
  }

  @TestMethod
  public rollsBackATransactionThatThrows(): void {
    using directory = new TemporaryDirectory();
    using connection = SQLiteConnection.open(directory.dataSource("app"));
    connection.execute(SQLiteConnectionTests.createNotes);

    Assert.throws(() => connection.transaction(() => {
      connection.execute(new SqlQuery("INSERT INTO notes (id, text) VALUES ('a', 'first')"));
      throw new Error("stop");
    }), Error);

    Assert.areEqual(0, connection.query(SQLiteConnectionTests.selectNotes).length);
  }

  @TestMethod
  public enforcesForeignKeys(): void {
    using directory = new TemporaryDirectory();
    using connection = SQLiteConnection.open(directory.dataSource("app"));
    connection.execute(new SqlQuery("CREATE TABLE owners (id TEXT PRIMARY KEY)"));
    connection.execute(new SqlQuery("CREATE TABLE pets (id TEXT PRIMARY KEY, ownerId TEXT NOT NULL REFERENCES owners(id))"));

    Assert.throws(() => connection.execute(new SqlQuery("INSERT INTO pets (id, ownerId) VALUES ('p', 'missing')")), Error);
  }

  @TestMethod
  public rejectsRowsHoldingUnsupportedValues(): void {
    using directory = new TemporaryDirectory();
    using connection = SQLiteConnection.open(directory.dataSource("app"));

    Assert.throws(() => connection.query(new SqlQuery("SELECT x'00' AS blob")), DataException);
  }

  @TestMethod
  public refusesWorkOnceClosedAndClosesOnlyOnce(): void {
    using directory = new TemporaryDirectory();
    const connection = SQLiteConnection.open(directory.dataSource("app"));
    connection.close();
    connection.close();

    Assert.isFalse(connection.isOpen);
    Assert.throws(() => connection.execute(SQLiteConnectionTests.createNotes), DataException);
    Assert.throws(() => connection.insert(SQLiteConnectionTests.createNotes), DataException);
    Assert.throws(() => connection.query(SQLiteConnectionTests.selectNotes), DataException);
  }

  @TestMethod
  public commitsNestedTransactionsAsOne(): void {
    using directory = new TemporaryDirectory();
    using connection = SQLiteConnection.open(directory.dataSource("app"));
    connection.execute(SQLiteConnectionTests.createNotes);

    connection.transaction(() => {
      connection.execute(new SqlQuery("INSERT INTO notes (id, text) VALUES ('a', 'first')"));
      connection.transaction(() => connection.execute(new SqlQuery("INSERT INTO notes (id, text) VALUES ('b', 'second')")));
    });

    Assert.areEqual(2, connection.query(SQLiteConnectionTests.selectNotes).length);
  }

  @TestMethod
  public rollsBackAFailedCommitAndAllowsTheNextTransaction(): void {
    using directory = new TemporaryDirectory();
    using connection = SQLiteConnection.open(directory.dataSource("commit-failure"));
    connection.execute(new SqlQuery("CREATE TABLE owners (id INTEGER PRIMARY KEY)"));
    connection.execute(new SqlQuery("CREATE TABLE pets (ownerId INTEGER REFERENCES owners(id) DEFERRABLE INITIALLY DEFERRED)"));

    const failure = Assert.throws(() => connection.transaction(() => {
      connection.execute(new SqlQuery("INSERT INTO pets (ownerId) VALUES (?)", [1]));
    }), Error);

    Assert.areEqual("FOREIGN KEY constraint failed", failure.message);
    Assert.isFalse(connection.isInTransaction);
    Assert.areEqual(0, connection.query(new SqlQuery("SELECT ownerId FROM pets")).length);

    connection.transaction(() => {
      connection.execute(new SqlQuery("INSERT INTO owners (id) VALUES (?)", [1]));
      connection.execute(new SqlQuery("INSERT INTO pets (ownerId) VALUES (?)", [1]));
    });

    Assert.areEqual(1, connection.query(new SqlQuery("SELECT ownerId FROM pets")).length);
  }
}
