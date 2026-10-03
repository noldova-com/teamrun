/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";

export class MenuItem {
  public readonly command: string | null;
  public readonly commandArguments: JsonObject;
  public readonly submenu: string | null;

  private constructor(command: string | null, commandArguments: JsonObject, submenu: string | null) {
    this.command = command;
    this.commandArguments = commandArguments;
    this.submenu = submenu;
  }

  public static ofCommand(command: string, commandArguments: JsonObject = {}): MenuItem {
    return new MenuItem(QualifiedName.parse(command, Resources.commandParameter).text, { ...commandArguments }, null);
  }

  public static ofSubmenu(place: string): MenuItem {
    return new MenuItem(null, {}, QualifiedName.parse(place, Resources.submenuParameter).text);
  }
}
