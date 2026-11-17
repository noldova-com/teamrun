/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Options, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import type { IClaudeQuery, IClaudeQueryFactory, ProcessOrigin } from "@noldova/teamrun.providers";

import { FakeClaudeQuery } from "./fake-claude-query.fixture.js";

export class FakeClaudeQueryFactory implements IClaudeQueryFactory {
  public readonly queries: FakeClaudeQuery[] = [];
  public readonly prompts: (string | AsyncIterable<SDKUserMessage>)[] = [];
  public readonly optionsList: Options[] = [];
  public readonly origins: ProcessOrigin[] = [];
  public next: FakeClaudeQuery = new FakeClaudeQuery([]);
  public readonly queued: FakeClaudeQuery[] = [];
  public repeat: (() => FakeClaudeQuery) | null = null;

  public get lastOptions(): Options | undefined {
    return this.optionsList.at(-1);
  }

  public get promptTexts(): readonly string[] {
    return this.queries.flatMap(query => query.inputs).map(input => typeof input.message.content === "string" ? input.message.content : "(blocks)");
  }

  public start(prompt: string | AsyncIterable<SDKUserMessage>, options: Options, origin: ProcessOrigin): IClaudeQuery {
    const query = this.repeat?.() ?? this.next;
    query.options = options;
    query.prompt = prompt;
    this.queries.push(query);
    this.prompts.push(prompt);
    this.optionsList.push(options);
    this.origins.push(origin);
    this.next = this.queued.shift() ?? new FakeClaudeQuery([]);

    return query;
  }
}
