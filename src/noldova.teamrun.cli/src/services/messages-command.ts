/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { Conversation, ConversationListParams, DetailKind, type Message, MessagePage, MessagePageParams, MethodName, ProjectListing } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class MessagesCommand extends TeamRunCommand {
  public readonly name: string = Resources.messagesCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const params = new MessagePageParams(values.readText(Resources.chatIdValue), values.readOptionalInteger(Resources.beforeValue), null,
      values.readInteger(Resources.limitValue));
    const page = MessagePage.fromJson(await this.client.requestAsync(MethodName.MessagePage, params.toJson(), signal));
    const titles = page.messages.some(t => !Object.isNull(t.sender)) ? await this.chatTitles(signal) : new Map<string, string>();
    return new CliCommandResult(page.toJson(), Resources.formatList(page.messages.map(t => MessagesCommand.describe(t, titles))));
  }

  private async chatTitles(signal: AbortSignal): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    const projects = await this.client.listAsync(MethodName.ProjectList, null, signal, t => ProjectListing.fromJson(t).project);
    for (const projectId of [...projects.map(t => t.id), null])
      for (const chat of await this.client.listAsync(MethodName.ConversationList, new ConversationListParams(projectId).toJson(), signal, t => Conversation.fromJson(t)))
        titles.set(chat.id, chat.title);
    return titles;
  }

  private static describe(message: Message, titles: ReadonlyMap<string, string>): string {
    const text = message.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(Resources.wordSeparator);
    const sender = message.sender;
    const author = Object.isNull(sender) ? message.teammateName ?? message.author : Resources.formatSender(sender, titles.get(sender.conversationId) ?? null);
    return Resources.formatMessage(message, author, text);
  }
}
