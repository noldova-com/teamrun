/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import GitHubException from "../../repository/github.exception.ts";
import GitHubApi from "../../repository/github-api.ts";
import OpenPullRequest from "../../workflows/open-pull-request.ts";
import PullRequestNote from "../../workflows/pull-request-note.ts";
import PullRequestReader from "../../workflows/pull-request.reader.ts";
import GitHubApiFixture from "../fixtures/github-api.fixture.ts";
import PullRequestScenarioFixture from "../fixtures/pull-request-scenario.fixture.ts";

class PullRequestReaderTests {
  private static readonly NUMBER: number = 7;
  private static readonly OPEN: OpenPullRequest = new OpenPullRequest(PullRequestReaderTests.NUMBER, false, "main");

  public static register(): void {
    test("the repository's default branch, required checks without repeats and the base's last change are read", async () => {
      const scenario = new PullRequestScenarioFixture(["Require linked issue", "Build and test (all targets)"], 90);
      scenario.api.answer("/rules/branches/main?per_page=100", [
        { type: "pull_request", parameters: { required_approving_review_count: 0 } },
        { type: "required_status_checks", parameters: { required_status_checks: [{ context: "Require linked issue" }, { context: "Build and test (all targets)" }] } },
        { type: "required_status_checks", parameters: { required_status_checks: [{ context: "Require linked issue" }] } }
      ]);

      const repository = await PullRequestReaderTests.createReader(scenario).readRepositoryAsync();

      assert.equal(repository.defaultBranch, "main");
      assert.deepEqual(repository.requiredChecks, ["Require linked issue", "Build and test (all targets)"]);
      assert.equal(repository.baseChangedAt.toISOString(), PullRequestScenarioFixture.ago(90));
      assert.deepEqual(scenario.api.requests, ["GET ", "GET /rules/branches/main?per_page=100", "GET /commits/main"]);
    });

    test("every open pull request is listed with its draft state and base", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3 });
      scenario.add({ number: 4, isDraft: true });
      scenario.add({ number: 5, base: "release" });

      const open = await PullRequestReaderTests.createReader(scenario).listOpenAsync();

