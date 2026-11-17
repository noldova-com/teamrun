/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";
import type { PlanStep, Provider } from "@noldova/teamrun.protocol";

export interface IAcpToDoReader {
  read(tool: JsonReader, sessionId: string, provider: Provider | null): readonly PlanStep[] | null;
}
