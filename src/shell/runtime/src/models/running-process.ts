/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { OwnedProcess } from "./owned-process.js";
import type { ProcessRecord } from "./process-record.js";

export class RunningProcess {
  public readonly process: OwnedProcess;
  public readonly record: ProcessRecord;
  public readonly exitTime: Promise<number>;

  public constructor(process: OwnedProcess, record: ProcessRecord, exitTime: Promise<number>) {
    this.process = process;
    this.record = record;
    this.exitTime = exitTime;
  }
}
