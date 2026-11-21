/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { isAbsolute, resolve } from "node:path";
import "@noldova/context.core";
import { ChangeOperation, type DataRecord } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import {
  Approval,
  ChatFindHit,
  type ChatFindParams,
  ChatFindResult,
  type ChatFolderAttachParams,
  type ChatMemberModeParams,
  type ChatMemberSettingsParams,
  type ChatPlanFirstParams,
  Conversation,
  ConversationMember,
  ConversationMemberParams,
  type ConversationCreateParams,
  ConversationIdParams,
  type ConversationListParams,
  type ConversationMoveParams,
  type ConversationRenameParams,
  ConversationResponder,
  type ConversationResponderParams,
  ConversationSearchHit,
  ConversationSearchParams,
  ConversationSearchResult,
  DetailKind,
  ErrorCode,
  ForkedSession,
  Message,
  type OrganizationChat,
  MessageSearchHit,
  MessageSearchResult,
  Project,
  Provider,
  RunOutput
} from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import { FolderState } from "../../enums/folder-state.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IDraftsService } from "../../interfaces/i-drafts.service.js";
import type { ILog } from "../../interfaces/i-log.js";
import { Guid } from "../../models/guid.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import { ChatFolders } from "./chat-folders.js";

export class ConversationsService implements IConversationsService {
  private readonly context: DatabaseContext;
  private readonly drafts: IDraftsService | null;
  private readonly log: ILog | null;

  public constructor(context: DatabaseContext, drafts: IDraftsService | null = null, log: ILog | null = null) {
    this.context = context;
    this.drafts = drafts;
    this.log = log;
  }

