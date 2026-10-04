/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type GitHubApi from "../repository/github-api.ts";
import type OpenPullRequest from "./open-pull-request.ts";
import type PullRequestEvaluator from "./pull-request-evaluator.ts";
import PullRequestNote from "./pull-request-note.ts";
import type PullRequestReader from "./pull-request.reader.ts";
import type WatchedRepository from "./watched-repository.ts";

export default class PullRequestWatcher {
  private static readonly NO_PULL_REQUESTS: string = "- No open pull requests.";
  private static readonly NOTHING_TO_DO: string = "nothing to do";

  private readonly api: GitHubApi;
  private readonly reader: PullRequestReader;
  private readonly evaluator: PullRequestEvaluator;
  private readonly clock: () => number;

  public constructor(api: GitHubApi, reader: PullRequestReader, evaluator: PullRequestEvaluator, clock: () => number) {
    this.api = api;
    this.reader = reader;
    this.evaluator = evaluator;
    this.clock = clock;
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

    const pull = await this.reader.readAsync(open);
    const findings = this.evaluator.evaluate(repository, pull);
    const outcomes: string[] = [];
    for (const finding of findings.filter(t => t.isDue(now))) {
      const isKnown = pull.notes.some(t => t.matches(finding.kind, pull.head));
      if (!isKnown)
        await this.api.writeAsync("POST", `/issues/${pull.number}/comments`, PullRequestNote.compose(finding, pull.head));
      outcomes.push(`${finding.kind} (${isKnown ? "already commented" : "commented"})`);
    }
    for (const note of pull.notes.filter(t => !t.isCleared && !findings.some(f => t.matches(f.kind, pull.head)))) {
      await this.api.writeAsync("PATCH", `/issues/comments/${note.id}`, note.clearedBody);
      outcomes.push(`${note.kind} (cleared)`);
    }
    return `- #${pull.number}: ${outcomes.length === 0 ? PullRequestWatcher.NOTHING_TO_DO : outcomes.join(", ")}`;
  }
}
