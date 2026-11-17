/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CliCommandException } from "@noldova/desktop.cli";
import {
  Conversation, ConversationCreateParams, ConversationIdParams, DetailKind, type Message, MessageSendParams, MessageSendResult, MessageStatus
} from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class LiveCheckCommandTests {
  private static readonly prompt: string = "Reply with the single word PONG and do nothing else.";

  @TestMethod
  public async sendsThePromptInAChatOfItsOwnWaitsForTheReplyAndDeletesTheChat(): Promise<void> {
    const reads = [[SampleData.reply("m2", "c9", 1, MessageStatus.Running)],
      [SampleData.reply("m2", "c9", 1, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "PONG")])]];
    const context = await LiveCheckCommandTests.contextAsync(() => (reads.shift() as Message[]).map(t => t.toJson()));

    const result = await context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: LiveCheckCommandTests.prompt });

    Assert.areEqual("Work (codex) answered: PONG", result.text);
    const report = result.value as Readonly<Record<string, unknown>>;
    Assert.areEqual(`a1|codex|${LiveCheckCommandTests.prompt}|Completed|PONG|`, ["provider", "kind", "prompt", "status", "text", "error"].map(t => report[t]).join("|"));
    Assert.isTrue(Number.isSafeInteger(report["durationMilliseconds"]));
    const created = ConversationCreateParams.fromJson(context.payloadsOf("teamrun.conversationCreate")[0]);
    Assert.areEqual("null Live check", `${created.projectId} ${created.title}`);
    const sent = MessageSendParams.fromJson(context.payloadsOf("teamrun.messageSend")[0]);
    Assert.areEqual(`c9 ${LiveCheckCommandTests.prompt} codex a1`, `${sent.chatId} ${sent.text} ${sent.requested?.kind} ${sent.providerId}`);
    Assert.areEqual(2, context.payloadsOf("teamrun.messageList").length);
    Assert.areEqual("c9", ConversationIdParams.fromJson(context.payloadsOf("teamrun.conversationDelete")[0]).conversationId);
  }

  @TestMethod
  public async failsWithTheReportWhenTheReplyEndsOtherThanCompletedAndStillDeletesTheChat(): Promise<void> {
    const ended = [SampleData.reply("m2", "c9", 1, MessageStatus.Failed, [SampleData.detail(0, DetailKind.Error, "Rate limited")]),
      SampleData.reply("m2", "c9", 1, MessageStatus.Cancelled)];
    const context = await LiveCheckCommandTests.contextAsync(() => [(ended[0] as Message).toJson()]);

    const failed = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }), CliCommandException);
    ended.shift();
    const cancelled = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }), CliCommandException);

    Assert.areEqual("LiveCheckFailed The reply of Work (codex) ended Failed: Rate limited", `${failed.code} ${failed.message}`);
    Assert.areEqual("Failed Rate limited", `${failed.details?.["status"]} ${failed.details?.["error"]}`);
    Assert.areEqual("The reply of Work (codex) ended Cancelled.", cancelled.message);
    Assert.areEqual(2, context.payloadsOf("teamrun.conversationDelete").length);
  }

  @TestMethod
  public async stopsAReplyThatAsksForAnApprovalAndFails(): Promise<void> {
    const context = await LiveCheckCommandTests.contextAsync(() => [SampleData.reply("m2", "c9", 1, MessageStatus.AwaitingApproval).toJson()]);
    context.answer("teamrun.conversationCancel", () => []);

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }), CliCommandException);

    Assert.areEqual("Work (codex) asked for an approval, which only the window answers, so the live check stopped its reply.", error.message);
    Assert.areEqual("c9", ConversationIdParams.fromJson(context.payloadsOf("teamrun.conversationCancel")[0]).conversationId);
    Assert.areEqual("teamrun.conversationCancel,teamrun.conversationDelete", context.requests.slice(-2).map(t => t[0]).join(","));
  }

  @TestMethod
  public async failsWhenTheRuntimeStartsNoReplyOrTheReplyIsGone(): Promise<void> {
    const context = await LiveCheckCommandTests.contextAsync(() => []);

    const gone = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }), CliCommandException);
    context.answer("teamrun.messageSend", () => new MessageSendResult(SampleData.user("m1", "c9", 0, "Hi"), []).toJson());
    const none = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }), CliCommandException);

    Assert.areEqual("The live check's reply is gone: its chat was deleted while the reply ran.", gone.message);
    Assert.areEqual("LiveCheckFailed The runtime started no reply for the live check's message.", `${none.code} ${none.message}`);
    Assert.areEqual(2, context.payloadsOf("teamrun.conversationDelete").length);
  }

  @TestMethod
  public async endsAsCancelledWhenStoppedWhileTheReplyRunsThoughItsChatCantBeDeleted(): Promise<void> {
    const controller = new AbortController();
    const context = await LiveCheckCommandTests.contextAsync(() => {
      controller.abort();
      return [SampleData.reply("m2", "c9", 1, MessageStatus.Running).toJson()];
    });
    context.answer("teamrun.conversationDelete", () => {
      throw new Error("The connection is closed.");
    });

    const error = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }, controller.signal), Error);

    Assert.areEqual("AbortError", error.name);
    Assert.areEqual(1, context.payloadsOf("teamrun.messageList").length);
    Assert.areEqual(1, context.payloadsOf("teamrun.conversationDelete").length);
  }

  @TestMethod
  public async namesTheChatItCantDeleteAfterAPassOrAFailure(): Promise<void> {
    const replies = [SampleData.reply("m2", "c9", 1, MessageStatus.Completed, [SampleData.detail(0, DetailKind.Text, "PONG")]),
      SampleData.reply("m2", "c9", 1, MessageStatus.Failed)];
    const context = await LiveCheckCommandTests.contextAsync(() => [(replies.shift() as Message).toJson()]);
    context.answer("teamrun.conversationDelete", () => {
      throw new Error("The runtime went away.");
    });

    const passed = await context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" });
    const failed = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }), CliCommandException);

    const left = "The live check's chat c9 stays; delete-chat c9 removes it.";
    Assert.areEqual(`Work (codex) answered: PONG\n${left}`, passed.text);
    Assert.areEqual("Completed", (passed.value as Readonly<Record<string, unknown>>)["status"]);
    Assert.areEqual(`LiveCheckFailed The reply of Work (codex) ended Failed.\n${left}`, `${failed.code} ${failed.message}`);
    Assert.areEqual("Failed", failed.details?.["status"]);
  }

  @TestMethod
  public async namesTheChatItCantDeleteAfterARequestFailsAsALiveCheckFailure(): Promise<void> {
    const failures: unknown[] = [new Error("The runtime went away."), "No answer"];
    const context = await LiveCheckCommandTests.contextAsync(() => {
      throw failures.shift();
    });
    context.answer("teamrun.conversationDelete", () => {
      throw new Error("The runtime went away.");
    });

    const lost = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }), CliCommandException);
    const odd = await Assert.throwsAsync(() => context.runAsync("teamrun.liveCheck", { provider: "a1", prompt: "Hi" }), CliCommandException);

    const left = "The live check's chat c9 stays; delete-chat c9 removes it.";
    Assert.areEqual(`LiveCheckFailed The runtime went away.\n${left}`, `${lost.code} ${lost.message}`);
    Assert.areEqual(`No answer\n${left}`, odd.message);
  }

  private static async contextAsync(messages: () => JsonValue): Promise<RecordingCliContext> {
    const context = await RecordingCliContext.activateAsync();
    return context.answer("teamrun.providerList", () => [SampleData.provider.toJson()])
      .answer("teamrun.conversationCreate", () => new Conversation("c9", null, "Live check", SampleData.time, SampleData.time, false, null, null, false, "/data/chats/c9").toJson())
      .answer("teamrun.messageSend", () => new MessageSendResult(SampleData.user("m1", "c9", 0, "Hi"), [SampleData.reply("m2", "c9", 1, MessageStatus.Pending)]).toJson())
      .answer("teamrun.messageList", messages)
      .answer("teamrun.conversationDelete", () => null);
  }
}
