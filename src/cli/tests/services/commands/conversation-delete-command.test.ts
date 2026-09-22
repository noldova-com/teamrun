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
export class ConversationDeleteCommandTests {
  @TestMethod
  public async deletesAConversation(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();

    const code = await host.run("conversation-delete", conversation.id);
    const printed = host.console.lastLine;
    const again = await host.run("conversation-delete", conversation.id);

    Assert.areEqual(0, code);
    Assert.areEqual(conversation.id, printed);
    Assert.areEqual(1, again);
  }
}
