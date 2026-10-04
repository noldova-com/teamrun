/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import GitHubApiFixture from "./github-api.fixture.ts";
import type IScenarioCheck from "./interfaces/scenario-check.ts";
import type IScenarioPullRequest from "./interfaces/scenario-pull-request.ts";
import MergeTreeFixture from "./merge-tree.fixture.ts";

export default class PullRequestScenarioFixture {
  public static readonly NOW: Date = new Date("2026-10-04T12:00:00Z");
  public static readonly REQUIRED: readonly string[] = ["Require linked issue", "Build and test (all targets)"];
  public static readonly BOT: string = "github-actions[bot]";

  private static readonly MINUTE: number = 60_000;

  public readonly api: GitHubApiFixture = new GitHubApiFixture();
  public readonly git: MergeTreeFixture = new MergeTreeFixture();

  private readonly open: unknown[] = [];

  public static head(number: number): string {
    return number.toString(16).padStart(40, "0");
  }

  public static ago(minutes: number): string {
    return new Date(PullRequestScenarioFixture.NOW.getTime() - minutes * PullRequestScenarioFixture.MINUTE).toISOString();
  }

  public static passed(name: string, finishedMinutesAgo: number): IScenarioCheck {
    return { name, conclusion: "success", startedMinutesAgo: finishedMinutesAgo + 5, finishedMinutesAgo };
  }

  public static failed(name: string, finishedMinutesAgo: number): IScenarioCheck {
    return { name, conclusion: "failure", startedMinutesAgo: finishedMinutesAgo + 5, finishedMinutesAgo };
  }

  public static allPassed(finishedMinutesAgo: number): readonly IScenarioCheck[] {
    return PullRequestScenarioFixture.REQUIRED.map(t => PullRequestScenarioFixture.passed(t, finishedMinutesAgo));
  }

  public constructor(requiredChecks: readonly string[] = PullRequestScenarioFixture.REQUIRED, baseChangedMinutesAgo: number = 600) {
    this.api.answer("", { default_branch: "main" });
    this.api.answer("/rules/branches/main?per_page=100", [
      { type: "deletion", ruleset_id: 1 },
      { type: "required_status_checks", ruleset_id: 2, parameters: { required_status_checks: requiredChecks.map(t => ({ context: t, integration_id: 15368 })) } }
    ]);
    this.api.answer("/commits/main", { sha: "f".repeat(40), commit: { committer: { date: PullRequestScenarioFixture.ago(baseChangedMinutesAgo) } } });
    this.api.answer("/pulls?state=open&per_page=100", this.open);
  }

  public add(pull: IScenarioPullRequest): void {
    const head = PullRequestScenarioFixture.head(pull.number);
    const ago = PullRequestScenarioFixture.ago;
    this.open.push({ number: pull.number, draft: pull.isDraft ?? false, base: { ref: pull.base ?? "main" } });
    this.api.answer("/pulls?state=open&per_page=100", this.open);
    const states = [...Array<string>(pull.unknownMergeStates ?? 0).fill("unknown"), pull.mergeState ?? "clean"];
    this.api.answerInTurn(`/pulls/${pull.number}`, states.map(t => ({
      number: pull.number,
      head: { sha: head },
      mergeable_state: t,
      auto_merge: pull.hasAutoMerge === true ? { merge_method: "squash", enabled_by: { login: "maintainer" } } : null
    })));
    this.api.answer(`/actions/workflows/build-and-test.yml/runs?event=pull_request&head_sha=${head}&per_page=100`, {
      total_count: (pull.activeRuns?.length ?? 0) + 1,
      workflow_runs: [...(pull.activeRuns ?? []).map((t, index) => ({ id: t, status: index === 0 ? "in_progress" : "queued" })), { id: 1, status: "completed" }]
    });
    this.git.conflict(pull.number, pull.conflicts ?? []);
    this.api.answer(`/commits/${head}`, { sha: head, commit: { committer: { date: ago(pull.commitMinutesAgo ?? 120) } } });
    this.api.answer(`/commits/${head}/check-runs?per_page=100`, {
      total_count: pull.checks?.length ?? 0,
      check_runs: (pull.checks ?? []).map(t => ({
        name: t.name,
        status: t.conclusion === null ? "in_progress" : "completed",
        conclusion: t.conclusion,
        started_at: t.startedMinutesAgo === null ? null : ago(t.startedMinutesAgo),
        completed_at: t.finishedMinutesAgo === null ? null : ago(t.finishedMinutesAgo)
      }))
    });
    this.api.answer(`/actions/workflows/build-and-test.yml/runs?event=pull_request&head_sha=${head}&per_page=1`, { total_count: pull.buildRuns ?? 1, workflow_runs: [] });
    this.api.answer(`/pulls/${pull.number}/reviews?per_page=100`, (pull.reviews ?? []).map(t => ({ state: t.state, user: { login: t.login } })));
    this.api.answer(`/issues/${pull.number}/events?per_page=100`, (pull.events ?? []).map(t => ({ event: t })));
    this.api.answer(`/issues/${pull.number}/comments?per_page=100`, (pull.comments ?? []).map(t => ({ id: t.id, body: t.body, user: { login: t.login } })));
  }
}
