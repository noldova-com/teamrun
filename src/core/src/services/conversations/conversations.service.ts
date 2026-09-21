/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Guid } from "@noldova/teamrun-foundation-core";
import { ChangeOperation, type DataRecord } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import {
  Approval,
  Conversation,
  ConversationMember,
  ConversationMemberParams,
  type ConversationCreateParams,
  type ConversationIdParams,
  type ConversationMoveParams,
  type ConversationRenameParams,
  ConversationSearchHit,
  ConversationSearchParams,
  ConversationSearchResult,
  DetailKind,
  ErrorCode,
  ForkedSession,
  Message,
  Project,
  type ProjectIdParams
} from "@noldova/teamrun-protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class ConversationsService implements IConversationsService {
  private readonly context: DatabaseContext;

  public constructor(context: DatabaseContext) {
    this.context = context;
  }

  public list(params: ProjectIdParams): readonly Conversation[] {
    const records = this.context.database.connection.query(new SqlQuery(Resources.selectConversationsByProject, [params.projectId]));
    return records.map(t => ConversationsService.read(t));
  }

  public find(conversationId: string): Conversation | null {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectConversationById, [conversationId]));
    if (Object.isUndefined(record))
      return null;

    return ConversationsService.read(record);
  }

  public create(params: ConversationCreateParams): Conversation {
    return this.context.database.transaction(() => {
      const [project] = this.context.database.connection.query(new SqlQuery(Resources.selectProjectById, [params.projectId]));
      if (Object.isUndefined(project))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatProjectNotFound(params.projectId), [params.projectId]);

      const now = new Date().toISOString();
      const title = Object.isNull(params.title) ? Resources.defaultConversationTitle : params.title;
      const conversation = new Conversation(Guid.createVersion7().toString(), params.projectId, title, now, now);
      const json = JSON.stringify(conversation.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.insertConversation, [conversation.id, conversation.projectId, json, now, now]));
      this.context.database.changeFeed.append(ChangeEntity.Conversation, conversation.id, ChangeOperation.Insert, json);
      return conversation;
    });
  }

  public rename(params: ConversationRenameParams): Conversation {
    return this.context.database.transaction(() => {
      const now = new Date().toISOString();
      const renamed = this.require(params.conversationId).withTitle(params.title, now);
      const json = JSON.stringify(renamed.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.updateConversation, [json, now, renamed.id]));
      this.context.database.changeFeed.append(ChangeEntity.Conversation, renamed.id, ChangeOperation.Update, json);
      return renamed;
    });
  }

  public move(params: ConversationMoveParams): Conversation {
    return this.context.database.transaction(() => {
      const [project] = this.context.database.connection.query(new SqlQuery(Resources.selectProjectById, [params.projectId]));
      if (Object.isUndefined(project))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatProjectNotFound(params.projectId), [params.projectId]);
      this.context.projectActivity.requireIdle(Project.fromJson(ConversationsService.parse(project)).rootPath);
      this.requireIdle(this.require(params.conversationId));
      const now = new Date().toISOString();
      const moved = this.require(params.conversationId).withProjectId(params.projectId, now);
      const json = JSON.stringify(moved.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.updateConversationProject, [moved.projectId, json, now, moved.id]));
      this.context.database.changeFeed.append(ChangeEntity.Conversation, moved.id, ChangeOperation.Update, json);
      return moved;
    });
  }

  public delete(params: ConversationIdParams): void {
    this.context.database.transaction(() => {
      const conversation = this.require(params.conversationId);
      this.requireIdle(conversation);
      for (const member of this.listMembers(params))
        this.removeMember(new ConversationMemberParams(conversation.id, member.teammateId));
      const connection = this.context.database.connection;
      for (const record of connection.query(new SqlQuery(Resources.selectApprovalsByConversation, [conversation.id])))
        this.appendDeletion(ChangeEntity.Approval, Approval.fromJson(ConversationsService.parse(record)).id, record);
      for (const record of connection.query(new SqlQuery(Resources.selectMessagesByConversation, [conversation.id, -1])))
        this.appendDeletion(ChangeEntity.Message, Message.fromJson(ConversationsService.parse(record)).id, record);
      connection.execute(new SqlQuery(Resources.deleteApprovalsByConversation, [conversation.id]));
      connection.execute(new SqlQuery(Resources.deleteMessagesByConversation, [conversation.id]));
      connection.execute(new SqlQuery(Resources.deleteConversation, [conversation.id]));
      this.context.database.changeFeed.append(ChangeEntity.Conversation, conversation.id, ChangeOperation.Delete, JSON.stringify(conversation.toJson()));
    });
  }

  public removeFrom(conversationId: string, fromSequence: number): readonly Message[] {
    return this.context.database.transaction(() => {
      const conversation = this.require(conversationId);
      const connection = this.context.database.connection;
      const removed: Message[] = [];
      for (const record of connection.query(new SqlQuery(Resources.selectApprovalsFromSequence, [conversation.id, fromSequence])))
        this.appendDeletion(ChangeEntity.Approval, Approval.fromJson(ConversationsService.parse(record)).id, record);
      for (const record of connection.query(new SqlQuery(Resources.selectMessagesByConversation, [conversation.id, fromSequence - 1]))) {
        const message = Message.fromJson(ConversationsService.parse(record));
        this.appendDeletion(ChangeEntity.Message, message.id, record);
        removed.push(message);
      }
      connection.execute(new SqlQuery(Resources.deleteApprovalsFromSequence, [conversation.id, fromSequence]));
      connection.execute(new SqlQuery(Resources.deleteMessagesFromSequence, [conversation.id, fromSequence]));
      return removed;
    });
  }

  public listMembers(params: ConversationIdParams): readonly ConversationMember[] {
    this.require(params.conversationId);
    return this.context.database.connection.query(new SqlQuery(Resources.selectMembersByConversation, [params.conversationId]))
      .map(t => ConversationMember.fromJson(ConversationsService.parse(t)));
  }

  public addMember(params: ConversationMemberParams): ConversationMember {
    return this.context.database.transaction(() => {
      this.require(params.conversationId);
      const [teammate] = this.context.database.connection.query(new SqlQuery(Resources.selectTeammateById, [params.teammateId]));
      if (Object.isUndefined(teammate))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(params.teammateId), [params.teammateId]);
      const existing = this.findMember(params);
      if (!Object.isNull(existing))
        return existing;
      const member = new ConversationMember(params.conversationId, params.teammateId, new Date().toISOString(), null, false);
      const json = JSON.stringify(member.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.insertMember, [member.conversationId, member.teammateId, json, member.joinedAt]));
      this.context.database.changeFeed.append(ChangeEntity.ConversationMember,
        Resources.memberEntityId(member.conversationId, member.teammateId), ChangeOperation.Insert, json);
      return member;
    });
  }

  public removeMember(params: ConversationMemberParams): void {
    this.context.database.transaction(() => {
      this.require(params.conversationId);
      const member = this.findMember(params);
      if (Object.isNull(member))
        return;
      this.requireNoOpenReply(params.conversationId);
      this.context.database.connection.execute(new SqlQuery(Resources.deleteMember, [params.conversationId, params.teammateId]));
      this.context.database.changeFeed.append(ChangeEntity.ConversationMember,
        Resources.memberEntityId(member.conversationId, member.teammateId), ChangeOperation.Delete, JSON.stringify(member.toJson()));
    });
  }

  public findMember(params: ConversationMemberParams): ConversationMember | null {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectMember, [params.conversationId, params.teammateId]));
    return Object.isUndefined(record) ? null : ConversationMember.fromJson(ConversationsService.parse(record));
  }

  public setMemberSession(params: ConversationMemberParams, nativeSessionId: string | null, resumedNativeSession: boolean): ConversationMember {
    return this.context.database.transaction(() => {
      const member = this.findMember(params);
      if (Object.isNull(member))
        throw new ServiceException(ErrorCode.NotFound, Resources.formatMemberNotFound(params.conversationId, params.teammateId),
          [params.conversationId, params.teammateId]);
      const updated = member.withSession(nativeSessionId, resumedNativeSession);
      const json = JSON.stringify(updated.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.updateMember, [json, updated.conversationId, updated.teammateId]));
      this.context.database.changeFeed.append(ChangeEntity.ConversationMember,
        Resources.memberEntityId(updated.conversationId, updated.teammateId), ChangeOperation.Update, json);
      return updated;
    });
  }

  public resetTeammateSessions(teammateId: string): void {
    this.context.database.transaction(() => {
      for (const member of this.membersOfTeammate(teammateId)) {
        this.requireNoOpenReply(member.conversationId);
        this.setMemberSession(new ConversationMemberParams(member.conversationId, teammateId), null, false);
      }
    });
  }

  public removeTeammateMembers(teammateId: string): void {
    this.context.database.transaction(() => {
      for (const member of this.membersOfTeammate(teammateId))
        this.removeMember(new ConversationMemberParams(member.conversationId, teammateId));
    });
  }

  private membersOfTeammate(teammateId: string): readonly ConversationMember[] {
    return this.context.database.connection.query(new SqlQuery(Resources.selectMembersByTeammate, [teammateId]))
      .map(t => ConversationMember.fromJson(ConversationsService.parse(t)));
  }

  public setSessionReset(conversationId: string, sessionReset: boolean): Conversation {
    return this.updateSession(conversationId, conversation => conversation.withSessionReset(sessionReset, new Date().toISOString()));
  }

  public setForkedSession(conversationId: string, forkedSession: ForkedSession | null): Conversation {
    return this.updateSession(conversationId, conversation => conversation.withForkedSession(forkedSession, new Date().toISOString()));
  }

  public search(params: ConversationSearchParams): ConversationSearchResult {
    const pattern = Resources.formatLikePattern(params.query);
    const hits = new Map<string, ConversationSearchHit>();
    for (const record of this.context.database.connection.query(new SqlQuery(Resources.selectConversationsByTitle, [pattern]))) {
      const conversation = Conversation.fromJson(JSON.parse(record.readString(Resources.jsonColumn)));
      const hit = new ConversationSearchHit(conversation.id, conversation.projectId, conversation.title, null, conversation.title, conversation.updatedAt);
      hits.set(conversation.id, hit);
    }
    for (const record of this.context.database.connection.query(new SqlQuery(Resources.selectMessagesByText, [pattern]))) {
      const message = Message.fromJson(JSON.parse(record.readString(Resources.jsonColumn)));
      if (hits.has(message.conversationId))
        continue;
      const conversation = this.require(message.conversationId);
      const text = message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.space);
      const snippet = Resources.formatSnippet(text, params.query);
      const hit = new ConversationSearchHit(conversation.id, conversation.projectId, conversation.title, message.id, snippet, conversation.updatedAt,
        message.sequence);
      hits.set(conversation.id, hit);
    }
    const ordered = [...hits.values()].toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, params.limit);

    return new ConversationSearchResult(ordered);
  }

  private updateSession(conversationId: string, change: (conversation: Conversation) => Conversation): Conversation {
    return this.context.database.transaction(() => {
      const marked = change(this.require(conversationId));
      const now = marked.updatedAt;
      const json = JSON.stringify(marked.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.updateConversation, [json, now, marked.id]));
      this.context.database.changeFeed.append(ChangeEntity.Conversation, marked.id, ChangeOperation.Update, json);
      return marked;
    });
  }

  private require(conversationId: string): Conversation {
    const conversation = this.find(conversationId);
    if (Object.isNull(conversation))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatConversationNotFound(conversationId), [conversationId]);

    return conversation;
  }

  private requireIdle(conversation: Conversation): void {
    const [project] = this.context.database.connection.query(new SqlQuery(Resources.selectProjectById, [conversation.projectId]));
    if (!Object.isUndefined(project))
      this.context.projectActivity.requireIdle(Project.fromJson(ConversationsService.parse(project)).rootPath);
    this.requireNoOpenReply(conversation.id);
  }

  private requireNoOpenReply(conversationId: string): void {
    const [open] = this.context.database.connection.query(new SqlQuery(Resources.selectOpenReplyByConversation, [conversationId]));
    if (!Object.isUndefined(open))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatReplyInProgress(conversationId), [conversationId]);
  }

  private appendDeletion(entity: ChangeEntity, entityId: string, record: DataRecord): void {
    this.context.database.changeFeed.append(entity, entityId, ChangeOperation.Delete, record.readString(Resources.jsonColumn));
  }

  private static parse(record: DataRecord): unknown {
    return JsonReader.parse(record.readString(Resources.jsonColumn)).toJson();
  }

  private static read(record: DataRecord): Conversation {
    return Conversation.fromJson(ConversationsService.parse(record));
  }
}
