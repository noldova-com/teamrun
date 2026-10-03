/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/teamrun-foundation-exceptions";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { QualifiedName } from "@noldova/teamrun-shell-protocol";

import type { ITopBarActionOptions } from "../interfaces/i-top-bar-action-options";
import { Resources } from "../../resources";

export class TopBarActionState {
  public readonly icon: string;
  public readonly title: string;
  public readonly command: string;
  public readonly commandArguments: JsonValue;
  public readonly isHidden: boolean;

  public constructor(icon: string, title: string, command: string, options: ITopBarActionOptions = {}) {
    ArgumentException.throwIfNullOrWhitespace(icon, Resources.iconParameter);
    ArgumentException.throwIfNullOrWhitespace(title, Resources.titleParameter);

    this.icon = icon;
    this.title = title;
    this.command = QualifiedName.parse(command, Resources.commandParameter).text;
    this.commandArguments = options.commandArguments ?? null;
    this.isHidden = options.isHidden ?? false;
  }
}
