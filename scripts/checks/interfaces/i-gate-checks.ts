/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type FlakyRecord from "../flaky-record.ts";
import type GateCheck from "../gate-check.ts";
import type ICheck from "./i-check.ts";

export default interface IGateChecks {
  createDocumentChecks(): readonly ICheck[];

  createAsync(flaky: FlakyRecord | null, packages?: readonly string[]): Promise<readonly GateCheck[]>;
}
