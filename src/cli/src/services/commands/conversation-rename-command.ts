/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Conversation, ConversationRenameParams, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ConversationRenameCommand extends RuntimeCommand {
  public readonly name: string = Resources.conversationRenameCommand;
  public readonly description: string = Resources.conversationRenameDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const id = context.commandLine.requirePositional(0, Resources.idArgument);
    const params = new ConversationRenameParams(id, context.commandLine.requirePositional(1, Resources.titleOption));
    const renamed = await session.call(MethodName.ConversationRename, params.toJson());
    output.writeObject(renamed, t => this.formatter.formatConversation(Conversation.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
