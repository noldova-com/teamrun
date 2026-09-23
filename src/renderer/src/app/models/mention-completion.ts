/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MentionResolver, TeammateMention, TeammateName, type Teammate } from "@noldova/teamrun-protocol";
import { Resources } from "../resources";

export class MentionCompletion {
  public readonly start: number;
  public readonly end: number;
  public readonly choices: readonly Teammate[];

  private constructor(start: number, end: number, choices: readonly Teammate[]) {
    this.start = start;
    this.end = end;
    this.choices = choices;
  }

  public static at(text: string, caret: number, available: readonly Teammate[]): MentionCompletion | null {
    const prefix = text.slice(0, caret);
    const match = Resources.mentionQueryPattern.exec(prefix);
    if (Object.isNull(match))
      return null;
    const query = match[1]!;
    const start = caret - query.length - Resources.mentionPrefix.length;
    const choices = available.filter(t => TeammateName.key(t.name).startsWith(TeammateName.key(query)));
    const first = choices[0];
    if (Object.isUndefined(first))
      return null;
    const candidate = text.slice(0, start) + Resources.mentionPrefix + first.name;
    if (!MentionResolver.find(candidate, [new TeammateMention(first.id, first.name)]).some(t => t.start === start))
      return null;
    const tail = Resources.mentionTailPattern.exec(text.slice(caret))?.[0].length ?? 0;
    return new MentionCompletion(start, caret + tail, choices);
  }
}
