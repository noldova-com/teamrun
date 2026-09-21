/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Options, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import type { IClaudeQuery } from "./i-claude-query.js";

export interface IClaudeQueryFactory {
  start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options): IClaudeQuery;
}
