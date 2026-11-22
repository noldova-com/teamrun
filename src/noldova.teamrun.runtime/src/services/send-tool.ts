/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  type IToolHandler,
  PermissionDetailKind,
  PermissionOption,
  type ToolCall,
  ToolContent,
  ToolFailure,
  ToolFailureCode,
  ToolFailureException,
  ToolResult,
  ToolRisk
} from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { type ISenderSends, type ISenderTokens, type ITeammatesService, Resources as CoreResources, type SendAsk } from "@noldova/teamrun.core";
import { MentionResolver, MessageSendParams, TeammateMention } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import { DispatchedMethod } from "./dispatched-method.js";
import { MethodFailures } from "./method-failures.js";

export class SendTool implements IToolHandler {
  private readonly moduleId: string;
  private readonly senders: ISenderTokens;
  private readonly sends: ISenderSends;
  private readonly teammates: ITeammatesService;

  public constructor(moduleId: string, senders: ISenderTokens, sends: ISenderSends, teammates: ITeammatesService) {
    this.moduleId = moduleId;
    this.senders = senders;
    this.sends = sends;
    this.teammates = teammates;
  }

  public async handleAsync(call: ToolCall): Promise<ToolResult> {
    const token = this.senders.senderTokenOf(call.session);
    if (Object.isNull(token))
      throw new ToolFailureException(new ToolFailure(ToolFailureCode.Refused, Resources.noRunningTurn));
    const text = call.arguments[Resources.textArgument] as string;
    const mentioned = MentionResolver.resolveTeammateText(text, (await this.teammates.listAsync()).map(t => new TeammateMention(t.id, t.name))).map(t => t.teammateId);
    const params = new MessageSendParams(call.arguments[Resources.chatIdArgument] as string, text, null, null, [], mentioned, null, token,
      call.arguments[Resources.wakeWhenDoneArgument] === true);
    const sendId = this.sends.announceSend(params);
    try {
      return await this.sendAsync(call, params);
    }
    catch (error) {
      if (!Object.isNull(sendId))
        this.sends.abandonSend(sendId);
      throw error;
    }
  }

  private async sendAsync(call: ToolCall, params: MessageSendParams): Promise<ToolResult> {
    const ask = await this.sends.describeSendAsync(params);
    if (!Object.isNull(ask))
      await this.askAsync(call, ask, params);
    call.markSending();
    try {
      const result = await this.sends.sendAllowedAsync(params, ask?.starts ?? null);
      return new ToolResult([ToolContent.fromText(JSON.stringify(result.toJson()), Resources.formatToolOrigin(Resources.sendMessageTool))]);
    }
    catch (error) {
      throw new ToolFailureException(MethodFailures.of(this.moduleId, DispatchedMethod.failureOf(error)));
    }
  }

  private async askAsync(call: ToolCall, ask: SendAsk, params: MessageSendParams): Promise<void> {
    const outcome = await call.requestPermissionAsync({
      action: Resources.formatPermissionAction(this.moduleId, Resources.sendMessageTool),
      subject: ask.chatId,
      title: ask.title,
      details: [
        { label: CoreResources.sendChatLabel, kind: PermissionDetailKind.Text, value: ask.chatTitle },
        { label: CoreResources.sendStartsLabel, kind: PermissionDetailKind.Text, value: ask.starts },
        { label: CoreResources.sendMessageLabel, kind: PermissionDetailKind.AgentText, value: params.text }
      ],
      risk: ToolRisk.Medium,
      options: [PermissionOption.AllowOnce, PermissionOption.Deny]
    });
    if (!outcome.isAllowed)
      throw new ToolFailureException(MethodFailures.ofDecision(outcome.decision));
    if ((await this.sends.describeSendAsync(params))?.starts !== ask.starts)
      throw new ToolFailureException(new ToolFailure(ToolFailureCode.Stale, Resources.changedBeforeAllowed));
  }
}
