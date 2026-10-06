/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";

import type { RequestContext } from "../models/request-context.js";

export interface IMethodHandler {
  handleAsync(context: RequestContext): Promise<JsonValue>;
}
