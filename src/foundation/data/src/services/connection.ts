/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException } from "../exceptions/data.exception.js";
import type { DataSource } from "../models/data-source.js";
import { Resources } from "../resources.js";
import type { Transaction } from "./transaction.js";

export abstract class Connection implements Disposable {
  private transactionDepth: number = 0;
  private rollbackRequested: boolean = false;

  public readonly dataSource: DataSource;

  protected constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  public abstract get isOpen(): boolean;

  public get isInTransaction(): boolean {
    return this.transactionDepth > 0;
  }

  public abstract beginTransaction(): Transaction;

  public abstract close(): void;

  public transaction<T>(action: () => T): T {
    if (this.transactionDepth > 0)
      return this.runNested(action);

    const transaction = this.beginTransaction();
    this.transactionDepth = 1;
    try {
      const result = action();
      if (this.rollbackRequested)
        throw new DataException(Resources.nestedTransactionFailed);
      transaction.commit();
      return result;
    }
    finally {
      this.transactionDepth = 0;
      this.rollbackRequested = false;
      transaction[Symbol.dispose]();
    }
  }

  public [Symbol.dispose](): void {
    this.close();
  }

  protected throwIfClosed(): void {
    if (!this.isOpen)
      throw new DataException(Resources.connectionClosed);
  }

  private runNested<T>(action: () => T): T {
    this.transactionDepth += 1;
    let succeeded = false;
    try {
      const result = action();
      succeeded = true;
      return result;
    }
    finally {
      this.transactionDepth -= 1;
      if (!succeeded)
        this.rollbackRequested = true;
    }
  }
}
