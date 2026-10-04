/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { KeptProgram } from "../models/kept-program.js";
import type { ProcessEnding } from "../models/process-ending.js";
import type { ProcessExit } from "../models/process-exit.js";
import type { ProcessRecord } from "../models/process-record.js";
import type { RunningProcess } from "../models/running-process.js";

export interface IProcessEnder {
  stopAsync(running: readonly RunningProcess[], kept: readonly KeptProgram[]): Promise<readonly ProcessEnding[]>;

  endAfterExitAsync(record: ProcessRecord, exit: ProcessExit): Promise<readonly ProcessEnding[] | KeptProgram>;

  endLeftoversAsync(records: readonly ProcessRecord[]): Promise<readonly ProcessEnding[]>;
}
