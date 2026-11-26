/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class AcpServedTool {
  public readonly name: string;
  public readonly input: JsonValue;

  public constructor(name: string, input: JsonValue) {
    this.name = name;
    this.input = input;
  }
}
