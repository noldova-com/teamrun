/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { Approval, ApprovalStatus, ConversationIdParams, MethodName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class ApprovalsCommand extends TeamRunCommand {
  public readonly name: string = Resources.approvalsCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const params = new ConversationIdParams(values.readText(Resources.chatIdValue));
    const listed = await this.client.listAsync(MethodName.ApprovalList, params.toJson(), signal, t => Approval.fromJson(t));
    const approvals = values.isSet(Resources.pendingValue) ? listed.filter(t => t.status === ApprovalStatus.Pending) : listed;
    return new CliCommandResult(approvals.map(t => t.toJson()), Resources.formatList(approvals.map(t => Resources.formatApproval(t))));
  }
}
