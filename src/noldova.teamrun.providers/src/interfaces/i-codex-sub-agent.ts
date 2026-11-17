/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SubAgent } from "@noldova/teamrun.protocol";

export interface ICodexSubAgent {
  readonly itemId: string;
  readonly childThreadId: string | null;
  readonly turnId: string | null;
  readonly agent: SubAgent;
}
