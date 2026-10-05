/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type GitHubApi from "../repository/github-api.ts";
import GitHubJson from "../repository/github-json.ts";
import OpenPullRequest from "./open-pull-request.ts";
import PullRequestCheck from "./pull-request-check.ts";
import PullRequestNote from "./pull-request-note.ts";
import PullRequestSnapshot from "./pull-request-snapshot.ts";
import PullRequestState from "./pull-request-state.ts";
import WatchedRepository from "./watched-repository.ts";

export default class PullRequestReader {
  private static readonly BUILD_WORKFLOW: string = "build-and-test.yml";
  private static readonly REQUIRED_CHECKS_RULE: string = "required_status_checks";
  private static readonly AUTO_MERGE_EVENTS: readonly string[] = ["auto_merge_enabled", "auto_squash_enabled", "auto_rebase_enabled"];
  private static readonly NOTE_AUTHOR: string = "github-actions[bot]";
  private static readonly DECISIONS: readonly string[] = ["APPROVED", "CHANGES_REQUESTED"];
  private static readonly APPROVED: string = "APPROVED";
  private static readonly CHANGES_REQUESTED: string = "CHANGES_REQUESTED";
  private static readonly PAGE: string = "per_page=100";
  private static readonly NO_ONE: string = "";
  private static readonly COMPLETED: string = "completed";

  private readonly api: GitHubApi;

  public constructor(api: GitHubApi) {
    this.api = api;
  }

  public async readRepositoryAsync(): Promise<WatchedRepository> {
    const repository = GitHubJson.object(await this.api.readAsync(""), "repository");
    const defaultBranch = GitHubJson.text(repository, "default_branch", "repository");
    const rules = (await this.api.readPagesAsync(`/rules/branches/${defaultBranch}?${PullRequestReader.PAGE}`)).map((t, index) => GitHubJson.object(t, `rules[${index}]`));
    const requiredChecks = rules
      .filter(t => GitHubJson.text(t, "type", "rule") === PullRequestReader.REQUIRED_CHECKS_RULE)
      .flatMap(t => GitHubJson.children(GitHubJson.child(t, "parameters", "rule"), "required_status_checks", "rule.parameters").map(c => GitHubJson.text(c, "context", "required check")));
    return new WatchedRepository(defaultBranch, requiredChecks, await this.readCommitDateAsync(defaultBranch));
  }

  public async listOpenAsync(): Promise<readonly OpenPullRequest[]> {
    const pulls = await this.api.readPagesAsync(`/pulls?state=open&${PullRequestReader.PAGE}`);
    return pulls.map((t, index) => {
      const pull = GitHubJson.object(t, `pulls[${index}]`);
      return new OpenPullRequest(GitHubJson.number(pull, "number", "pull request"), GitHubJson.flag(pull, "draft", "pull request"),
        GitHubJson.text(GitHubJson.child(pull, "base", "pull request"), "ref", "pull request.base"));
    });
  }

  public async readStateAsync(number: number): Promise<PullRequestState> {
    const pull = GitHubJson.object(await this.api.readAsync(`/pulls/${number}`), "pull request");
    return new PullRequestState(
      number,
      GitHubJson.text(GitHubJson.child(pull, "head", "pull request"), "sha", "pull request.head"),
      GitHubJson.text(pull, "mergeable_state", "pull request"),
      GitHubJson.nullableChild(pull, "auto_merge", "pull request") !== null);
  }

  public async readAsync(state: PullRequestState): Promise<PullRequestSnapshot> {
    const [checks, hadAutoMerge, isApproved, buildRuns, notes] = await Promise.all([
      this.readChecksAsync(state.head),
      this.readAutoMergeHistoryAsync(state.number),
      this.readApprovalAsync(state.number),
      this.readBuildRunsAsync(state.head),
      this.readNotesAsync(state.number)
    ]);
    const starts = checks.flatMap(t => t.startedTime === null ? [] : [t.startedTime]);
    const pushedAt = starts.length === 0 ? await this.readCommitDateAsync(state.head) : new Date(Math.min(...starts));
    return new PullRequestSnapshot(state.number, state.head, state.mergeState, state.hasAutoMerge, hadAutoMerge, isApproved, pushedAt, buildRuns, checks, notes);
  }

