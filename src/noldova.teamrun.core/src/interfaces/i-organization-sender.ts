/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message, MessageIdParams, MessageSendResult, OrganizationChat } from "@noldova/teamrun.protocol";

export interface IOrganizationSender {
  startAsPersonAsync(chat: OrganizationChat, text: string, prompt: string): Promise<MessageSendResult>;
  cancelAsync(params: MessageIdParams): Promise<Message>;
}
