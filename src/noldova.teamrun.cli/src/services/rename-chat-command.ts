/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { Conversation, ConversationRenameParams, MethodName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class RenameChatCommand extends TeamRunCommand {
  public readonly name: string = Resources.renameChatCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const params = new ConversationRenameParams(values.readText(Resources.chatIdValue), values.readWords(Resources.titleValue));
    const chat = Conversation.fromJson(await this.client.requestAsync(MethodName.ConversationRename, params.toJson(), signal));
    return new CliCommandResult(chat.toJson(), Resources.formatChatRenamed(chat));
  }
}
