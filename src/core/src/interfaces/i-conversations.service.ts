/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Conversation,
  ConversationMember,
  ConversationMemberParams,
  ConversationCreateParams,
  ConversationIdParams,
  ConversationMoveParams,
  ConversationRenameParams,
  ConversationSearchParams,
  ConversationSearchResult,
  ForkedSession,
  Message,
  ProjectIdParams
} from "@noldova/teamrun-protocol";

export interface IConversationsService {
  listMembers(params: ConversationIdParams): readonly ConversationMember[];
  addMember(params: ConversationMemberParams): ConversationMember;
  removeMember(params: ConversationMemberParams): void;
  findMember(params: ConversationMemberParams): ConversationMember | null;
  setMemberSession(params: ConversationMemberParams, nativeSessionId: string | null, resumedNativeSession: boolean): ConversationMember;
  resetTeammateSessions(teammateId: string): void;
  removeTeammateMembers(teammateId: string): void;
  list(params: ProjectIdParams): readonly Conversation[];
  find(conversationId: string): Conversation | null;
  create(params: ConversationCreateParams): Conversation;
  rename(params: ConversationRenameParams): Conversation;
  move(params: ConversationMoveParams): Conversation;
  delete(params: ConversationIdParams): void;
  removeFrom(conversationId: string, fromSequence: number): readonly Message[];
  setSessionReset(conversationId: string, sessionReset: boolean): Conversation;
  setForkedSession(conversationId: string, forkedSession: ForkedSession | null): Conversation;
  search(params: ConversationSearchParams): ConversationSearchResult;
}
