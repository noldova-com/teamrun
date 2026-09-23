/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

export class DeferredResponse {
  private complete: ((value: JsonValue) => void) | null = null;

  public readonly promise: Promise<JsonValue> = new Promise(resolve => this.complete = resolve);

  public resolve(value: JsonValue): void {
    this.complete?.(value);
  }
}
