/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ChangeOperation, type DataRecord } from "@noldova/teamrun-foundation-data";
import { SqlQuery } from "@noldova/teamrun-foundation-data-sql";
import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Message, type MessageListParams, MessagePage, type MessagePageParams, MessageStatus, type ReplyPanel, ReplyPage, ReplySummary } from "@noldova/teamrun-protocol";

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

  public list(params: MessageListParams): readonly Message[] {
    const after = Object.isNull(params.afterSequence) ? -1 : params.afterSequence;
    const query = params.kinds.length === 0
      ? new SqlQuery(Resources.selectMessagesByConversation, [params.conversationId, after])
      : new SqlQuery(Resources.selectMessageDigest, [JSON.stringify(params.kinds), params.conversationId, after]);
    return this.context.database.connection.query(query).map(t => MessagesService.read(t));
  }

  public page(params: MessagePageParams): MessagePage {
    const connection = this.context.database.connection;
    const records = Object.isNull(params.beforeSequence) && Object.isNull(params.afterSequence)
      ? connection.query(new SqlQuery(Resources.selectNewestMessagesByConversation, [params.conversationId, params.limit])).toReversed()
      : Object.isNull(params.afterSequence)
        ? connection.query(new SqlQuery(Resources.selectMessagesBeforeSequence, [params.conversationId, params.beforeSequence, params.limit])).toReversed()
        : connection.query(new SqlQuery(Resources.selectMessagesAfterSequenceLimited, [params.conversationId, params.afterSequence, params.limit]));
    const messages = records.map(t => MessagesService.read(t));
    const first = messages[0];
    const last = messages.at(-1);
    const hasEarlier = !Object.isUndefined(first) && this.exists(Resources.selectEarlierMessageExists, params.conversationId, first.sequence);
    const hasLater = !Object.isUndefined(last) && this.exists(Resources.selectLaterMessageExists, params.conversationId, last.sequence);
    return new MessagePage(messages, hasEarlier, hasLater);
  }

  private exists(statement: string, conversationId: string, sequence: number): boolean {
    return this.context.database.connection.query(new SqlQuery(statement, [conversationId, sequence])).length > 0;
  }

  public find(messageId: string): Message | null {
    return this.findOne(Resources.selectMessageById, messageId);
  }

  public replyPage(params: MessagePageParams, panel: ReplyPanel): ReplyPage {
    const ascending = !Object.isNull(params.afterSequence);
    const query = Resources.formatReplyPageQuery(panel, ascending);
    const records = this.context.database.connection.query(new SqlQuery(query,
      [params.conversationId, params.beforeSequence ?? Resources.maximumReplySequence, params.afterSequence ?? -1, params.limit + 1]));
    const more = records.length > params.limit;
    const replies = records.slice(0, params.limit).map(t => ReplySummary.fromMessage(MessagesService.read(t)));
    if (ascending)
      replies.reverse();
    const newest = replies[0]?.preview.sequence;
    const oldest = replies.at(-1)?.preview.sequence;
    if (Object.isUndefined(newest) || Object.isUndefined(oldest))
      return new ReplyPage([], false, false);
    const exists = (before: number, after: number): boolean => this.context.database.connection.query(new SqlQuery(query,
      [params.conversationId, before, after, 1])).length > 0;
    return new ReplyPage(replies, ascending ? exists(oldest, -1) : more,
      ascending ? more : exists(Resources.maximumReplySequence, newest));
  }

  public findOpenReply(conversationId: string): Message | null {
    return this.findOne(Resources.selectOpenReplyByConversation, conversationId);
  }

  public findResumableSession(conversationId: string, provider: string, accountId: string | null): string | null {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectResumableSession, [conversationId, provider, accountId]));
    return Object.isUndefined(record) ? null : record.readString(Resources.nativeSessionIdColumn);
  }

  public listOpen(): readonly Message[] {
    return this.context.database.connection.query(new SqlQuery(Resources.selectOpenReplies, [])).map(t => MessagesService.read(t));
  }

  public nextSequence(conversationId: string): number {
    const [record] = this.context.database.connection.query(new SqlQuery(Resources.selectLastSequenceByConversation, [conversationId]));
    if (Object.isUndefined(record))
      return 0;

    return record.readInteger(Resources.sequenceColumn) + 1;
  }

  public insert(message: Message): void {
    this.context.database.transaction(() => {
      const json = JSON.stringify(message.toJson());
      const parameters = [message.id, message.conversationId, message.sequence, message.status, json, message.createdAt, message.createdAt];
      this.context.database.connection.execute(new SqlQuery(Resources.insertMessage, parameters));
      this.context.database.changeFeed.append(ChangeEntity.Message, message.id, ChangeOperation.Insert, json);
    });
  }

  public update(message: Message): void {
    this.context.database.transaction(() => {
      const json = JSON.stringify(message.toJson());
      this.context.database.connection.execute(new SqlQuery(Resources.updateMessage, [message.status, json, new Date().toISOString(), message.id]));
      if (!MessagesService.openStatuses.includes(message.status))
        this.context.database.changeFeed.append(ChangeEntity.Message, message.id, ChangeOperation.Update, json);
    });
  }

  private findOne(statement: string, parameter: string): Message | null {
    const [record] = this.context.database.connection.query(new SqlQuery(statement, [parameter]));
    if (Object.isUndefined(record))
      return null;

    return MessagesService.read(record);
  }

  private static read(record: DataRecord): Message {
    return Message.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
