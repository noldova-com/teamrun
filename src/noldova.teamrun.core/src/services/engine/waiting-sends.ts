/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SqlTransaction } from "@noldova/context.data.sql";
import { ArgumentException } from "@noldova/context.exceptions";
import { ServiceException } from "@noldova/teamrun.services";
import { AttachmentInput, type ChatIdParams, type Conversation, DetailKind, ErrorCode, Event, EventName, Message, type MessageAttachment, MessageAuthor,
  MessageDelivery, MessageDetail, MessageSendParams, MessageStatus, Resources as ProtocolResources, TeammateMention, WaitingMessage,
  type WaitingMessageAddParams, type WaitingMessageEditParams, type WaitingMessageIdParams, WaitingMessagesPayload } from "@noldova/teamrun.protocol";

import type { IEngineCallbacks } from "../../interfaces/i-engine-callbacks.js";
import type { IEventSink } from "../../interfaces/i-event-sink.js";
import type { ILog } from "../../interfaces/i-log.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import { Guid } from "../../models/guid.js";
import { KeptWaitingFiles } from "../../models/kept-waiting-files.js";
import { TurnSteer } from "../../models/turn-steer.js";
import { WaitingEdit } from "../../models/waiting-edit.js";
import { Resources } from "../../resources.js";
import type { DatabaseContext } from "../database-context.js";
import { AttachmentStore } from "./attachment-store.js";
import type { EngineServices } from "./engine-services.js";
import { MentionCheck } from "./mention-check.js";
import type { ReplyRun } from "./reply-run.js";
import type { TurnState } from "./turn-state.js";
import { WaitingMessages } from "./waiting-messages.js";

export class WaitingSends {
  private readonly context: DatabaseContext;
  private readonly messages: IMessagesService;
  private readonly teammates: ITeammatesService;
  private readonly events: IEventSink;
  private readonly log: ILog | null;
  private readonly attachments: AttachmentStore;
  private readonly state: TurnState;
  private readonly waiting: WaitingMessages;
  private readonly steering: Set<string> = new Set();
  private lastWaitingTime: number = 0;
  private readonly requireConversationAsync: IEngineCallbacks["requireConversationAsync"];
  private readonly sendMessageAsync: IEngineCallbacks["sendMessageAsync"];
  private readonly refuseRaisedModeAsync: IEngineCallbacks["refuseRaisedModeAsync"];
  private readonly findGroup: IEngineCallbacks["findGroup"];
  private readonly stopAsync: IEngineCallbacks["stopAsync"];
  private readonly isIdleAsync: IEngineCallbacks["isIdleAsync"];
  private readonly beginSending: IEngineCallbacks["beginSending"];
  private readonly endSending: IEngineCallbacks["endSending"];
  private readonly track: IEngineCallbacks["track"];
  private readonly settleSafelyAsync: IEngineCallbacks["settleSafelyAsync"];

  public constructor(services: EngineServices, state: TurnState, callbacks: IEngineCallbacks) {
    this.context = services.context;
    this.messages = services.messages;
    this.teammates = services.teammates;
    this.events = services.events;
    this.log = services.log;
    this.attachments = services.attachments;
    this.state = state;
    this.waiting = new WaitingMessages(services.context, services.log);
    this.requireConversationAsync = callbacks.requireConversationAsync;
    this.sendMessageAsync = callbacks.sendMessageAsync;
    this.refuseRaisedModeAsync = callbacks.refuseRaisedModeAsync;
    this.findGroup = callbacks.findGroup;
    this.stopAsync = callbacks.stopAsync;
    this.isIdleAsync = callbacks.isIdleAsync;
    this.beginSending = callbacks.beginSending;
    this.endSending = callbacks.endSending;
    this.track = callbacks.track;
    this.settleSafelyAsync = callbacks.settleSafelyAsync;
  }

