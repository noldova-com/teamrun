/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message } from "@noldova/teamrun.protocol";
import type { MessageAuthor, MessageBlock, MessageStatus } from "@noldova/ui.components.angular";

export interface IOrganizationReplyEntry {
  readonly reply: Message;
  readonly author: MessageAuthor;
  readonly blocks: readonly MessageBlock[];
  readonly status: MessageStatus;
}
