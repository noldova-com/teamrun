/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { MethodName, ConversationMemberParams, ConversationMember } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class MemberAddCommand extends RuntimeCommand {
  public readonly name: string = Resources.memberAddCommand;
  public readonly description: string = Resources.memberAddDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const conversationId = context.commandLine.requirePositional(0, Resources.conversationIdArgument);
    const teammateId = context.commandLine.requirePositional(1, Resources.teammateIdArgument);
    const joined = await session.call(MethodName.ConversationAddMember, new ConversationMemberParams(conversationId, teammateId).toJson());
    output.writeObject(joined, t => this.formatter.formatMember(ConversationMember.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
