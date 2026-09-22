/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Message } from "@noldova/teamrun-protocol";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class RewindCommandTests {
  @TestMethod
  public async rewindsAConversationAndReportsWhatWent(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    await host.run("send", conversation.id, "First", "--provider", "fake");
    await host.run("send", conversation.id, "Second", "--provider", "fake");
    const messages = await host.runJson("messages", conversation.id);
    const second = Array.isArray(messages) ? Message.fromJson(messages[2]) : null;

    const code = await host.run("rewind", conversation.id, second?.id ?? "", "--restore-files");
    const reported = host.console.lastLine;
    const remaining = await host.runJson("messages", conversation.id);
    const missing = await host.run("rewind", conversation.id, "nope");

    Assert.areEqual(0, code);
    Assert.areEqual("Removed 2 messages; no files restored. The next reply starts a fresh provider session.", reported);
    Assert.areEqual(2, Array.isArray(remaining) ? remaining.length : -1);
    Assert.areEqual(1, missing);
  }
}
