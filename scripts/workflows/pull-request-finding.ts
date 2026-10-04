/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type IPullRequestComment from "./interfaces/pull-request-comment.ts";

export default class PullRequestFinding implements IPullRequestComment {
  public static readonly NO_BUILD: string = "no-build";
  public static readonly CONFLICT: string = "conflict";
  public static readonly FAILED: string = "failed";
  public static readonly NOT_MERGING: string = "not-merging";

  private static readonly MINUTE: number = 60_000;
  private static readonly REVISION_LENGTH: number = 7;
  private static readonly NO_BUILD_MINUTES: number = 10;
  private static readonly CONFLICT_MINUTES: number = 20;
  private static readonly FAILED_MINUTES: number = 30;
  private static readonly NOT_MERGING_MINUTES: number = 15;

  private readonly minutes: number;

  public readonly kind: string;
  public readonly since: Date;
  public readonly text: string;

  private constructor(kind: string, since: Date, minutes: number, text: string) {
    this.kind = kind;
    this.since = since;
    this.minutes = minutes;
    this.text = text;
  }

  public static noBuild(since: Date, head: string): PullRequestFinding {
    const minutes = PullRequestFinding.NO_BUILD_MINUTES;
    return new PullRequestFinding(PullRequestFinding.NO_BUILD, since, minutes,
      `No "Build and test" run has started for ${head.slice(0, PullRequestFinding.REVISION_LENGTH)} in the more than ${minutes} minutes since it was pushed, `
      + "so the required checks cannot pass. This workflow cannot start a run itself. "
      + "Push again, for example with `git commit --allow-empty -m \"Start the checks\"`, or close and reopen the pull request.");
  }

  public static conflict(since: Date, defaultBranch: string): PullRequestFinding {
    const minutes = PullRequestFinding.CONFLICT_MINUTES;
    return new PullRequestFinding(PullRequestFinding.CONFLICT, since, minutes,
      `This pull request has conflicted with \`${defaultBranch}\` for more than ${minutes} minutes. `
      + `Merge or rebase \`${defaultBranch}\` into the branch, resolve the conflicts and push.`);
  }

  public static failed(since: Date, checks: readonly string[]): PullRequestFinding {
    const minutes = PullRequestFinding.FAILED_MINUTES;
    return new PullRequestFinding(PullRequestFinding.FAILED, since, minutes,
      `The required ${checks.map(t => `"${t}"`).join(", ")} failed more than ${minutes} minutes ago and nothing has been pushed since. `
      + "Fix the failure and push. If a known flaky test caused it, comment on that test's issue and rerun the failed job once.");
  }

  public static notMerging(since: Date): PullRequestFinding {
    const minutes = PullRequestFinding.NOT_MERGING_MINUTES;
    return new PullRequestFinding(PullRequestFinding.NOT_MERGING, since, minutes,
      `Every required check passed more than ${minutes} minutes ago and auto-merge is off. `
      + "A reviewer merges the pull request or turns on auto-merge; if you are waiting for that, ask the reviewer.");
  }

  public isDue(now: Date): boolean {
    return now.getTime() - this.since.getTime() >= this.minutes * PullRequestFinding.MINUTE;
  }
}