  public async listActiveBuildRunsAsync(head: string): Promise<readonly number[]> {
    const resource = `/actions/workflows/${PullRequestReader.BUILD_WORKFLOW}/runs?event=pull_request&head_sha=${head}&${PullRequestReader.PAGE}`;
    return GitHubJson.children(GitHubJson.object(await this.api.readAsync(resource), "workflow runs"), "workflow_runs", "workflow runs")
      .filter(t => GitHubJson.text(t, "status", "workflow run") !== PullRequestReader.COMPLETED)
      .map(t => GitHubJson.number(t, "id", "workflow run"));
  }

  private async readCommitDateAsync(revision: string): Promise<Date> {
    const commit = GitHubJson.child(GitHubJson.object(await this.api.readAsync(`/commits/${revision}`), "commit"), "commit", "commit");
    return GitHubJson.date(GitHubJson.child(commit, "committer", "commit.commit"), "date", "commit.commit.committer");
  }

  private async readChecksAsync(head: string): Promise<readonly PullRequestCheck[]> {
    const answer = GitHubJson.object(await this.api.readAsync(`/commits/${head}/check-runs?${PullRequestReader.PAGE}`), "check runs");
    return GitHubJson.children(answer, "check_runs", "check runs").map(t => new PullRequestCheck(
      GitHubJson.text(t, "name", "check run"),
      GitHubJson.nullableText(t, "conclusion", "check run"),
      GitHubJson.nullableDate(t, "started_at", "check run"),
      GitHubJson.nullableDate(t, "completed_at", "check run")));
  }

  private async readBuildRunsAsync(head: string): Promise<number> {
    const resource = `/actions/workflows/${PullRequestReader.BUILD_WORKFLOW}/runs?event=pull_request&head_sha=${head}&per_page=1`;
    return GitHubJson.number(GitHubJson.object(await this.api.readAsync(resource), "workflow runs"), "total_count", "workflow runs");
  }

  private async readApprovalAsync(number: number): Promise<boolean> {
    const decisions = new Map<string, string>();
    for (const [index, t] of (await this.api.readPagesAsync(`/pulls/${number}/reviews?${PullRequestReader.PAGE}`)).entries()) {
      const review = GitHubJson.object(t, `reviews[${index}]`);
      const state = GitHubJson.text(review, "state", "review");
      const user = GitHubJson.nullableChild(review, "user", "review");
      if (PullRequestReader.DECISIONS.includes(state))
        decisions.set(user === null ? PullRequestReader.NO_ONE : GitHubJson.text(user, "login", "review.user"), state);
    }
    const states = [...decisions.values()];
    return states.includes(PullRequestReader.APPROVED) && !states.includes(PullRequestReader.CHANGES_REQUESTED);
  }

  private async readAutoMergeHistoryAsync(number: number): Promise<boolean> {
    const events = await this.api.readPagesAsync(`/issues/${number}/events?${PullRequestReader.PAGE}`);
    return events.some((t, index) => PullRequestReader.AUTO_MERGE_EVENTS.includes(GitHubJson.text(GitHubJson.object(t, `events[${index}]`), "event", "event")));
  }

  private async readNotesAsync(number: number): Promise<readonly PullRequestNote[]> {
    const notes: PullRequestNote[] = [];
    for (const [index, t] of (await this.api.readPagesAsync(`/issues/${number}/comments?${PullRequestReader.PAGE}`)).entries()) {
      const comment = GitHubJson.object(t, `comments[${index}]`);
      const user = GitHubJson.nullableChild(comment, "user", "comment");
      const note = user !== null && GitHubJson.text(user, "login", "comment.user") === PullRequestReader.NOTE_AUTHOR
        ? PullRequestNote.parse(GitHubJson.number(comment, "id", "comment"), GitHubJson.text(comment, "body", "comment"))
        : null;
      if (note !== null)
        notes.push(note);
    }
    return notes;
  }
}
