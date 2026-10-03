/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/teamrun-foundation-json";
import type { QualifiedName, Response } from "@noldova/teamrun-shell-protocol";

export interface IRuntimeConnection {
  callAsync(method: QualifiedName, payload: JsonValue, timeout?: number): Promise<Response>;
  close(): void;
}
