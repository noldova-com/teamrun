/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AccountInfo, ModelInfo, SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export interface IClaudeQuery extends AsyncIterable<SDKMessage> {
  interrupt(): Promise<unknown>;
  accountInfo(): Promise<AccountInfo>;
  supportedModels(): Promise<ModelInfo[]>;
  close(): void;
}
