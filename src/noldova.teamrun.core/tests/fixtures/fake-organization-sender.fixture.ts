/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IOrganizationSender, MessagesService } from "@noldova/teamrun.core";
import {
  DetailKind, Message, MessageAuthor, MessageDetail, type MessageIdParams, MessageSendResult, MessageStatus, ObservedSettings, type OrganizationChat, Provenance,
  RequestedSettings
} from "@noldova/teamrun.protocol";

import { ChangeSignal } from "./change-signal.fixture.js";

export class FakeOrganizationSender implements IOrganizationSender {
  public readonly sends: string[] = [];
  public readonly cancels: string[] = [];
  public readonly holds: Map<string, Promise<void>> = new Map();
  public readonly failures: Map<string, unknown> = new Map();
  private readonly messages: MessagesService;
  private readonly chatIds: Readonly<Record<string, string>>;

  public constructor(messages: MessagesService, chatIds: Readonly<Record<string, string>>) {
    this.messages = messages;
    this.chatIds = chatIds;
  }

  public async startAsPersonAsync(chat: OrganizationChat, text: string): Promise<MessageSendResult> {
    const teammateId = chat.teammateId;
    this.sends.push(`${chat.organizationId}:${teammateId}:${text}`);
    ChangeSignal.notify();
    await (this.holds.get(teammateId) ?? Promise.resolve());
    if (this.failures.has(teammateId))
      throw this.failures.get(teammateId);
    const chatId = this.chatIds[teammateId] ?? String.empty;
    const sequence = await this.messages.nextSequenceAsync(chatId);
    const sent = new Message(`u${sequence}-${teammateId}`, chatId, sequence, MessageAuthor.User, null, MessageStatus.Completed,
      [new MessageDetail(0, DetailKind.Text, text, null, "t")], null, "t", null, "t");
    const reply = new Message(`r${sequence + 1}-${teammateId}`, chatId, sequence + 1, MessageAuthor.Provider, sent.id, MessageStatus.Pending, [],
      new Provenance(null, new RequestedSettings("fake", null, null), new ObservedSettings(null, null, null, null), null, false),
      "t", null, null, [], teammateId, teammateId);
    await this.messages.insertAsync(sent);
    await this.messages.insertAsync(reply);
    return new MessageSendResult(sent, [reply]);
  }

  public async cancelAsync(params: MessageIdParams): Promise<Message> {
    this.cancels.push(params.messageId);
    const reply = await this.messages.findAsync(params.messageId);
    if (Object.isNull(reply))
      throw new Error(`There is no reply ${params.messageId}.`);
    const cancelled = reply.withStatus(MessageStatus.Cancelled, "t");
    await this.messages.updateAsync(cancelled);
    return cancelled;
  }
}
