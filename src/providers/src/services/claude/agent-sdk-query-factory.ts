/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type Options, type SDKUserMessage, query } from "@anthropic-ai/claude-agent-sdk";

import type { IClaudeQuery } from "../../interfaces/i-claude-query.js";
import type { IClaudeQueryFactory } from "../../interfaces/i-claude-query-factory.js";

export class AgentSdkQueryFactory implements IClaudeQueryFactory {
  public start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options): IClaudeQuery {
    return query({ prompt, options });
  }
}
