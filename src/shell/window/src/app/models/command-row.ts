/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

import type { MenuCheck } from "../enums/menu-check";
import { MenuRow } from "./menu-row";

export class CommandRow extends MenuRow {
  public readonly command: string;
  public readonly commandArguments: JsonObject;
  public readonly key: string | null;
  public readonly isEnabled: boolean;
  public readonly check: MenuCheck;
  public readonly isChecked: boolean;

  public constructor(command: string, commandArguments: JsonObject, title: string, icon: string | null, key: string | null, isEnabled: boolean, check: MenuCheck, isChecked: boolean) {
    super(title, icon);

    this.command = command;
    this.commandArguments = commandArguments;
    this.key = key;
    this.isEnabled = isEnabled;
    this.check = check;
    this.isChecked = isChecked;
  }
}
