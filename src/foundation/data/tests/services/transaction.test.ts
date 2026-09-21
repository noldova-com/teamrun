/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryTransaction } from "../fixtures/memory-transaction.fixture.js";

@TestClass
export class TransactionTests {
  @TestMethod
  public commitsOnce(): void {
    const transaction = new MemoryTransaction();

    Assert.isFalse(transaction.isCompleted);
    transaction.commit();

    Assert.isTrue(transaction.isCompleted);
    Assert.areEqual(1, transaction.commits);
    Assert.throws(() => transaction.commit(), DataException);
    Assert.throws(() => transaction.rollback(), DataException);
  }

  @TestMethod
  public rollsBackOnce(): void {
    const transaction = new MemoryTransaction();
    transaction.rollback();

    Assert.isTrue(transaction.isCompleted);
    Assert.areEqual(1, transaction.rollbacks);
    Assert.throws(() => transaction.rollback(), DataException);
  }

  @TestMethod
  public disposalRollsBackAnIncompleteTransactionOnly(): void {
    const incomplete = new MemoryTransaction();
    const committed = new MemoryTransaction();
    committed.commit();

    incomplete[Symbol.dispose]();
    committed[Symbol.dispose]();

    Assert.areEqual(1, incomplete.rollbacks);
    Assert.areEqual(0, committed.rollbacks);
  }
}
