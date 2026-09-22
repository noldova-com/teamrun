/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalAsk } from "@noldova/teamrun-core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, MethodName } from "@noldova/teamrun-protocol";
import { RuntimeSession } from "@noldova/teamrun-cli";

import { Wait } from "../../fixtures/wait.fixture.js";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class ApprovalsCommandTests {
  @TestMethod
  public async listsApprovalsOfAConversation(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    host.adapter.approvalAsk = new ApprovalAsk("req-1", ApprovalKind.Command, "Bash", "Run ls", null, [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved)]);
    const session = await RuntimeSession.open(host.connections);
    await session.call(MethodName.MessageSend, { conversationId: conversation.id, text: "Hi", requested: { provider: "fake", model: null, effort: null }, providerAccountId: null });
    await Wait.until(() => host.adapter.prompts.length === 1);

    const code = await host.run("approvals", conversation.id);
    session[Symbol.dispose]();

    Assert.areEqual(0, code);
    Assert.isTrue(host.console.lastLine.includes("  Pending  Command  Run ls  "));
  }
}
