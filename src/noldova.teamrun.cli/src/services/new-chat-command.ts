/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { Conversation, ConversationCreateParams, MethodName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class NewChatCommand extends TeamRunCommand {
  public readonly name: string = Resources.newChatCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const params = new ConversationCreateParams(values.readOptionalText(Resources.projectIdValue), values.readOptionalText(Resources.titleValue));
    const chat = Conversation.fromJson(await this.client.requestAsync(MethodName.ConversationCreate, params.toJson(), signal));
    return new CliCommandResult(chat.toJson(), Resources.formatChatStarted(chat));
  }
}
