/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SubAgent } from "@noldova/teamrun.protocol";

import type { ClaudePlan } from "../services/claude/claude-plan.js";
import type { ClaudeTurn } from "../services/claude/claude-turn.js";

export interface IClaudeSubAgent {
  readonly itemId: string;
  readonly parentItemId: string | null;
  readonly owner: ClaudeTurn;
  readonly plan: ClaudePlan;
  readonly agent: SubAgent;
}
