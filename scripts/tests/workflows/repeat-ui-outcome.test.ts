/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TotalsException from "../../totals/totals.exception.ts";
import RepeatUiOutcome from "../../workflows/repeat-ui-outcome.ts";

class RepeatUiOutcomeTests {
  public static register(): void {
    test("each test counts once as passed, failed, skipped or unfinished, through nested suites", () => {
      const outcome = RepeatUiOutcome.parse(RepeatUiOutcomeTests.report([]));

      assert.deepEqual([outcome.passed, outcome.failed, outcome.skipped, outcome.unfinished, outcome.isOutOfTime], [2, 1, 1, 2, false]);
      assert.equal(outcome.formatSummary("Linux x64, pass 1 of 5"), "### Repeat (Linux x64, pass 1 of 5)\n\n2 UI tests passed, 1 failed, 1 were skipped and 2 did not finish.\n");
      assert.equal(outcome.formatAnnotation("Linux x64, pass 1 of 5"), "");
    });

    test("Playwright's global timeout error marks the run out of time, in the summary and as an error annotation", () => {
      const outcome = RepeatUiOutcome.parse(RepeatUiOutcomeTests.report([{ message: "\u001b[31mTimed out waiting 2520s for the test suite to run\u001b[39m" }]));
      const leg = "macOS ARM64, 5 passes, shard 1 of 2";

      assert.equal(outcome.isOutOfTime, true);
      assert.equal(outcome.formatSummary(leg), `### Repeat (${leg})\n\n2 UI tests passed, 1 failed, 1 were skipped and 2 did not finish.\n\n` +
        "The repeat ran out of time: Playwright stopped it at its global timeout, before the job's time limit, so the tests that did not finish are not failures.\n");
      assert.equal(outcome.formatAnnotation(leg), `::error title=The repeat ran out of time::${leg} ran out of time after 2 passing and 1 failing UI tests; 2 did not finish.\n`);
    });

    test("other run errors, and a report without errors or suites, are not out of time", () => {
      const other = RepeatUiOutcome.parse(RepeatUiOutcomeTests.report([{ message: "Error: No tests found" }, { message: "Timed out waiting 5s for the webServer" }]));
      const empty = RepeatUiOutcome.parse(JSON.stringify({ suites: [{ title: "empty.spec.ts" }] }));

      assert.equal(other.isOutOfTime, false);
      assert.deepEqual([empty.passed, empty.failed, empty.skipped, empty.unfinished, empty.isOutOfTime], [0, 0, 0, 0, false]);
    });

    test("a report that isn't a Playwright JSON report is refused", () => {
      assert.throws(() => RepeatUiOutcome.parse("not json"), TotalsException);
      assert.throws(() => RepeatUiOutcome.parse(JSON.stringify({ suites: [{ specs: [{ tests: [{ results: [{}] }] }] }] })), TotalsException);
    });
  }

  private static report(errors: readonly object[]): string {
    const spec = (...tests: readonly object[]): object => ({ title: "a test", tests });
    const run = (status: string, ...results: readonly string[]): object => ({ status, results: results.map(t => ({ status: t })) });
    return JSON.stringify({
      suites: [
        {
          title: "quit.spec.ts",
          specs: [spec(run("expected", "passed"), run("flaky", "failed", "passed")), spec(run("unexpected", "failed"))],
          suites: [{ title: "quitting", specs: [spec(run("skipped", "skipped"), run("skipped"), run("unexpected", "interrupted"))] }]
        }
      ],
      errors
    });
  }
}

RepeatUiOutcomeTests.register();
