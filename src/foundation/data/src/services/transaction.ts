/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DataException } from "../exceptions/data.exception.js";
import { Resources } from "../resources.js";

export abstract class Transaction implements Disposable {
  private completed: boolean = false;

  public get isCompleted(): boolean {
    return this.completed;
  }

  public commit(): void {
    this.throwIfCompleted();
    this.commitCore();
    this.completed = true;
  }

  public rollback(): void {
    this.throwIfCompleted();
    this.rollbackCore();
    this.completed = true;
  }

  public [Symbol.dispose](): void {
    if (!this.completed)
      this.rollback();
  }

  protected abstract commitCore(): void;

  protected abstract rollbackCore(): void;

  private throwIfCompleted(): void {
    if (this.completed)
      throw new DataException(Resources.transactionCompleted);
  }
}
