/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";
import type { Message, MessageAttachment, MessageListParams, MessagePage, MessagePageParams, ReplyPage, ReplyPanel,
  TeammateLastReply, TeammateUsage } from "@noldova/teamrun.protocol";

export interface IMessagesService {
  listAsync(params: MessageListParams, transaction?: SqlTransaction): Promise<readonly Message[]>;
  listOutlinesAsync(conversationId: string, afterSequence: number | null, transaction?: SqlTransaction): Promise<readonly Message[]>;
  pageAsync(params: MessagePageParams, transaction?: SqlTransaction): Promise<MessagePage>;
  replyPageAsync(params: MessagePageParams, panel: ReplyPanel, transaction?: SqlTransaction): Promise<ReplyPage>;
  findAsync(messageId: string, transaction?: SqlTransaction): Promise<Message | null>;
  findOpenReplyAsync(conversationId: string, transaction?: SqlTransaction): Promise<Message | null>;
  findResumableSessionAsync(conversationId: string, kind: string, providerId: string | null, transaction?: SqlTransaction): Promise<string | null>;
  findWindowTokensAsync(providerId: string, model: string | null, transaction?: SqlTransaction): Promise<number | null>;
  findAttachmentAsync(conversationId: string, path: string, transaction?: SqlTransaction): Promise<MessageAttachment | null>;
  findCheckpointAsync(messageId: string, transaction?: SqlTransaction): Promise<string | null>;
  findCheckpointFolderAsync(messageId: string, transaction?: SqlTransaction): Promise<string | null>;
  listRepliesToAsync(sent: Message): Promise<readonly Message[]>;
  listTeammateUsageAsync(): Promise<readonly TeammateUsage[]>;
  listTeammateLastRepliesAsync(): Promise<readonly TeammateLastReply[]>;
  listOpenAsync(transaction?: SqlTransaction): Promise<readonly Message[]>;
  listWithRunningSubAgentsAsync(transaction?: SqlTransaction): Promise<readonly Message[]>;
  nextSequenceAsync(conversationId: string, transaction?: SqlTransaction): Promise<number>;
  insertAsync(message: Message, transaction?: SqlTransaction): Promise<void>;
  updateAsync(message: Message, transaction?: SqlTransaction): Promise<void>;
  setCheckpointAsync(messageId: string, checkpointId: string, transaction?: SqlTransaction): Promise<void>;
  setCheckpointFolderAsync(messageId: string, folderId: string, transaction?: SqlTransaction): Promise<void>;
}
