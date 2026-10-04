/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GitHubApi from "../../repository/github-api.ts";
import PullRequestEvaluator from "../../workflows/pull-request-evaluator.ts";
import PullRequestFinding from "../../workflows/pull-request-finding.ts";
import PullRequestNote from "../../workflows/pull-request-note.ts";
import PullRequestWatcher from "../../workflows/pull-request-watcher.ts";
import PullRequestReader from "../../workflows/pull-request.reader.ts";
import GitHubApiFixture from "../fixtures/github-api.fixture.ts";
import PullRequestScenarioFixture from "../fixtures/pull-request-scenario.fixture.ts";

class PullRequestWatcherTests {
  private static readonly CLEARED: string = "\n\n**Cleared:** this finding no longer applies.";

  public static register(): void {
    test("a repository without open pull requests reports that and writes nothing", async () => {
      const scenario = new PullRequestScenarioFixture();

      assert.deepEqual(await PullRequestWatcherTests.watchAsync(scenario), ["- No open pull requests."]);
      assert.deepEqual(scenario.api.writes, []);
    });

    test("drafts and pull requests for another branch are listed as skipped and never read", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, isDraft: true, buildRuns: 0, commitMinutesAgo: 600 });
      scenario.add({ number: 4, base: "release", buildRuns: 0, commitMinutesAgo: 600 });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: skipped, a draft", "- #4: skipped, based on release"]);
      assert.deepEqual(scenario.api.requests.filter(t => t.includes("/pulls/")), []);
      assert.deepEqual(scenario.api.writes, []);
    });

    test("a pull request with nothing wrong, or with a finding not yet due, is listed with nothing to do", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, checks: PullRequestScenarioFixture.allPassed(40) });
      scenario.add({ number: 4, buildRuns: 0, commitMinutesAgo: 9 });
      scenario.add({ number: 5, mergeState: "dirty", commitMinutesAgo: 19 });

      assert.deepEqual(await PullRequestWatcherTests.watchAsync(scenario), ["- #3: nothing to do", "- #4: nothing to do", "- #5: nothing to do"]);
      assert.deepEqual(scenario.api.writes, []);
    });

    test("a finding that is due gets one comment on the pull request with its text and a marker for the head commit", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, buildRuns: 0, commitMinutesAgo: 10 });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      const head = PullRequestScenarioFixture.head(3);
      assert.deepEqual(lines, ["- #3: no-build (commented)"]);
      assert.deepEqual(scenario.api.writes, ["POST /issues/3/comments"]);
      assert.deepEqual(scenario.api.bodies, [PullRequestNote.compose(PullRequestFinding.noBuild(new Date(), head), head)]);
    });

    test("every finding that is due gets its own comment", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({
        number: 3,
        mergeState: "dirty",
        commitMinutesAgo: 90,
        checks: [PullRequestScenarioFixture.failed("Build and test (all targets)", 45), PullRequestScenarioFixture.passed("Require linked issue", 80)]
      });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: conflict (commented), failed (commented)"]);
      assert.deepEqual(scenario.api.writes, ["POST /issues/3/comments", "POST /issues/3/comments"]);
      assert.match(scenario.api.bodies[0] ?? "", /^<!-- pull-request-watch:conflict:/);
      assert.match(scenario.api.bodies[1] ?? "", /^<!-- pull-request-watch:failed:/);
    });

    test("a passing pull request that nobody merges is flagged once its checks passed 15 minutes ago", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, checks: PullRequestScenarioFixture.allPassed(15), reviews: [{ login: "ada", state: "APPROVED" }] });
      scenario.add({ number: 4, checks: PullRequestScenarioFixture.allPassed(14), reviews: [{ login: "ada", state: "APPROVED" }] });
      scenario.add({ number: 5, checks: PullRequestScenarioFixture.allPassed(60), events: ["auto_squash_enabled", "auto_merge_disabled"] });
      scenario.add({ number: 6, checks: PullRequestScenarioFixture.allPassed(60), hasAutoMerge: true });
      scenario.add({ number: 7, checks: PullRequestScenarioFixture.allPassed(60) });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, [
        "- #3: not-merging (commented)",
        "- #4: nothing to do",
        "- #5: not-merging (commented)",
        "- #6: nothing to do",
        "- #7: nothing to do"
      ]);
    });

    test("a finding already commented on for the same head commit is not commented on again, even after its comment was cleared", async () => {
      const scenario = new PullRequestScenarioFixture();
      const head = PullRequestScenarioFixture.head(3);
      const open = `<!-- pull-request-watch:no-build:${head} -->\nText`;
      scenario.add({
        number: 3,
        buildRuns: 0,
        commitMinutesAgo: 60,
        mergeState: "dirty",
        comments: [
          { id: 1, login: PullRequestScenarioFixture.BOT, body: open },
          { id: 2, login: PullRequestScenarioFixture.BOT, body: `<!-- pull-request-watch:conflict:${head} -->\nText${PullRequestWatcherTests.CLEARED}` }
        ]
      });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: no-build (already commented), conflict (already commented)"]);
      assert.deepEqual(scenario.api.writes, []);
    });

    test("a comment says so when its finding clears, once, and a comment already cleared is left alone", async () => {
      const scenario = new PullRequestScenarioFixture();
      const head = PullRequestScenarioFixture.head(3);
      const open = `<!-- pull-request-watch:conflict:${head} -->\nText`;
      const cleared = `<!-- pull-request-watch:failed:${head} -->\nText${PullRequestWatcherTests.CLEARED}`;
      scenario.add({
        number: 3,
        mergeState: "clean",
        comments: [
          { id: 11, login: PullRequestScenarioFixture.BOT, body: open },
          { id: 12, login: PullRequestScenarioFixture.BOT, body: cleared }
        ]
      });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: conflict (cleared)"]);
      assert.deepEqual(scenario.api.writes, ["PATCH /issues/comments/11"]);
      assert.deepEqual(scenario.api.bodies, [`${open}${PullRequestWatcherTests.CLEARED}`]);
    });

    test("a push clears the comments for the old head commit and the new head commit gets its own comment when its finding is due", async () => {
      const scenario = new PullRequestScenarioFixture();
      const oldHead = "f".repeat(40);
      const old = `<!-- pull-request-watch:no-build:${oldHead} -->\nText`;
      scenario.add({ number: 3, buildRuns: 0, commitMinutesAgo: 30, comments: [{ id: 21, login: PullRequestScenarioFixture.BOT, body: old }] });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: no-build (commented), no-build (cleared)"]);
      assert.deepEqual(scenario.api.writes, ["POST /issues/3/comments", "PATCH /issues/comments/21"]);
    });

    test("a failed write fails the run instead of being reported as done", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, buildRuns: 0, commitMinutesAgo: 30 });
      scenario.api.fail("/issues/3/comments", "HTTP 403: Resource not accessible by integration");

      await assert.rejects(PullRequestWatcherTests.watchAsync(scenario), /HTTP 403: Resource not accessible by integration/);
    });
  }

  private static watchAsync(scenario: PullRequestScenarioFixture): Promise<readonly string[]> {
    const api = new GitHubApi(GitHubApiFixture.REPOSITORY, scenario.api, "work");
    return new PullRequestWatcher(api, new PullRequestReader(api), new PullRequestEvaluator(), () => PullRequestScenarioFixture.NOW.getTime()).watchAsync();
  }
}

PullRequestWatcherTests.register();
