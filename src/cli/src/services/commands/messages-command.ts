/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Message, MessageListParams, MessagePage, MessagePageParams, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class MessagesCommand extends RuntimeCommand {
  public readonly name: string = Resources.messagesCommand;
  public readonly description: string = Resources.messagesDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const conversationId = context.commandLine.requirePositional(0, Resources.conversationIdArgument);
    const after = context.commandLine.option(Resources.afterOption);
    const before = context.commandLine.option(Resources.beforeOption);
    const limit = context.commandLine.option(Resources.limitOption);
    if (Object.isNull(before) && Object.isNull(limit)) {
      const params = new MessageListParams(conversationId, Object.isNull(after) ? null : Number(after));
      output.writeObjects(await session.call(MethodName.MessageList, params.toJson()), t => this.formatter.formatMessage(Message.fromJson(t.toJson())));
      return Resources.exitSuccess;
    }

    const params = new MessagePageParams(conversationId, Object.isNull(before) ? null : Number(before), Object.isNull(after) ? null : Number(after),
      Object.isNull(limit) ? Resources.defaultPageSize : Number(limit));
    const page = MessagePage.fromJson(await session.call(MethodName.MessagePage, params.toJson()));
    output.writeObjects(page.messages.map(t => t.toJson()), t => this.formatter.formatMessage(Message.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
