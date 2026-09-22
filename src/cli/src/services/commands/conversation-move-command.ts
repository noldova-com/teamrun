/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Conversation, ConversationMoveParams, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ConversationMoveCommand extends RuntimeCommand {
  public readonly name: string = Resources.conversationMoveCommand;
  public readonly description: string = Resources.conversationMoveDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const id = context.commandLine.requirePositional(0, Resources.idArgument);
    const params = new ConversationMoveParams(id, context.commandLine.requirePositional(1, Resources.projectIdArgument));
    const moved = await session.call(MethodName.ConversationMove, params.toJson());
    output.writeObject(moved, t => this.formatter.formatConversation(Conversation.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
