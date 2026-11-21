/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ChangeOperation, type DataRecord } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader } from "@noldova/context.json";
import { Message, MessageAttachment, type MessageListParams, MessagePage, type MessagePageParams, MessageStatus, ReplyPanel, ReplyPage, ReplySummary,
  ReplyUsage, TeammateUsage } from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class MessagesService implements IMessagesService {
  private static readonly openStatuses: readonly MessageStatus[] = [MessageStatus.Pending, MessageStatus.Running, MessageStatus.AwaitingApproval];
  private readonly context: DatabaseContext;

  public constructor(context: DatabaseContext) {
    this.context = context;
  }

  public async listAsync(params: MessageListParams, transaction?: SqlTransaction): Promise<readonly Message[]> {
    const after = Object.isNull(params.afterSequence) ? -1 : params.afterSequence;
    const query = params.kinds.length === 0
      ? new SqlQuery(Resources.selectMessagesByConversation, [params.conversationId, after])
      : new SqlQuery(Resources.selectMessageDigest, [JSON.stringify(params.kinds), params.conversationId, after]);
    return (await (transaction ?? this.context.database.connection).queryAsync(query)).map(t => MessagesService.read(t));
  }

  public async listOutlinesAsync(conversationId: string, afterSequence: number | null, transaction?: SqlTransaction): Promise<readonly Message[]> {
    const after = Object.isNull(afterSequence) ? -1 : afterSequence;
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectMessageOutlinesByConversation, [conversationId, after])))
      .map(t => MessagesService.read(t));
  }

  public async pageAsync(params: MessagePageParams, transaction?: SqlTransaction): Promise<MessagePage> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.pageAsync(params, t));
    const records = Object.isNull(params.beforeSequence) && Object.isNull(params.afterSequence)
      ? (await transaction.queryAsync(new SqlQuery(Resources.selectNewestMessagesByConversation, [params.conversationId, params.limit]))).toReversed()
      : Object.isNull(params.afterSequence)
        ? (await transaction.queryAsync(new SqlQuery(Resources.selectMessagesBeforeSequence, [params.conversationId, params.beforeSequence, params.limit]))).toReversed()
        : await transaction.queryAsync(new SqlQuery(Resources.selectMessagesAfterSequenceLimited, [params.conversationId, params.afterSequence, params.limit]));
    const messages = records.map(t => MessagesService.read(t));
    const first = messages[0];
    const last = messages.at(-1);
    const hasEarlier = !Object.isUndefined(first) && await this.existsAsync(Resources.selectEarlierMessageExists, params.conversationId, first.sequence, transaction);
    const hasLater = !Object.isUndefined(last) && await this.existsAsync(Resources.selectLaterMessageExists, params.conversationId, last.sequence, transaction);
    return new MessagePage(messages, hasEarlier, hasLater, await this.nextSequenceAsync(params.conversationId, transaction));
  }

  private async existsAsync(statement: string, conversationId: string, sequence: number, transaction: SqlTransaction): Promise<boolean> {
    return (await transaction.queryAsync(new SqlQuery(statement, [conversationId, sequence]))).length > 0;
  }

  public async findAsync(messageId: string, transaction?: SqlTransaction): Promise<Message | null> {
    return this.findOneAsync(Resources.selectMessageById, messageId, transaction);
  }

  public async replyPageAsync(params: MessagePageParams, panel: ReplyPanel, transaction?: SqlTransaction): Promise<ReplyPage> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.replyPageAsync(params, panel, t));
    const ascending = !Object.isNull(params.afterSequence);
    const query = Resources.formatReplyPageQuery(panel, ascending);
    const records = await transaction.queryAsync(new SqlQuery(query,
      [params.conversationId, params.beforeSequence ?? Resources.maximumReplySequence, params.afterSequence ?? -1, params.limit + 1]));
    const more = records.length > params.limit;
    const replies = records.slice(0, params.limit).map(t => ReplySummary.fromMessage(MessagesService.read(t)));
    if (ascending)
      replies.reverse();
    const newest = replies[0]?.preview.sequence;
    const oldest = replies.at(-1)?.preview.sequence;
    const ranCommands = panel === ReplyPanel.Changes
      && (await transaction.queryAsync(new SqlQuery(Resources.selectCommandReply, [params.conversationId]))).length > 0;
    if (Object.isUndefined(newest) || Object.isUndefined(oldest))
      return new ReplyPage([], false, false, ranCommands);
    const existsAsync = async (before: number, after: number): Promise<boolean> => (await transaction.queryAsync(new SqlQuery(query,
      [params.conversationId, before, after, 1]))).length > 0;
    return new ReplyPage(replies, ascending ? await existsAsync(oldest, -1) : more,
      ascending ? more : await existsAsync(Resources.maximumReplySequence, newest), ranCommands);
  }

  public async findOpenReplyAsync(conversationId: string, transaction?: SqlTransaction): Promise<Message | null> {
    return this.findOneAsync(Resources.selectOpenReplyByConversation, conversationId, transaction);
  }

  public async findResumableSessionAsync(conversationId: string, kind: string, providerId: string | null, transaction?: SqlTransaction): Promise<string | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectResumableSession,
      [conversationId, kind, providerId, providerId]));
    return Object.isUndefined(record) ? null : record.readString(Resources.nativeSessionIdColumn);
  }

  public async findWindowTokensAsync(providerId: string, model: string | null, transaction?: SqlTransaction): Promise<number | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectWindowTokens, [providerId, model]));
    return Object.isUndefined(record) ? null : record.readInteger(Resources.windowTokensColumn);
  }

  public async findAttachmentAsync(conversationId: string, path: string, transaction?: SqlTransaction): Promise<MessageAttachment | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectMessageAttachment, [conversationId, path]));
    return Object.isUndefined(record) ? null : MessageAttachment.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }

  public async findCheckpointAsync(messageId: string, transaction?: SqlTransaction): Promise<string | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectMessageCheckpoint, [messageId]));
    return Object.isUndefined(record) ? null : record.readNullableString(Resources.checkpointIdColumn);
  }

  public async findCheckpointFolderAsync(messageId: string, transaction?: SqlTransaction): Promise<string | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectMessageCheckpointFolder, [messageId]));
    return Object.isUndefined(record) ? null : record.readNullableString(Resources.checkpointFolderIdColumn);
  }

  public async listRepliesToAsync(sent: Message): Promise<readonly Message[]> {
    const rows = await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectRepliesTo, [sent.chatId, sent.sequence, sent.id]));
    return rows.map(t => MessagesService.read(t));
  }

  public async listTeammateUsageAsync(): Promise<readonly TeammateUsage[]> {
    return (await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectTeammateUsage, []))).map(t => new TeammateUsage(
      t.readString(Resources.teammateIdColumn), t.readString(Resources.conversationIdColumn), t.readString(Resources.idColumn),
      t.readNullableString(Resources.startedAtColumn), t.readNullableString(Resources.endedAtColumn),
      ReplyUsage.fromJson(JsonReader.parse(t.readString(Resources.usageColumn)).toJson())));
  }

  public async listOpenAsync(transaction?: SqlTransaction): Promise<readonly Message[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectOpenReplies, []))).map(t => MessagesService.read(t));
  }

  public async listWithRunningSubAgentsAsync(transaction?: SqlTransaction): Promise<readonly Message[]> {
    return (await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectRepliesWithRunningSubAgents, [])))
      .map(t => MessagesService.read(t));
  }

  public async nextSequenceAsync(conversationId: string, transaction?: SqlTransaction): Promise<number> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectLastSequenceByConversation, [conversationId]));
    if (Object.isUndefined(record))
      return 0;

    return record.readInteger(Resources.sequenceColumn) + 1;
  }

  public async insertAsync(message: Message, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.insertAsync(message, t));
    const json = JSON.stringify(message.toJson());
    const parameters = [message.id, message.conversationId, message.sequence, message.status, json, message.createdAt, message.createdAt];
    await transaction.executeAsync(new SqlQuery(Resources.insertMessage, parameters));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Message, message.id, ChangeOperation.Insert, json, transaction);
  }

  public async updateAsync(message: Message, transaction?: SqlTransaction): Promise<void> {
    if (Object.isUndefined(transaction))
      return this.context.database.connection.runInTransactionAsync(t => this.updateAsync(message, t));
    const json = JSON.stringify(message.toJson());
    await transaction.executeAsync(new SqlQuery(Resources.updateMessage, [message.status, json, new Date().toISOString(), message.id]));
    if (!MessagesService.openStatuses.includes(message.status))
      await this.context.database.changeFeed.appendAsync(ChangeEntity.Message, message.id, ChangeOperation.Update, json, transaction);
  }

  public async setCheckpointAsync(messageId: string, checkpointId: string, transaction?: SqlTransaction): Promise<void> {
    await (transaction ?? this.context.database.connection).executeAsync(new SqlQuery(Resources.updateMessageCheckpoint, [checkpointId, messageId]));
  }

  public async setCheckpointFolderAsync(messageId: string, folderId: string, transaction?: SqlTransaction): Promise<void> {
    await (transaction ?? this.context.database.connection).executeAsync(new SqlQuery(Resources.updateMessageCheckpointFolder, [folderId, messageId]));
  }

  private async findOneAsync(statement: string, parameter: string, transaction?: SqlTransaction): Promise<Message | null> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(statement, [parameter]));
    if (Object.isUndefined(record))
      return null;

    return MessagesService.read(record);
  }

  private static read(record: DataRecord): Message {
    return Message.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
