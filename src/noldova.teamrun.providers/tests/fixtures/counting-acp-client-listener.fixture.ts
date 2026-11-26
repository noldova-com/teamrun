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

export class CountingAcpClientListener implements IAcpClientListener {
  private readonly answer: Promise<JsonValue>;
  public notifications: number = 0;
  public notificationFailure: string | null = null;

  public constructor(answer: Promise<JsonValue>) {
    this.answer = answer;
  }

  public onRequest(): Promise<JsonValue> {
    return this.answer;
  }

  public onNotificationAsync(): Promise<void> {
    if (!Object.isNull(this.notificationFailure))
      throw this.notificationFailure;
    this.notifications++;
    return Promise.resolve();
  }

  public onResponseAsync(): Promise<void> {
    return Promise.resolve();
  }

  public onExitAsync(): Promise<void> {
    return Promise.resolve();
  }
}
