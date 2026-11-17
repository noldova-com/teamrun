/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonReader, JsonValue } from "@noldova/context.json";

import type { IAcpClientListener } from "../../interfaces/i-acp-client-listener.js";
import type { Deadline } from "../deadline.js";

export class AcpActivity implements IAcpClientListener {
  private readonly listener: IAcpClientListener;
  private readonly silence: Deadline;

  public constructor(listener: IAcpClientListener, silence: Deadline) {
    this.listener = listener;
    this.silence = silence;
  }

  public onNotificationAsync(method: string, params: JsonReader): Promise<void> {
    this.silence.extend();
    return this.listener.onNotificationAsync(method, params);
  }

  public onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue> {
    this.silence.extend();
    return this.listener.onRequest(id, method, params);
  }

  public onResponseAsync(method: string, result: JsonReader | null): Promise<void> {
    return this.listener.onResponseAsync(method, result);
  }

  public onExitAsync(): Promise<void> {
    return this.listener.onExitAsync();
  }
}
