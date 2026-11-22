/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";
import type { Conversation, Message, MessageIdParams, MessageSender, MessageSendParams, MessageSendResult, ProviderMode, RequestedSettings,
  Teammate } from "@noldova/teamrun.protocol";

import type { ReplyMode } from "../models/reply-mode.js";
import type { ReplyWork } from "../models/reply-work.js";
import type { SendAllowance } from "../models/send-allowance.js";
import type { WorkFolder } from "../models/work-folder.js";

export interface IEngineCallbacks {
  requireConversationAsync(id: string, transaction?: SqlTransaction): Promise<Conversation>;
  requireTeammateAsync(id: string, transaction?: SqlTransaction): Promise<Teammate>;
  capEndsTasksAsync(teammate: Teammate, chatId: string): Promise<boolean>;
  sendMessageAsync(params: MessageSendParams, prompt: string | null, allowed: SendAllowance | null, signal: AbortSignal | undefined,
    outside?: MessageSender | null): Promise<MessageSendResult>;
  refuseRaisedModeAsync(params: MessageSendParams): Promise<void>;
  toolModeOfAsync(open: ReplyMode): Promise<ProviderMode | null>;
  modeIn(requested: RequestedSettings): ProviderMode | null;
  nameOf(reply: Message): string;
  cancelAsync(params: MessageIdParams): Promise<Message>;
  startedRequestedAsync(reply: Message, transaction?: SqlTransaction): Promise<RequestedSettings>;
  requireMessageAsync(messageId: string, transaction?: SqlTransaction): Promise<Message>;
  sendWaitingAsync(chatId: string): Promise<void>;
  findGroup(conversationId: string): ReplyWork[] | null;
  requireWorkFolderAsync(conversation: Conversation, prepare: boolean, transaction?: SqlTransaction): Promise<WorkFolder>;
  stopAsync(item: ReplyWork): Promise<void>;
  isIdleAsync(chatId: string, held?: boolean): Promise<boolean>;
  beginSending(chatId: string): boolean;
  endSending(chatId: string): void;
  track(chatId: string, work: Promise<void>): void;
  settleSafelyAsync(conversationId: string, settleAsync: () => Promise<void>): Promise<void>;
}
