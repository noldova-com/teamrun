/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PullRequestFinding from "../../workflows/pull-request-finding.ts";

class PullRequestFindingTests {
  private static readonly SINCE: Date = new Date("2026-10-04T12:00:00Z");
  private static readonly HEAD: string = "0123456789abcdef0123456789abcdef01234567";

  public static register(): void {
    test("each finding is due after its own time limit and not a minute before", () => {
      const since = PullRequestFindingTests.SINCE;
      const findings = [
        [PullRequestFinding.noBuild(since, PullRequestFindingTests.HEAD), 10],
        [PullRequestFinding.conflict(since, "main"), 20],
        [PullRequestFinding.failed(since, ["Build and test (all targets)"]), 30],
        [PullRequestFinding.notMerging(since), 15]
      ] as const;

      for (const [finding, minutes] of findings) {
        assert.equal(finding.since, since);
        assert.equal(finding.isDue(new Date(since.getTime() + (minutes * 60_000) - 1)), false, finding.kind);
        assert.equal(finding.isDue(new Date(since.getTime() + (minutes * 60_000))), true, finding.kind);
        assert.equal(finding.isDue(new Date(since.getTime() + (minutes * 120_000))), true, finding.kind);
      }
    });

    test("each finding names its kind and tells the author what to do next", () => {
      const since = PullRequestFindingTests.SINCE;

      const noBuild = PullRequestFinding.noBuild(since, PullRequestFindingTests.HEAD);
      const conflict = PullRequestFinding.conflict(since, "trunk");
      const failed = PullRequestFinding.failed(since, ["Require linked issue", "Build and test (all targets)"]);
      const notMerging = PullRequestFinding.notMerging(since);

      assert.deepEqual([noBuild.kind, conflict.kind, failed.kind, notMerging.kind], ["no-build", "conflict", "failed", "not-merging"]);
      assert.match(noBuild.text, /^No "Build and test" run has started for 0123456 in the more than 10 minutes since it was pushed, /);
      assert.match(noBuild.text, /cannot start a run itself\. Push again, for example with `git commit --allow-empty -m "Start the checks"`, or close and reopen the pull request\.$/);
      assert.equal(conflict.text, "This pull request has conflicted with `trunk` for more than 20 minutes. Merge or rebase `trunk` into the branch, resolve the conflicts and push.");
      assert.equal(failed.text,
        "The required \"Require linked issue\", \"Build and test (all targets)\" failed more than 30 minutes ago and nothing has been pushed since. "
        + "Fix the failure and push. If a known flaky test caused it, comment on that test's issue and rerun the failed job once.");
      assert.equal(notMerging.text,
        "Every required check passed more than 15 minutes ago and auto-merge is off. "
        + "A reviewer merges the pull request or turns on auto-merge; if you are waiting for that, ask the reviewer.");
    });
  }
}

PullRequestFindingTests.register();
