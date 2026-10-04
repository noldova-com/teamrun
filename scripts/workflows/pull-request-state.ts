/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class PullRequestState {
  private static readonly UNKNOWN: string = "unknown";

  public readonly number: number;
  public readonly head: string;
  public readonly mergeState: string;
  public readonly hasAutoMerge: boolean;

  public constructor(number: number, head: string, mergeState: string, hasAutoMerge: boolean) {
    this.number = number;
    this.head = head;
    this.mergeState = mergeState;
    this.hasAutoMerge = hasAutoMerge;
  }

  public get isMergeStateKnown(): boolean {
    return this.mergeState !== PullRequestState.UNKNOWN;
  }
}
