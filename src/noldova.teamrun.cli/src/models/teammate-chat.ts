/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Conversation } from "@noldova/teamrun.protocol";

export class TeammateChat {
  public readonly chat: Conversation;
  public readonly members: readonly string[];

  public constructor(chat: Conversation, members: readonly string[]) {
    this.chat = chat;
    this.members = members;
  }
}
