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
import PullRequestEvaluator from "../../workflows/pull-request-evaluator.ts";
import PullRequestSnapshot from "../../workflows/pull-request-snapshot.ts";
import WatchedRepository from "../../workflows/watched-repository.ts";

class PullRequestEvaluatorTests {
  private static readonly MINUTE: number = 60_000;
  private static readonly BASE: number = Date.parse("2026-10-04T12:00:00Z");
  private static readonly HEAD: string = "0123456789abcdef0123456789abcdef01234567";
  private static readonly REQUIRED: readonly string[] = ["Require linked issue", "Build and test (all targets)"];

  public static register(): void {
    test("a pull request without a build run is a no-build finding from its push time", () => {
      const pushedAt = PullRequestEvaluatorTests.at(-30);

      const findings = PullRequestEvaluatorTests.evaluate({ pushedAt, buildRuns: 0 });
      const covered = PullRequestEvaluatorTests.evaluate({ pushedAt, buildRuns: 3 });

      assert.deepEqual(findings.map(t => t.kind), ["no-build"]);
      assert.equal(findings[0]?.since, pushedAt);
      assert.deepEqual(covered, []);
    });

    test("only a conflicted merge state is a conflict finding, from the later of the push and the base's last change", () => {
      const early = PullRequestEvaluatorTests.at(-100);
      const late = PullRequestEvaluatorTests.at(-40);

      const pushedLast = PullRequestEvaluatorTests.evaluate({ mergeState: "dirty", pushedAt: late }, early);
      const baseChangedLast = PullRequestEvaluatorTests.evaluate({ mergeState: "dirty", pushedAt: early }, late);

      assert.deepEqual(pushedLast.map(t => t.kind), ["conflict"]);
      assert.equal(pushedLast[0]?.since.getTime(), late.getTime());
      assert.equal(baseChangedLast[0]?.since.getTime(), late.getTime());
      for (const mergeState of ["clean", "unknown", "blocked", "behind", "unstable", "has_hooks"])
        assert.deepEqual(PullRequestEvaluatorTests.evaluate({ mergeState }), [], mergeState);
    });

    test("a required check that failed is a failed finding from the latest failure, naming each failed check", () => {
      const checks = [
        PullRequestEvaluatorTests.check("Require linked issue", "failure", -90, -80),
        PullRequestEvaluatorTests.check("Build and test (all targets)", "timed_out", -70, -60),
        PullRequestEvaluatorTests.check("Build and test (Linux x64)", "failure", -50, -5)
      ];

      const findings = PullRequestEvaluatorTests.evaluate({ checks });

      assert.deepEqual(findings.map(t => t.kind), ["failed"]);
      assert.equal(findings[0]?.since.getTime(), PullRequestEvaluatorTests.at(-60).getTime());
      assert.ok(findings[0]?.text.startsWith("The required \"Require linked issue\", \"Build and test (all targets)\" failed"));
    });

    test("a rerun supersedes an earlier failure, a queued rerun is the newest and a check still running neither fails nor passes", () => {
      const rerun = [
        PullRequestEvaluatorTests.check("Require linked issue", "success", -50, -45),
        PullRequestEvaluatorTests.check("Build and test (all targets)", "failure", -70, -60),
        PullRequestEvaluatorTests.check("Build and test (all targets)", "success", -40, -30)
      ];
      const queued = [
        PullRequestEvaluatorTests.check("Require linked issue", "success", -50, -45),
        PullRequestEvaluatorTests.check("Build and test (all targets)", "success", -70, -60),
        new PullRequestCheck("Build and test (all targets)", null, null, null)
      ];
      const queuedFirst = [queued[2] as PullRequestCheck, queued[0] as PullRequestCheck, queued[1] as PullRequestCheck];
      const failedAfterQueued = [new PullRequestCheck("Require linked issue", null, null, null), PullRequestEvaluatorTests.check("Require linked issue", "failure", -9, -8)];
      const running = [PullRequestEvaluatorTests.check("Require linked issue", "success", -50, -45), new PullRequestCheck("Build and test (all targets)", null, new Date(PullRequestEvaluatorTests.BASE), null)];

      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks: rerun }), []);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks: queued, isApproved: true }), []);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks: queuedFirst, isApproved: true }), []);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks: failedAfterQueued }), []);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks: running, isApproved: true }), []);
    });

    test("checks that are not required never count", () => {
      const checks = [
        PullRequestEvaluatorTests.check("Build and test (Linux x64)", "failure", -50, -40),
        ...PullRequestEvaluatorTests.REQUIRED.map(t => PullRequestEvaluatorTests.check(t, "success", -50, -40))
      ];

      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks }), []);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks: [PullRequestEvaluatorTests.check("Build and test (Linux x64)", "success", -50, -40)], isApproved: true }), []);
    });

    test("passing required checks on an approved pull request with auto-merge off are a not-merging finding from the latest completion", () => {
      const checks = [
        PullRequestEvaluatorTests.check("Require linked issue", "success", -50, -45),
        PullRequestEvaluatorTests.check("Build and test (all targets)", "neutral", -40, -20)
      ];

      const approved = PullRequestEvaluatorTests.evaluate({ checks, isApproved: true });
      const enabledBefore = PullRequestEvaluatorTests.evaluate({ checks, hadAutoMerge: true });

      assert.deepEqual(approved.map(t => t.kind), ["not-merging"]);
      assert.equal(approved[0]?.since.getTime(), PullRequestEvaluatorTests.at(-20).getTime());
      assert.deepEqual(enabledBefore.map(t => t.kind), ["not-merging"]);
    });

    test("passing checks are not a finding while auto-merge is on, with no approval or earlier auto-merge, in a conflict, with a check missing or without required checks", () => {
      const checks = PullRequestEvaluatorTests.REQUIRED.map(t => PullRequestEvaluatorTests.check(t, "success", -50, -40));
      const one = checks.slice(0, 1);

      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks, isApproved: true, hasAutoMerge: true, hadAutoMerge: true }), []);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks }), []);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks, isApproved: true, mergeState: "dirty" }).map(t => t.kind), ["conflict"]);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks: one, isApproved: true }), []);
      assert.deepEqual(PullRequestEvaluatorTests.evaluate({ checks, isApproved: true }, PullRequestEvaluatorTests.at(-600), []).map(t => t.kind), []);
    });

    test("a pull request can have several findings at once, in a fixed order", () => {
      const checks = [PullRequestEvaluatorTests.check("Require linked issue", "failure", -50, -40)];

      const findings = PullRequestEvaluatorTests.evaluate({ buildRuns: 0, mergeState: "dirty", checks });

      assert.deepEqual(findings.map(t => t.kind), ["no-build", "conflict", "failed"]);
    });
  }

  private static at(minutes: number): Date {
    return new Date(PullRequestEvaluatorTests.BASE + (minutes * PullRequestEvaluatorTests.MINUTE));
  }

  private static check(name: string, conclusion: string, startedMinutes: number, finishedMinutes: number): PullRequestCheck {
    return new PullRequestCheck(name, conclusion, PullRequestEvaluatorTests.at(startedMinutes), PullRequestEvaluatorTests.at(finishedMinutes));
  }

  private static evaluate(
    changes: {
      readonly mergeState?: string;
      readonly hasAutoMerge?: boolean;
      readonly hadAutoMerge?: boolean;
      readonly isApproved?: boolean;
      readonly pushedAt?: Date;
      readonly buildRuns?: number;
      readonly checks?: readonly PullRequestCheck[];
    },
    baseChangedAt: Date = PullRequestEvaluatorTests.at(-600),
    requiredChecks: readonly string[] = PullRequestEvaluatorTests.REQUIRED) {
    const pull = new PullRequestSnapshot(
      5,
      PullRequestEvaluatorTests.HEAD,
      changes.mergeState ?? "clean",
      changes.hasAutoMerge ?? false,
      changes.hadAutoMerge ?? false,
      changes.isApproved ?? false,
      changes.pushedAt ?? PullRequestEvaluatorTests.at(-120),
      changes.buildRuns ?? 1,
      changes.checks ?? [],
      []);
    return new PullRequestEvaluator().evaluate(new WatchedRepository("main", requiredChecks, baseChangedAt), pull);
  }
}

PullRequestEvaluatorTests.register();
