/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { CliSettings, CommandContext, CommandLine, DecisionPolicy, RuntimeSession, SendCommand } from "@noldova/teamrun-cli";
import { ApprovalAsk, TurnOutcome } from "@noldova/teamrun-core";
import { Approval, ApprovalKind, ApprovalOption, ApprovalOutcome, ApprovalStatus, Message, MessageSendParams, MessageStatus, RequestedSettings } from "@noldova/teamrun-protocol";
import { Wait } from "../../fixtures/wait.fixture.js";

import { FakeConsole } from "../../fixtures/fake-console.fixture.js";

import { CliTestHost } from "../../fixtures/cli-test-host.fixture.js";

@TestClass
export class SendCommandTests {
  @TestMethod
  @TestData("--deny", null, ApprovalOutcome.Approved)
  @TestData(null, "unknown", ApprovalOutcome.Approved)
  @TestData(null, null, ApprovalOutcome.Approved)
  @TestData("--approve", null, ApprovalOutcome.Denied)
  public async refusesAnApprovalPolicyWithoutAMatchingOption(flag: string | null, answer: string | null, offered: ApprovalOutcome): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    host.adapter.approvalAsk = new ApprovalAsk("fixture-ask", ApprovalKind.Tool, "Fixture", "Choose an outcome", null,
      [new ApprovalOption("only-option", "Only option", offered)]);
    const console = new FakeConsole();
    if (answer !== null)
      console.answers.push(answer);

    const code = await host.runWith(console, "send", conversation.id, "Ask", "--provider", "fake", ...(flag === null ? [] : [flag]));
    const pending = await host.runJson("approvals", conversation.id);