      assert.deepEqual(open.map(t => [t.number, t.isDraft, t.base]), [[3, false, "main"], [4, true, "main"], [5, false, "release"]]);
    });

    test("a pull request's snapshot holds its head, merge state, auto-merge, build runs and checks, pushed when its first check started", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({
        number: PullRequestReaderTests.NUMBER,
        mergeState: "dirty",
        hasAutoMerge: true,
        buildRuns: 2,
        checks: [
          PullRequestScenarioFixture.passed("Build and test (Linux x64)", 20),
          { name: "Require linked issue", conclusion: "success", startedMinutesAgo: 90, finishedMinutesAgo: 89 },
          { name: "Build and test (macOS ARM64)", conclusion: null, startedMinutesAgo: null, finishedMinutesAgo: null }
        ]
      });

      const pull = await PullRequestReaderTests.createReader(scenario).readAsync(PullRequestReaderTests.OPEN);

      assert.equal(pull.number, PullRequestReaderTests.NUMBER);
      assert.equal(pull.head, PullRequestScenarioFixture.head(PullRequestReaderTests.NUMBER));
      assert.equal(pull.mergeState, "dirty");
      assert.equal(pull.hasAutoMerge, true);
      assert.equal(pull.buildRuns, 2);
      assert.equal(pull.pushedAt.toISOString(), PullRequestScenarioFixture.ago(90));
      assert.deepEqual(pull.checks.map(t => [t.name, t.conclusion]), [["Build and test (Linux x64)", "success"], ["Require linked issue", "success"], ["Build and test (macOS ARM64)", null]]);
      assert.deepEqual(pull.notes, []);
    });

    test("a pull request with no started check is pushed when its head commit was made", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 7, commitMinutesAgo: 45 });
      scenario.add({ number: 8, commitMinutesAgo: 25, checks: [{ name: "Build and test (Linux x64)", conclusion: null, startedMinutesAgo: null, finishedMinutesAgo: null }] });
      const reader = PullRequestReaderTests.createReader(scenario);

      const none = await reader.readAsync(new OpenPullRequest(7, false, "main"));
      const queued = await reader.readAsync(new OpenPullRequest(8, false, "main"));

      assert.equal(none.pushedAt.toISOString(), PullRequestScenarioFixture.ago(45));
      assert.equal(none.hasAutoMerge, false);
      assert.equal(queued.pushedAt.toISOString(), PullRequestScenarioFixture.ago(25));
    });

    test("an approving review counts unless a reviewer's latest decision asks for changes, and comments and dismissed reviews decide nothing", async () => {
      const cases: readonly (readonly [boolean, readonly (readonly [string, string])[]])[] = [
        [false, []],
        [true, [["ada", "APPROVED"]]],
        [true, [["ada", "APPROVED"], ["bob", "COMMENTED"]]],
        [false, [["ada", "COMMENTED"]]],
        [false, [["ada", "DISMISSED"]]],
        [false, [["ada", "APPROVED"], ["bob", "CHANGES_REQUESTED"]]],
        [false, [["ada", "APPROVED"], ["ada", "CHANGES_REQUESTED"]]],
        [true, [["ada", "CHANGES_REQUESTED"], ["ada", "APPROVED"]]],
        [true, [["bob", "DISMISSED"], ["ada", "APPROVED"]]]
      ];

      for (const [expected, reviews] of cases) {
        const scenario = new PullRequestScenarioFixture();
        scenario.add({ number: PullRequestReaderTests.NUMBER, reviews: reviews.map(([login, state]) => ({ login, state })) });

        const pull = await PullRequestReaderTests.createReader(scenario).readAsync(PullRequestReaderTests.OPEN);

        assert.equal(pull.isApproved, expected, JSON.stringify(reviews));
      }
    });

    test("a review by a deleted account still counts", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: PullRequestReaderTests.NUMBER });
      scenario.api.answer(`/pulls/${PullRequestReaderTests.NUMBER}/reviews?per_page=100`, [{ state: "APPROVED", user: null }]);

      const pull = await PullRequestReaderTests.createReader(scenario).readAsync(PullRequestReaderTests.OPEN);

      assert.equal(pull.isApproved, true);
    });

    test("auto-merge counts as turned on before when the history shows it enabled by any merge method", async () => {
      for (const [expected, events] of [[false, []], [false, ["labeled", "auto_merge_disabled"]], [true, ["auto_merge_enabled"]], [true, ["labeled", "auto_squash_enabled"]], [true, ["auto_rebase_enabled"]]] as const) {
        const scenario = new PullRequestScenarioFixture();
        scenario.add({ number: PullRequestReaderTests.NUMBER, events });

        const pull = await PullRequestReaderTests.createReader(scenario).readAsync(PullRequestReaderTests.OPEN);

        assert.equal(pull.hadAutoMerge, expected, events.join());
      }
    });

    test("only the workflow's own comments that carry the marker are notes", async () => {
      const head = PullRequestScenarioFixture.head(PullRequestReaderTests.NUMBER);
      const marker = `<!-- pull-request-watch:conflict:${head} -->\nText`;
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: PullRequestReaderTests.NUMBER });
      scenario.api.answer(`/issues/${PullRequestReaderTests.NUMBER}/comments?per_page=100`, [
        { id: 1, body: marker, user: { login: PullRequestScenarioFixture.BOT } },
        { id: 2, body: "Thanks for the review.", user: { login: PullRequestScenarioFixture.BOT } },
        { id: 3, body: marker, user: { login: "mallory" } },
        { id: 4, body: `<!-- pull-request-watch:failed:${head} -->\nText\n\n**Cleared:** this finding no longer applies.`, user: { login: PullRequestScenarioFixture.BOT } },
        { id: 5, body: marker, user: null }
      ]);

      const pull = await PullRequestReaderTests.createReader(scenario).readAsync(PullRequestReaderTests.OPEN);

      assert.ok(pull.notes.every(t => t instanceof PullRequestNote));
      assert.deepEqual(pull.notes.map(t => [t.id, t.kind, t.head, t.isCleared]), [[1, "conflict", head, false], [4, "failed", head, true]]);
    });

    test("an answer of the wrong shape is refused naming the field", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: PullRequestReaderTests.NUMBER });
      const reader = PullRequestReaderTests.createReader(scenario);

      scenario.api.answer("/pulls?state=open&per_page=100", [1]);
      await assert.rejects(reader.listOpenAsync(), new GitHubException("pulls[0] must be an object."));
      scenario.api.answer("/pulls?state=open&per_page=100", [{ number: 1, draft: "no", base: { ref: "main" } }]);
      await assert.rejects(reader.listOpenAsync(), new GitHubException("pull request.draft must be true or false."));
      scenario.api.answer("/rules/branches/main?per_page=100", [2]);
      await assert.rejects(reader.readRepositoryAsync(), new GitHubException("rules[0] must be an object."));
      scenario.api.answer(`/pulls/${PullRequestReaderTests.NUMBER}`, { head: { sha: "a".repeat(40) }, mergeable_state: 3 });
      scenario.api.answer(`/commits/${"a".repeat(40)}/check-runs?per_page=100`, { check_runs: [] });
      scenario.api.answer(`/commits/${"a".repeat(40)}`, { commit: { committer: { date: PullRequestScenarioFixture.ago(5) } } });
      await assert.rejects(reader.readAsync(PullRequestReaderTests.OPEN), new GitHubException("pull request.mergeable_state must be text."));
    });
  }

  private static createReader(scenario: PullRequestScenarioFixture): PullRequestReader {
    return new PullRequestReader(new GitHubApi(GitHubApiFixture.REPOSITORY, scenario.api, "work"));
  }
}

PullRequestReaderTests.register();
