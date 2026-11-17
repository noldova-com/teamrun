/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class TerminalToolCall {
  public readonly tool: string;
  public readonly input: JsonValue;
  public readonly itemId: string;
  public readonly parentItemId: string | null;

  public constructor(tool: string, input: JsonValue, itemId: string, parentItemId: string | null) {
    this.tool = tool;
    this.input = input;
    this.itemId = itemId;
    this.parentItemId = parentItemId;
  }
}
