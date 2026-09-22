/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Conversation, MethodName, ProjectIdParams } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ConversationsCommand extends RuntimeCommand {
  public readonly name: string = Resources.conversationsCommand;
  public readonly description: string = Resources.conversationsDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const params = new ProjectIdParams(context.commandLine.requirePositional(0, Resources.projectIdArgument));
    const listed = await session.call(MethodName.ConversationList, params.toJson());
    output.writeObjects(listed, t => this.formatter.formatConversation(Conversation.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
