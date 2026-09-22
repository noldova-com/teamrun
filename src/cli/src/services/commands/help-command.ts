/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICommand } from "../../interfaces/i-command.js";
import type { CommandContext } from "../../models/command-context.js";
import { Resources } from "../../resources.js";
import type { CommandRegistry } from "../command-registry.js";

export class HelpCommand implements ICommand {
  public readonly name: string = Resources.helpCommand;
  public readonly description: string = Resources.helpDescription;
  private readonly registry: CommandRegistry;

  public constructor(registry: CommandRegistry) {
    this.registry = registry;
  }

  public run(context: CommandContext): Promise<number> {
    context.console.write(Resources.usageHeading);
    context.console.write(Resources.commandsHeading);
    for (const command of this.registry.all())
      context.console.write(Resources.formatCommandHelp(command.name, command.description));

    return Promise.resolve(Resources.exitSuccess);
  }
}
