/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Options, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import type { IClaudeQuery, IClaudeQueryFactory } from "@noldova/teamrun-providers";

import { FakeClaudeQuery } from "./fake-claude-query.fixture.js";

export class FakeClaudeQueryFactory implements IClaudeQueryFactory {
  public readonly queries: FakeClaudeQuery[] = [];
  public readonly prompts: (string | AsyncIterable<SDKUserMessage>)[] = [];
  public readonly optionsList: Options[] = [];
  public next: FakeClaudeQuery = new FakeClaudeQuery([]);

  public get lastOptions(): Options | undefined {
    return this.optionsList.at(-1);
  }

  public start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options): IClaudeQuery {
    const query = this.next;
    query.options = options;
    this.queries.push(query);
    this.prompts.push(prompt);
    this.optionsList.push(options);
    this.next = new FakeClaudeQuery([]);

    return query;
  }
}
