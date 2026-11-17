/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ToolCallRecord } from "../models/tool-call-record.js";
import type { ITurnToolSession } from "./i-turn-tool-session.js";

export interface ITurnToolSessions {
  readonly approvedTools: readonly string[];
  readonly endpoint: string | null;
  open(scope: string, conversationId: string, workFolder: string, projectId: string | null, agentName: string,
    record: (call: ToolCallRecord) => void): ITurnToolSession;
}
