/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import { Resources } from "../../resources";

export class MenuItem {
  public readonly command: string | null;
  public readonly commandArguments: JsonObject;
  public readonly submenu: string | null;
  public readonly label: string | null;

  private constructor(command: string | null, commandArguments: JsonObject, submenu: string | null, label: string | null) {
    this.command = command;
    this.commandArguments = commandArguments;
    this.submenu = submenu;
    this.label = label;
  }

  public static ofCommand(command: string, commandArguments: JsonObject = {}, label: string | null = null): MenuItem {
    if (!Object.isNull(label))
      ArgumentException.throwIfNullOrWhitespace(label, Resources.labelParameter);
    return new MenuItem(QualifiedName.parse(command, Resources.commandParameter).text, { ...commandArguments }, null, label);
  }

  public static ofSubmenu(place: string): MenuItem {
    return new MenuItem(null, {}, QualifiedName.parse(place, Resources.submenuParameter).text, null);
  }
}
