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
export class ConversationRenameCommandTests {
  @TestMethod
  public async renamesAConversation(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();

    const code = await host.run("conversation-rename", conversation.id, "Renamed");

    Assert.areEqual(0, code);
    Assert.isTrue(host.console.lastLine.startsWith(`${conversation.id}  Renamed  `));
  }
}
