/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolCall } from "@noldova/ui.components.angular";

export class ActivityRow {
  public readonly key: string;
  public readonly call: ToolCall | null;
  public readonly text: string;

  public constructor(key: string, call: ToolCall | null, text: string) {
    this.key = key;
    this.call = call;
    this.text = text;
  }
}
