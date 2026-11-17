/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type IMethodHandler,
  type IToolHandler,
  PermissionOption,
  RequestContext,
  type ToolCall,
  ToolContent,
  ToolFailure,
  ToolFailureCode,
  ToolFailureException,
  ToolResult
} from "@noldova/desktop.runtime";
import type { JsonValue } from "@noldova/context.json";
import "@noldova/context.core";
import { type IConversationsService, Resources as CoreResources } from "@noldova/teamrun.core";

import { ChangeGuard } from "../enums/change-guard.js";
import type { TeamRunChange } from "../models/teamrun-change.js";
import { Resources } from "../resources.js";
import type { ChangeSubjects } from "./change-subjects.js";
import { MethodFailures } from "./method-failures.js";

export class MethodTool implements IToolHandler {
  private readonly moduleId: string;
  private readonly change: TeamRunChange;
  private readonly handler: IMethodHandler;
  private readonly subjects: ChangeSubjects;
  private readonly conversations: IConversationsService;

  public constructor(moduleId: string, change: TeamRunChange, handler: IMethodHandler, subjects: ChangeSubjects, conversations: IConversationsService) {
    this.moduleId = moduleId;
    this.change = change;
    this.handler = handler;
    this.subjects = subjects;
    this.conversations = conversations;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const [chatId, scoped] = call.scope.split(CoreResources.toolScopeSeparator) as [string, string];
    const teammateId = scoped === CoreResources.defaultToolScope ? null : scoped;
    const payload = this.change.payloadOf(call.arguments, await this.subjects.clearedOfAsync(this.change, call.arguments));
    const refusal = await this.refusalOfAsync(payload, chatId, teammateId);
    if (!Object.isNull(refusal))
      throw new ToolFailureException(new ToolFailure(ToolFailureCode.Refused, refusal));
    if (this.change.asks && (this.change.asksInOwnChat || payload[Resources.conversationIdField] !== chatId))
      await this.askAsync(call, payload);
    call.markSending();
    try {
      const result = await this.handler.handleAsync(new RequestContext(Resources.toolsClient, payload, call.signal, Resources.toolsConnection));
      const text = Object.isNull(result) ? Resources.changeDone : JSON.stringify(result);
      return new ToolResult([ToolContent.fromText(text, Resources.formatToolOrigin(this.change.descriptor.name))]);
    }
    catch (error) {
      throw new ToolFailureException(MethodFailures.of(this.moduleId, error));
    }
  }

  private async refusalOfAsync(payload: Readonly<Record<string, JsonValue>>, chatId: string, teammateId: string | null): Promise<string | null> {
    switch (this.change.guard) {
      case ChangeGuard.OwnProject: {
        const project = await this.projectOfAsync(chatId);
        return !Object.isNull(project) && payload[Resources.projectIdField] === project ? Resources.ownProjectRefused : null;
      }
      case ChangeGuard.OwnChat:
        if (payload[Resources.conversationIdField] === chatId)
          return Resources.ownChatRefused;
        return await this.isInProjectOfAsync(payload[Resources.conversationIdField], chatId) ? Resources.ownProjectChatRefused : null;
      case ChangeGuard.OwnMembership:
        return payload[Resources.conversationIdField] === chatId && payload[Resources.teammateIdField] === teammateId
          ? Resources.ownMembershipRefused : null;
      case ChangeGuard.Caller:
        return payload[Resources.teammateIdField] === teammateId ? Resources.callerRefused : null;
      case ChangeGuard.ChatFiles: {
        const conversation = await this.conversations.findAsync(String(payload[Resources.conversationIdField]));
        const count = conversation?.projectId === null ? await this.subjects.countFilesOfAsync(conversation.id) : 0;
        return count > 0 ? Resources.chatFilesMoveRefused : null;
      }
      default:
        return null;
    }
  }

  private async isInProjectOfAsync(subject: JsonValue | undefined, chatId: string): Promise<boolean> {
    const project = await this.projectOfAsync(chatId);
    return typeof subject === "string" && !Object.isNull(project) && (await this.conversations.findAsync(subject))?.projectId === project;
  }

  private async projectOfAsync(chatId: string): Promise<string | null> {
    return (await this.conversations.findAsync(chatId))?.projectId ?? null;
  }

  private async askAsync(call: ToolCall, payload: Readonly<Record<string, JsonValue>>): Promise<void> {
    const view = await this.subjects.viewOfAsync(this.change, payload);
    if (Object.isNull(view))
      return;
    const outcome = await call.requestPermissionAsync({
      action: Resources.formatPermissionAction(this.moduleId, this.change.descriptor.name),
      subject: view.subject,
      title: view.title,
      details: view.details,
      risk: this.change.descriptor.risk!.default,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });
    if (!outcome.isAllowed)
      throw new ToolFailureException(MethodFailures.ofDecision(outcome.decision));
    if ((await this.subjects.viewOfAsync(this.change, payload))?.state !== view.state)
      throw new ToolFailureException(new ToolFailure(ToolFailureCode.Stale, Resources.changedBeforeAllowed));
  }
}
