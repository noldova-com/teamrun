/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import type {
  AttachmentContent,
  AttachmentInput,
  AttachmentReadParams,
  Draft,
  MessageAttachment,
  Approval,
  BackgroundTask,
  ApprovalDecideParams,
  Conversation,
  CommandStartParams,
  ConversationIdParams,
  ConversationResponderParams,
  ConversationRewindParams,
  ConversationRewindResult,
  LinkedPaths,
  Message,
  MessageIdParams,
  MessageSendParams,
  MessageSendResult,
  McpToolCallParams,
  McpToolListParams,
  SubAgent,
  SubAgentStartParams,
  SubAgentStopParams,
  SubAgentWaitParams,
  SubAgentWaitResult,
  ChatIdParams,
  WaitingMessage,
  WaitingMessageAddParams,
  WaitingMessageEditParams,
  WaitingMessageIdParams,
  WaitingMessagesPayload,
  WrittenImageReadParams
} from "@noldova/teamrun.protocol";

import type { IOpenedFile } from "./i-opened-file.js";

export interface IConversationEngine {
  prepareAttachment(input: AttachmentInput): MessageAttachment;
  prepareOpenedAttachmentAsync(input: AttachmentInput, source: IOpenedFile): Promise<MessageAttachment>;
  discardAttachment(attachment: MessageAttachment): void;
  readAttachmentAsync(params: AttachmentReadParams, draft: Draft | null): Promise<AttachmentContent>;
  locateAttachmentAsync(params: AttachmentReadParams, draft: Draft | null): Promise<MessageAttachment>;
  hasAttachmentAsync(params: AttachmentReadParams): Promise<boolean>;
  listLinkedFolders(params: LinkedPaths): Promise<LinkedPaths>;
  readWrittenImageAsync(params: WrittenImageReadParams): Promise<AttachmentContent>;
  locateWrittenImageAsync(params: WrittenImageReadParams): Promise<MessageAttachment>;
  sendAsync(params: MessageSendParams, signal?: AbortSignal): Promise<MessageSendResult>;
  cancelAsync(params: MessageIdParams): Promise<Message>;
  approvePlanAsync(params: MessageIdParams): Promise<MessageSendResult>;
  cancelConversationAsync(params: ConversationIdParams): Promise<readonly Message[]>;
  addWaitingAsync(params: WaitingMessageAddParams): Promise<WaitingMessage>;
  listWaitingAsync(params: ChatIdParams): Promise<WaitingMessagesPayload>;
  editWaitingAsync(params: WaitingMessageEditParams): Promise<WaitingMessage>;
  removeWaitingAsync(params: WaitingMessageIdParams): Promise<void>;
  sendWaitingNowAsync(params: WaitingMessageIdParams): Promise<WaitingMessage>;
  setResponderAsync(params: ConversationResponderParams): Promise<Conversation>;
  forgetAsync(conversationIds: readonly string[]): Promise<void>;
  forgetTeammate(teammateId: string, conversationId: string | null): void;
  planFirstAsync(conversationId: string): Promise<void>;
  decideAsync(params: ApprovalDecideParams): Promise<Approval>;
  rewindAsync(params: ConversationRewindParams): Promise<ConversationRewindResult>;
  releaseFolderAsync(conversationId: string): Promise<void>;
  sweepFoldersAsync(): Promise<void>;
  listMcpToolsAsync(params: McpToolListParams, signal?: AbortSignal): Promise<readonly JsonObject[]>;
  callMcpToolAsync(params: McpToolCallParams, signal?: AbortSignal): Promise<JsonObject>;
  startSubAgentAsync(params: SubAgentStartParams): Promise<SubAgent>;
  waitSubAgents(params: SubAgentWaitParams): Promise<SubAgentWaitResult>;
  stopSubAgent(params: SubAgentStopParams): Promise<SubAgent>;
  startCommandAsync(params: CommandStartParams): Promise<BackgroundTask>;
}
