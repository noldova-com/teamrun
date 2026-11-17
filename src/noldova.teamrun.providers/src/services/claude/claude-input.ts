/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";

export class ClaudeInput implements AsyncIterable<SDKUserMessage> {
  private readonly queued: SDKUserMessage[] = [];
  private waiting: PromiseWithResolvers<void> | null = null;
  private ended: boolean = false;

  public get isEnded(): boolean {
    return this.ended;
  }

  public push(message: SDKUserMessage): void {
    if (this.ended)
      return;
    this.queued.push(message);
    this.wake();
  }

  public end(): void {
    this.ended = true;
    this.wake();
  }

  public async *[Symbol.asyncIterator](): AsyncGenerator<SDKUserMessage> {
    while (true) {
      const message = this.queued.shift();
      if (!Object.isUndefined(message)) {
        yield message;
        continue;
      }
      if (this.ended)
        return;
      this.waiting = Promise.withResolvers<void>();
      await this.waiting.promise;
    }
  }

  private wake(): void {
    const waiting = this.waiting;
    this.waiting = null;
    waiting?.resolve();
  }
}
