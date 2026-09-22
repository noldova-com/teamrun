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
export class ConversationMoveCommandTests {
  @TestMethod
  public async movesAConversationToAnotherProject(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    const other = await host.openProject("other");

    const code = await host.run("conversation-move", conversation.id, other.id);

    Assert.areEqual(0, code);
    Assert.isTrue(host.console.lastLine.startsWith(`${conversation.id}  `));
    const listed = await host.runJson("conversations", other.id) as readonly { id: string }[];
    Assert.areEqual(conversation.id, listed[0]?.id);
  }
}
