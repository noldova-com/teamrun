/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delayAsync } from "node:timers/promises";

import type { JsonObject } from "@noldova/context.json";
import { CliCommandException, CliCommandResult } from "@noldova/desktop.cli";
import {
  Conversation, ConversationCreateParams, ConversationIdParams, DetailKind, Message, MessageListParams, MessageSendParams, MessageSendResult, MessageStatus,
  MethodName, type Provider, RequestedSettings
} from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class LiveCheckCommand extends TeamRunCommand {
  public readonly name: string = Resources.liveCheckCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const provider = await this.client.findProviderAsync(values.readText(Resources.providerValue), signal);
    const prompt = values.readText(Resources.promptValue);
    const startedAt = Date.now();
    const created = new ConversationCreateParams(null, Resources.liveCheckTitle);
    const chat = Conversation.fromJson(await this.client.requestAsync(MethodName.ConversationCreate, created.toJson(), signal));
    let result: CliCommandResult;
    try {
      result = await this.checkAsync(provider, prompt, chat.id, startedAt, signal);
    }
    catch (error) {
      if (await this.deletedAsync(chat.id, signal) || signal.aborted)
        throw error;
      throw error instanceof CliCommandException
        ? new CliCommandException(error.code, Resources.formatLiveCheckChatLeft(error.message, chat.id), error.details)
        : new CliCommandException(Resources.liveCheckFailedCode, Resources.formatLiveCheckChatLeft(Resources.formatReason(error), chat.id));
    }
    const deleted = await this.deletedAsync(chat.id, signal);
    return deleted ? result : new CliCommandResult(result.value, Resources.formatLiveCheckChatLeft(result.text, chat.id));
  }

  private async checkAsync(provider: Provider, prompt: string, chatId: string, startedAt: number, signal: AbortSignal): Promise<CliCommandResult> {
    const params = new MessageSendParams(chatId, prompt, new RequestedSettings(provider.kind, null, null), provider.id);
    const sent = MessageSendResult.fromJson(await this.client.requestAsync(MethodName.MessageSend, params.toJson(), signal));
    const replyId = sent.replies[0]?.id;
    if (Object.isUndefined(replyId))
      throw new CliCommandException(Resources.liveCheckFailedCode, Resources.liveCheckNoReply);
    const reply = await this.settledAsync(chatId, replyId, signal);
    if (reply.status === MessageStatus.AwaitingApproval)
      await this.client.requestAsync(MethodName.ConversationCancel, new ConversationIdParams(chatId).toJson(), signal);
    return LiveCheckCommand.resultOf(provider, prompt, reply, Date.now() - startedAt);
  }

  private async deletedAsync(chatId: string, signal: AbortSignal): Promise<boolean> {
    try {
      await this.client.requestAsync(MethodName.ConversationDelete, new ConversationIdParams(chatId).toJson(), signal);
      return true;
    }
    catch {
      return false;
    }
  }

  private async settledAsync(chatId: string, replyId: string, signal: AbortSignal): Promise<Message> {
    for (;;) {
      const messages = await this.client.listAsync(MethodName.MessageList, new MessageListParams(chatId, null).toJson(), signal, t => Message.fromJson(t));
      const reply = messages.find(t => t.id === replyId);
      if (Object.isUndefined(reply))
        throw new CliCommandException(Resources.liveCheckFailedCode, Resources.liveCheckReplyGone);
      if (Resources.liveCheckEndStatuses.includes(reply.status))
        return reply;
      await delayAsync(Resources.liveCheckPollMilliseconds, undefined, { signal });
    }
  }

  private static resultOf(provider: Provider, prompt: string, reply: Message, milliseconds: number): CliCommandResult {
    const textOf = (kind: DetailKind): string => reply.details.filter(t => t.kind === kind).map(t => t.text).join(Resources.wordSeparator);
    const report: JsonObject = {
      [Resources.providerField]: provider.id, [Resources.kindField]: provider.kind, [Resources.promptField]: prompt, [Resources.statusField]: reply.status,
      [Resources.textField]: textOf(DetailKind.Text), [Resources.errorField]: textOf(DetailKind.Error), [Resources.durationField]: milliseconds
    };
    if (reply.status !== MessageStatus.Completed)
      throw new CliCommandException(Resources.liveCheckFailedCode, Resources.formatLiveCheckFailed(provider, reply.status, textOf(DetailKind.Error)), report);

    return new CliCommandResult(report, Resources.formatLiveCheckPassed(provider, textOf(DetailKind.Text)));
  }
}
