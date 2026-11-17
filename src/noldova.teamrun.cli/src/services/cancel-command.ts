/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { ConversationIdParams, Message, MessageStatus, MethodName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class CancelCommand extends TeamRunCommand {
  public readonly name: string = Resources.cancelCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const chatId = values.readText(Resources.chatIdValue);
    const stopped = await this.cancelAsync(chatId, signal);
    return new CliCommandResult(stopped.map(t => t.toJson()), stopped.length === 0 ? Resources.noWorkingReply : Resources.formatStopped(stopped));
  }

  private async cancelAsync(chatId: string, signal: AbortSignal): Promise<readonly Message[]> {
    try {
      const answered = await this.client.listAsync(MethodName.ConversationCancel, new ConversationIdParams(chatId).toJson(), signal, t => Message.fromJson(t));
      return answered.filter(t => t.status === MessageStatus.Cancelled);
    }
    catch (error) {
      if (!RuntimeClient.isConflict(error))
        throw error;
      return [];
    }
  }
}
