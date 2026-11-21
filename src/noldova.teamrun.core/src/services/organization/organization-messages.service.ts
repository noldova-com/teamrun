/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ChangeOperation, type DataRecord } from "@noldova/context.data";
import { SqlQuery } from "@noldova/context.data.sql";
import { JsonReader } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import {
  ErrorCode, Event, EventName, type Message, MessageIdParams, MessageStatus, type Organization, OrganizationMessage, type OrganizationMessageSendParams,
  OrganizationRecipient, OrganizationRecipientState, type OrganizationTarget, OrganizationTargetKind, type Teammate
} from "@noldova/teamrun.protocol";

import { ChangeEntity } from "../../enums/change-entity.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IOrganizationMessagesService } from "../../interfaces/i-organization-messages.service.js";
import type { IOrganizationSender } from "../../interfaces/i-organization-sender.js";
import type { IOrganizationService } from "../../interfaces/i-organization.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { Guid } from "../../models/guid.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";

export class OrganizationMessagesService implements IOrganizationMessagesService {
  private readonly context: DatabaseContext;
  private readonly organization: IOrganizationService;
  private readonly teammates: ITeammatesService;
  private readonly messages: IMessagesService;
  private readonly sender: IOrganizationSender;
  private readonly events: IEventSink;

  public constructor(context: DatabaseContext, organization: IOrganizationService, teammates: ITeammatesService, messages: IMessagesService,
    sender: IOrganizationSender, events: IEventSink) {
    this.context = context;
    this.organization = organization;
    this.teammates = teammates;
    this.messages = messages;
    this.sender = sender;
    this.events = events;
  }

