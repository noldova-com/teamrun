/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessTable } from "./process-table.js";

export class ProcessKilling {
  public readonly killed: readonly number[];
  public readonly replaced: readonly number[];
  public readonly running: readonly number[];
  public readonly table: ProcessTable;

  public constructor(killed: readonly number[], replaced: readonly number[], running: readonly number[], table: ProcessTable) {
    this.killed = [...killed];
    this.replaced = [...replaced];
    this.running = [...running];
    this.table = table;
  }
}
