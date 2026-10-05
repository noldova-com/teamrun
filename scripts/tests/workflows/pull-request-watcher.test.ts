/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import Git from "../../repository/git.ts";
import GitHubApi from "../../repository/github-api.ts";
import MergeConflictReader from "../../workflows/merge-conflict.reader.ts";
import PullRequestEvaluator from "../../workflows/pull-request-evaluator.ts";
import PullRequestFinding from "../../workflows/pull-request-finding.ts";
import PullRequestNote from "../../workflows/pull-request-note.ts";
import PullRequestWatcher from "../../workflows/pull-request-watcher.ts";
import PullRequestReader from "../../workflows/pull-request.reader.ts";
import RunCancellation from "../../workflows/run-cancellation.ts";
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

    test("a conflicting pull request's queued and running build runs are cancelled, with one comment naming the conflicting files", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", commitMinutesAgo: 5, activeRuns: [301, 302], conflicts: ["docs/a.md", "src/b.ts"] });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      const head = PullRequestScenarioFixture.head(3);
      assert.deepEqual(lines, ["- #3: cancelled (2 runs, commented)"]);
      assert.deepEqual(scenario.api.writes, ["POST /actions/runs/301/cancel", "POST /actions/runs/302/cancel", "POST /issues/3/comments"]);
      assert.deepEqual(scenario.api.bodies, [PullRequestNote.compose(new RunCancellation("main", ["docs/a.md", "src/b.ts"], 2), head)]);
      assert.match(scenario.api.bodies[0] ?? "", /`main` moved, and this pull request now conflicts with it in these files:\n\n```\ndocs\/a\.md\nsrc\/b\.ts\n```\n\n2 runs of \*\*Build and test\*\* were cancelled/);
      assert.deepEqual(scenario.git.commands, [
        "fetch --no-tags --quiet origin +refs/heads/main:refs/remotes/watch/base +refs/pull/3/head:refs/remotes/watch/head",
        "merge-tree --write-tree --name-only --no-messages -z refs/remotes/watch/base refs/remotes/watch/head"
      ]);
    });

    test("a conflict Git no longer finds, or a file list Git cannot read, still gets the comment without names", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", commitMinutesAgo: 5, activeRuns: [301] });
      scenario.add({ number: 4, mergeState: "dirty", commitMinutesAgo: 5, activeRuns: [401], conflicts: null });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: cancelled (1 run, commented)", "- #4: cancelled (1 run, commented)"]);
      assert.deepEqual([...scenario.api.bodies].sort(), [
        PullRequestNote.compose(new RunCancellation("main", [], 1), PullRequestScenarioFixture.head(3)),
        PullRequestNote.compose(new RunCancellation("main", null, 1), PullRequestScenarioFixture.head(4))
      ].sort());
    });

    test("two conflicting pull requests read their files with Git one after the other, so each comment names its own", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", commitMinutesAgo: 5, activeRuns: [301], conflicts: ["a.ts"] });
      scenario.add({ number: 4, mergeState: "dirty", commitMinutesAgo: 5, activeRuns: [401], conflicts: ["b.ts"] });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: cancelled (1 run, commented)", "- #4: cancelled (1 run, commented)"]);
      assert.deepEqual(scenario.git.commands.map(t => t.split(" ")[0]), ["fetch", "merge-tree", "fetch", "merge-tree"]);
      assert.deepEqual([...scenario.api.bodies].sort(), [
        PullRequestNote.compose(new RunCancellation("main", ["a.ts"], 1), PullRequestScenarioFixture.head(3)),
        PullRequestNote.compose(new RunCancellation("main", ["b.ts"], 1), PullRequestScenarioFixture.head(4))
      ].sort());
    });

    test("pull requests checked several at a time are listed in their order", async () => {
      const scenario = new PullRequestScenarioFixture();
      const numbers = [3, 4, 5, 6, 7, 8];
      for (const number of numbers)
        scenario.add({ number });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, numbers.map(t => `- #${t}: nothing to do`));
    });

    test("failures with some pull requests still let the others be checked, then fail the run with each failure in their order", async () => {
      const scenario = new PullRequestScenarioFixture();
      for (const number of [3, 4, 5, 6, 7, 8])
        scenario.add({ number, buildRuns: 0, commitMinutesAgo: 30 });
      scenario.api.fail("/pulls/3/reviews?per_page=100", "HTTP 502: the reviews of 3");
      scenario.api.fail("/issues/5/comments", "HTTP 403: a comment on 5");

      const failure = await PullRequestWatcherTests.watchAsync(scenario).then(() => null, (error: unknown) => error);

      assert.ok(failure instanceof AggregateError);
      assert.deepEqual(failure.errors.map(t => /the reviews of 3|a comment on 5/.exec((t as Error).message)?.[0]), ["the reviews of 3", "a comment on 5"]);
      assert.deepEqual([...scenario.api.writes].sort(), [4, 5, 6, 7, 8].map(t => `POST /issues/${t}/comments`));
    });

    test("an error other than Git's failure while reading the files fails the run", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", commitMinutesAgo: 5, activeRuns: [301] });
      scenario.git.fail(3, new Error("Git could not be started."));

      await assert.rejects(PullRequestWatcherTests.watchAsync(scenario), /^Error: Git could not be started\.$/);
    });

    test("a run that completed before its cancel arrived counts as cancelled", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", commitMinutesAgo: 5, activeRuns: [301, 302] });
      scenario.api.fail("/actions/runs/301/cancel", "gh: Cannot cancel a workflow run that is completed. (HTTP 409)");

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: cancelled (2 runs, commented)"]);
      assert.deepEqual(scenario.api.writes, ["POST /actions/runs/301/cancel", "POST /actions/runs/302/cancel", "POST /issues/3/comments"]);
    });

    test("a head with a cancel comment gets no conflict comment, while other findings and other heads still do", async () => {
      const scenario = new PullRequestScenarioFixture();
      const failed = [PullRequestScenarioFixture.failed("Build and test (all targets)", 45), PullRequestScenarioFixture.passed("Require linked issue", 80)];
      scenario.add({ number: 3, mergeState: "dirty", commitMinutesAgo: 90, activeRuns: [301], checks: failed });
      scenario.add({
        number: 4,
        mergeState: "dirty",
        commitMinutesAgo: 30,
        comments: [{ id: 41, login: PullRequestScenarioFixture.BOT, body: `<!-- pull-request-watch:cancelled:${PullRequestScenarioFixture.head(4)} -->\nText` }]
      });
      scenario.add({
        number: 5,
        mergeState: "dirty",
        commitMinutesAgo: 30,
        comments: [{ id: 51, login: PullRequestScenarioFixture.BOT, body: `<!-- pull-request-watch:cancelled:${PullRequestScenarioFixture.head(6)} -->\nText` }]
      });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: cancelled (1 run, commented), failed (commented)", "- #4: nothing to do", "- #5: conflict (commented)"]);
      assert.deepEqual(scenario.api.writes.filter(t => !t.includes("/5/")), ["POST /actions/runs/301/cancel", "POST /issues/3/comments", "POST /issues/3/comments"]);
      assert.deepEqual(scenario.api.writes.filter(t => t.includes("/5/")), ["POST /issues/5/comments"]);
      assert.deepEqual(scenario.api.bodies.map(t => /^<!-- pull-request-watch:([a-z-]+):([0-9a-f]+) -->/.exec(t)?.slice(1)).sort(), [
        ["cancelled", PullRequestScenarioFixture.head(3)], ["conflict", PullRequestScenarioFixture.head(5)], ["failed", PullRequestScenarioFixture.head(3)]
      ]);
    });

    test("runs started again on a head already commented on are cancelled without another comment, and the comment is never cleared", async () => {
      const scenario = new PullRequestScenarioFixture();
      const head = PullRequestScenarioFixture.head(3);
      const old = PullRequestScenarioFixture.head(4);
      scenario.add({
        number: 3,
        mergeState: "dirty",
        commitMinutesAgo: 5,
        activeRuns: [303],
        comments: [
          { id: 31, login: PullRequestScenarioFixture.BOT, body: `<!-- pull-request-watch:cancelled:${head} -->\nText` },
          { id: 32, login: PullRequestScenarioFixture.BOT, body: `<!-- pull-request-watch:cancelled:${old} -->\nText` }
        ]
      });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: cancelled (1 run, already commented)"]);
      assert.deepEqual(scenario.api.writes, ["POST /actions/runs/303/cancel"]);
      assert.deepEqual(scenario.git.commands, []);
    });

    test("a conflicting pull request without a queued or running build run, a clean one and a draft are left alone", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", commitMinutesAgo: 5 });
      scenario.add({ number: 4, mergeState: "clean", activeRuns: [401] });
      scenario.add({ number: 5, isDraft: true, mergeState: "dirty", activeRuns: [501] });

      const lines = await PullRequestWatcherTests.watchAsync(scenario);

      assert.deepEqual(lines, ["- #3: nothing to do", "- #4: nothing to do", "- #5: skipped, a draft"]);
      assert.deepEqual(scenario.api.writes, []);
      assert.deepEqual(scenario.api.requests.filter(t => t.endsWith("&per_page=100") && t.includes("/runs?")), [
        `GET /actions/workflows/build-and-test.yml/runs?event=pull_request&head_sha=${PullRequestScenarioFixture.head(3)}&per_page=100`
      ]);
      assert.deepEqual(scenario.git.commands, []);
    });

    test("unknown merge states are read again together every 5 seconds until GitHub has computed them", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", unknownMergeStates: 1, commitMinutesAgo: 5, activeRuns: [301], conflicts: ["a.ts"] });
      scenario.add({ number: 4, unknownMergeStates: 3 });
      scenario.add({ number: 5 });
      scenario.add({ number: 6, isDraft: true });
      const waits: number[] = [];

      const lines = await PullRequestWatcherTests.watchAsync(scenario, waits);

      assert.deepEqual(lines, ["- #3: cancelled (1 run, commented)", "- #4: nothing to do", "- #5: nothing to do", "- #6: skipped, a draft"]);
      assert.deepEqual(waits, [5_000, 5_000, 5_000]);
      assert.deepEqual(scenario.api.requests.filter(t => /^GET \/pulls\/\d+$/.test(t)), [
        "GET /pulls/3", "GET /pulls/4", "GET /pulls/5", "GET /pulls/3", "GET /pulls/4", "GET /pulls/4", "GET /pulls/4"
      ]);
    });

    test("a merge state still unknown after eleven reads in 50 seconds is reported and nothing is cancelled", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", unknownMergeStates: 12, commitMinutesAgo: 5, activeRuns: [301] });
      const waits: number[] = [];

      const lines = await PullRequestWatcherTests.watchAsync(scenario, waits);

      assert.deepEqual(lines, ["- #3: merge state still unknown"]);
      assert.deepEqual(waits, Array.from({ length: 10 }, () => 5_000));
      assert.equal(scenario.api.requests.filter(t => t === "GET /pulls/3").length, 11);
      assert.deepEqual(scenario.api.writes, []);
    });

    test("a failed cancel fails the run instead of being reported as done", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, mergeState: "dirty", commitMinutesAgo: 5, activeRuns: [301] });
      scenario.api.fail("/actions/runs/301/cancel", "HTTP 403: Resource not accessible by integration");

      await assert.rejects(PullRequestWatcherTests.watchAsync(scenario), /HTTP 403: Resource not accessible by integration/);
    });

    test("a failed write fails the run instead of being reported as done", async () => {
      const scenario = new PullRequestScenarioFixture();
      scenario.add({ number: 3, buildRuns: 0, commitMinutesAgo: 30 });
      scenario.api.fail("/issues/3/comments", "HTTP 403: Resource not accessible by integration");

      await assert.rejects(PullRequestWatcherTests.watchAsync(scenario), /HTTP 403: Resource not accessible by integration/);
    });
  }

  private static watchAsync(scenario: PullRequestScenarioFixture, waits: number[] = []): Promise<readonly string[]> {
    const api = new GitHubApi(GitHubApiFixture.REPOSITORY, scenario.api, "work");
    const conflicts = new MergeConflictReader(new Git("work", scenario.git));
    return new PullRequestWatcher(api, new PullRequestReader(api), new PullRequestEvaluator(), conflicts, () => PullRequestScenarioFixture.NOW.getTime(), async t => {
      waits.push(t);
    }).watchAsync();
  }
}

PullRequestWatcherTests.register();
