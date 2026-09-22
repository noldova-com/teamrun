/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { ApprovalAsk } from "@noldova/teamrun-core";
import { ApprovalKind, ApprovalOption, ApprovalOutcome, MethodName } from "@noldova/teamrun-protocol";
import { RuntimeSession } from "@noldova/teamrun-cli";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class ApproveCommandTests {
  @TestMethod
  public async decidesAPendingApproval(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    host.adapter.approvalAsk = new ApprovalAsk("req-1", ApprovalKind.Command, "Bash", "Run ls", null, [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved)]);
    const session = await RuntimeSession.open(host.connections);
    await session.call(MethodName.MessageSend, { conversationId: conversation.id, text: "Hi", requested: { provider: "fake", model: null, effort: null }, providerAccountId: null });
    await Wait.until(() => host.adapter.prompts.length === 1);
    const approvals = JsonReader.fromValue({ items: await session.call(MethodName.ApprovalList, { conversationId: conversation.id }) }).readObjectArray("items");
    const approvalId = approvals[0]?.readString("id") ?? "";
    session[Symbol.dispose]();

    const code = await host.run("approve", approvalId, "allow");
    const printed = host.console.lines[0];
    const again = await host.run("approve", approvalId, "allow");

    Assert.areEqual(0, code);
    Assert.areEqual(`${approvalId}  Approved  Command  Run ls  allow`, printed);
    Assert.areEqual(1, again);
  }
}
