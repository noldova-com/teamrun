/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/teamrun-foundation-json";

export interface IDeviceFileStore {
  readAsync(): Promise<JsonObject | null>;
  writeAsync(value: JsonObject): Promise<void>;
}
