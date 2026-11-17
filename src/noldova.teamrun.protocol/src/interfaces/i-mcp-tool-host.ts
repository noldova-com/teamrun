/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export interface IMcpToolHost {
  listToolsAsync(signal: AbortSignal): Promise<readonly JsonObject[]>;
  callToolAsync(name: string, input: JsonObject, signal: AbortSignal): Promise<JsonObject>;
}
