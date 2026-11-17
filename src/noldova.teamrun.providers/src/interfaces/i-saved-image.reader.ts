/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject, JsonReader } from "@noldova/context.json";
import type { Provider } from "@noldova/teamrun.protocol";

import type { SavedImage } from "../models/saved-image.js";

export interface ISavedImageReader {
  read(tool: JsonReader, sessionId: string, provider: Provider | null, workingDirectory: string): SavedImage | null;
  failureOf(tool: JsonReader): JsonObject | null;
}
