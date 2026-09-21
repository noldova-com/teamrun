/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException } from "@noldova/teamrun-foundation-data";
import { SqlQuery, SqlTransaction } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { RecordingConnection } from "../fixtures/recording-connection.fixture.js";

@TestClass
export class SqlConnectionTests {
  @TestMethod
  public beginsSqlTransactions(): void {
    const connection = new RecordingConnection();

    using transaction = connection.beginTransaction();

    Assert.areEqual("recording", connection.dataSource.name);
    Assert.isInstanceOf(transaction, SqlTransaction);
    Assert.areEqual("BEGIN", connection.statements.join(","));
  }

  @TestMethod
  public runsActionsInsideATransaction(): void {
    const connection = new RecordingConnection();

    const result = connection.transaction(() => {
      connection.execute(new SqlQuery("INSERT INTO notes (id) VALUES ('a')"));
      return 42;
    });
    Assert.throws(() => connection.transaction(() => {
      throw new Error("stop");
    }), Error);

    Assert.areEqual(42, result);
    Assert.areEqual("BEGIN,INSERT INTO notes (id) VALUES ('a'),COMMIT,BEGIN,ROLLBACK", connection.statements.join(","));
  }

  @TestMethod
  public refusesATransactionOnceClosed(): void {
    const connection = new RecordingConnection();
    connection.close();

    Assert.throws(() => connection.beginTransaction(), DataException);
    Assert.areEqual(0, connection.statements.length);
  }
}
