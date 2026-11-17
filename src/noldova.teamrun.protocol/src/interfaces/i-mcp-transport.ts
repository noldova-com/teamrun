/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

export interface IMcpTransport {
  onmessage?: ((message: unknown) => void) | undefined;
  onclose?: (() => void) | undefined;
  start(): Promise<void>;
  send(message: JsonObject): Promise<void>;
  close(): Promise<void>;
}
