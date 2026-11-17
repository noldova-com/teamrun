/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";
import type { PlanStep } from "@noldova/teamrun.protocol";

export interface IAcpToDoListReader {
  readonly methods: readonly string[];
  read(params: JsonReader): readonly PlanStep[];
}
