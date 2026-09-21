/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException } from "@noldova/teamrun-foundation-data";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";

import { MemoryConnection } from "../fixtures/memory-connection.fixture.js";

@TestClass
export class ConnectionTests {
  @TestMethod
  public isOpenOnItsDataSourceUntilClosed(): void {
    const connection = new MemoryConnection();

    Assert.areEqual("memory", connection.dataSource.name);
    Assert.isTrue(connection.isOpen);
    connection.close();
    connection.close();

    Assert.isFalse(connection.isOpen);
    Assert.areEqual(2, connection.closeCount);
    Assert.throws(() => connection.beginTransaction(), DataException);
  }

  @TestMethod
  public commitsATransactionThatReturns(): void {
    const connection = new MemoryConnection();

    const result = connection.transaction(() => 42);

    Assert.areEqual(42, result);
    Assert.areEqual(1, connection.transactions[0]?.commits);
    Assert.isFalse(connection.isInTransaction);
  }

  @TestMethod
  public rollsBackATransactionThatThrowsAndRethrows(): void {
    const connection = new MemoryConnection();

    const failure = Assert.throws(() => connection.transaction(() => {
      throw new Error("stop");
    }), Error);

    Assert.areEqual("stop", failure.message);
    Assert.areEqual(1, connection.transactions[0]?.rollbacks);
    Assert.isFalse(connection.isInTransaction);
  }

  @TestMethod
  public joinsAnInnerTransactionToTheOuterOne(): void {
    const connection = new MemoryConnection();

    const result = connection.transaction(() => {
      Assert.isTrue(connection.isInTransaction);
      return connection.transaction(() => connection.transaction(() => 7)) + 1;
    });

    Assert.areEqual(8, result);
    Assert.areEqual(1, connection.transactions.length);
    Assert.areEqual(1, connection.transactions[0]?.commits);
  }

  @TestMethod
  public rollsBackTheOuterTransactionWhenAnInnerOneFails(): void {
    const connection = new MemoryConnection();

    const propagated = Assert.throws(() => connection.transaction(() => connection.transaction(() => {
      throw new Error("inner");
    })), Error);
    const swallowed = Assert.throws(() => connection.transaction(() => {
      try {
        connection.transaction(() => {
          throw new Error("inner");
        });
      }
      catch {
        return "ignored";
      }
      return "unreachable";
    }), DataException);

    Assert.areEqual("inner", propagated.message);
    Assert.areEqual(1, connection.transactions[0]?.rollbacks);
    Assert.areEqual(0, connection.transactions[0]?.commits);
    Assert.isTrue(swallowed.message.startsWith("An inner transaction failed"));
    Assert.areEqual(1, connection.transactions[1]?.rollbacks);
    Assert.isFalse(connection.isInTransaction);
  }

  @TestMethod
  public disposalCloses(): void {
    const connection = new MemoryConnection();
    connection[Symbol.dispose]();

    Assert.isFalse(connection.isOpen);
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public preservesTheOriginalFailureWhenRollbackAlsoFails(failOnCommit: boolean): void {
    const connection = new MemoryConnection();
    const original = new Error("Original failure");
    const rollback = new Error("Rollback failed");

    const failure = Assert.throws(() => connection.transaction(() => {
      Assert.areEqual(1, connection.transactions.length);
      for (const transaction of connection.transactions) {
        transaction.rollbackFailure = rollback;
        if (failOnCommit)
          transaction.commitFailure = original;
      }
      if (!failOnCommit)
        throw original;
      return 42;
    }), SuppressedError);

    Assert.areEqual(original, failure.suppressed);
    Assert.areEqual(rollback, failure.error);
    Assert.areEqual("The transaction failed and rollback also failed.", failure.message);
    Assert.areEqual(1, connection.transactions[0]?.rollbacks);
    Assert.isFalse(connection.isInTransaction);
  }
}
