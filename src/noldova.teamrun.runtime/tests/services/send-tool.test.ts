/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PermissionDecision, ToolCall, ToolFailureException } from "@noldova/desktop.runtime";
import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { JsonObject } from "@noldova/context.json";
import { type ISenderSends, type ISenderTokens, SendAsk } from "@noldova/teamrun.core";
import { ErrorCode, Message, MessageAuthor, type MessageSendParams, MessageSendResult, MessageStatus } from "@noldova/teamrun.protocol";
import { SendTool, TeamRunChanges } from "@noldova/teamrun.runtime";
import { ServiceException } from "@noldova/teamrun.services";

import { ChangeServices } from "../fixtures/change-services.fixture.js";
import { ScriptedPermissions } from "../fixtures/scripted-permissions.fixture.js";

@TestClass
export class SendToolTests {
  @TestMethod
  public async asksThePersonWhatCoreDescribesThenSendsInProcessWithTheStartsItAllowedAsTheTurnThatOpenedTheSession(): Promise<void> {
    const sends = new ScriptedSends(SendToolTests.askOf("Bo"));
    const permissions = SendToolTests.allowing();
    const call = SendToolTests.callOf("s1", { chat_id: "c2", text: "@Bo please check this, @Nobody" }, permissions);

    const result = await SendToolTests.toolOf(sends).handleAsync(call);

    Assert.areEqual(JSON.stringify([["teamrun.sendMessage", "c2", "Send a message to the chat \"Bugs\"", "Medium", ["AllowOnce", "Deny"],
      [["Chat", "Text", "Bugs"], ["Starts", "Text", "Bo"], ["Message", "AgentText", "@Bo please check this, @Nobody"]]]]),
    JSON.stringify(permissions.requests.map(t => [t.action, t.subject, t.title, t.risk, t.options, t.details.map(u => [u.label, u.kind, u.value])])));
    Assert.areEqual(JSON.stringify([["c2", "@Bo please check this, @Nobody", ["t2"], "token-1", null, null, false, "Bo"]]),
      JSON.stringify(sends.sent.map(([t, starts]) => [t.chatId, t.text, t.mentionedTeammateIds, t.senderToken, t.requested, t.responderTeammateId,
        t.wakeWhenDone, starts])));
    Assert.areEqual(2, sends.described.length);
    Assert.areEqual("c2 token-1", sends.announced.map(t => `${t.chatId} ${t.senderToken}`).join(","));
    Assert.areEqual(0, sends.abandoned.length);
    Assert.isTrue(call.hasMarkedSending);
    Assert.areEqual(JSON.stringify(sends.result.toJson()), result.content[0]!.value);
    Assert.areEqual("teamrun:teamrun_send_message", result.content[0]!.origin);
  }

  @TestMethod
  public async sendsNothingWhenThePersonDoesntAllowIt(): Promise<void> {
    const cases: readonly [PermissionDecision, string][] = [
      [PermissionDecision.Denied, "Denied The person didn't allow it, so nothing changed."],
      [PermissionDecision.Expired, "Expired Nobody answered in time, so nothing changed."],
      [PermissionDecision.Withdrawn, "Withdrawn The call ended before the person answered, so nothing changed."]
    ];
    const sends = new ScriptedSends(SendToolTests.askOf("Bo"));
    const tool = SendToolTests.toolOf(sends);

    for (const [decision, expected] of cases) {
      const call = SendToolTests.callOf("s1", { chat_id: "c2", text: "Check this" }, new ScriptedPermissions(() => decision));
      const failure = await Assert.throwsAsync(() => tool.handleAsync(call), ToolFailureException);
      Assert.areEqual(expected, `${failure.failure.code} ${failure.failure.message}`);
      Assert.isFalse(call.hasMarkedSending);
    }

    Assert.areEqual(0, sends.sent.length);
    Assert.areEqual("send-1,send-2,send-3", sends.abandoned.join(","));
  }

  @TestMethod
  public async abandonsNothingForASendCoreAnnouncedNothingFor(): Promise<void> {
    const sends = new ScriptedSends(SendToolTests.askOf("Bo"));
    sends.isAnnouncing = false;
    const call = SendToolTests.callOf("s1", { chat_id: "c2", text: "Check this" }, new ScriptedPermissions(() => PermissionDecision.Denied));

    await Assert.throwsAsync(() => SendToolTests.toolOf(sends).handleAsync(call), ToolFailureException);

    Assert.areEqual("1 0", `${sends.announced.length} ${sends.abandoned.length}`);
  }

  @TestMethod
  public async refusesAsStaleASendWhoseStartsChangedOrThatCoreWouldRefuseOnceThePersonAllowedIt(): Promise<void> {
    const cases: readonly ScriptedSends[] = [new ScriptedSends(SendToolTests.askOf("Bo"), SendToolTests.askOf("Ada")),
      new ScriptedSends(SendToolTests.askOf("Bo"), null)];

    for (const sends of cases) {
      const call = SendToolTests.callOf("s1", { chat_id: "c2", text: "Check this" }, SendToolTests.allowing());
      const failure = await Assert.throwsAsync(() => SendToolTests.toolOf(sends).handleAsync(call), ToolFailureException);
      Assert.areEqual("Stale What the person allowed changed before TeamRun acted, so nothing changed.", `${failure.failure.code} ${failure.failure.message}`);
      Assert.isFalse(call.hasMarkedSending);
      Assert.areEqual(0, sends.sent.length);
    }
  }

