/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClaudeInput } from "@noldova/teamrun.providers";

@TestClass
export class ClaudeInputTests {
  @TestMethod
  public async yieldsEachMessageAsItIsPushedAndEndsAfterTheQueuedOnes(): Promise<void> {
    const input = new ClaudeInput();
    const read: string[] = [];
    const reading = (async () => {
      for await (const message of input)
        read.push(String(message.message.content));
    })();

    input.push(ClaudeInputTests.message("first"));
    await new Promise(resolve => setImmediate(resolve));
    Assert.areEqual("first", read.join(","));
    input.push(ClaudeInputTests.message("second"));
    input.push(ClaudeInputTests.message("third"));
    input.end();
    input.push(ClaudeInputTests.message("late"));
    await reading;

    Assert.areEqual("first,second,third", read.join(","));
    Assert.isTrue(input.isEnded);
  }

  private static message(text: string): SDKUserMessage {
    return { type: "user", message: { role: "user", content: text }, parent_tool_use_id: null };
  }
}
