/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommandList, type QualifiedName } from "@noldova/teamrun-shell-protocol";

import { RegistrationException } from "../../exceptions/registration.exception.js";
import { Registration } from "../../models/registration.js";
import type { RuntimeCommand } from "../../models/runtime-command.js";
import { Resources } from "../../resources.js";

export class CommandRegistry {
  private readonly commands: Map<string, RuntimeCommand> = new Map();

  public get list(): CommandList {
    return new CommandList([...this.commands.values()].map(t => t.info));
  }

  public register(command: RuntimeCommand): Registration {
    const name = command.info.name.text;
    if (this.commands.has(name))
      throw new RegistrationException(Resources.formatCommandRegistered(name));

    this.commands.set(name, command);
    return new Registration(() => this.unregister(command));
  }

  public find(name: QualifiedName): RuntimeCommand | undefined {
    return this.commands.get(name.text);
  }

  private unregister(command: RuntimeCommand): void {
    const name = command.info.name.text;
    if (this.commands.get(name) === command)
      this.commands.delete(name);
  }
}
