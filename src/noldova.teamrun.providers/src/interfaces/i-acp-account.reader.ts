/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { ProviderIdentity } from "@noldova/teamrun.protocol";

export interface IAcpAccountReader {
  readonly methods: readonly string[];
  readonly planMethods: readonly string[];
  read(answer: JsonValue): ProviderIdentity | null;
  readPlan(answer: JsonValue): string | null;
}