  public async listAsync(): Promise<readonly OrganizationMessage[]> {
    const records = await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectOrganizationMessages));
    return records.map(t => OrganizationMessagesService.read(t));
  }

  public async sendAsync(params: OrganizationMessageSendParams): Promise<OrganizationMessage> {
    const message = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const organization = await this.organization.listAsync(transaction);
      const teammates = await this.teammates.listAsync(transaction);
      OrganizationMessagesService.requireTarget(params.target, organization, teammates);
      const ids = organization.recipientsOf(params.target, teammates.map(t => t.id));
      const recipients = teammates.filter(t => ids.includes(t.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
        .map(t => new OrganizationRecipient(t.id, t.name, OrganizationRecipientState.Queued));
      const now = new Date().toISOString();
      const message = new OrganizationMessage(Guid.createVersion7().toString(), params.target, params.text, now, recipients);
      const json = JSON.stringify(message.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.insertOrganizationMessage, [message.id, json, now]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.OrganizationMessage, message.id, ChangeOperation.Insert, json, transaction);
      return message;
    });
    this.events.publish(new Event(EventName.OrganizationMessageUpdated, message.toJson()));
    await Promise.all(message.recipients.map(t => this.startAsync(message.id, t.teammateId, params.text)));
    return await this.requireAsync(message.id);
  }

  public async stopAsync(params: MessageIdParams): Promise<OrganizationMessage> {
    const id = params.messageId;
    await this.requireAsync(id);
    const message = await this.changeAsync(id, t => t.state === OrganizationRecipientState.Queued ? t.with(OrganizationRecipientState.Stopped) : t);
    const started = new Set(message.recipients.filter(t => t.state === OrganizationRecipientState.Started).map(t => t.messageId));
    const waiting = (await this.messages.listOpenAsync()).filter(t => t.status === MessageStatus.Pending && started.has(t.inReplyTo));
    await Promise.all(waiting.map(t => this.sender.cancelAsync(new MessageIdParams(t.id))));
    const halted = new Set(waiting.map(t => t.inReplyTo));
    return halted.size === 0 ? message : await this.changeAsync(id,
      t => t.state === OrganizationRecipientState.Started && halted.has(t.messageId) ? t.with(OrganizationRecipientState.Stopped) : t);
  }

  public async listRepliesAsync(params: MessageIdParams): Promise<readonly Message[]> {
    const message = await this.requireAsync(params.messageId);
    const sent = await Promise.all(message.recipients.map(t => Object.isNull(t.messageId) ? null : this.messages.findAsync(t.messageId)));
    return (await Promise.all(sent.filter(t => !Object.isNull(t)).map(t => this.messages.listRepliesToAsync(t)))).flat();
  }

  public async reconcileAsync(): Promise<void> {
    for (const message of await this.listAsync())
      if (message.recipients.some(t => t.state === OrganizationRecipientState.Queued))
        await this.changeAsync(message.id, t => t.state === OrganizationRecipientState.Queued
          ? t.with(OrganizationRecipientState.Failed, undefined, undefined, Resources.organizationSendInterrupted) : t);
  }

  private async startAsync(messageId: string, teammateId: string, text: string): Promise<void> {
    const change = (state: OrganizationRecipientState, chatId: string | null, sentId: string | null, reason: string | null) =>
      this.changeAsync(messageId, t => t.teammateId === teammateId && t.state === OrganizationRecipientState.Queued ? t.with(state, chatId, sentId, reason) : t);
    try {
      const result = await this.sender.startOutsideAsync(teammateId, text, Resources.organizationMessageLabel);
      const message = await change(OrganizationRecipientState.Started, result.sent.chatId, result.sent.id, null);
      if (message.recipients.some(t => t.teammateId === teammateId && t.state === OrganizationRecipientState.Started))
        return;
      for (const reply of result.replies)
        await this.sender.cancelAsync(new MessageIdParams(reply.id));
      await this.changeAsync(messageId, t => t.teammateId === teammateId ? t.with(t.state, result.sent.chatId, result.sent.id) : t);
    }
    catch (error) {
      const removed = error instanceof ServiceException && error.info.name === ErrorCode.NotFound;
      await change(removed ? OrganizationRecipientState.Removed : OrganizationRecipientState.Failed, null, null,
        removed ? null : error instanceof Error ? error.message : String(error));
    }
  }

  private async changeAsync(messageId: string, change: (recipient: OrganizationRecipient) => OrganizationRecipient): Promise<OrganizationMessage> {
    const message = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const [record] = await transaction.queryAsync(new SqlQuery(Resources.selectOrganizationMessage, [messageId]));
      const current = OrganizationMessagesService.read(OrganizationMessagesService.require(record, messageId));
      const changed = new OrganizationMessage(current.id, current.target, current.text, current.createdAt, current.recipients.map(change));
      const json = JSON.stringify(changed.toJson());
      await transaction.executeAsync(new SqlQuery(Resources.updateOrganizationMessage, [json, messageId]));
      await this.context.database.changeFeed.appendAsync(ChangeEntity.OrganizationMessage, messageId, ChangeOperation.Update, json, transaction);
      return changed;
    });
    this.events.publish(new Event(EventName.OrganizationMessageUpdated, message.toJson()));
    return message;
  }

  private async requireAsync(messageId: string): Promise<OrganizationMessage> {
    const [record] = await this.context.database.connection.queryAsync(new SqlQuery(Resources.selectOrganizationMessage, [messageId]));
    return OrganizationMessagesService.read(OrganizationMessagesService.require(record, messageId));
  }

  private static requireTarget(target: OrganizationTarget, organization: Organization, teammates: readonly Teammate[]): void {
    if (target.kind === OrganizationTargetKind.Department && !organization.departments.some(t => t.id === target.id))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatDepartmentNotFound(String(target.id)), [String(target.id)]);
    if (target.kind === OrganizationTargetKind.Teammate && !teammates.some(t => t.id === target.id))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatTeammateNotFound(String(target.id)), [String(target.id)]);
  }

  private static require(record: DataRecord | undefined, messageId: string): DataRecord {
    if (Object.isUndefined(record))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatOrganizationMessageNotFound(messageId), [messageId]);
    return record;
  }

  private static read(record: DataRecord): OrganizationMessage {
    return OrganizationMessage.fromJson(JsonReader.parse(record.readString(Resources.jsonColumn)).toJson());
  }
}
