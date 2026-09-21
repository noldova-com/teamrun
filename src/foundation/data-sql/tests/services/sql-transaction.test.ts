/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transaction } from "@noldova/teamrun-foundation-data";
import { SqlTransaction } from "@noldova/teamrun-foundation-data-sql";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { RecordingConnection } from "../fixtures/recording-connection.fixture.js";

@TestClass
export class SqlTransactionTests {
  @TestMethod
  public beginsOnCreationAndCommits(): void {
    const connection = new RecordingConnection();
    const transaction = new SqlTransaction(connection);
    transaction.commit();

    Assert.isInstanceOf(transaction, Transaction);
    Assert.areEqual("BEGIN,COMMIT", connection.statements.join(","));
  }

  @TestMethod
  public rollsBack(): void {
    const connection = new RecordingConnection();
    const transaction = new SqlTransaction(connection);
    transaction.rollback();

    Assert.areEqual("BEGIN,ROLLBACK", connection.statements.join(","));
  }
}
