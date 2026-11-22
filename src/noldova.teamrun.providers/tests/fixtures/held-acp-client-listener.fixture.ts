/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonValue } from "@noldova/context.json";
import type { IAcpClientListener } from "@noldova/teamrun.providers";

export class HeldAcpClientListener implements IAcpClientListener {
  private readonly answer: Promise<JsonValue>;
  private readonly failing: readonly string[];

  public constructor(answer: Promise<JsonValue>, failing: readonly string[]) {
    this.answer = answer;
    this.failing = failing;
  }

  public onRequest(id: string): Promise<JsonValue> {
    return this.failing.includes(id) ? Promise.reject(new Error(id)) : this.answer;
  }

  public onNotificationAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onResponseAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onExitAsync(): Promise<void> {
    return Promise.resolve();
  }
}