  public async addWaitingAsync(params: WaitingMessageAddParams, fromOutside: boolean): Promise<WaitingMessage> {
    const conversation = await this.requireConversationAsync(params.message.chatId);
    const fit = await this.fitWaitingAsync(params.message, conversation);
    this.lastWaitingTime = Math.max(Date.now(), this.lastWaitingTime + 1);
    const checked = new WaitingMessage(Guid.createVersion7().toString(), params.delivery, fit, new Date(this.lastWaitingTime).toISOString(), null, fromOutside);
    const added = checked.withMessage(this.keepWaitingFiles(checked.id, fit).message);
    await this.waiting.addAsync(added);
    await this.publishWaitingAsync(conversation.id);
    await this.deliverStoredAsync(added);
    return added;
  }

  public async listWaitingAsync(params: ChatIdParams): Promise<WaitingMessagesPayload> {
    const conversation = await this.requireConversationAsync(params.chatId);
    return new WaitingMessagesPayload(conversation.id, await this.waiting.listAsync(conversation.id));
  }

  public async editWaitingAsync(params: WaitingMessageEditParams, fromOutside: boolean): Promise<WaitingMessage> {
    const { current, edited, kept } = await this.context.database.connection.runInTransactionAsync(async (transaction): Promise<WaitingEdit> => {
      const found = await this.requireWaitingAsync(params.id, transaction);
      if (params.message.chatId !== found.chatId)
        throw new ServiceException(ErrorCode.InvalidParams, Resources.formatWaitingMessageOtherChat(found.id, params.message.chatId),
          [found.id, params.message.chatId]);
      const fit = await this.fitWaitingAsync(params.message, await this.requireConversationAsync(found.chatId, transaction), transaction);
      const kept = this.keepWaitingFiles(found.id, fit);
      const changed = found.withMessage(kept.message, found.fromOutside || fromOutside);
      await this.waiting.updateAsync(changed, transaction);
      return new WaitingEdit(found, changed, kept.files);
    });
    this.removeWaitingFiles(current.id, () => this.attachments.removeWaitingFiles(current.chatId, current.id, kept));
    await this.publishWaitingAsync(edited.chatId);
    await this.sendWaitingAsync(edited.chatId);
    return edited;
  }

