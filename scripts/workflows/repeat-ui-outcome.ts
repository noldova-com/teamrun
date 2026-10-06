/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { stripVTControlCharacters } from "node:util";

import JsonFields from "../totals/json-fields.ts";

export default class RepeatUiOutcome {
  private static readonly SOURCE: string = "The UI workflow report";
  private static readonly OUT_OF_TIME: RegExp = /^Timed out waiting \d+(?:\.\d+)?s for the .+ to run$/u;
  private static readonly PASSED: ReadonlySet<string> = new Set(["expected", "flaky"]);
  private static readonly FAILED: string = "unexpected";
  private static readonly INTERRUPTED: string = "interrupted";

  public readonly passed: number;
  public readonly failed: number;
  public readonly skipped: number;
  public readonly unfinished: number;
  public readonly isOutOfTime: boolean;

  public constructor(passed: number, failed: number, skipped: number, unfinished: number, isOutOfTime: boolean) {
    this.passed = passed;
    this.failed = failed;
    this.skipped = skipped;
    this.unfinished = unfinished;
    this.isOutOfTime = isOutOfTime;
  }

  public static parse(text: string): RepeatUiOutcome {
    const report = JsonFields.parse(text, RepeatUiOutcome.SOURCE);
    const tests = report.objects("suites").flatMap(t => RepeatUiOutcome.collect(t));
    const finished = tests.filter(t => !RepeatUiOutcome.isUnfinished(t)).map(t => t.text("status"));
    const passed = finished.filter(t => RepeatUiOutcome.PASSED.has(t)).length;
    const failed = finished.filter(t => t === RepeatUiOutcome.FAILED).length;
    const isOutOfTime = (report.has("errors") ? report.objects("errors") : [])
      .some(t => RepeatUiOutcome.OUT_OF_TIME.test(stripVTControlCharacters(t.text("message")).trim()));
    return new RepeatUiOutcome(passed, failed, finished.length - passed - failed, tests.length - finished.length, isOutOfTime);
  }

  public formatSummary(leg: string): string {
    const lines = [
      `### Repeat (${leg})`,
      "",
      `${this.passed} UI tests passed, ${this.failed} failed, ${this.skipped} were skipped and ${this.unfinished} did not finish.`
    ];
    if (this.isOutOfTime)
      lines.push("", "The repeat ran out of time: Playwright stopped it at its global timeout, before the job's time limit, so the tests that did not finish are not failures.");
    return `${lines.join("\n")}\n`;
  }

  public formatAnnotation(leg: string): string {
    return this.isOutOfTime
      ? `::error title=The repeat ran out of time::${leg} ran out of time after ${this.passed} passing and ${this.failed} failing UI tests; ${this.unfinished} did not finish.\n`
      : "";
  }

  private static collect(suite: JsonFields): JsonFields[] {
    const tests = suite.has("specs") ? suite.objects("specs").flatMap(t => t.objects("tests")) : [];
    const suites = suite.has("suites") ? suite.objects("suites").flatMap(t => RepeatUiOutcome.collect(t)) : [];
    return [...tests, ...suites];
  }

  private static isUnfinished(test: JsonFields): boolean {
    const last = test.objects("results").at(-1);
    return last === undefined || last.text("status") === RepeatUiOutcome.INTERRUPTED;
  }
}
