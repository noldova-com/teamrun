/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type IRunnerSkip from "../totals/interfaces/runner-skip.ts";
import JsonFields from "../totals/json-fields.ts";
import RunnerResult from "../totals/runner-result.ts";
import TestNames from "../totals/test-names.ts";
import TotalsException from "../totals/totals.exception.ts";

export default class AngularTestReport {
  private static readonly PASSED: string = "passed";
  private static readonly FAILED: string = "failed";
  private static readonly PENDING: string = "pending";
  private static readonly REASONS: ReadonlyMap<string, string> = new Map([["skipped", "No reason given."], ["todo", "To do."]]);

  private readonly source: string;
  private readonly name: (file: string) => string;
  private readonly skips: IRunnerSkip[] = [];
  private readonly tests: TestNames = new TestNames();
  private readonly empty: string[] = [];
  private passed: number = 0;
  private failed: number = 0;
  private unreached: number = 0;

  public constructor(source: string, name: (file: string) => string) {
    this.source = source;
    this.name = name;
  }

  public read(results: readonly unknown[]): RunnerResult {
    const files = results.map((t, i) => this.readFile(new JsonFields(t, this.source, [`test file ${i + 1}`])));
    return new RunnerResult(new JsonFields({ passed: this.passed, failed: this.failed, skipped: this.skips.length, unreached: this.unreached, skips: this.skips, files: files.sort(), duplicates: this.tests.duplicates, empty: this.empty.sort() }, this.source));
  }

  private readFile(result: JsonFields): string {
    const file = this.name(result.text("name"));
    const assertions = result.objects("assertionResults");
    const statuses = assertions.map(t => t.text("status"));
    const failed = result.text("status") === AngularTestReport.FAILED;
    this.failed += Number(failed && !statuses.includes(AngularTestReport.FAILED));
    if (!failed && assertions.length === 0)
      this.empty.push(file);
    assertions.forEach(t => this.count(file, [...t.texts("ancestorTitles"), t.text("title")], t.text("status")));
    return file;
  }

  private count(file: string, names: readonly string[], status: string): void {
    const reason = AngularTestReport.REASONS.get(status);
    this.tests.add(file, names);
    if (status === AngularTestReport.PASSED)
      this.passed++;
    else if (status === AngularTestReport.FAILED)
      this.failed++;
    else if (status === AngularTestReport.PENDING)
      this.unreached++;
    else if (reason !== undefined)
      this.skips.push({ file, names, reason });
    else
      throw new TotalsException(`${this.source} gives ${file} an unknown test status ${JSON.stringify(status)}.`);
  }
}
