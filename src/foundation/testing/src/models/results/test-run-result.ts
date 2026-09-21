/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TestClassResult } from "./test-class-result.js";
import { TestOutcome } from "../../enums/test-outcome.js";

export class TestRunResult {
  public readonly classResults: readonly TestClassResult[];
  public readonly durationMilliseconds: number;
  public readonly passed: number;
  public readonly failed: number;
  public readonly skipped: number;
  public readonly executed: number;
  public readonly total: number;

  public constructor(classResults: readonly TestClassResult[]) {
    let durationMilliseconds = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    for (const classResult of classResults)
      for (const methodResult of classResult.methodResults) {
        durationMilliseconds += methodResult.durationMilliseconds;
        if (methodResult.outcome === TestOutcome.Passed)
          passed++;
        else if (methodResult.outcome === TestOutcome.Failed)
          failed++;
        else
          skipped++;
      }

    this.classResults = [...classResults];
    this.durationMilliseconds = durationMilliseconds;
    this.passed = passed;
    this.failed = failed;
    this.skipped = skipped;
    this.executed = this.passed + this.failed;
    this.total = this.executed + this.skipped;
  }
}
