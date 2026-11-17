/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes } from "node:crypto";

import "@noldova/context.core";
import { ChangeOperation } from "@noldova/context.data";
import { SqlQuery, type SqlTransaction } from "@noldova/context.data.sql";
import { JsonReader, type JsonObject } from "@noldova/context.json";
import { ChatCreateParams, DetailKind, Event, EventName, type Message, MessageAuthor, MessageListParams, MessageStatus, type Teammate } from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import { OutsideReplyState } from "../../enums/outside-reply-state.js";
import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import { OutsideReply } from "../../models/outside-reply.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class OutsideChats {
  private readonly context: DatabaseContext;
  private readonly conversations: IConversationsService;
  private readonly messages: IMessagesService;
  private readonly events: IEventSink;

  public constructor(context: DatabaseContext, conversations: IConversationsService, messages: IMessagesService, events: IEventSink) {
    this.context = context;
    this.conversations = conversations;
    this.messages = messages;
    this.events = events;
  }

  public async isOutsideAsync(chatId: string, transaction?: SqlTransaction): Promise<boolean> {
    return Object.values(await this.readAsync(Resources.outsideChatsPreference, transaction)).includes(chatId);
  }

  public async prepareAsync(teammate: Teammate): Promise<string> {
    const [chatId, made] = await this.context.database.connection.runInTransactionAsync(async (transaction): Promise<readonly [string, boolean]> => {
      const chats = await this.readAsync(Resources.outsideChatsPreference, transaction);
      const known = chats[teammate.id];
      if (Object.isString(known) && !Object.isNull(await this.conversations.findAsync(known, transaction)))
        return [known, false];
      const chat = await this.conversations.createAsync(new ChatCreateParams(null, Resources.formatOutsideChatTitle(teammate.name), teammate.id), transaction);
      await this.writeAsync(Resources.outsideChatsPreference, { ...chats, [teammate.id]: chat.id }, transaction);
      return [chat.id, true];
    });
    if (made)
      this.events.publish(new Event(EventName.StateInvalidated, null));
    return chatId;
  }

  public async rememberAsync(messageId: string): Promise<string> {
    const handle = randomBytes(Resources.outsideMessageIdBytes).toString("base64url");
    await this.context.database.connection.runInTransactionAsync(async transaction => {
      const kept = Object.entries(await this.readAsync(Resources.outsideMessagesPreference, transaction)).slice(1 - Resources.outsideMessagesKept);
      await this.writeAsync(Resources.outsideMessagesPreference, Object.fromEntries([...kept, [handle, messageId]]), transaction);
    });
    return handle;
  }

  public async forgetAsync(): Promise<void> {
    await this.context.database.connection.runInTransactionAsync(t => this.writeAsync(Resources.outsideMessagesPreference, {}, t));
  }

  public async replyToAsync(handle: string): Promise<OutsideReply> {
    const messageId = (await this.readAsync(Resources.outsideMessagesPreference))[handle];
    const message = Object.isString(messageId) ? await this.messages.findAsync(messageId) : null;
    if (Object.isNull(message))
      return new OutsideReply(handle, OutsideReplyState.Unknown);
    const reply = (await this.messages.listAsync(new MessageListParams(message.conversationId, message.sequence)))
      .find(t => t.author === MessageAuthor.Provider && t.inReplyTo === message.id) ?? null;
    return Object.isNull(reply) ? new OutsideReply(handle, OutsideReplyState.Failed, Resources.outsideReplyNotStarted) : OutsideChats.replyOf(handle, reply);
  }

  private static replyOf(handle: string, reply: Message): OutsideReply {
    switch (reply.status) {
      case MessageStatus.Pending:
        return new OutsideReply(handle, OutsideReplyState.Waiting);
      case MessageStatus.Running:
      case MessageStatus.AwaitingApproval:
        return new OutsideReply(handle, OutsideReplyState.Working);
      case MessageStatus.Completed:
        return new OutsideReply(handle, OutsideReplyState.Answered, OutsideChats.textOf(reply, DetailKind.Text));
      default:
        return new OutsideReply(handle, OutsideReplyState.Failed, OutsideChats.textOf(reply, DetailKind.Error) || Resources.outsideReplyFailed);
    }
  }

  private static textOf(reply: Message, kind: DetailKind): string {
    return reply.details.filter(t => t.kind === kind).map(t => t.text.trim()).filter(t => t.length > 0).join(Resources.transcriptSeparator);
  }

  private async readAsync(name: string, transaction?: SqlTransaction): Promise<JsonObject> {
    const [record] = await (transaction ?? this.context.database.connection).queryAsync(new SqlQuery(Resources.selectPreference, [name]));
    return Object.isUndefined(record) ? {} : JsonReader.parse(record.readString(Resources.jsonColumn)).toJson();
  }

  private async writeAsync(name: string, value: JsonObject, transaction: SqlTransaction): Promise<void> {
    const json = JSON.stringify(value);
    await transaction.executeAsync(new SqlQuery(Resources.upsertPreference, [name, json, new Date().toISOString()]));
    await this.context.database.changeFeed.appendAsync(ChangeEntity.Preference, name, ChangeOperation.Update, json, transaction);
  }
}
