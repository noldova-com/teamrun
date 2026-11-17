/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { Failure, FailureCode } from "@noldova/desktop.protocol";
import { MethodFailureException } from "@noldova/desktop.runtime";
import { ConversationIdParams, Message, MessageStatus } from "@noldova/teamrun.protocol";

import { RecordingCliContext } from "../fixtures/recording-cli-context.fixture.js";
import { SampleData } from "../fixtures/sample-data.fixture.js";

@TestClass
export class CancelCommandTests {
  @TestMethod
  public async stopsTheChatInOneAskAndNamesEveryReplyItStopped(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationCancel", () => ["m2", "m3", "m4"].map((t, index) => SampleData.reply(t, "c1", index + 1, MessageStatus.Cancelled).toJson()));

    const result = await context.runAsync("teamrun.cancel", { chatId: "c1" });

    Assert.areEqual("Stopped m2, m3, m4.", result.text);
    Assert.areEqual("m2,m3,m4", (result.value as unknown[]).map(t => Message.fromJson(t).id).join(","));
    Assert.areEqual(JSON.stringify([new ConversationIdParams("c1").toJson()]), JSON.stringify(context.payloadsOf("teamrun.conversationCancel")));
    Assert.areEqual(0, context.payloadsOf("teamrun.messageListOpen").length);
    Assert.areEqual(0, context.payloadsOf("teamrun.messageCancel").length);
  }

  @TestMethod
  public async namesOnlyTheRepliesTheStopAnswersAsCancelled(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationCancel", () => [
      SampleData.reply("m2", "c1", 1, MessageStatus.Completed).toJson(),
      SampleData.reply("m3", "c1", 2, MessageStatus.Cancelled).toJson()
    ]);

    const result = await context.runAsync("teamrun.cancel", { chatId: "c1" });

    Assert.areEqual("Stopped m3.", result.text);
    Assert.areEqual("m3", (result.value as unknown[]).map(t => Message.fromJson(t).id).join(","));
  }

  @TestMethod
  public async saysTheChatHasNoWorkingReplyWhenTheStopStoppedNone(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationCancel", () => []);

    const result = await context.runAsync("teamrun.cancel", { chatId: "c1" });

    Assert.areEqual("The chat has no working reply.", result.text);
    Assert.areEqual("[]", JSON.stringify(result.value));
  }

  @TestMethod
  public async saysTheChatHasNoWorkingReplyWhenItHasNoSendInProgress(): Promise<void> {
    const context = await RecordingCliContext.activateAsync();
    context.answer("teamrun.conversationCancel", () => {
      throw new MethodFailureException(new Failure(FailureCode.Conflict, "The conversation \"c1\" has no reply in progress."));
    });

    const result = await context.runAsync("teamrun.cancel", { chatId: "c1" });

    Assert.areEqual("The chat has no working reply.", result.text);
    Assert.areEqual("[]", JSON.stringify(result.value));
  }

  @TestMethod
  public async failsOnAnyOtherRefusalOrError(): Promise<void> {
    const refused = await RecordingCliContext.activateAsync();
    const failure = new MethodFailureException(new Failure(FailureCode.NotFound, "The conversation \"c1\" does not exist."));
    refused.answer("teamrun.conversationCancel", () => {
      throw failure;
    });
    const unanswered = await RecordingCliContext.activateAsync();

    Assert.isTrue(await Assert.throwsAsync(() => refused.runAsync("teamrun.cancel", { chatId: "c1" }), MethodFailureException) === failure);
    Assert.areEqual("The fixture has no answer for teamrun.conversationCancel.",
      (await Assert.throwsAsync(() => unanswered.runAsync("teamrun.cancel", { chatId: "c1" }), Error)).message);
  }
}
