/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class CodexChildAnswer {
  public readonly cancel: JsonValue;
  public readonly decline: JsonValue;
  public readonly note: string;

  public constructor(cancel: JsonValue, decline: JsonValue, note: string) {
    this.cancel = cancel;
    this.decline = decline;
    this.note = note;
  }
}
