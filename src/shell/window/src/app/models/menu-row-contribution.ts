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

export class MenuRowContribution {
  public readonly command: string;
  public readonly commandArguments: JsonObject;
  public readonly label: string | null;

  public constructor(command: string, commandArguments: JsonObject = {}, label: string | null = null) {
    if (!Object.isNull(label))
      ArgumentException.throwIfNullOrWhitespace(label, Resources.labelParameter);

    this.command = QualifiedName.parse(command, Resources.commandParameter).text;
    this.commandArguments = { ...commandArguments };
    this.label = label;
  }
}
