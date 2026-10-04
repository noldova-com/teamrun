/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ProcessRecord } from "./process-record.js";
import type { ProcessTableEntry } from "./process-table-entry.js";

export class KeptProgram {
  public readonly record: ProcessRecord;
  public readonly members: readonly ProcessTableEntry[];

  public constructor(record: ProcessRecord, members: readonly ProcessTableEntry[]) {
    this.record = record;
    this.members = [...members];
  }
}
