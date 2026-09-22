/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { FakeConsole } from "../../fixtures/fake-console.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class CancelCommandTests {
  @TestMethod
  public async cancelsTheOpenReplyOrReportsNone(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    host.adapter.holdUntilAbort = true;
    const sending = host.runWith(new FakeConsole(), "send", conversation.id, "Wait", "--provider", "fake");
    await Wait.until(() => host.adapter.prompts.length === 1);

    const cancelled = await host.run("cancel", conversation.id);
    const printed = host.console.lastLine;
    const sendCode = await sending;
    const none = await host.run("cancel", conversation.id);

    Assert.areEqual(0, cancelled);
    Assert.isTrue(printed.startsWith("1  Provider  Cancelled  "), printed);
    Assert.areEqual(1, sendCode);
    Assert.areEqual(1, none);
    Assert.areEqual("The conversation has no open reply.", host.console.errors[0]);
  }
}
