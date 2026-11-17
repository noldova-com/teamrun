/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";
import { CliCommandResult } from "@noldova/desktop.cli";
import { Conversation, ConversationIdParams, ConversationListParams, ConversationMember, Message, MethodName, NameOrder, ProjectListing, Teammate } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class ChatsCommand extends TeamRunCommand {
  public readonly name: string = Resources.chatsCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const project = values.readOptionalText(Resources.projectValue);
    const projectIds: readonly (string | null)[] = Object.isNull(project)
      ? [...(await this.client.listAsync(MethodName.ProjectList, null, signal, t => ProjectListing.fromJson(t).project)).map(t => t.id), null]
      : [project];
    const chats: Conversation[] = [];
    for (const projectId of projectIds)
      chats.push(...await this.client.listAsync(MethodName.ConversationList, new ConversationListParams(projectId).toJson(), signal, t => Conversation.fromJson(t)));
    const teammates = await this.client.listAsync(MethodName.TeammateList, null, signal, t => Teammate.fromJson(t));
    const open = await this.client.listAsync(MethodName.MessageListOpen, null, signal, t => Message.fromJson(t));
    const rows: JsonObject[] = [];
    const lines: string[] = [];
    for (const chat of chats) {
      const members = await this.client.listAsync(MethodName.ConversationListMembers, new ConversationIdParams(chat.id).toJson(), signal,
        t => ConversationMember.fromJson(t));
      const names = NameOrder.sort(members.map(t => teammates.find(u => u.id === t.teammateId)?.name ?? t.teammateId), t => t);
      const replying = open.some(t => t.conversationId === chat.id);
      rows.push({ ...chat.toJson(), [Resources.teammatesField]: names, [Resources.replyingField]: replying });
      lines.push(Resources.formatChat(chat, names, replying));
    }
    return new CliCommandResult(rows, Resources.formatList(lines));
  }
}
