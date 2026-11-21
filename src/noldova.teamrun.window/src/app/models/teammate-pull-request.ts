/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CheckState, HostItem, ReviewDecision } from "@noldova/git.hosting.protocol";

export class TeammatePullRequest {
  public readonly folder: string;
  public readonly pullRequest: HostItem;
  public readonly checksState: CheckState | null;
  public readonly reviewDecision: ReviewDecision;

  public constructor(folder: string, pullRequest: HostItem, checksState: CheckState | null, reviewDecision: ReviewDecision) {
    this.folder = folder;
    this.pullRequest = pullRequest;
    this.checksState = checksState;
    this.reviewDecision = reviewDecision;
  }
}
