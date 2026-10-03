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

  public constructor(command: string | null, commandArguments: Readonly<Record<string, unknown>>, submenu: string | null) {
    this.command = command;
    this.commandArguments = commandArguments;
    this.submenu = submenu;
  }

  public toJson(): Readonly<Record<string, unknown>> {
    return this.submenu === null ? { command: this.command, arguments: this.commandArguments } : { submenu: this.submenu };
  }
}