  @TestMethod
  public async asksToBeWokenOnlyWhenWakeWhenDoneIsTrue(): Promise<void> {
    const sends = new ScriptedSends(SendToolTests.askOf("Bo"));
    const tool = SendToolTests.toolOf(sends);

    for (const wake of [true, false, "yes"])
      await tool.handleAsync(SendToolTests.callOf("s1", { chat_id: "c2", text: "Check this", wake_when_done: wake }, SendToolTests.allowing()));

    Assert.areEqual(JSON.stringify([true, false, false]), JSON.stringify(sends.sent.map(([t]) => t.wakeWhenDone)));
    const schema = JSON.stringify(TeamRunChanges.send.inputSchema);
    Assert.isTrue(schema.includes("\"wake_when_done\":{\"type\":\"boolean\""), schema);
    Assert.isTrue(schema.includes("\"required\":[\"chat_id\",\"text\"]"), schema);
  }

  @TestMethod
  public async refusesASessionWhoseTurnHasEndedAndPassesOnCoresFailureAskingNothingForASendCoreWouldRefuse(): Promise<void> {
    const sends = new ScriptedSends(null);
    sends.failure = new ServiceException(ErrorCode.NotFound, "No such chat.", ["c99"]);
    const permissions = SendToolTests.allowing();
    const tool = SendToolTests.toolOf(sends);
    const ended = SendToolTests.callOf("s2", { chat_id: "c2", text: "Done" }, permissions);

    const gone = await Assert.throwsAsync(() => tool.handleAsync(ended), ToolFailureException);
    const missing = await Assert.throwsAsync(() => tool.handleAsync(SendToolTests.callOf("s1", { chat_id: "c99", text: "Done" }, permissions)), ToolFailureException);

    Assert.areEqual("Refused This call's turn has ended, so it can't send as its teammate.", `${gone.failure.code} ${gone.failure.message}`);
    Assert.isFalse(ended.hasMarkedSending);
    Assert.areEqual("OutcomeUncertain teamrun.notFound No such chat.", `${missing.failure.code} ${missing.failure.moduleCode} ${missing.failure.message}`);
    Assert.areEqual(JSON.stringify([["c99", null]]), JSON.stringify(sends.sent.map(([t, starts]) => [t.chatId, starts])));
    Assert.areEqual(0, permissions.requests.length);
    Assert.areEqual("c99:send-1", `${sends.announced.map(t => t.chatId).join(",")}:${sends.abandoned.join(",")}`);
  }

  private static askOf(starts: string): SendAsk {
    return new SendAsk("c2", "Bugs", "Send a message to the chat \"Bugs\"", starts);
  }

  private static allowing(): ScriptedPermissions {
    return new ScriptedPermissions(() => PermissionDecision.AllowedOnce);
  }

  private static toolOf(sends: ISenderSends): SendTool {
    return new SendTool("teamrun", new SessionTokens(), sends, new ChangeServices().teammatesService);
  }

  private static callOf(session: string, input: JsonObject, permissions: ScriptedPermissions): ToolCall {
    return new ToolCall(session, "c1/t1", {}, input, 30_000, new AbortController().signal, permissions);
  }
}

class SessionTokens implements ISenderTokens {
  public senderTokenOf(session: string): string | null {
    return session === "s1" ? "token-1" : null;
  }
}

class ScriptedSends implements ISenderSends {
  public readonly described: MessageSendParams[] = [];
  public readonly sent: [MessageSendParams, string | null][] = [];
  public readonly result: MessageSendResult = new MessageSendResult(new Message("m1", "c2", 0, MessageAuthor.User, null, MessageStatus.Completed, [], null,
    "2026-11-02T10:00:00.000Z", null, "2026-11-02T10:00:00.000Z"), []);
  public readonly announced: MessageSendParams[] = [];
  public readonly abandoned: string[] = [];
  public failure: unknown = null;
  public isAnnouncing: boolean = true;
  private readonly asks: readonly (SendAsk | null)[];

  public constructor(...asks: (SendAsk | null)[]) {
    this.asks = asks;
  }

  public describeSendAsync(params: MessageSendParams): Promise<SendAsk | null> {
    this.described.push(params);
    return Promise.resolve(this.asks[Math.min(this.described.length, this.asks.length) - 1] ?? null);
  }

  public sendAllowedAsync(params: MessageSendParams, starts: string | null): Promise<MessageSendResult> {
    this.sent.push([params, starts]);
    return Object.isNull(this.failure) ? Promise.resolve(this.result) : Promise.reject(this.failure);
  }

  public announceSend(params: MessageSendParams): string | null {
    this.announced.push(params);
    return this.isAnnouncing ? `send-${this.announced.length}` : null;
  }

  public abandonSend(sendId: string): void {
    this.abandoned.push(sendId);
  }
}
