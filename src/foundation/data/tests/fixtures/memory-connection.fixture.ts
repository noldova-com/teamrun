/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Connection, DataSource } from "@noldova/teamrun-foundation-data";

import { MemoryTransaction } from "./memory-transaction.fixture.js";

export class MemoryConnection extends Connection {
  private open: boolean = true;

  public readonly transactions: MemoryTransaction[] = [];
  public closeCount: number = 0;

  public constructor(dataSource: DataSource = new DataSource("memory", ":memory:")) {
    super(dataSource);
  }

  public override get isOpen(): boolean {
    return this.open;
  }

  public override beginTransaction(): MemoryTransaction {
    this.throwIfClosed();
    const transaction = new MemoryTransaction();
    this.transactions.push(transaction);
    return transaction;
  }

  public override close(): void {
    this.open = false;
    this.closeCount += 1;
  }
}
