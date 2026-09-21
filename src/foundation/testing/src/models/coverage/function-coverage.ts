/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CoverageRange } from "./coverage-range.js";

export class FunctionCoverage {
  public readonly ranges: readonly CoverageRange[];

  public constructor(ranges: readonly CoverageRange[]) {
    this.ranges = [...ranges];
  }
}
