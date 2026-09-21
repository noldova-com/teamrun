/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Message, MessageListParams, MessagePage, MessagePageParams, ReplyPage, ReplyPanel } from "@noldova/teamrun-protocol";

export interface IMessagesService {
  list(params: MessageListParams): readonly Message[];
  page(params: MessagePageParams): MessagePage;
  replyPage(params: MessagePageParams, panel: ReplyPanel): ReplyPage;
  find(messageId: string): Message | null;
  findOpenReply(conversationId: string): Message | null;
  findResumableSession(conversationId: string, provider: string, accountId: string | null): string | null;
  listOpen(): readonly Message[];
  nextSequence(conversationId: string): number;
  insert(message: Message): void;
  update(message: Message): void;
}
