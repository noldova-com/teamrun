/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { TeammateMention } from "../models/teammate-mention.js";
import { MentionSpan } from "../models/mention-span.js";
import { Resources } from "../resources.js";
import { TeammateName } from "./teammate-name.js";

export class MentionResolver {
  public static resolve(text: string, available: readonly TeammateMention[]): readonly TeammateMention[] {
    const result = new Map<string, TeammateMention>();
    for (const span of MentionResolver.find(text, available))
      if (!result.has(span.mention.teammateId))
        result.set(span.mention.teammateId, span.mention);
    return [...result.values()];
  }

  public static find(text: string, available: readonly TeammateMention[]): readonly MentionSpan[] {
    const names = new Map(available.map(t => [TeammateName.key(t.name), t]));
    const result: MentionSpan[] = [];
    const candidate = new RegExp(Resources.mentionCandidatePattern.source, Resources.mentionCandidatePattern.flags);
    for (let index = 0; index < text.length;) {
      const character = text[index];
      if (character === Resources.mentionEscape) {
        index += 2;
        continue;
      }
      if (character === Resources.mentionBacktick || character === Resources.mentionTilde) {
        let end = index + 1;
        while (text[end] === character)
          end++;
        if (character === Resources.mentionBacktick || end - index >= Resources.mentionFenceLength) {
          index = MentionResolver.afterCode(text, index, end);
          continue;
        }
      }
      if (character === Resources.mentionMarker) {
        candidate.lastIndex = index;
        const match = candidate.exec(text);
        if (!Object.isNull(match)) {
          const teammate = names.get(TeammateName.key(match[1]!));
          if (!Object.isUndefined(teammate))
            result.push(new MentionSpan(teammate, index, index + match[0].length));
          index += match[0].length;
          continue;
        }
      }
      index++;
    }
    return result;
  }

  private static afterCode(text: string, start: number, end: number): number {
    const delimiter = text.slice(start, end);
    let next = text.indexOf(delimiter, end);
    while (next >= 0) {
      let close = next + delimiter.length;
      while (text[close] === delimiter[0])
        close++;
      if (delimiter.length >= Resources.mentionFenceLength || close - next === delimiter.length)
        return close;
      next = text.indexOf(delimiter, close);
    }
    return text.length;
  }
}
