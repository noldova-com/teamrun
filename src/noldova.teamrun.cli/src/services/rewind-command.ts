/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CliCommandResult } from "@noldova/desktop.cli";
import { ConversationRewindParams, ConversationRewindResult, MethodName } from "@noldova/teamrun.protocol";

import { Resources } from "../resources.js";
import type { CommandValues } from "./command-values.js";
import type { RuntimeClient } from "./runtime-client.js";
import { TeamRunCommand } from "./teamrun-command.js";

export class RewindCommand extends TeamRunCommand {
  public readonly name: string = Resources.rewindCommand;

  public constructor(client: RuntimeClient) {
    super(client);
  }

  protected async runAsync(values: CommandValues, signal: AbortSignal): Promise<CliCommandResult> {
    const params = new ConversationRewindParams(values.readText(Resources.chatIdValue), values.readText(Resources.messageIdValue),
      values.isSet(Resources.restoreFilesValue));
    const result = ConversationRewindResult.fromJson(await this.client.requestAsync(MethodName.ConversationRewind, params.toJson(), signal));
    return new CliCommandResult(result.toJson(), Resources.formatRewound(result));
  }
}
