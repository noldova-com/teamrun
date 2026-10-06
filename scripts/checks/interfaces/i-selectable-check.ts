/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import type CheckSelection from "../check-selection.ts";
import type ICheck from "./i-check.ts";

export default interface ISelectableCheck extends ICheck {
  runSelectedAsync(filters: readonly string[], output: Writable): Promise<CheckSelection>;
}
