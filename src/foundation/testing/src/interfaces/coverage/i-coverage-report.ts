/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IScriptCoverage } from "./i-script-coverage.js";

export interface ICoverageReport {
  readonly result: readonly IScriptCoverage[];
}
