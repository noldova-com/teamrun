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
export class ConversationsCommandTests {
  @TestMethod
  public async listsConversationsOfAProject(): Promise<void> {
    await using host = await CliTestHost.create();
    const project = await host.openProject();
    const conversation = await host.createConversation(project);

    const code = await host.run("conversations", project.id);

    Assert.areEqual(0, code);
    Assert.isTrue(host.console.lastLine.startsWith(`${conversation.id}  Chat  `));
  }
}
