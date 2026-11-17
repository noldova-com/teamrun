/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader, JsonValue } from "@noldova/context.json";

export interface IAcpClientListener {
  onNotificationAsync(method: string, params: JsonReader): Promise<void>;
  onRequest(id: string, method: string, params: JsonReader): Promise<JsonValue>;
  onResponseAsync(method: string, result: JsonReader | null): Promise<void>;
  onExitAsync(): Promise<void>;
}
