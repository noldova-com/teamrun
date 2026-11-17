/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { ConversationIdParams, MethodName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class DeleteChatCommand extends TeamRunCommand {
  public readonly name: string = Resources.deleteChatCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const chatId = values.readText(Resources.chatIdValue);
    await this.client.requestAsync(MethodName.ConversationDelete, new ConversationIdParams(chatId).toJson(), signal);
    return new CliCommandResult(null, Resources.formatChatDeleted(chatId));
  }
}
