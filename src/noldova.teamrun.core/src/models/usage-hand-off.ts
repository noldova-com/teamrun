/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ConversationMemberParams } from "@noldova/teamrun.protocol";

import type { ReplyWork } from "./reply-work.js";

export class UsageHandOff {
  public readonly next: ReplyWork | null;
  public readonly member: ConversationMemberParams | null;

  public constructor(next: ReplyWork | null, member: ConversationMemberParams | null) {
    this.next = next;
    this.member = member;
  }
}
