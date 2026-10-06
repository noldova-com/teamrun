/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import AngularProject from "../angular/angular-project.ts";
import ProcessException from "../processes/process.exception.ts";
import TotalsException from "../totals/totals.exception.ts";
import CheckSelection from "./check-selection.ts";
import type FlakyRecord from "./flaky-record.ts";
import FlakyTest from "./flaky-test.ts";
import type ISelectableCheck from "./interfaces/selectable-check.ts";

export default class AngularTestCheck implements ISelectableCheck {
  public static readonly RUNNER: string = "angular";

  private static readonly UNIT: string = "spec files";
  private static readonly TOTALS_TITLE: string = "Angular tests";
  private static readonly NO_REPORT: string = "The Angular tests passed but wrote no report of the spec files they ran.\n";
  private static readonly LOG_HINT: string = `The Angular tests' full output is in ${AngularProject.LOG_FILE}.\n`;

  private readonly project: AngularProject;
  private readonly flaky: FlakyRecord | null;

  public readonly title: string = "Angular tests and coverage";

  public constructor(project: AngularProject, flaky: FlakyRecord | null) {
    this.project = project;
    this.flaky = flaky;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const isPassing = await this.checkAsync(output);
    if (!isPassing)
      output.write(AngularTestCheck.LOG_HINT);
    return isPassing;
  }

  public async runSelectedAsync(filters: readonly string[], output: Writable): Promise<CheckSelection> {
    try {
      const specs = await this.project.specFilesAsync();
      const selected = specs.filter(t => filters.some(u => t.includes(u)));
      if (selected.length === 0)
        return new CheckSelection(true, AngularTestCheck.UNIT, specs.length, 0);
      const isPassing = await this.checkAsync(output, selected);
      if (!isPassing)
        output.write(AngularTestCheck.LOG_HINT);
      return new CheckSelection(isPassing, AngularTestCheck.UNIT, specs.length, selected.length);
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      output.write(`${error.message}\n${AngularTestCheck.LOG_HINT}`);
      return new CheckSelection(false, AngularTestCheck.UNIT, 0, 0);
    }
  }

  private async checkAsync(output: Writable, include: readonly string[] = []): Promise<boolean> {
    try {
      const run = await this.project.testAsync(include, this.flaky !== null);
      await this.flaky?.addAsync(run.retried.map(t => new FlakyTest(AngularTestCheck.TOTALS_TITLE, t.file, t.name, t.failure)), output);
      if (run.result === null) {
        if (run.isSuccessful)
          output.write(AngularTestCheck.NO_REPORT);
        return false;
      }
      const totals = run.result.toTotals(AngularTestCheck.RUNNER, AngularTestCheck.TOTALS_TITLE, run.coverage, include.length === 0 ? await this.project.specFilesAsync() : include);
      const recorded = include.length === 0 ? await totals.recordAsync(this.project.root, output) : totals.report(output);
      return recorded && run.isSuccessful;
    }
    catch (error) {
      if (!(error instanceof ProcessException || error instanceof TotalsException))
        throw error;
      output.write(`${error.message}\n`);
      return false;
    }
  }
}
