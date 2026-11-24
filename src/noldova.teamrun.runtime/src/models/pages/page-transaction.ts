/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";

import type { PageWrite } from "./page-write.js";

export class PageTransaction {
  public readonly transaction: SqlTransaction;
  public readonly copies: PageWrite[];

  public constructor(transaction: SqlTransaction, copies: PageWrite[]) {
    this.transaction = transaction;
    this.copies = copies;
  }
}
