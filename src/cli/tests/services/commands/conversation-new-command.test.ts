/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { Conversation } from "@noldova/teamrun-protocol";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class ConversationNewCommandTests {
  @TestMethod
  public async startsConversationsWithOrWithoutATitle(): Promise<void> {
    await using host = await CliTestHost.create();
    const project = await host.openProject();

    const titled = await host.createConversation(project);
    const untitled = Conversation.fromJson(await host.runJson("conversation-new", project.id));
    const text = await host.run("conversation-new", project.id, "--title", "Text");

    Assert.areEqual("Chat", titled.title);
    Assert.areEqual("New conversation", untitled.title);
    Assert.areEqual(0, text);
    Assert.isTrue(host.console.lastLine.includes("  Text  "));
  }
}
