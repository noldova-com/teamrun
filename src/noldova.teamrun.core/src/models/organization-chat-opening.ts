/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Conversation } from "@noldova/teamrun.protocol";

export class OrganizationChatOpening {
  public readonly conversation: Conversation;
  public readonly made: boolean;

  public constructor(conversation: Conversation, made: boolean) {
    this.conversation = conversation;
    this.made = made;
  }
}
