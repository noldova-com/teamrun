/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type GitHubApi from "../repository/github-api.ts";
import type MergeConflictReader from "./merge-conflict.reader.ts";
import type OpenPullRequest from "./open-pull-request.ts";
import type PullRequestEvaluator from "./pull-request-evaluator.ts";
import PullRequestFinding from "./pull-request-finding.ts";
import PullRequestNote from "./pull-request-note.ts";
import type PullRequestSnapshot from "./pull-request-snapshot.ts";
import type PullRequestReader from "./pull-request.reader.ts";
import type WatchedRepository from "./watched-repository.ts";

export default class PullRequestWatcher {
  private static readonly NO_PULL_REQUESTS: string = "- No open pull requests.";
  private static readonly NOTHING_TO_DO: string = "nothing to do";
  private static readonly UNKNOWN_MERGE_STATE: string = "unknown";
  private static readonly MERGE_STATE_READS: number = 6;
  private static readonly MERGE_STATE_INTERVAL: number = 10_000;

  private readonly api: GitHubApi;
  private readonly reader: PullRequestReader;
  private readonly evaluator: PullRequestEvaluator;
  private readonly conflicts: MergeConflictReader;
  private readonly clock: () => number;
  private readonly wait: (milliseconds: number) => Promise<void>;

  public constructor(api: GitHubApi, reader: PullRequestReader, evaluator: PullRequestEvaluator, conflicts: MergeConflictReader,
    clock: () => number, wait: (milliseconds: number) => Promise<void>) {
    this.api = api;
    this.reader = reader;
    this.evaluator = evaluator;
    this.conflicts = conflicts;
    this.clock = clock;
    this.wait = wait;
  }

  public async watchAsync(): Promise<readonly string[]> {
    const repository = await this.reader.readRepositoryAsync();
    const now = new Date(this.clock());
    const lines: string[] = [];
    for (const open of await this.reader.listOpenAsync())
      lines.push(await this.watchPullRequestAsync(repository, open, now));
    return lines.length === 0 ? [PullRequestWatcher.NO_PULL_REQUESTS] : lines;
  }

  private async watchPullRequestAsync(repository: WatchedRepository, open: OpenPullRequest, now: Date): Promise<string> {
    if (open.isDraft)
      return `- #${open.number}: skipped, a draft`;
    if (open.base !== repository.defaultBranch)
      return `- #${open.number}: skipped, based on ${open.base}`;

    const isKnown = await this.waitForMergeStateAsync(open);
    const pull = await this.reader.readAsync(open);
    const outcomes: string[] = isKnown ? [] : [`merge state still ${PullRequestWatcher.UNKNOWN_MERGE_STATE}`];
    if (pull.isConflicted)
      outcomes.push(...await this.cancelBuildRunsAsync(repository, pull, now));
    const findings = this.evaluator.evaluate(repository, pull);
    for (const finding of findings.filter(t => t.isDue(now))) {
      const isNoted = pull.notes.some(t => t.matches(finding.kind, pull.head));
      if (!isNoted)
        await this.api.writeAsync("POST", `/issues/${pull.number}/comments`, PullRequestNote.compose(finding, pull.head));
      outcomes.push(`${finding.kind} (${isNoted ? "already commented" : "commented"})`);
    }
    for (const note of pull.notes.filter(t => !t.isCleared && t.kind !== PullRequestFinding.CANCELLED && !findings.some(f => t.matches(f.kind, pull.head)))) {
      await this.api.writeAsync("PATCH", `/issues/comments/${note.id}`, note.clearedBody);
      outcomes.push(`${note.kind} (cleared)`);
    }
    return `- #${pull.number}: ${outcomes.length === 0 ? PullRequestWatcher.NOTHING_TO_DO : outcomes.join(", ")}`;
  }

  private async waitForMergeStateAsync(open: OpenPullRequest): Promise<boolean> {
    for (let read = 1; read < PullRequestWatcher.MERGE_STATE_READS; read++) {
      if (await this.reader.readMergeStateAsync(open) !== PullRequestWatcher.UNKNOWN_MERGE_STATE)
        return true;
      await this.wait(PullRequestWatcher.MERGE_STATE_INTERVAL);
    }
    return await this.reader.readMergeStateAsync(open) !== PullRequestWatcher.UNKNOWN_MERGE_STATE;
  }

  private async cancelBuildRunsAsync(repository: WatchedRepository, pull: PullRequestSnapshot, now: Date): Promise<readonly string[]> {
    const runs = await this.reader.listActiveBuildRunsAsync(pull.head);
    if (runs.length === 0)
      return [];
    for (const run of runs)
      await this.api.postAsync(`/actions/runs/${run}/cancel`);
    const isNoted = pull.notes.some(t => t.matches(PullRequestFinding.CANCELLED, pull.head));
    if (!isNoted) {
      const files = await this.conflicts.readFilesAsync(repository.defaultBranch, pull.number);
      await this.api.writeAsync("POST", `/issues/${pull.number}/comments`, PullRequestNote.compose(PullRequestFinding.cancelled(now, repository.defaultBranch, files, runs.length), pull.head));
    }
    return [`${PullRequestFinding.CANCELLED} (${PullRequestFinding.countRuns(runs.length)}, ${isNoted ? "already commented" : "commented"})`];
  }
}
