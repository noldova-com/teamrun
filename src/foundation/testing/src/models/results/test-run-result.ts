/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestOutcome } from "../../enums/test-outcome.js";
import { TestTimeoutException } from "../../exceptions/test-timeout.exception.js";
import type { TestClassResult } from "./test-class-result.js";
import { TestSelection } from "./test-selection.js";

export class TestRunResult {
  public readonly classResults: readonly TestClassResult[];
  public readonly durationMilliseconds: number;
  public readonly passed: number;
  public readonly failed: number;
  public readonly skipped: number;
  public readonly unreached: number;
  public readonly isInterrupted: boolean;
  public readonly executed: number;
  public readonly total: number;
  public readonly selection: TestSelection;

  public constructor(classResults: readonly TestClassResult[], selection: TestSelection | null = null) {
    let durationMilliseconds = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let unreached = 0;
    let isInterrupted = false;

    for (const classResult of classResults)
      for (const methodResult of classResult.methodResults) {
        durationMilliseconds += methodResult.durationMilliseconds;
        if (methodResult.outcome === TestOutcome.Passed)
          passed++;
        else if (methodResult.outcome === TestOutcome.Failed)
          failed++;
        else if (methodResult.outcome === TestOutcome.Skipped)
          skipped++;
        else
          unreached++;
        if (methodResult.failure instanceof TestTimeoutException)
          isInterrupted = true;
      }

    this.classResults = [...classResults];
    this.durationMilliseconds = durationMilliseconds;
    this.passed = passed;
    this.failed = failed;
    this.skipped = skipped;
    this.unreached = unreached;
    this.isInterrupted = isInterrupted;
    this.executed = this.passed + this.failed;
    this.total = this.executed + this.skipped + this.unreached;
    this.selection = Object.isNull(selection) ? new TestSelection([], this.total, this.total) : selection;
  }
}
