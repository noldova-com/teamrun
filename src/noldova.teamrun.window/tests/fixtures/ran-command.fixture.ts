/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class RanCommand {
  public readonly name: string;
  public readonly commandArguments: JsonValue | undefined;

  public constructor(name: string, commandArguments: JsonValue | undefined) {
    this.name = name;
    this.commandArguments = commandArguments;
  }
}
