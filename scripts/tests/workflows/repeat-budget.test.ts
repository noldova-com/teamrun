/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import RepeatBudget from "../../workflows/repeat-budget.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class RepeatBudgetTests {
  public static register(): void {
    test("the budget is the job's limit less the time it has run and the margin, in milliseconds, and never under 60 seconds", () => {
      assert.equal(RepeatBudget.calculate(400, 1_000, 60, 480), 2_520_000);
      assert.equal(RepeatBudget.calculate(1_000, 1_000, 60, 480), 3_120_000);
      assert.equal(RepeatBudget.calculate(400, 3_460, 60, 480), 60_000);
      assert.equal(RepeatBudget.calculate(400, 3_461, 60, 480), 60_000);
      assert.equal(RepeatBudget.calculate(400, 3_459, 60, 480), 61_000);
      assert.equal(RepeatBudget.calculate(400, 9_000, 60, 480), 60_000);
    });

    test("a run prints the budget from the start, limit and margin it is given and the time it is told, and refuses anything else", () => {
      const printed = new TextOutputFixture();
      const refused = new TextOutputFixture();
      const usage = "Give the job's start in seconds since 1970, its time limit in minutes and the seconds to keep before the limit, as whole numbers.\n";

      assert.equal(RepeatBudget.run(["400", "60", "480"], 1_000_999, printed), 0);
      assert.deepEqual([["400", "60"], ["400", "60", "480", "1"], ["", "60", "480"], ["-400", "60", "480"], ["400", "60", "4.8"]].map(t => RepeatBudget.run(t, 1_000_000, refused)), [1, 1, 1, 1, 1]);
      assert.equal(printed.text, "2520000\n");
      assert.equal(refused.text, usage.repeat(5));
    });

    test("the command prints a budget from the current time and terminates", () => {
      const started = `${Math.floor(Date.now() / 1000)}`;

      const printed = spawnSync(process.execPath, [SourceTreeFixture.locateScript("workflows/repeat-budget.ts"), started, "60", "480"], { encoding: "utf8", timeout: 10_000 });

      assert.equal(printed.status, 0, printed.stderr);
      assert.match(printed.stdout, /^\d+000\n$/);
    });
  }
}

RepeatBudgetTests.register();
