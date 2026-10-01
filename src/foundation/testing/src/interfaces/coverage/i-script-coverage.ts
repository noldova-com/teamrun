/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IFunctionCoverage } from "./i-function-coverage.js";

export interface IScriptCoverage {
  readonly url: string;
  readonly functions: readonly IFunctionCoverage[];
}
