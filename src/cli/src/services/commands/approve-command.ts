/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { Approval, ApprovalDecideParams, MethodName } from "@noldova/teamrun-protocol";

import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { OutputWriter } from "../output-writer.js";
import type { RuntimeSession } from "../runtime-session.js";
import { RuntimeCommand } from "./runtime-command.js";

export class ApproveCommand extends RuntimeCommand {
  public readonly name: string = Resources.approveCommand;
  public readonly description: string = Resources.approveDescription;

  protected override async execute(session: RuntimeSession, context: CommandContext, output: OutputWriter): Promise<number> {
    const approvalId = context.commandLine.requirePositional(0, Resources.approvalIdArgument);
    const params = new ApprovalDecideParams(approvalId, context.commandLine.requirePositional(1, Resources.optionIdArgument));
    output.writeObject(await session.call(MethodName.ApprovalDecide, params.toJson()), t => this.formatter.formatApproval(Approval.fromJson(t.toJson())));
    return Resources.exitSuccess;
  }
}
