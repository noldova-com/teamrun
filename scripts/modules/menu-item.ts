/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export default class MenuItem {
  public readonly command: string | null;
  public readonly commandArguments: Readonly<Record<string, unknown>>;
  public readonly submenu: string | null;
  public readonly label: string | null;

  public constructor(command: string | null, commandArguments: Readonly<Record<string, unknown>>, submenu: string | null, label: string | null = null) {
    this.command = command;
    this.commandArguments = commandArguments;
    this.submenu = submenu;
    this.label = label;
  }

  public toJson(): Readonly<Record<string, unknown>> {
    if (this.submenu !== null)
      return { submenu: this.submenu };
    return this.label === null ? { command: this.command, arguments: this.commandArguments } : { command: this.command, arguments: this.commandArguments, label: this.label };
  }
}
