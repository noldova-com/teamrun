/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SqlTransaction } from "@noldova/context.data.sql";
import type {
  ChatFindParams,
  ChatFindResult,
  ChatFolderAttachParams,
  ChatMemberModeParams,
  ChatMemberSettingsParams,
  ChatPlanFirstParams,
  Conversation,
  ConversationMember,
  ConversationMemberParams,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationListParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationResponderParams,
  ConversationSearchParams,
  ConversationSearchResult,
  ForkedSession,
  Message,
  MessageSearchResult,
  RunOutput
} from "@noldova/teamrun.protocol";

import type { FolderState } from "../enums/folder-state.js";

export interface IConversationsService {
  listMembersAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<readonly ConversationMember[]>;
  addMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<ConversationMember>;
  removeMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<void>;
  findMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<ConversationMember | null>;
  setMemberSessionAsync(params: ConversationMemberParams, nativeSessionId: string | null, resumedNativeSession: boolean, sessionProviderId?: string | null,
    transaction?: SqlTransaction): Promise<ConversationMember>;
  setMemberModeAsync(params: ChatMemberModeParams, transaction?: SqlTransaction): Promise<ConversationMember>;
  setMemberSettingsAsync(params: ChatMemberSettingsParams, transaction?: SqlTransaction): Promise<ConversationMember>;
  setPlanFirstAsync(params: ChatPlanFirstParams, transaction?: SqlTransaction): Promise<Conversation>;
  approvePlanAsync(chatId: string, teammateId: string | null, transaction?: SqlTransaction): Promise<Conversation>;
  reopenPlanAsync(chatId: string, teammateId: string | null, transaction?: SqlTransaction): Promise<Conversation>;
  resetTeammateSessionsAsync(teammateId: string, transaction?: SqlTransaction): Promise<void>;
  resetProviderSessionsAsync(providerId: string, transaction?: SqlTransaction): Promise<void>;
  removeTeammateMembersAsync(teammateId: string, transaction?: SqlTransaction): Promise<void>;
  listAsync(params: ConversationListParams, transaction?: SqlTransaction): Promise<readonly Conversation[]>;
  listRecentAsync(limit: number): Promise<readonly Conversation[]>;
  listEmptyAsync(params: ConversationListParams): Promise<readonly Conversation[]>;
  touchAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<Conversation>;
  setResponderAsync(params: ConversationResponderParams, transaction?: SqlTransaction): Promise<Conversation>;
  moveProviderlessAsync(providerOf: (kind: string) => string | null, transaction?: SqlTransaction): Promise<readonly Conversation[]>;
  findAsync(conversationId: string, transaction?: SqlTransaction): Promise<Conversation | null>;
  createAsync(params: ConversationCreateParams, transaction?: SqlTransaction): Promise<Conversation>;
  renameAsync(params: ConversationRenameParams, transaction?: SqlTransaction): Promise<Conversation>;
  giveTitleAsync(conversationId: string, title: string, transaction?: SqlTransaction): Promise<Conversation | null>;
  moveAsync(params: ConversationMoveParams): Promise<Conversation>;
  deleteAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<void>;
  countFolderFilesAsync(params: ConversationIdParams): Promise<number>;
  attachFolderAsync(params: ChatFolderAttachParams, check: (path: string) => Promise<FolderState>): Promise<Conversation>;
  detachFolderAsync(params: ConversationIdParams): Promise<Conversation>;
  removeFromAsync(conversationId: string, fromSequence: number, transaction?: SqlTransaction): Promise<readonly Message[]>;
  listRunOutputsAsync(params: ConversationIdParams): Promise<readonly RunOutput[]>;
  saveRunOutputAsync(output: RunOutput, transaction?: SqlTransaction): Promise<void>;
  setSessionResetAsync(conversationId: string, sessionReset: boolean, transaction?: SqlTransaction): Promise<Conversation>;
  setForkedSessionAsync(conversationId: string, forkedSession: ForkedSession | null, transaction?: SqlTransaction): Promise<Conversation>;
  searchAsync(params: ConversationSearchParams): Promise<ConversationSearchResult>;
  findChatsAsync(params: ChatFindParams): Promise<ChatFindResult>;
  searchMessagesAsync(params: ConversationSearchParams): Promise<MessageSearchResult>;
}
