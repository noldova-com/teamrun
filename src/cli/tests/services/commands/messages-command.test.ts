/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class MessagesCommandTests {
  @TestMethod
  public async listsMessagesAfterASequence(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    await host.run("send", conversation.id, "Hi", "--provider", "fake");

    const all = await host.run("messages", conversation.id);
    const allLines = host.console.lines.length;
    const later = await host.run("messages", conversation.id, "--after", "0");

    Assert.areEqual(0, all);
    Assert.areEqual(2, allLines);
    const last = host.console.lastLine;
    Assert.areEqual(0, later);
    Assert.areEqual(1, host.console.lines.length);
    Assert.isTrue(last.startsWith("1  Provider  Completed  "), last);
    Assert.isTrue(last.endsWith("[Text] Reply to Hi"), last);
  }

  @TestMethod
  public async listsAPageOfMessages(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    await host.run("send", conversation.id, "Hi", "--provider", "fake");

    const newest = await host.run("messages", conversation.id, "--limit", "1");
    const newestLine = host.console.lastLine;
    const earlier = await host.run("messages", conversation.id, "--before", "1", "--limit", "5");
    const earlierLine = host.console.lastLine;
    const later = await host.run("messages", conversation.id, "--after", "0", "--limit", "5");
    const laterLine = host.console.lastLine;
    const defaultLimit = await host.run("messages", conversation.id, "--before", "1");

    Assert.areEqual(0, newest);
    Assert.isTrue(newestLine.startsWith("1  Provider  "), newestLine);
    Assert.areEqual(0, earlier);
    Assert.isTrue(earlierLine.startsWith("0  User  "), earlierLine);
    Assert.areEqual(0, later);
    Assert.isTrue(laterLine.startsWith("1  Provider  "), laterLine);
    Assert.areEqual(0, defaultLimit);
    Assert.areEqual(1, host.console.lines.length);
  }
}
