/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import type { Teammate } from "@noldova/teamrun.protocol";
import { type IMentionCandidateOptions, MentionCandidate } from "@noldova/ui.components.angular";

export class TeammateCandidates {
  private readonly create: (teammate: Teammate, options: IMentionCandidateOptions) => MentionCandidate;

  public constructor(create: (teammate: Teammate, options: IMentionCandidateOptions) => MentionCandidate = (t, u) => new MentionCandidate(t.id, t.name, u)) {
    this.create = create;
  }

  public of(teammates: readonly Teammate[], optionsOf: (teammate: Teammate) => IMentionCandidateOptions): readonly MentionCandidate[] {
    const candidates: MentionCandidate[] = [];
    for (const teammate of teammates) {
      try {
        candidates.push(this.create(teammate, optionsOf(teammate)));
      }
      catch (error) {
        if (!(error instanceof ArgumentException))
          throw error;
      }
    }
    return candidates;
  }
}
