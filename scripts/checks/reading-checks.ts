/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import { CheckSelection } from "./check-selection.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import type { ISelectableCheck } from "./interfaces/i-selectable-check.ts";

export class ReadingChecks implements ISelectableCheck {
  private static readonly UNIT: string = "checks";

  private readonly checks: readonly ICheck[];

  public readonly title: string = "Checks that read";

  public constructor(checks: readonly ICheck[]) {
    this.checks = checks;
  }

  public get titles(): readonly string[] {
    return this.checks.map(t => t.title);
  }

  public async runAsync(output: Writable): Promise<boolean> {
    return (await this.runChecksAsync(this.checks, output)).every(t => t);
  }

  public async runSelectedAsync(filters: readonly string[], output: Writable): Promise<CheckSelection> {
    const selected = this.checks.filter(t => filters.some(u => t.title.includes(u)));
    const results = await this.runChecksAsync(selected, output);
    return new CheckSelection(results.every(t => t), ReadingChecks.UNIT, this.checks.length, selected.length);
  }

  private async runChecksAsync(checks: readonly ICheck[], output: Writable): Promise<boolean[]> {
    const results: boolean[] = [];
    for (const check of checks) {
      output.write(`\n${check.title}\n`);
      const passed = await check.runAsync(output);
      output.write(`${check.title}: ${passed ? "passed" : "failed"}\n`);
      results.push(passed);
    }
    return results;
  }
}
