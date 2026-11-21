/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TeammateSourceState } from "../enums/teammate-source-state";
import type { TeammatePullRequest } from "./teammate-pull-request";

export class TeammatePullRequests {
  public static readonly reading: TeammatePullRequests = new TeammatePullRequests(TeammateSourceState.Reading, [], null);

  public readonly state: TeammateSourceState;
  public readonly items: readonly TeammatePullRequest[];
  public readonly failure: string | null;

  public constructor(state: TeammateSourceState, items: readonly TeammatePullRequest[], failure: string | null) {
    this.state = state;
    this.items = [...items];
    this.failure = failure;
  }
}
