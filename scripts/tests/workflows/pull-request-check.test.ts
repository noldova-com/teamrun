/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PullRequestCheck from "../../workflows/pull-request-check.ts";

class PullRequestCheckTests {
  public static register(): void {
    test("a check has failed after a failure, a timeout, a failed start or a cancellation, and has passed after a success, a neutral or a skipped result", () => {
      const date = new Date("2026-10-04T12:00:00Z");
      for (const conclusion of ["failure", "timed_out", "startup_failure", "cancelled"]) {
        const check = new PullRequestCheck("Build", conclusion, date, date);
        assert.equal(check.hasFailed, true, conclusion);
        assert.equal(check.hasPassed, false, conclusion);
      }
      for (const conclusion of ["success", "neutral", "skipped"]) {
        const check = new PullRequestCheck("Build", conclusion, date, date);
        assert.equal(check.hasFailed, false, conclusion);
        assert.equal(check.hasPassed, true, conclusion);
      }
      for (const conclusion of [null, "action_required", "stale"]) {
        const check = new PullRequestCheck("Build", conclusion, date, date);
        assert.equal(check.hasFailed, false, String(conclusion));
        assert.equal(check.hasPassed, false, String(conclusion));
      }
    });

    test("a check keeps its start and finish as times, with no start while queued and no finish while running", () => {
      const started = new Date("2026-10-04T11:00:00Z");
      const finished = new Date("2026-10-04T11:30:00Z");

      const done = new PullRequestCheck("Build", "success", started, finished);
      const running = new PullRequestCheck("Build", null, started, null);
      const queued = new PullRequestCheck("Build", null, null, null);

      assert.equal(done.name, "Build");
      assert.equal(done.conclusion, "success");
      assert.equal(done.startedTime, started.getTime());
      assert.equal(done.finishedTime, finished.getTime());
      assert.equal(running.finishedTime, 0);
      assert.equal(queued.startedTime, null);
    });
  }
}

PullRequestCheckTests.register();
