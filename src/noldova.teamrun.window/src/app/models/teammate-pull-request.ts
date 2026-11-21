/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { CheckState, HostItem } from "@noldova/git.hosting.protocol";

export class TeammatePullRequest {
  public readonly folder: string;
  public readonly pullRequest: HostItem;
  public readonly checksState: CheckState | null;

  public constructor(folder: string, pullRequest: HostItem, checksState: CheckState | null) {
    this.folder = folder;
    this.pullRequest = pullRequest;
    this.checksState = checksState;
  }
}