  public async listAsync(params: ConversationListParams, transaction?: SqlTransaction): Promise<readonly Conversation[]> {
    const records = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectConversationsByProject, [params.projectId]));
    return records.map(t => this.read(t));
  }

  public async listRecentAsync(limit: number): Promise<readonly Conversation[]> {
    return (await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectRecentConversations, [limit]))).map(t => this.read(t));
  }

  public listEmptyAsync(params: ConversationListParams): Promise<readonly Conversation[]> {
    return this.context.database.connection.runInTransactionAsync(async transaction => {
      const records = await transaction.queryAsync(new SqlQuery(Resources.selectConversationsWithoutMessagesByProject, [params.projectId]));
      const empty: Conversation[] = [];
      for (const conversation of records.map(t => this.read(t))) {
        if (conversation.edited)
          continue;
        const draft = (await this.drafts?.readAsync(new ConversationIdParams(conversation.id), transaction)) ?? null;
        if (Object.isNull(draft) || (String.isNullOrWhitespace(draft.text) && draft.attachments.length === 0 && draft.missing.length === 0))
          empty.push(conversation);
      }
      return empty;
    });
  }

  public async findAsync(conversationId: string, transaction?: SqlTransaction): Promise<Conversation | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectConversationById, [conversationId]));
    if (Object.isUndefined(record))
      return null;

    return this.read(record);
  }

  public async findOrganizationChatAsync(chat: OrganizationChat, transaction: SqlTransaction): Promise<Conversation | null> {
    const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectOrganizationChat,
      [chat.organizationId, chat.teammateId]));
    return Object.isUndefined(record) ? null : this.read(record);
  }

  public async createAsync(params: ConversationCreateParams, transaction?: SqlTransaction, organizationChat: OrganizationChat | null = null): Promise<Conversation> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.createAsync(params, t, organizationChat));
    if (!Object.isNull(params.projectId))
      await this.requireProjectAsync(params.projectId, transaction);
    const now = new Date().toISOString();
    const title = Object.isNull(params.title) ? Resources.defaultConversationTitle : params.title;
    const id = Guid.createVersion7().toString();
    const folder = Object.isNull(params.projectId) ? this.context.chatFolders.prepare(id) : null;
    const conversation = new Conversation(id, params.projectId, title, now, now, false, null, null, false, folder, false, [], false, false, null,
      organizationChat);
    const json = JSON.stringify(conversation.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.insertConversation, [conversation.id, conversation.projectId, json, now, now]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, conversation.id, ChangeOperation.Insert, json, transaction);
    if (!Object.isNull(params.teammateId))
      await this.insertMemberAsync(new ConversationMemberParams(conversation.id, params.teammateId), transaction);
    return conversation;
  }

  public async renameAsync(params: ConversationRenameParams, transaction?: SqlTransaction): Promise<Conversation> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.renameAsync(params, t));
    const now = new Date().toISOString();
    const renamed = (await this.requireAsync(params.conversationId, transaction)).withChosenTitle(params.title, now);
    const json = JSON.stringify(renamed.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateConversation, [json, now, renamed.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, renamed.id, ChangeOperation.Update, json, transaction);
    return renamed;
  }

  public async giveTitleAsync(conversationId: string, title: string, transaction?: SqlTransaction): Promise<Conversation | null> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.giveTitleAsync(conversationId, title, t));
    const conversation = await this.findAsync(conversationId, transaction);
    if (Object.isNull(conversation) || conversation.titleChosen)
      return null;
    const titled = conversation.withTitle(title, conversation.updatedAt);
    const json = JSON.stringify(titled.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateConversation, [json, titled.updatedAt, titled.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, titled.id, ChangeOperation.Update, json, transaction);
    return titled;
  }

  public async touchAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<Conversation> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.touchAsync(params, t));
    const now = new Date().toISOString();
    const conversation = await this.requireAsync(params.conversationId, transaction);
    const touched = conversation.withTitle(conversation.title, now);
    const json = JSON.stringify(touched.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateConversation, [json, now, touched.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, touched.id, ChangeOperation.Update, json, transaction);
    return touched;
  }

  public async setResponderAsync(params: ConversationResponderParams, transaction?: SqlTransaction): Promise<Conversation> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.setResponderAsync(params, t));
    const conversation = await this.requireAsync(params.conversationId, transaction);
    if (params.start && !Object.isNull(conversation.responder))
      return conversation;
    const held = conversation.responder?.teammateId ?? null;
    if (!params.chosen && Object.isNull(params.responder?.teammateId ?? null) && !Object.isNull(held) &&
      (await transaction.queryAsync(new SqlQuery(Resources.selectMember, [conversation.id, held]))).length > 0)
      return conversation;
    const teammateId = params.responder?.teammateId ?? null;
    const providerId = params.responder?.providerId ?? null;
    if (!Object.isNull(teammateId)) {
      const [teammate] = await transaction.queryAsync(new SqlQuery(Resources.selectTeammateById, [teammateId]));
      if (Object.isUndefined(teammate))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(teammateId), [teammateId]);
    }
    if (!Object.isNull(providerId)) {
      const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectProviderById, [providerId]));
      if (Object.isUndefined(record))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatProviderNotFound(providerId), [providerId]);
      const kind = params.responder!.requested!.kind;
      if (Provider.fromJson(ConversationsService.parse(record)).kind !== kind)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatProviderMismatch(providerId, kind), [providerId, kind]);
    }
    const chosen = params.chosen ? conversation.withResponder(params.responder).asEdited() : conversation.withResponder(params.responder);
    const json = JSON.stringify(chosen.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateConversation, [json, chosen.updatedAt, chosen.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, chosen.id, ChangeOperation.Update, json, transaction);
    return chosen;
  }

  public async moveProviderlessAsync(providerOf: (kind: string) => string | null, transaction?: SqlTransaction): Promise<readonly Conversation[]> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.moveProviderlessAsync(providerOf, t));
    const moved: Conversation[] = [];
    for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectProviderlessConversations, []))) {
      const conversation = this.read(record);
      const requested = conversation.responder!.requested!;
      const providerId = providerOf(requested.kind);
      if (Object.isNull(providerId))
        continue;
      const chosen = conversation.withResponder(new ConversationResponder(null, requested, providerId));
      const json = JSON.stringify(chosen.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateConversation, [json, chosen.updatedAt, chosen.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, chosen.id, ChangeOperation.Update, json, transaction);
      moved.push(chosen);
    }
    return moved;
  }

  public async moveAsync(params: ConversationMoveParams): Promise<Conversation> {
    const project = await this.requireProjectAsync(params.projectId);
    const activity = this.context.projectActivity;
    activity.requireIdle(project.rootPath);
    const conversation = await this.requireAsync(params.conversationId);
    await this.requireIdleAsync(conversation);
    if (!Object.isNull(conversation.projectId))
      return this.moveRecordAsync(params);
    const holds = activity.enterAll([project.rootPath, this.context.chatFolders.pathOf(conversation.id)]);
    const copies: string[] = [];
    try {
      await this.context.chatFolders.copyToAsync(conversation.id, project.rootPath, copies);
      return await this.moveRecordAsync(params);
    }
    catch (error) {
      const kept = await ChatFolders.removeCopiesAsync(copies);
      if (kept.length > 0)
        this.log?.write(Resources.formatMoveCopiesKept(conversation.id, kept));
      throw error;
    }
    finally {
      for (const hold of holds)
        activity.leave(hold);
    }
  }

  public async attachFolderAsync(params: ChatFolderAttachParams, check: (path: string) => Promise<FolderState>): Promise<Conversation> {
    if (!isAbsolute(params.folder))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatFolderNotAbsolute(params.folder), [params.folder]);
    const folder = resolve(params.folder);
    const conversation = await this.requireAsync(params.chatId);
    if (!Object.isNull(conversation.projectId))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatChatInProject(conversation.id), [conversation.id]);
    await this.requireIdleAsync(conversation);
    const activity = this.context.projectActivity;
    const hold = activity.enter(folder);
    try {
      if (await check(folder) !== FolderState.Present)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatFolderNotAttached(folder), [folder]);
      return (await this.changeFolderAsync(conversation.id, t => ConversationsService.requireProjectless(t).withAttachedFolder(folder, new Date().toISOString())))
        .withFolder(folder);
    }
    finally {
      activity.leave(hold);
    }
  }

  public async detachFolderAsync(params: ConversationIdParams): Promise<Conversation> {
    const conversation = await this.requireAsync(params.conversationId);
    if (Object.isNull(conversation.attachedFolder))
      return conversation;
    await this.requireIdleAsync(conversation);
    return (await this.changeFolderAsync(conversation.id, t => t.withAttachedFolder(null, new Date().toISOString())))
      .withFolder(this.context.chatFolders.pathOf(conversation.id));
  }

  private changeFolderAsync(conversationId: string, change: (conversation: Conversation) => Conversation): Promise<Conversation> {
    return this.context.database.connection.runInTransactionAsync(async transaction => {
      await this.requireNoOpenReplyAsync(conversationId, transaction);
      return this.updateSessionAsync(conversationId, t => change(t).asEdited(), transaction);
    });
  }

  private static requireProjectless(conversation: Conversation): Conversation {
    if (!Object.isNull(conversation.projectId))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatChatInProject(conversation.id), [conversation.id]);
    return conversation;
  }

  private async moveRecordAsync(params: ConversationMoveParams): Promise<Conversation> {
    return this.context.database.connection.runInTransactionAsync(async transaction => {
      await this.requireProjectAsync(params.projectId, transaction);
      const conversation = await this.requireAsync(params.conversationId, transaction);
      await this.requireNoOpenReplyAsync(conversation.id, transaction);
      const now = new Date().toISOString();
      const moved = conversation.withProjectId(params.projectId, now).asEdited();
      const json = JSON.stringify(moved.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateConversationProject, [moved.projectId, json, now, moved.id]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, moved.id, ChangeOperation.Update, json, transaction);
      return moved;
    });
  }

  public async deleteAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction)) {
      const sent = await this.context.database.connection.runInTransactionAsync(async t => {
        const paths = await ConversationsService.sentPathsAsync(params.conversationId, t);
        await this.deleteAsync(params, t);
        return paths;
      });
      this.drafts?.removeChatFiles(params.conversationId);
      this.drafts?.removeSentFiles(params.conversationId, sent);
      return;
    }
    const conversation = await this.requireAsync(params.conversationId, transaction);
    await this.requireIdleAsync(conversation, transaction);
    for (const member of await this.listMembersAsync(params, transaction))
      await this.removeMemberAsync(new ConversationMemberParams(conversation.id, member.teammateId), transaction);
    for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectApprovalsByConversation, [conversation.id])))
      await this.appendDeletionAsync(ChangeEntity.Approval, Approval.fromJson(ConversationsService.parse(record)).id, record, transaction);
    for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectMessagesByConversation, [conversation.id, -1])))
      await this.appendDeletionAsync(ChangeEntity.Message, Message.fromJson(ConversationsService.parse(record)).id, record, transaction);
    await transaction.executeAsync(new SqlQuery(Resources.deleteApprovalsByConversation, [conversation.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteMessagesByConversation, [conversation.id]));
    await this.drafts?.forgetAsync(conversation.id, transaction);
    await transaction.executeAsync(new SqlQuery(Resources.deleteReadingPosition, [conversation.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteChatWakes, [conversation.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteWaitingMessages, [conversation.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteSustainAttempts, [conversation.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteHandoverSummaries, [conversation.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteRunOutputs, [conversation.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteBackgroundTasks, [conversation.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteConversation, [conversation.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, conversation.id, ChangeOperation.Delete, JSON.stringify(conversation.toJson()), transaction);
  }

  private static async sentPathsAsync(conversationId: string, transaction: SqlTransaction): Promise<readonly string[]> {
    return (await transaction.queryAsync(new SqlQuery(Resources.selectChatAttachmentPaths, [conversationId]))).map(t => t.readString(Resources.pathColumn));
  }

  public async removeFromAsync(conversationId: string, fromSequence: number, transaction?: SqlTransaction): Promise<readonly Message[]> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.removeFromAsync(conversationId, fromSequence, t));
    const conversation = await this.requireAsync(conversationId, transaction);
    const removed: Message[] = [];
    for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectApprovalsFromSequence, [conversation.id, fromSequence])))
      await this.appendDeletionAsync(ChangeEntity.Approval, Approval.fromJson(ConversationsService.parse(record)).id, record, transaction);
    for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectMessagesByConversation, [conversation.id, fromSequence - 1]))) {
      const message = Message.fromJson(ConversationsService.parse(record));
      await this.appendDeletionAsync(ChangeEntity.Message, message.id, record, transaction);
      removed.push(message);
    }
    for (const message of removed)
      await transaction.executeAsync(new SqlQuery(Resources.deleteMessageRunOutputs, [message.id]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteApprovalsFromSequence, [conversation.id, fromSequence]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteMessagesFromSequence, [conversation.id, fromSequence]));
    await transaction.executeAsync(new SqlQuery(Resources.deleteReadingPositionFromSequence, [conversation.id, fromSequence]));
    return removed;
  }

  public async listRunOutputsAsync(params: ConversationIdParams): Promise<readonly RunOutput[]> {
    await this.requireAsync(params.conversationId);
    return (await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectRunOutputs, [params.conversationId])))
      .map(t => RunOutput.fromJson(ConversationsService.parse(t)));
  }

  public async saveRunOutputAsync(output: RunOutput, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.saveRunOutputAsync(output, t));
    await this.requireAsync(output.chatId, transaction);
    const [found] = await transaction.queryAsync(new SqlQuery(Resources.selectMessageInChat, [output.messageId, output.chatId]));
    if (Object.isUndefined(found))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatMessageNotFound(output.messageId), [output.messageId]);
    const json = JSON.stringify(output.toJson());
    if (json.length > Resources.runOutputsKeptCharacters) {
      await transaction.executeAsync(new SqlQuery(Resources.deleteRunOutput, [output.messageId, output.site, output.block]));
      return;
    }
    await transaction.executeAsync(new SqlQuery(Resources.upsertRunOutput, [output.chatId, output.messageId, output.site, output.block, json, new Date().toISOString()]));
    await transaction.executeAsync(new SqlQuery(Resources.trimRunOutputs, [output.chatId, Resources.runOutputsKeptCharacters]));
  }

  public async listMembersAsync(params: ConversationIdParams, transaction?: SqlTransaction): Promise<readonly ConversationMember[]> {
    await this.requireAsync(params.conversationId, transaction);
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectMembersByConversation, [params.conversationId])))
      .map(t => ConversationMember.fromJson(ConversationsService.parse(t)));
  }

  public async addMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<ConversationMember> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.addMemberAsync(params, t));
    const existing = await this.findMemberAsync(params, transaction);
    const member = await this.insertMemberAsync(params, transaction);
    if (Object.isNull(existing))
      await this.markEditedAsync(params.conversationId, transaction);
    return member;
  }

  public async removeMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.removeMemberAsync(params, t));
    await this.requireAsync(params.conversationId, transaction);
    const member = await this.findMemberAsync(params, transaction);
    if (Object.isNull(member))
      return;
    await this.requireNoOpenReplyAsync(params.conversationId, transaction);
    await transaction.executeAsync(new SqlQuery(Resources.deleteMember, [params.conversationId, params.teammateId]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.ChatMember,
      Resources.memberEntityId(member.conversationId, member.teammateId), ChangeOperation.Delete, JSON.stringify(member.toJson()), transaction);
    await this.markEditedAsync(params.conversationId, transaction);
  }

  private async insertMemberAsync(params: ConversationMemberParams, transaction: SqlTransaction): Promise<ConversationMember> {
    await this.requireAsync(params.conversationId, transaction);
    const [teammate] = await transaction.queryAsync(new SqlQuery(Resources.selectTeammateById, [params.teammateId]));
    if (Object.isUndefined(teammate))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(params.teammateId), [params.teammateId]);
    const existing = await this.findMemberAsync(params, transaction);
    if (!Object.isNull(existing))
      return existing;
    const member = new ConversationMember(params.conversationId, params.teammateId, new Date().toISOString(), null, false);
    const json = JSON.stringify(member.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.insertMember, [member.conversationId, member.teammateId, json, member.joinedAt]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.ChatMember,
      Resources.memberEntityId(member.conversationId, member.teammateId), ChangeOperation.Insert, json, transaction);
    return member;
  }

  public async findMemberAsync(params: ConversationMemberParams, transaction?: SqlTransaction): Promise<ConversationMember | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectMember, [params.conversationId, params.teammateId]));
    return Object.isUndefined(record) ? null : ConversationMember.fromJson(ConversationsService.parse(record));
  }

  public async setMemberSessionAsync(params: ConversationMemberParams, nativeSessionId: string | null, resumedNativeSession: boolean,
    sessionProviderId: string | null = null, transaction?: SqlTransaction): Promise<ConversationMember> {
    return this.updateMemberAsync(params, t => t.withSession(nativeSessionId, resumedNativeSession, sessionProviderId), transaction);
  }

  public async setPlanFirstAsync(params: ChatPlanFirstParams, transaction?: SqlTransaction): Promise<Conversation> {
    return this.changePlanFirstAsync(params.chatId, t => t.withPlanFirst(params.planFirst), transaction);
  }

  public async approvePlanAsync(chatId: string, teammateId: string | null, transaction?: SqlTransaction): Promise<Conversation> {
    return this.changePlanFirstAsync(chatId, t => t.withPlanApproved(teammateId), transaction);
  }

  public async reopenPlanAsync(chatId: string, teammateId: string | null, transaction?: SqlTransaction): Promise<Conversation> {
    return this.changePlanFirstAsync(chatId, t => t.withPlanReopened(teammateId), transaction);
  }

  public async setMemberModeAsync(params: ChatMemberModeParams, transaction?: SqlTransaction): Promise<ConversationMember> {
    return this.updateMemberAsync(new ConversationMemberParams(params.chatId, params.teammateId), t => t.withMode(params.mode), transaction);
  }

  public async setMemberSettingsAsync(params: ChatMemberSettingsParams, transaction?: SqlTransaction): Promise<ConversationMember> {
    return this.updateMemberAsync(new ConversationMemberParams(params.chatId, params.teammateId), t => t.withSettings(params.settings), transaction);
  }

  private async changePlanFirstAsync(chatId: string, change: (conversation: Conversation) => Conversation, transaction?: SqlTransaction): Promise<Conversation> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.changePlanFirstAsync(chatId, change, t));
    const conversation = await this.requireAsync(chatId, transaction);
    const changed = change(conversation);
    const json = JSON.stringify(changed.toJson());
    if (json === JSON.stringify(conversation.toJson()))
      return conversation;
    await transaction.executeAsync(new SqlQuery(Resources.updateConversation, [json, changed.updatedAt, changed.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, changed.id, ChangeOperation.Update, json, transaction);
    return changed;
  }

  private async updateMemberAsync(params: ConversationMemberParams, change: (member: ConversationMember) => ConversationMember,
    transaction?: SqlTransaction): Promise<ConversationMember> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.updateMemberAsync(params, change, t));
    const member = await this.findMemberAsync(params, transaction);
    if (Object.isNull(member))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatMemberNotFound(params.conversationId, params.teammateId),
        [params.conversationId, params.teammateId]);
    const updated = change(member);
    const json = JSON.stringify(updated.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateMember, [json, updated.conversationId, updated.teammateId]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.ChatMember,
      Resources.memberEntityId(updated.conversationId, updated.teammateId), ChangeOperation.Update, json, transaction);
    return updated;
  }

  public async resetTeammateSessionsAsync(teammateId: string, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.resetTeammateSessionsAsync(teammateId, t));
    for (const member of await this.membersOfTeammateAsync(teammateId, transaction)) {
      await this.requireNoOpenReplyAsync(member.conversationId, transaction);
      await this.updateMemberAsync(new ConversationMemberParams(member.conversationId, teammateId), t => t.withSession(null, false).withMode(null).withSettings(null),
        transaction);
    }
  }

  public async resetProviderSessionsAsync(providerId: string, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.resetProviderSessionsAsync(providerId, t));
    const [open] = await transaction.queryAsync(new SqlQuery(Resources.selectOpenReplyByProvider, [providerId]));
    if (!Object.isUndefined(open))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatProviderReplyInProgress(providerId), [providerId]);
    await transaction.executeAsync(new SqlQuery(Resources.forgetProviderSessions, [providerId, providerId]));
    for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectConversationsWithForkByProvider, [providerId])))
      await this.setForkedSessionAsync(record.readString(Resources.conversationIdColumn), null, transaction);
    const members = (await transaction.queryAsync(new SqlQuery(Resources.selectMembersWithSessionsByProvider, [providerId])))
      .map(t => ConversationMember.fromJson(ConversationsService.parse(t)));
    for (const member of members)
      await this.setMemberSessionAsync(new ConversationMemberParams(member.conversationId, member.teammateId), null, false, null, transaction);
  }

  public async removeTeammateMembersAsync(teammateId: string, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.removeTeammateMembersAsync(teammateId, t));
    for (const member of await this.membersOfTeammateAsync(teammateId, transaction))
      await this.removeMemberAsync(new ConversationMemberParams(member.conversationId, teammateId), transaction);
  }

  private async membersOfTeammateAsync(teammateId: string, transaction: SqlTransaction): Promise<readonly ConversationMember[]> {
    return (await transaction.queryAsync(new SqlQuery(Resources.selectMembersByTeammate, [teammateId])))
      .map(t => ConversationMember.fromJson(ConversationsService.parse(t)));
  }

  public async setSessionResetAsync(conversationId: string, sessionReset: boolean, transaction?: SqlTransaction): Promise<Conversation> {
    return this.updateSessionAsync(conversationId, conversation => conversation.withSessionReset(sessionReset, new Date().toISOString()), transaction);
  }

  public async setForkedSessionAsync(conversationId: string, forkedSession: ForkedSession | null, transaction?: SqlTransaction): Promise<Conversation> {
    return this.updateSessionAsync(conversationId, conversation => conversation.withForkedSession(forkedSession, new Date().toISOString()), transaction);
  }

  public async searchAsync(params: ConversationSearchParams): Promise<ConversationSearchResult> {
    return this.context.database.connection.runInTransactionAsync(async transaction => {
      const pattern = Resources.formatLikePattern(params.query);
      const hits = new Map<string, ConversationSearchHit>();
      for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectConversationsByTitle, [pattern]))) {
        const conversation = Conversation.fromJson(JSON.parse(record.readString(Resources.jsonColumn)));
        const hit = new ConversationSearchHit(conversation.id, conversation.projectId, conversation.title, null, conversation.title, conversation.updatedAt);
        hits.set(conversation.id, hit);
      }
      for (const record of await transaction.queryAsync(new SqlQuery(Resources.selectMessagesByText, [pattern]))) {
        const message = Message.fromJson(JSON.parse(record.readString(Resources.jsonColumn)));
        if (hits.has(message.conversationId))
          continue;
        const conversation = await this.requireAsync(message.conversationId, transaction);
        const text = message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.space);
        const snippet = Resources.formatSnippet(text, params.query);
        const hit = new ConversationSearchHit(conversation.id, conversation.projectId, conversation.title, message.id, snippet, conversation.updatedAt,
          message.sequence);
        hits.set(conversation.id, hit);
      }
      const ordered = [...hits.values()].toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, params.limit);

      return new ConversationSearchResult(ordered);
    });
  }

  public async findChatsAsync(params: ChatFindParams): Promise<ChatFindResult> {
    return this.context.database.connection.runInTransactionAsync(async transaction => {
      const pattern = Resources.formatLikePattern(params.query);
      const blank = params.query.length === 0;
      const records = await transaction.queryAsync(blank ? new SqlQuery(Resources.selectLatestChats, [params.limit])
        : new SqlQuery(Resources.selectChatsByTitleLimited, [pattern, params.limit]));
      const counted = await this.countOfAsync(blank ? new SqlQuery(Resources.countChats, []) : new SqlQuery(Resources.countChatsByTitle, [pattern]), transaction);
      const hits: ChatFindHit[] = [];
      for (const chat of records.map(t => this.read(t)))
        hits.push(new ChatFindHit(chat.id, chat.projectId, chat.title, await this.teammateNamesOfAsync(chat.id, transaction), chat.updatedAt));
      return new ChatFindResult(hits, Math.max(hits.length, counted));
    });
  }

  public async searchMessagesAsync(params: ConversationSearchParams): Promise<MessageSearchResult> {
    return this.context.database.connection.runInTransactionAsync(async transaction => {
      const query = params.query.trim();
      const short = [...query].length < Resources.trigramLength;
      const pattern = short ? Resources.formatGlobPattern(query) : Resources.formatMatchPhrase(query);
      const window = short ? [Resources.shortSearchRows] : [];
      const selected = new SqlQuery(short ? Resources.selectMessagesContaining : Resources.selectMessagesMatching, [...window, pattern, params.limit]);
      const hits = (await transaction.queryAsync(selected)).map(t => {
        const message = Message.fromJson(JSON.parse(t.readString(Resources.jsonColumn)));
        const chat = Conversation.fromJson(JSON.parse(t.readString(Resources.chatColumn)));
        const text = message.details.filter(u => u.kind === DetailKind.Text).map(u => u.text).join(Resources.space);
        const provenance = message.provenance;
        return new MessageSearchHit(chat.id, chat.projectId, chat.title, message.id, message.sequence, message.author, message.sender?.name ?? null, message.teammateName,
          provenance?.providerId ?? null, Object.isNull(provenance) ? null : provenance.observed.kind ?? provenance.requested.kind, Resources.formatSnippet(text, query),
          message.createdAt);
      });
      const counted = hits.length < params.limit ? hits.length
        : await this.countOfAsync(new SqlQuery(short ? Resources.countMessagesContaining : Resources.countMessagesMatching,
          [...window, pattern, Resources.messageSearchCountCap + 1]), transaction);
      const unread = short
        && await this.countOfAsync(new SqlQuery(Resources.countLatestIndexed, [Resources.shortSearchRows + 1]), transaction) > Resources.shortSearchRows;
      const capped = unread || counted > Resources.messageSearchCountCap;
      return new MessageSearchResult(hits, capped ? Resources.messageSearchCountCap : Math.max(hits.length, counted), capped);
    });
  }

  private async countOfAsync(query: SqlQuery, transaction: SqlTransaction): Promise<number> {
    return (await transaction.queryAsync(query)).reduce((total, t) => total + t.readInteger(Resources.countColumn), 0);
  }

  private async teammateNamesOfAsync(chatId: string, transaction: SqlTransaction): Promise<readonly string[]> {
    return (await transaction.queryAsync(new SqlQuery(Resources.selectTeammateNamesByChat, [chatId]))).map(t => t.readString(Resources.nameColumn));
  }

  private async markEditedAsync(conversationId: string, transaction: SqlTransaction): Promise<void> {
    const conversation = await this.requireAsync(conversationId, transaction);
    if (!conversation.edited)
      await this.updateSessionAsync(conversationId, t => t.asEdited(), transaction);
  }

  private async updateSessionAsync(conversationId: string, change: (conversation: Conversation) => Conversation, transaction?: SqlTransaction): Promise<Conversation> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.updateSessionAsync(conversationId, change, t));
    const marked = change(await this.requireAsync(conversationId, transaction));
    const now = marked.updatedAt;
    const json = JSON.stringify(marked.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateConversation, [json, now, marked.id]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Chat, marked.id, ChangeOperation.Update, json, transaction);
    return marked;
  }

  public async countFolderFilesAsync(params: ConversationIdParams): Promise<number> {
    const conversation = await this.requireAsync(params.conversationId);
    return Object.isNull(conversation.projectId) ? await this.context.chatFolders.countFilesAsync(conversation.id) : 0;
  }

  private async requireProjectAsync(projectId: string, transaction?: SqlTransaction): Promise<Project> {
    const project = await this.findProjectAsync(projectId, transaction);
    if (Object.isNull(project))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatProjectNotFound(projectId), [projectId]);
    return project;
  }

  private async findProjectAsync(projectId: string, transaction?: SqlTransaction): Promise<Project | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectProjectById, [projectId]));
    return Object.isUndefined(record) ? null : Project.fromJson(ConversationsService.parse(record));
  }

  private async requireAsync(conversationId: string, transaction?: SqlTransaction): Promise<Conversation> {
    const conversation = await this.findAsync(conversationId, transaction);
    if (Object.isNull(conversation))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatConversationNotFound(conversationId), [conversationId]);

    return conversation;
  }

  private async requireIdleAsync(conversation: Conversation, transaction?: SqlTransaction): Promise<void> {
    const root = Object.isNull(conversation.projectId) ? conversation.attachedFolder ?? this.context.chatFolders.pathOf(conversation.id)
      : (await this.requireProjectAsync(conversation.projectId, transaction)).rootPath;
    if (!Object.isNull(root))
      this.context.projectActivity.requireIdle(root);
    await this.requireNoOpenReplyAsync(conversation.id, transaction);
  }

  private async requireNoOpenReplyAsync(conversationId: string, transaction?: SqlTransaction): Promise<void> {
    const [open] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectOpenReplyByConversation, [conversationId]));
    if (!Object.isUndefined(open))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatReplyInProgress(conversationId), [conversationId]);
  }

  private async appendDeletionAsync(entity: ChangeEntity, entityId: string, record: DataRecord, transaction: SqlTransaction): Promise<void> {
    await this.context.database.changeFeed.appendAsync(entity, entityId, ChangeOperation.Delete, record.readString(Resources.jsonColumn), transaction);
  }

  private static parse(record: DataRecord): unknown {
    return JsonReader.parse(record.readString(Resources.jsonColumn)).toJson();
  }

  private read(record: DataRecord): Conversation {
    const conversation = Conversation.fromJson(ConversationsService.parse(record));
    return Object.isNull(conversation.projectId)
      ? conversation.withFolder(conversation.attachedFolder ?? this.context.chatFolders.pathOf(conversation.id)) : conversation;
  }
}
