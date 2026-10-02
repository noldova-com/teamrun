/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

export class EventChannel implements Disposable {
  private readonly publisher: (payload: JsonValue) => void;
  private readonly withdraw: () => void;

  public constructor(publisher: (payload: JsonValue) => void, withdraw: () => void) {
    this.publisher = publisher;
    this.withdraw = withdraw;
  }

  public publish(payload: JsonValue): void {
    this.publisher(payload);
  }

  public [Symbol.dispose](): void {
    this.withdraw();
  }
}