    Assert.areEqual(1, code);
    Assert.isTrue(console.errors.some(t => t.startsWith("Error (Unavailable)")));
    Assert.isTrue(Array.isArray(pending));
    if (!Array.isArray(pending))
      throw new Error("Expected the pending approval list.");
    Assert.areEqual(1, pending.length);
    const approval = Approval.fromJson(pending[0]);
    Assert.areEqual(ApprovalStatus.Pending, approval.status);
    Assert.isNull(approval.decision);
  }

  @TestMethod
  public async preservesAnInterruptBeforeTheSendResponseArrives(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    host.adapter.holdUntilAbort = true;
    using session = await RuntimeSession.open(host.connections);
    const commandLine = CommandLine.parse(["send", "--json"]);
    const context = new CommandContext(commandLine, CliSettings.fromCommandLine(commandLine), host.console, host.connections, host.signals);
    const pending = SendCommand.sendAndFollow(session, context,
      new MessageSendParams(conversation.id, "hold", new RequestedSettings("fake", null, null), null), DecisionPolicy.Deny);
    host.signals.emit("SIGINT");
    const outcomes = await pending;
    Assert.areEqual(1, outcomes.length);
    Assert.areEqual(MessageStatus.Cancelled, outcomes[0]?.reply.status);
    Assert.areEqual(0, host.signals.listenerCount("SIGINT"));
  }

  @TestMethod
  public async reportsAnInterruptedConnectionWithoutLeavingTheSendWaiting(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    host.adapter.holdUntilAbort = true;
    using session = await RuntimeSession.open(host.connections);
    const commandLine = CommandLine.parse(["send", "--json"]);
    const context = new CommandContext(commandLine, CliSettings.fromCommandLine(commandLine), host.console, host.connections, host.signals);
    const pending = SendCommand.sendAndFollow(session, context,
      new MessageSendParams(conversation.id, "hold", new RequestedSettings("fake", null, null), null), DecisionPolicy.Deny);
    const failure = Assert.throwsAsync(() => pending, Error);
    await Wait.until(() => host.adapter.prompts.length === 1);
    await Wait.delay(20);
    session[Symbol.dispose]();
    host.signals.emit("SIGINT");
    await failure;
    Assert.areEqual(0, host.signals.listenerCount("SIGINT"));
  }

  @TestMethod
  public async addressesTeammatesByMentionsOrMembershipAndAllowsZeroReplies(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    const alice = await host.createTeammate("Alice");
    const bob = await host.createTeammate("Bob");
    Assert.areEqual(1, await host.run("send", conversation.id, "hi", "--as", "Alice"));
    Assert.areEqual(2, await host.run("send", conversation.id, "hi", "--as", "Missing"));
    Assert.areEqual(2, await host.run("send", conversation.id, "@Alice hi", "--model", "override"));
    const replies = (await host.runJson("send", conversation.id, "@Bob @Alice hi") as unknown[]).map(t => Message.fromJson(t));
    Assert.areEqual("Bob,Alice", replies.map(t => t.teammateName).join(","));
    const selected = (await host.runJson("send", conversation.id, "continue", "--as", "alice") as unknown[]).map(t => Message.fromJson(t));
    Assert.areEqual(alice.id, selected[0]?.teammateId);
    const explicit = (await host.runJson("send", conversation.id, "@Bob next", "--as", "Missing") as unknown[]).map(t => Message.fromJson(t));
    Assert.areEqual(bob.id, explicit[0]?.teammateId);
    await host.runJson("account-remove", bob.providerAccountId);
    Assert.areEqual("[]", JSON.stringify(await host.runJson("send", conversation.id, "@Bob unavailable")));
    Assert.areEqual(0, await host.run("send", conversation.id, "mail a@Alice or `@Bob`", "--provider", "fake"));
  }

  @TestMethod
  public async interruptsTheWholeSendIncludingQueuedReplies(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    await host.createTeammate("Alice");
    await host.createTeammate("Bob");
    host.adapter.holdUntilAbort = true;
    const completion = host.run("send", conversation.id, "@Alice @Bob wait", "--json");
    for (let attempt = 0; attempt < 400 && host.adapter.prompts.length === 0; attempt++)
      await new Promise(resolve => setTimeout(resolve, 5));
    host.signals.emit("SIGINT");
    Assert.areEqual(1, await completion);
    const replies = JSON.parse(host.console.output) as { status: string }[];
    Assert.areEqual("Cancelled,Cancelled", replies.map(t => t.status).join(","));
    Assert.areEqual(1, host.adapter.prompts.length);
    Assert.areEqual(0, host.signals.listenerCount("SIGINT"));
  }

  @TestMethod
  public async sendsAndFollowsAReply(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();

    const code = await host.run("send", conversation.id, "Hi", "--provider", "fake", "--model", "fake-model", "--effort", "high");
    const lines = host.console.lines.join("|");
    const reply = Message.fromJson((await host.runJson("send", conversation.id, "Again", "--provider", "fake") as unknown[])[0]);

    Assert.areEqual(0, code);
    Assert.areEqual("[Text] Reply to Hi|-- reply Completed", lines);

    host.adapter.streamedTexts = ["Str", "Streamed"];
    host.adapter.approvalAsk = new ApprovalAsk("req-s", ApprovalKind.Command, "Bash", "Run ls", null, [new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied)]);
    const streamedCode = await host.run("send", conversation.id, "Stream", "--provider", "fake", "--deny");
    Assert.areEqual(0, streamedCode, host.console.errors.join("; "));
    const streamedLines = host.console.lines.join("|");
    Assert.isTrue(streamedLines.startsWith("[Text] Reply to Stream|[Text] Streamed|"), streamedLines);
    Assert.isFalse(streamedLines.includes("[Text] Str|"), streamedLines);
    Assert.isTrue(streamedLines.includes("|-- reply Completed"), streamedLines);
    host.adapter.streamedTexts = [];
    host.adapter.approvalAsk = null;
    Assert.areEqual("Completed", reply.status);
    Assert.areEqual("Hi,Again,Stream", host.adapter.prompts.join(","));
  }

  @TestMethod
  public async answersApprovalsByPolicyOrByAsking(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    const options = [new ApprovalOption("allow", "Allow", ApprovalOutcome.Approved), new ApprovalOption("deny", "Deny", ApprovalOutcome.Denied)];
    host.adapter.approvalAsk = new ApprovalAsk("req-1", ApprovalKind.Command, "Bash", "Run ls", null, options);

    await host.run("send", conversation.id, "Approve", "--provider", "fake", "--approve");
    const approved = host.console.lines.join("|");
    await host.run("send", conversation.id, "Deny", "--provider", "fake", "--deny");
    const denied = host.console.lines.join("|");
    const asked = host.console = SendCommandTests.consoleWith(["allow"]);
    await host.runWith(asked, "send", conversation.id, "Ask", "--provider", "fake");
    const invalid = host.console = SendCommandTests.consoleWith(["maybe"]);
    await host.runWith(invalid, "send", conversation.id, "Invalid", "--provider", "fake");

    Assert.isTrue(approved.includes("-- decided allow") && approved.includes("[Note] decided allow"), approved);
    Assert.isTrue(denied.includes("-- decided deny") && denied.includes("[Note] decided deny"), denied);
    Assert.areEqual("Approval requested:|Run ls|  allow: Allow|  deny: Deny", asked.lines.slice(0, 4).join("|"));
    Assert.isTrue(asked.lines.includes("[Text] Reply to Ask"));
    Assert.areEqual("Decision (option id): ", asked.prompts[0]);
    Assert.isTrue(asked.lines.includes("-- decided allow"));
    Assert.isTrue(invalid.lines.includes("-- decided deny"));
  }

  @TestMethod
  public async reportsFailedRepliesWithExitOne(): Promise<void> {
    await using host = await CliTestHost.create();
    const conversation = await host.createConversation();
    host.adapter.outcome = TurnOutcome.Failed;

    const code = await host.run("send", conversation.id, "Boom", "--provider", "fake");
    const printed = host.console.lastLine;
    const missingProvider = await host.run("send", conversation.id, "Boom");

    Assert.areEqual(1, code);
    Assert.areEqual("-- reply Failed", printed);
    Assert.areEqual(2, missingProvider);
  }

  private static consoleWith(answers: readonly string[]): FakeConsole {
    const console = new FakeConsole();
    console.answers.push(...answers);
    return console;
  }
}
