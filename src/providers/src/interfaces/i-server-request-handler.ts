/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader, JsonValue } from "@noldova/teamrun-foundation-json";

export interface IServerRequestHandler {
  handleServerRequest(method: string, params: JsonReader): Promise<JsonValue>;
}
