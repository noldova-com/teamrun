/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ProcessException from "../processes/process.exception.ts";
import type GitHubApi from "../repository/github-api.ts";
import GitHubException from "../repository/github.exception.ts";
import type IWait from "./interfaces/wait.ts";
import type MergeConflictReader from "./merge-conflict.reader.ts";
import type OpenPullRequest from "./open-pull-request.ts";
import type PullRequestEvaluator from "./pull-request-evaluator.ts";
import PullRequestFinding from "./pull-request-finding.ts";
import PullRequestNote from "./pull-request-note.ts";
import type PullRequestSnapshot from "./pull-request-snapshot.ts";
import PullRequestState from "./pull-request-state.ts";
import type PullRequestReader from "./pull-request.reader.ts";
import RunCancellation from "./run-cancellation.ts";
import type WatchedRepository from "./watched-repository.ts";

export default class PullRequestWatcher {
  private static readonly NO_PULL_REQUESTS: string = "- No open pull requests.";
  private static readonly NOTHING_TO_DO: string = "nothing to do";
  private static readonly MERGE_STATE_UNKNOWN: string = "merge state still unknown";
  private static readonly MERGE_STATE_READS: number = 6;
  private static readonly MERGE_STATE_INTERVAL: number = 10_000;
  private static readonly RUN_COMPLETED: number = 409;

  private readonly api: GitHubApi;
  private readonly reader: PullRequestReader;
  private readonly evaluator: PullRequestEvaluator;
  private readonly conflicts: MergeConflictReader;
  private readonly clock: () => number;
  private readonly wait: IWait;

  public constructor(api: GitHubApi, reader: PullRequestReader, evaluator: PullRequestEvaluator, conflicts: MergeConflictReader, clock: () => number, wait: IWait) {
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
    for (const pull of await this.readStatesAsync(repository, await this.reader.listOpenAsync()))
      lines.push(typeof pull === "string" ? pull : await this.watchPullRequestAsync(repository, pull, now));
    return lines.length === 0 ? [PullRequestWatcher.NO_PULL_REQUESTS] : lines;
  }

  private static describeSkip(repository: WatchedRepository, open: OpenPullRequest): string | null {
    if (open.isDraft)
      return `- #${open.number}: skipped, a draft`;
    return open.base === repository.defaultBranch ? null : `- #${open.number}: skipped, based on ${open.base}`;
  }

  private static isWaiting(pull: string | PullRequestState): pull is PullRequestState {
    return pull instanceof PullRequestState && !pull.isMergeStateKnown;
  }

  private async readStatesAsync(repository: WatchedRepository, opens: readonly OpenPullRequest[]): Promise<readonly (string | PullRequestState)[]> {
    const pulls: (string | PullRequestState)[] = [];
    for (const open of opens)
      pulls.push(PullRequestWatcher.describeSkip(repository, open) ?? await this.reader.readStateAsync(open.number));
    for (let read = 1; read < PullRequestWatcher.MERGE_STATE_READS && pulls.some(t => PullRequestWatcher.isWaiting(t)); read++) {
      await this.wait(PullRequestWatcher.MERGE_STATE_INTERVAL);
      for (const [index, pull] of pulls.entries())
        if (PullRequestWatcher.isWaiting(pull))
          pulls[index] = await this.reader.readStateAsync(pull.number);
    }
    return pulls;
  }

  private async watchPullRequestAsync(repository: WatchedRepository, state: PullRequestState, now: Date): Promise<string> {
    const pull = await this.reader.readAsync(state);
    const cancellation = pull.isConflicted ? await this.cancelBuildRunsAsync(repository, pull) : null;
    const outcomes = [...state.isMergeStateKnown ? [] : [PullRequestWatcher.MERGE_STATE_UNKNOWN], ...cancellation === null ? [] : [cancellation]];
    const isCancelNoted = cancellation !== null || pull.notes.some(t => t.matches(RunCancellation.KIND, pull.head));
    const findings = this.evaluator.evaluate(repository, pull);
    for (const finding of findings.filter(t => t.isDue(now) && !(isCancelNoted && t.kind === PullRequestFinding.CONFLICT))) {
      const isNoted = pull.notes.some(t => t.matches(finding.kind, pull.head));
      if (!isNoted)
        await this.api.writeAsync("POST", `/issues/${pull.number}/comments`, PullRequestNote.compose(finding, pull.head));
      outcomes.push(`${finding.kind} (${isNoted ? "already commented" : "commented"})`);
    }
    for (const note of pull.notes.filter(t => !t.isCleared && t.kind !== RunCancellation.KIND && !findings.some(f => t.matches(f.kind, pull.head)))) {
      await this.api.writeAsync("PATCH", `/issues/comments/${note.id}`, note.clearedBody);
      outcomes.push(`${note.kind} (cleared)`);
    }
    return `- #${pull.number}: ${outcomes.length === 0 ? PullRequestWatcher.NOTHING_TO_DO : outcomes.join(", ")}`;
  }

  private async cancelBuildRunsAsync(repository: WatchedRepository, pull: PullRequestSnapshot): Promise<string | null> {
    const runs = await this.reader.listActiveBuildRunsAsync(pull.head);
    if (runs.length === 0)
      return null;
    for (const run of runs)
      await this.cancelAsync(run);
    const isNoted = pull.notes.some(t => t.matches(RunCancellation.KIND, pull.head));
    if (!isNoted) {
      const cancellation = new RunCancellation(repository.defaultBranch, await this.readConflictFilesAsync(repository, pull), runs.length);
      await this.api.writeAsync("POST", `/issues/${pull.number}/comments`, PullRequestNote.compose(cancellation, pull.head));
    }
    return `${RunCancellation.KIND} (${RunCancellation.countRuns(runs.length)}, ${isNoted ? "already commented" : "commented"})`;
  }

  private async cancelAsync(run: number): Promise<void> {
    try {
      await this.api.postAsync(`/actions/runs/${run}/cancel`);
    }
    catch (error) {
      if (!(error instanceof GitHubException) || error.status !== PullRequestWatcher.RUN_COMPLETED)
        throw error;
    }
  }

  private async readConflictFilesAsync(repository: WatchedRepository, pull: PullRequestSnapshot): Promise<readonly string[] | null> {
    try {
      return await this.conflicts.readFilesAsync(repository.defaultBranch, pull.number);
    }
    catch (error) {
      if (!(error instanceof ProcessException))
        throw error;
      return null;
    }
  }
}
