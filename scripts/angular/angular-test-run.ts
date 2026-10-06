/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ICoverageCount from "../totals/interfaces/coverage-count.ts";
import type RunnerResult from "../totals/runner-result.ts";

export default class AngularTestRun {
  public readonly exitCode: number | null;
  public readonly result: RunnerResult | null;
  public readonly coverage: ICoverageCount | null;

  public constructor(exitCode: number | null, result: RunnerResult | null, coverage: ICoverageCount | null) {
    this.exitCode = exitCode;
    this.result = result;
    this.coverage = coverage;
  }

  public get isSuccessful(): boolean {
    return this.exitCode === 0;
  }

  public get collected(): readonly string[] | null {
    return this.result?.files ?? null;
  }
}
