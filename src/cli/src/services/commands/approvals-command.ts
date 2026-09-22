/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Approval, ConversationIdParams, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ApprovalsCommand extends RuntimeCommand {
  public readonly name: string = Resources.approvalsCommand;
  public readonly description: string = Resources.approvalsDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const params = new ConversationIdParams(context.commandLine.requirePositional(0, Resources.conversationIdArgument));
    output.writeObjects(await session.call(MethodName.ApprovalList, params.toJson()), t => this.formatter.formatApproval(Approval.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
