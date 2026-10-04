/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class PullRequestCheck {
  private static readonly FAILED: readonly (string | null)[] = ["failure", "timed_out", "startup_failure", "cancelled"];
  private static readonly PASSED: readonly (string | null)[] = ["success", "neutral", "skipped"];

  public readonly name: string;
  public readonly conclusion: string | null;
  public readonly startedTime: number | null;
  public readonly finishedTime: number;

  public constructor(name: string, conclusion: string | null, startedAt: Date | null, completedAt: Date | null) {
    this.name = name;
    this.conclusion = conclusion;
    this.startedTime = startedAt?.getTime() ?? null;
    this.finishedTime = completedAt?.getTime() ?? 0;
  }

  public get hasFailed(): boolean {
    return PullRequestCheck.FAILED.includes(this.conclusion);
  }

  public get hasPassed(): boolean {
    return PullRequestCheck.PASSED.includes(this.conclusion);
  }
}
