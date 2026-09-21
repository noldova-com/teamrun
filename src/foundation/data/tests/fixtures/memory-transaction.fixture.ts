/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Transaction } from "@noldova/teamrun-foundation-data";

export class MemoryTransaction extends Transaction {
  public commits: number = 0;
  public rollbacks: number = 0;
  public commitFailure?: Error;
  public rollbackFailure?: Error;

  protected override commitCore(): void {
    this.commits += 1;
    if (!Object.isUndefined(this.commitFailure))
      throw this.commitFailure;
  }

  protected override rollbackCore(): void {
    this.rollbacks += 1;
    if (!Object.isUndefined(this.rollbackFailure))
      throw this.rollbackFailure;
  }
}
