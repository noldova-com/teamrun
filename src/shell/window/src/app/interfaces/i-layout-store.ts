/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonValue } from "@noldova/teamrun-foundation-json";

export interface ILayoutStore {
  readAsync(): Promise<JsonValue | null>;
  writeAsync(layout: JsonObject): Promise<boolean>;
}
