/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";

export class DeferredResponse {
  private complete: ((value: JsonValue) => void) | null = null;
  private fail: ((error: unknown) => void) | null = null;

  public readonly promise: Promise<JsonValue> = new Promise((resolve, reject) => {
    this.complete = resolve;
    this.fail = reject;
  });

  public resolve(value: JsonValue): void {
    this.complete?.(value);
  }

  public reject(error: unknown): void {
    this.fail?.(error);
  }
}
