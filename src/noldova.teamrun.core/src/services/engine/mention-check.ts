/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { MentionResolver, type TeammateMention } from "@noldova/teamrun.protocol";

export class MentionCheck {
  public static matches(text: string, mentionedIds: readonly string[], available: readonly TeammateMention[], isTeammateText: boolean): boolean {
    const resolved = isTeammateText ? MentionResolver.resolveTeammateText(text, available) : MentionResolver.resolve(text, available);
    const mentioned = [...new Set(mentionedIds)];
    return resolved.length === mentioned.length && resolved.every((t, index) => t.teammateId === mentioned[index]);
  }
}
