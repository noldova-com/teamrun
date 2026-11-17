/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SubAgent } from "@noldova/teamrun.protocol";

export interface IAcpSubAgent {
  readonly toolCallId: string;
  readonly itemId: string;
  readonly childSessionId: string | null;
  readonly subAgentId: string | null;
  readonly agent: SubAgent;
}
