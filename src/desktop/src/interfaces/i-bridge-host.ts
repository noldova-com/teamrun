/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { IBridgeHandlers } from "./i-bridge-handlers.js";

export interface IBridgeHost {
  attach(handlers: IBridgeHandlers): void;
  broadcast(channel: string, payload: JsonValue): void;
  windowIds(): readonly number[];
  sendToWindow(windowId: number, channel: string, payload: JsonValue): void;
  openExternal(url: string): Promise<void>;
  pickDirectory(): Promise<string | null>;
  setTitleBar(color: string, symbolColor: string): void;
}
