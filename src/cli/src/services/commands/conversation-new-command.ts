/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Conversation, ConversationCreateParams, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ConversationNewCommand extends RuntimeCommand {
  public readonly name: string = Resources.conversationNewCommand;
  public readonly description: string = Resources.conversationNewDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const projectId = context.commandLine.requirePositional(0, Resources.projectIdArgument);
    const params = new ConversationCreateParams(projectId, context.commandLine.option(Resources.titleOption));
    const created = await session.call(MethodName.ConversationCreate, params.toJson());
    output.writeObject(created, t => this.formatter.formatConversation(Conversation.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
