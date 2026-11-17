/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IToolDescriptor } from "@noldova/desktop.runtime";
import type { JsonObject, JsonValue } from "@noldova/context.json";

export class TeamRunTool {
  public readonly descriptor: IToolDescriptor;
  public readonly command: string;
  private readonly values: ReadonlyMap<string, string>;
  private readonly defaults: Readonly<Record<string, JsonValue>>;

  public constructor(descriptor: IToolDescriptor, command: string, values: ReadonlyMap<string, string> = new Map(),
    defaults: Readonly<Record<string, JsonValue>> = {}) {
    this.descriptor = descriptor;
    this.command = command;
    this.values = values;
    this.defaults = defaults;
  }

  public toValues(input: JsonObject): Record<string, JsonValue> {
    const values: Record<string, JsonValue> = { ...this.defaults };
    for (const [argument, value] of this.values)
      if (Object.hasOwn(input, argument) && input[argument] !== false)
        values[value] = input[argument]!;
    return values;
  }
}