  public async removeWaitingAsync(params: WaitingMessageIdParams): Promise<void> {
    const current = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const found = await this.requireWaitingAsync(params.id, transaction);
      await this.waiting.removeAsync(found.id, transaction);
      return found;
    });
    this.removeWaitingFiles(current.id, () => this.attachments.removeWaitingFiles(current.chatId, current.id));
    await this.publishWaitingAsync(current.chatId);
  }

  public async sendWaitingNowAsync(params: WaitingMessageIdParams): Promise<WaitingMessage> {
    const now = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const current = await this.requireWaitingAsync(params.id, transaction);
      const changed = current.withMessage(current.message).withDelivery(MessageDelivery.StopAndSend);
      await this.waiting.updateAsync(changed, transaction);
      return changed;
    });
    await this.publishWaitingAsync(now.chatId);
    await this.deliverStoredAsync(now);
    return now;
  }

  public async resumeAsync(): Promise<void> {
    const held = new Set(await this.waiting.idsAsync());
    for (const folder of this.attachments.listWaitingFolders())
      if (!held.has(folder.waitingId))
        this.removeWaitingFiles(folder.waitingId, () => this.attachments.removeWaitingFiles(folder.chatId, folder.waitingId));
    for (const chatId of await this.waiting.chatIdsAsync())
      await this.sendWaitingAsync(chatId);
  }

  public async sendWaitingAsync(chatId: string): Promise<void> {
    if (this.state.closing || this.steering.has(chatId) || !this.beginSending(chatId))
      return;
    let idle = false;
    let shown = true;
    let taken: WaitingMessage | undefined;
    try {
      idle = await this.isIdleAsync(chatId, true);
      if (idle && !this.state.closing && !this.steering.has(chatId))
        taken = await this.context.database.connection.runInTransactionAsync(async transaction => {
          const found = (await this.waiting.listAsync(chatId, transaction)).find(t => Object.isNull(t.failure));
          if (!Object.isUndefined(found))
            await this.waiting.removeAsync(found.id, transaction);
          return found;
        });
      if (!Object.isUndefined(taken))
        shown = await this.showWaitingAsync(chatId);
    }
    catch (error) {
      this.endSending(chatId);
      throw error;
    }
    if (Object.isUndefined(taken)) {
      this.endSending(chatId);
      if (!idle)
        await this.steerWaitingAsync(chatId);
      return;
    }
    const next = taken;
    this.track(chatId, this.sendNextAsync(next).finally(() => this.endSending(chatId)).then(async () => {
      this.removeWaitingFiles(next.id, () => this.attachments.removeWaitingFiles(chatId, next.id));
      if (!shown)
        await this.showWaitingAsync(chatId);
      await this.sendWaitingAsync(chatId);
    }, async (error: unknown) => {
      this.log?.write(Resources.formatWaitingMessageNotSent(chatId, Resources.formatFailureKind(error)));
      await this.settleSafelyAsync(chatId, async () => {
        await this.waiting.addAsync(next.withFailure(error instanceof ServiceException ? error.message : Resources.waitingMessageNotSent));
        await this.publishWaitingAsync(chatId);
        await this.sendWaitingAsync(chatId);
      });
    }));
  }

  private async sendNextAsync(next: WaitingMessage): Promise<void> {
    if (next.fromOutside)
      await this.refuseRaisedModeAsync(next.message);
    await this.sendMessageAsync(next.message, null, null, undefined);
  }

  private removeWaitingFiles(waitingId: string, remove: () => void): void {
    try {
      remove();
    }
    catch (error) {
      this.log?.write(Resources.formatWaitingFilesNotRemoved(waitingId, Resources.formatFailureKind(error)));
    }
  }

  private keepWaitingFiles(id: string, message: MessageSendParams): KeptWaitingFiles {
    const kept = this.attachments.saveWaiting(message.chatId, id, message.attachments);
    return new KeptWaitingFiles(new MessageSendParams(message.chatId, message.text, message.requested, message.providerId, kept.map(t => new AttachmentInput(t.name, t.mediaType, null, t.path)),
      message.mentionedTeammateIds, message.responderTeammateId, message.senderToken, message.wakeWhenDone), kept);
  }

  private async fitWaitingAsync(message: MessageSendParams, conversation: Conversation, transaction?: SqlTransaction): Promise<MessageSendParams> {
    if (!Object.isNull(message.senderToken))
      throw new ArgumentException(ProtocolResources.waitingFromPersonOnly, ProtocolResources.messageField);
    if (!Object.isNull(conversation.organizationChat))
      return new MessageSendParams(message.chatId, message.text, message.requested, message.providerId, message.attachments, [], message.responderTeammateId,
        message.senderToken, message.wakeWhenDone);
    const available = (await this.teammates.listAsync(transaction)).map(t => new TeammateMention(t.id, t.name));
    if (!MentionCheck.matches(message.text, message.mentionedTeammateIds, available, false))
      throw new ServiceException(ErrorCode.Conflict, Resources.waitingMentionsMismatch, []);
    return message;
  }

  private async requireWaitingAsync(id: string, transaction: SqlTransaction): Promise<WaitingMessage> {
    const found = await this.waiting.findAsync(id, transaction);
    if (Object.isNull(found))
      throw new ServiceException(ErrorCode.NotFound, Resources.formatWaitingMessageNotFound(id), [id]);
    return found;
  }

  private showWaitingAsync(chatId: string): Promise<boolean> {
    return this.publishWaitingAsync(chatId).then(() => true, (error: unknown) => {
      this.log?.write(Resources.formatWaitingMessagesNotShown(chatId, Resources.formatFailureKind(error)));
      return false;
    });
  }

  private async publishWaitingAsync(chatId: string): Promise<void> {
    this.events.publish(new Event(EventName.WaitingMessagesChanged, new WaitingMessagesPayload(chatId, await this.waiting.listAsync(chatId)).toJson()));
  }

  private async deliverStoredAsync(message: WaitingMessage): Promise<void> {
    try {
      await this.deliverWaitingAsync(message);
    }
    catch (error) {
      this.log?.write(Resources.formatWaitingMessageNotDelivered(message.chatId, Resources.formatFailureKind(error)));
    }
  }

  private async deliverWaitingAsync(message: WaitingMessage): Promise<void> {
    const group = this.findGroup(message.chatId);
    if (message.delivery === MessageDelivery.StopAndSend && !Object.isNull(group))
      for (const item of group)
        await this.stopAsync(item);
    else
      await this.sendWaitingAsync(message.chatId);
  }

  private async steerWaitingAsync(chatId: string): Promise<void> {
    const waiting = await this.waiting.listAsync(chatId);
    const group = this.findGroup(chatId);
    if (this.steering.has(chatId) || Object.isNull(group))
      return;
    for (const steered of waiting.filter(t => t.delivery === MessageDelivery.Steer && Object.isNull(t.failure)))
      for (const [item, run] of this.state.replyRuns)
        if (run.isSteerable && group.includes(item) && WaitingSends.steersInto(steered.message, item.message)) {
          this.steering.add(chatId);
          this.track(chatId, this.steerIntoAsync(steered, item.message, run).catch((error: unknown) => {
            this.log?.write(Resources.formatSteeredMessageNotKept(chatId, Resources.formatFailureKind(error)));
          }).finally(() => {
            this.steering.delete(chatId);
            this.track(chatId, this.sendWaitingAsync(chatId));
          }));
          return;
        }
  }

  private async steerIntoAsync(listed: WaitingMessage, reply: Message, run: ReplyRun): Promise<void> {
    const chatId = listed.chatId;
    const waiting = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const found = await this.waiting.findAsync(listed.id, transaction);
      if (Object.isNull(found) || found.delivery !== MessageDelivery.Steer || !Object.isNull(found.failure) || !WaitingSends.steersInto(found.message, reply))
        return null;
      await this.waiting.removeAsync(found.id, transaction);
      return found;
    });
    if (Object.isNull(waiting))
      return;
    const shown = await this.showWaitingAsync(chatId);
    let saved: readonly MessageAttachment[] = [];
    let steered = false;
    try {
      saved = this.attachments.save(waiting.message.attachments);
      steered = await run.steer(new TurnSteer(AttachmentStore.formatPrompt(waiting.message.text, saved), saved));
    }
    catch (error) {
      this.log?.write(Resources.formatWaitingMessageNotSent(chatId, Resources.formatFailureKind(error)));
    }
    if (!steered) {
      this.attachments.discard(saved);
      await this.waiting.addAsync(waiting.withDelivery(MessageDelivery.Queue));
      await this.publishWaitingAsync(chatId);
      return;
    }
    this.removeWaitingFiles(waiting.id, () => this.attachments.removeWaitingFiles(chatId, waiting.id));
    const now = new Date().toISOString();
    const params = waiting.message;
    const mentions = (await this.teammates.listAsync()).filter(t => params.mentionedTeammateIds.includes(t.id)).map(t => new TeammateMention(t.id, t.name));
    const message = await this.context.database.connection.runInTransactionAsync(async transaction => {
      const inserted = new Message(Guid.createVersion7().toString(), chatId, await this.messages.nextSequenceAsync(chatId, transaction), MessageAuthor.User, null,
        MessageStatus.Completed, [new MessageDetail(0, DetailKind.Text, params.text, { [Resources.steeredIntoField]: reply.id }, now)], null, now, null, now, saved,
        null, null, mentions, null);
      await this.messages.insertAsync(inserted, transaction);
      return inserted;
    });
    this.events.publish(new Event(EventName.MessageCreated, message.toJson()));
    if (!shown)
      await this.showWaitingAsync(chatId);
  }

  private static steersInto(message: MessageSendParams, reply: Message): boolean {
    const named = Object.isNull(message.responderTeammateId) ? message.mentionedTeammateIds : [...message.mentionedTeammateIds, message.responderTeammateId];
    return named.length === 0 || (!Object.isNull(reply.teammateId) && named.includes(reply.teammateId));
  }
}
