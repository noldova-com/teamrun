/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Transaction } from "@noldova/teamrun-foundation-data";

export class MemoryTransaction extends Transaction {
  public commits: number = 0;
  public rollbacks: number = 0;

  protected override commitCore(): void {
    this.commits += 1;
  }

  protected override rollbackCore(): void {
    this.rollbacks += 1;
  }
}
