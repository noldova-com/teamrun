/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type PullRequestCheck from "./pull-request-check.ts";
import type PullRequestNote from "./pull-request-note.ts";

export default class PullRequestSnapshot {
  private static readonly CONFLICTED: string = "dirty";

  public readonly number: number;
  public readonly head: string;
  public readonly mergeState: string;
  public readonly hasAutoMerge: boolean;
  public readonly hadAutoMerge: boolean;
  public readonly isApproved: boolean;
  public readonly pushedAt: Date;
  public readonly buildRuns: number;
  public readonly checks: readonly PullRequestCheck[];
  public readonly notes: readonly PullRequestNote[];

  public constructor(
    number: number,
    head: string,
    mergeState: string,
    hasAutoMerge: boolean,
    hadAutoMerge: boolean,
    isApproved: boolean,
    pushedAt: Date,
    buildRuns: number,
    checks: readonly PullRequestCheck[],
    notes: readonly PullRequestNote[]) {
    this.number = number;
    this.head = head;
    this.mergeState = mergeState;
    this.hasAutoMerge = hasAutoMerge;
    this.hadAutoMerge = hadAutoMerge;
    this.isApproved = isApproved;
    this.pushedAt = pushedAt;
    this.buildRuns = buildRuns;
    this.checks = [...checks];
    this.notes = [...notes];
  }

  public get isConflicted(): boolean {
    return this.mergeState === PullRequestSnapshot.CONFLICTED;
  }
}
