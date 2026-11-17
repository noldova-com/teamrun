/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Readable } from "node:stream";

import type { ICliPart, ICliPartContext } from "@noldova/desktop.cli";

import { ProvidersCommand } from "./providers-command.js";
import { AddProviderCommand } from "./add-provider-command.js";
import { ApprovalsCommand } from "./approvals-command.js";
import { CancelCommand } from "./cancel-command.js";
import { ChatsCommand } from "./chats-command.js";
import { CheckProviderCommand } from "./check-provider-command.js";
import { DeleteChatCommand } from "./delete-chat-command.js";
import { ForgetProjectCommand } from "./forget-project-command.js";
import { LiveCheckCommand } from "./live-check-command.js";
import { MessagesCommand } from "./messages-command.js";
import { ModelsCommand } from "./models-command.js";
import { MoveChatCommand } from "./move-chat-command.js";
import { NewChatCommand } from "./new-chat-command.js";
import { OpenFolderCommand } from "./open-folder-command.js";
import { ProjectsCommand } from "./projects-command.js";
import { RemoveProviderCommand } from "./remove-provider-command.js";
import { RenameChatCommand } from "./rename-chat-command.js";
import { RewindCommand } from "./rewind-command.js";
import { RuntimeClient } from "./runtime-client.js";
import { SearchCommand } from "./search-command.js";
import { SendCommand } from "./send-command.js";
import type { TeamRunCommand } from "./teamrun-command.js";
import { TeammatesCommand } from "./teammates-command.js";

export class CliPart implements ICliPart {
  private readonly environment: Readonly<Record<string, string | undefined>>;
  private readonly input: Readable;

  public constructor(environment: Readonly<Record<string, string | undefined>> = process.env, input: Readable = process.stdin) {
    this.environment = environment;
    this.input = input;
  }

  public async activateAsync(context: ICliPartContext): Promise<void> {
    const client = new RuntimeClient(context);
    const commands: readonly TeamRunCommand[] = [
      new ProjectsCommand(client),
      new OpenFolderCommand(client),
      new ForgetProjectCommand(client),
      new ChatsCommand(client),
      new NewChatCommand(client),
      new RenameChatCommand(client),
      new DeleteChatCommand(client),
      new MoveChatCommand(client),
      new SearchCommand(client),
      new MessagesCommand(client),
      new SendCommand(client, this.environment, this.input),
      new CancelCommand(client),
      new RewindCommand(client),
      new ApprovalsCommand(client),
      new ProvidersCommand(client),
      new CheckProviderCommand(client),
      new AddProviderCommand(client),
      new RemoveProviderCommand(client),
      new ModelsCommand(client),
      new LiveCheckCommand(client),
      new TeammatesCommand(client)
    ];
    for (const command of commands)
      context.registerCommand(command.name, command);
  }

  public async deactivateAsync(): Promise<void> {
  }
}
