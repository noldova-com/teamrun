/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";

import type { ICommand } from "../interfaces/i-command.js";
import { Resources } from "../resources.js";
import { AccountAddCommand } from "./commands/account-add-command.js";
import { AccountCheckCommand } from "./commands/account-check-command.js";
import { AccountRemoveCommand } from "./commands/account-remove-command.js";
import { AccountsCommand } from "./commands/accounts-command.js";
import { ApprovalsCommand } from "./commands/approvals-command.js";
import { ApproveCommand } from "./commands/approve-command.js";
import { CancelCommand } from "./commands/cancel-command.js";
import { ChatCommand } from "./commands/chat-command.js";
import { ConversationDeleteCommand } from "./commands/conversation-delete-command.js";
import { ConversationNewCommand } from "./commands/conversation-new-command.js";
import { ConversationMoveCommand } from "./commands/conversation-move-command.js";
import { ConversationRenameCommand } from "./commands/conversation-rename-command.js";
import { RewindCommand } from "./commands/rewind-command.js";
import { SearchCommand } from "./commands/search-command.js";
import { ConversationsCommand } from "./commands/conversations-command.js";
import { HelpCommand } from "./commands/help-command.js";
import { LiveCheckCommand } from "./commands/live-check-command.js";
import { MessagesCommand } from "./commands/messages-command.js";
import { ModelsCommand } from "./commands/models-command.js";
import { ProjectForgetCommand } from "./commands/project-forget-command.js";
import { ProjectOpenCommand } from "./commands/project-open-command.js";
import { ProjectsCommand } from "./commands/projects-command.js";
import { ProvidersCommand } from "./commands/providers-command.js";
import { SendCommand } from "./commands/send-command.js";
import { StatusCommand } from "./commands/status-command.js";
import { TeammatesCommand } from "./commands/teammates-command.js";
import { TeammateNewCommand } from "./commands/teammate-new-command.js";
import { TeammateUpdateCommand } from "./commands/teammate-update-command.js";
import { TeammateDeleteCommand } from "./commands/teammate-delete-command.js";
import { MembersCommand } from "./commands/members-command.js";
import { MemberAddCommand } from "./commands/member-add-command.js";
import { MemberRemoveCommand } from "./commands/member-remove-command.js";

export class CommandRegistry {
  private readonly commands: Map<string, ICommand> = new Map();

  public static createDefault(): CommandRegistry {
    const registry = new CommandRegistry();
    registry.register(new HelpCommand(registry));
    registry.register(new StatusCommand());
    registry.register(new ProvidersCommand());
    registry.register(new ModelsCommand());
    registry.register(new AccountsCommand());
    registry.register(new AccountAddCommand());
    registry.register(new AccountCheckCommand());
    registry.register(new AccountRemoveCommand());
    registry.register(new ProjectsCommand());
    registry.register(new ProjectOpenCommand());
    registry.register(new ProjectForgetCommand());
    registry.register(new ConversationsCommand());
    registry.register(new ConversationNewCommand());
    registry.register(new ConversationRenameCommand());
    registry.register(new ConversationMoveCommand());
    registry.register(new ConversationDeleteCommand());
    registry.register(new RewindCommand());
    registry.register(new SearchCommand());
    registry.register(new MessagesCommand());
    registry.register(new SendCommand());
    registry.register(new ChatCommand());
    registry.register(new CancelCommand());
    registry.register(new ApprovalsCommand());
    registry.register(new ApproveCommand());
    registry.register(new LiveCheckCommand());
    registry.register(new TeammatesCommand());
    registry.register(new TeammateNewCommand());
    registry.register(new TeammateUpdateCommand());
    registry.register(new TeammateDeleteCommand());
    registry.register(new MembersCommand());
    registry.register(new MemberAddCommand());
    registry.register(new MemberRemoveCommand());

    return registry;
  }

  public register(command: ICommand): void {
    if (this.commands.has(command.name))
      throw new ArgumentException(Resources.formatDuplicateCommand(command.name), Resources.commandParameterName);

    this.commands.set(command.name, command);
  }

  public find(name: string): ICommand | null {
    return this.commands.get(name) ?? null;
  }

  public all(): readonly ICommand[] {
    return [...this.commands.values()];
  }
}
