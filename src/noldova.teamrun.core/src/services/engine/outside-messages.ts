/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { SqlTransaction } from "@noldova/context.data.sql";
import type { JsonObject } from "@noldova/context.json";
import { ServiceException } from "@noldova/teamrun.services";
import { type Conversation, ConversationIdParams, ErrorCode, MessageSender, MessageSendParams, type MessageSendResult, type Teammate } from "@noldova/teamrun.protocol";

import type { IConversationsService } from "../../interfaces/i-conversations.service.js";
import type { IEngineCallbacks } from "../../interfaces/i-engine-callbacks.js";
import type { IMessagesService } from "../../interfaces/i-messages.service.js";
import type { IOutsideMessages } from "../../interfaces/i-outside-messages.js";
import type { IProjectsService } from "../../interfaces/i-projects.service.js";
import type { IProvidersService } from "../../interfaces/i-providers.service.js";
import type { ITeammatesService } from "../../interfaces/i-teammates.service.js";
import type { OutsideReply } from "../../models/outside-reply.js";
import { Resources } from "../../resources.js";
import type { EngineServices } from "./engine-services.js";
import { OutsideChats } from "./outside-chats.js";

export class OutsideMessages implements IOutsideMessages {
  private readonly projects: IProjectsService;
  private readonly conversations: IConversationsService;
  private readonly messages: IMessagesService;
  private readonly providers: IProvidersService;
  private readonly teammates: ITeammatesService;
  private readonly outside: OutsideChats;
  private readonly requireConversationAsync: IEngineCallbacks["requireConversationAsync"];
  private readonly requireTeammateAsync: IEngineCallbacks["requireTeammateAsync"];
  private readonly capEndsTasksAsync: IEngineCallbacks["capEndsTasksAsync"];
  private readonly sendMessageAsync: IEngineCallbacks["sendMessageAsync"];

  public constructor(services: EngineServices, callbacks: IEngineCallbacks) {
    this.projects = services.projects;
    this.conversations = services.conversations;
    this.messages = services.messages;
    this.providers = services.providers;
    this.teammates = services.teammates;
    this.outside = new OutsideChats(services.context, services.conversations, services.messages, services.events);
    this.requireConversationAsync = callbacks.requireConversationAsync;
    this.requireTeammateAsync = callbacks.requireTeammateAsync;
    this.capEndsTasksAsync = callbacks.capEndsTasksAsync;
    this.sendMessageAsync = callbacks.sendMessageAsync;
  }

  public isOutsideAsync(chatId: string, transaction?: SqlTransaction): Promise<boolean> {
    return this.outside.isOutsideAsync(chatId, transaction);
  }

  public async sendOutsideAsync(teammateId: string | null, text: string, label: string, chatId: string | null = null): Promise<string> {
    const teammate = !Object.isNull(chatId) ? await this.outsideTeammateInAsync(await this.requireConversationAsync(chatId), teammateId)
      : !Object.isNull(teammateId) ? await this.requireTeammateAsync(teammateId) : null;
    if (Object.isNull(teammate))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.outsideTeammateOrChatRequired, []);
    const result = await this.startAsync(teammate, text, label, chatId, false);
    return this.outside.rememberAsync(result.sent.id);
  }

  public async startOutsideAsync(teammateId: string, text: string, label: string): Promise<MessageSendResult> {
    return this.startAsync(await this.requireTeammateAsync(teammateId), text, label, null, true);
  }

  public async listOutsideChatsAsync(): Promise<readonly JsonObject[]> {
    const working = new Set((await this.messages.listOpenAsync()).map(t => t.conversationId));
    const projects = new Map((await this.projects.listProjectsAsync()).map(t => [t.id, t.name]));
    const named = (teammate: Teammate): JsonObject => ({ [Resources.outsideIdField]: teammate.id, [Resources.outsideNameField]: teammate.name });
    const listed: JsonObject[] = [];
    for (const chat of await this.conversations.listRecentAsync(Resources.outsideChatsListed)) {
      const members = await this.membersOfAsync(chat.id);
      const answerer = OutsideMessages.answererOf(chat, members);
      listed.push({
        [Resources.outsideIdField]: chat.id,
        [Resources.outsideTitleField]: chat.title,
        [Resources.outsideProjectField]: projects.get(chat.projectId ?? String.empty) ?? null,
        [Resources.outsideTeammateField]: Object.isNull(answerer) ? null : named(answerer),
        [Resources.outsideTeammatesField]: members.map(named),
        [Resources.stateField]: working.has(chat.id) ? Resources.outsideWorkingState : Resources.outsideIdleState
      });
    }
    return listed;
  }

  public async listOutsideAsync(): Promise<readonly JsonObject[]> {
    const working = new Set((await this.messages.listOpenAsync()).map(t => t.teammateId));
    const listed: JsonObject[] = [];
    for (const t of await this.teammates.listAsync())
      listed.push({
        [Resources.outsideIdField]: t.id,
        [Resources.outsideNameField]: t.name,
        [Resources.outsideProviderField]: (await this.providers.findAsync(t.providerId))?.kind ?? null,
        [Resources.outsideModelField]: t.model,
        [Resources.stateField]: working.has(t.id) ? Resources.outsideWorkingState : Resources.outsideIdleState
      });
    return listed;
  }

  public readOutsideAsync(messageId: string): Promise<OutsideReply> {
    return this.outside.replyToAsync(messageId);
  }

  public forgetOutsideAsync(): Promise<void> {
    return this.outside.forgetAsync();
  }

  private async startAsync(teammate: Teammate, text: string, label: string, chatId: string | null, queues: boolean): Promise<MessageSendResult> {
    const target = chatId ?? await this.outside.prepareAsync(teammate);
    if (await this.capEndsTasksAsync(teammate, target))
      throw new ServiceException(ErrorCode.Conflict, Resources.formatOutsideCapEndsTasks(target), [target]);
    return this.sendMessageAsync(new MessageSendParams(target, text, null, null, [], [], teammate.id), null, null, undefined,
      new MessageSender(target, null, label, true), queues);
  }

  private async outsideTeammateInAsync(chat: Conversation, teammateId: string | null): Promise<Teammate> {
    const members = await this.membersOfAsync(chat.id);
    const teammate = Object.isNull(teammateId) ? OutsideMessages.answererOf(chat, members) : await this.requireTeammateAsync(teammateId);
    if (Object.isNull(teammate))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatOutsideNoTeammate(chat.id), [chat.id]);
    if (!members.some(t => t.id === teammate.id))
      throw new ServiceException(ErrorCode.InvalidParams, Resources.formatMemberNotFound(chat.id, teammate.id), [chat.id, teammate.id]);
    return teammate;
  }

  private async membersOfAsync(chatId: string): Promise<readonly Teammate[]> {
    const members: Teammate[] = [];
    for (const member of await this.conversations.listMembersAsync(new ConversationIdParams(chatId))) {
      const teammate = await this.teammates.findAsync(member.teammateId);
      if (!Object.isNull(teammate))
        members.push(teammate);
    }
    return members;
  }

  private static answererOf(chat: Conversation, members: readonly Teammate[]): Teammate | null {
    const chosen = members.filter(t => t.id === chat.responder?.teammateId);
    return (chosen.length > 0 ? chosen : members.length === 1 ? members : []).at(0) ?? null;
  }
}
