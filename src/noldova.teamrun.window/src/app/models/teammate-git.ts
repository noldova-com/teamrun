/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { GitStatus } from "@noldova/git.protocol";

import { TeammateSourceState } from "../enums/teammate-source-state";

export class TeammateGit {
  public static readonly reading: TeammateGit = new TeammateGit(TeammateSourceState.Reading, null, null);

  public readonly state: TeammateSourceState;
  public readonly folder: string | null;
  public readonly status: GitStatus | null;
  public readonly failure: string;

  public constructor(state: TeammateSourceState, folder: string | null, status: GitStatus | null, failure: string = "") {
    this.state = state;
    this.folder = folder;
    this.status = status;
    this.failure = failure;
  }

  public get changes(): number {
    return this.status?.entries.length ?? 0;
  }
}
