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
export class SearchCommandTests {
  @TestMethod
  public async findsConversationsByTitleAndText(): Promise<void> {
    await using host = await CliTestHost.create();
    const project = await host.openProject();
    const conversation = await host.createConversation(project);
    await host.run("send", conversation.id, "Please look at the login page", "--provider", "fake");
    const titled = await host.run("conversation-new", project.id, "--title", "Login flow");

    const byText = await host.run("search", "login page");
    const textLine = host.console.lastLine;
    const byTitle = await host.runJson("search", "login flow", "--limit", "5");
    const none = await host.run("search", "nothing of the sort");
    const bad = await host.run("search", "login", "--limit", "0");

    Assert.areEqual(0, titled);
    Assert.areEqual(0, byText);
    Assert.isTrue(textLine.startsWith(`${conversation.id}  `));
    Assert.isTrue(textLine.includes("login page"));
    Assert.areEqual(1, Array.isArray(byTitle) ? byTitle.length : -1);
    Assert.areEqual(0, none);
    Assert.areEqual(1, bad);
  }
}
