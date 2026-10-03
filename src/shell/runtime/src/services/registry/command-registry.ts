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
  private readonly watches: Map<RuntimeCommand, Registration> = new Map();
  private readonly changed: (list: CommandList) => void;
  private sequence: number = 0;

  public constructor(changed: (list: CommandList) => void = () => undefined) {
    this.changed = changed;
  }

  public get list(): CommandList {
    return new CommandList([...this.commands.values()].map(t => t.info), this.sequence);
  }

  public register(command: RuntimeCommand): Registration {
    const name = command.info.name.text;
    if (this.commands.has(name))
      throw new RegistrationException(Resources.formatCommandRegistered(name));

    this.commands.set(name, command);
    this.watches.set(command, command.onChanged(() => this.publish()));
    this.publish();
    return new Registration(() => this.unregister(command));
  }

  public find(name: QualifiedName): RuntimeCommand | undefined {
    return this.commands.get(name.text);
  }

  private unregister(command: RuntimeCommand): void {
    const name = command.info.name.text;
    if (this.commands.get(name) !== command)
      return;
    this.commands.delete(name);
    this.watches.get(command)?.[Symbol.dispose]();
    this.watches.delete(command);
    this.publish();
  }

  private publish(): void {
    this.sequence++;
    this.changed(this.list);
  }
}
