/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Wait } from "../../fixtures/wait.fixture.js";
import { FakeConsole } from "../../fixtures/fake-console.fixture.js";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class ChatCommandTests {
  @TestMethod
  public async continuesAfterAnUnavailableTeammateProducesNoReplies(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    const alice = await host.createTeammate("Alice");
    await host.runJson("account-remove", alice.providerAccountId);
    const console = new FakeConsole();
    console.answers.push("@Alice hi", "");
    Assert.areEqual(0, await host.runWith(console, "chat", conversation.id));
    Assert.areEqual(0, host.adapter.prompts.length);
    Assert.areEqual(2, console.prompts.length);
  }

  @TestMethod
  public async exchangesUntilAnEmptyLine(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    const console = new FakeConsole();
    console.answers.push("hello", "world", "");

    const code = await host.runWith(console, "chat", conversation.id, "--provider", "fake");

    Assert.areEqual(0, code);
    Assert.areEqual("hello,world", host.adapter.prompts.join(","));
    Assert.areEqual(3, console.prompts.length);
    Assert.isTrue(console.lines.includes("[Text] Reply to world"));
  }

  @TestMethod
  public async cancelsTheOpenReplyOnInterrupt(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    host.adapter.holdUntilAbort = true;
    const console = new FakeConsole();
    console.answers.push("wait");
    console.onAsk = () => {
      console.onAsk = null;
      host.signals.emit("SIGINT");
    };

    const running = host.runWith(console, "chat", conversation.id, "--provider", "fake");
    console.onWrite = line => {
      if (line !== "Cancelling the reply...")
        return;
      console.onWrite = null;
      host.signals.emit("SIGINT");
    };
    await Wait.until(() => host.adapter.prompts.length === 1);
    host.signals.emit("SIGINT");
    const code = await running;
    host.signals.emit("SIGINT");

    Assert.areEqual(0, code, [...console.errors, ...console.lines].join("|"));
    Assert.areEqual(1, console.lines.filter(t => t === "Cancelling the reply...").length, console.lines.join("|"));
    Assert.isTrue(console.lines.includes("-- reply Cancelled"));
  }
}
