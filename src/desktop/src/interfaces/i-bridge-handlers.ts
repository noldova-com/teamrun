/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { SenderInfo } from "../models/sender-info.js";

export interface IBridgeHandlers {
  invoke(sender: SenderInfo, request: unknown): Promise<JsonValue>;
  openExternal(sender: SenderInfo, url: unknown): Promise<boolean>;
  pickDirectory(sender: SenderInfo): Promise<string | null>;
  describe(sender: SenderInfo): Promise<JsonValue>;
  update(sender: SenderInfo, command: unknown): Promise<JsonValue>;
  checkpoint(sender: SenderInfo, result: unknown): Promise<boolean>;
  setTitleBar(sender: SenderInfo, color: unknown, symbolColor: unknown): Promise<boolean>;
  readImage(sender: SenderInfo, path: unknown): Promise<string | null>;
}
