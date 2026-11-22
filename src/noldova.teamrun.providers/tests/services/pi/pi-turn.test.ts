/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { TurnOutcome } from "@noldova/teamrun.core";
import { ApprovalKind, ContextUsage, DetailKind, QuestionAnswer } from "@noldova/teamrun.protocol";
import { DeltaStream, InvalidOperationException, PiTurn, Resources } from "@noldova/teamrun.providers";

import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class PiTurnTests {
  @TestMethod
  public async refusesAnAskItCannotBuildAndNotesIt(): Promise<void> {
    const listener = new RecordingTurnListener();
    const replies: JsonObject[] = [];
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "a1", method: "confirm", title: Resources.piApprovalTitle, message: JSON.stringify({ toolName: " " }) });
    await Wait.until(() => listener.details.length === 1, "The listener did not see a detail.");

    Assert.areEqual(JSON.stringify([{ type: "extension_ui_response", id: "a1", confirmed: false }]), JSON.stringify(replies));
    Assert.isTrue(listener.texts[0]!.startsWith(Resources.formatPiApprovalFailed("")));
    Assert.areEqual(0, listener.asks.length);
  }

  @TestMethod
  public async refusesAnAskWhoseFailureItCannotNoteWithoutARejectionLeftOver(): Promise<void> {
    const listener = new RecordingTurnListener();
    listener.decisionFailure = new Error("The window closed.");
    let notes = 0;
    listener.onDetailAsync = (): Promise<void> => {
      notes += 1;
      return Promise.reject(new Error("The listener failed."));
    };
    const replies: JsonObject[] = [];
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "a1", method: "confirm", title: Resources.piApprovalTitle, message: JSON.stringify({ toolName: "edit" }) });
    await Wait.until(() => notes === 2, "The listener did not get both notes.");
    await new Promise(resolve => setImmediate(resolve));
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify([{ type: "extension_ui_response", id: "a1", confirmed: false }]), JSON.stringify(replies));
  }

  @TestMethod
  public async endsCompletedWhenPisRetryRecoversAFailedAttempt(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = PiTurnTests.turn(listener, []);

    PiTurnTests.feed(turn, { type: "message_end", message: { role: "assistant", stopReason: "error", errorMessage: "529 overloaded" } },
      { type: "auto_retry_start", errorMessage: "529 overloaded" },
      { type: "message_end", message: { role: "assistant", stopReason: "stop" } },
      { type: "agent_settled", aborted: false });
    await turn.drainAsync();

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.isNull(turn.error);
  }

  @TestMethod
  public async notesARecordItCannotReadAndGoesOn(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = PiTurnTests.turn(listener, []);

    PiTurnTests.feed(turn, { type: "message_end" }, { type: "agent_settled", aborted: false });
    await turn.drainAsync();

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual(1, listener.details.filter(t => t.kind === DetailKind.Note && t.text.startsWith("TeamRun couldn't read a message_end record from Pi: ")).length);
  }

  @TestMethod
  public async notesACompactionOnceAndNoFailureForAStoppedOrAManualOne(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = PiTurnTests.turn(listener, []);

    PiTurnTests.feed(turn, { type: "compaction_end", reason: "manual", result: { summary: "S" }, aborted: false },
      { type: "compaction_end", reason: "manual", aborted: true },
      { type: "compaction_end", reason: "threshold", aborted: true },
      { type: "compaction_end", reason: "manual", aborted: false, errorMessage: "Nothing to compact" },
      { type: "compaction_end", reason: "threshold", aborted: false, errorMessage: "too large" });
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify([Resources.piCompacted, Resources.formatPiCompactionFailed("too large")]), JSON.stringify(listener.details.map(t => t.text)));
  }

  @TestMethod
  public async streamsTextAndThinkingAndAddsUpTheUsageOfEachAssistantMessage(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = PiTurnTests.turn(listener, []);

    PiTurnTests.feed(turn, { type: "message_start", message: { role: "assistant" } },
      { type: "message_update", assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: "Hm" } },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 1, delta: "Hel" } },
      { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 1, delta: "lo" } },
      { type: "message_update", assistantMessageEvent: { type: "toolcall_delta", contentIndex: 2, delta: "{" } },
      { type: "message_end", message: { role: "assistant", usage: { input: 10, output: 2, cacheRead: 3, cacheWrite: 1, cost: { total: 0.5 } } } },
      { type: "message_end", message: { role: "assistant", usage: { input: 5, output: "many", cost: null } } },
      { type: "message_end", message: { role: "assistant", usage: null } },
      { type: "message_end", message: { role: "assistant", usage: { input: 0 } } },
      { type: "message_end", message: { role: "user", usage: { input: 1000 } } },
      { type: "queue_update" },
      { type: "agent_settled", aborted: false });
    await turn.drainAsync();
    const usage = turn.usage(new ContextUsage(60, 200, null));

    Assert.areEqual(JSON.stringify([[DetailKind.Reasoning, "Hm", "pi:1:0"], [DetailKind.Text, "Hello", "pi:1:1"]]),
      JSON.stringify(listener.details.map(t => [t.kind, t.text, t.providerItemId])));
    Assert.areEqual(1, listener.thinking);
    Assert.isTrue(turn.hasUsage);
    Assert.areEqual(JSON.stringify([15, 2, 0.5, 3, 1, null, 60]), JSON.stringify([usage.inputTokens, usage.outputTokens, usage.costUsd, usage.cacheReadTokens,
      usage.cacheWriteTokens, usage.reasoningTokens, usage.context?.usedTokens]));
    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.isNull(turn.error);
  }

  @TestMethod
  @TestData(true, "Interrupted", null)
  @TestData(false, "Failed", "The provider failed.")
  public async settlesAbortedOrFailedWithTheAssistantsErrorAndOnlyOnce(aborted: boolean, outcome: string, error: string | null): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = PiTurnTests.turn(listener, []);

    PiTurnTests.feed(turn, { type: "message_end", message: { role: "assistant", stopReason: "error", errorMessage: "The provider failed." } },
      { type: "agent_settled", aborted }, { type: "agent_settled", aborted: !aborted });
    turn.settle(TurnOutcome.Completed);
    await turn.drainAsync();

    Assert.areEqual(outcome, turn.outcome);
    Assert.areEqual(outcome, turn.settledOutcome);
    Assert.areEqual(error, turn.error);
    Assert.isFalse(turn.hasUsage);
  }

  @TestMethod
  public refusesItsSettledOutcomeWhileItRuns(): void {
    const turn = PiTurnTests.turn(new RecordingTurnListener(), []);

    Assert.throws(() => turn.settledOutcome, InvalidOperationException);
    Assert.isNull(turn.outcome);
  }

  @TestMethod
  public async settlesButPassesOnAFailureReportingItsLastTextOnceWhenDrained(): Promise<void> {
    const listener = new RecordingTurnListener();
    const failure = new Error("The text could not be saved.");
    const reported: string[] = [];
    listener.onDetailAsync = (detail): Promise<void> => {
      reported.push(detail.text);
      return Promise.reject(failure);
    };
    const turn = PiTurnTests.turn(listener, []);

    PiTurnTests.feed(turn, { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "Hello" } });
    turn.settle(TurnOutcome.Completed);
    const thrown = await Assert.throwsAsync(() => turn.drainAsync(), Error);
    await turn.drainAsync();

    Assert.areEqual(failure, thrown);
    Assert.areEqual("Hello", reported.join(","));
    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.isNull(turn.error);
  }

  @TestMethod
  public async failsWithANoteOfItsOwnWhenNoErrorIsGiven(): Promise<void> {
    const turn = PiTurnTests.turn(new RecordingTurnListener(), []);

    turn.settle(TurnOutcome.Failed);
    await turn.drainAsync();

    Assert.areEqual(Resources.piNoResult, turn.error);
  }

  @TestMethod
  public async handlesEachEventOnlyOnceTheListenerReturnedFromTheEventBefore(): Promise<void> {
    const listener = new RecordingTurnListener();
    const held = Promise.withResolvers<void>();
    listener.heldDetail = held.promise;
    const turn = PiTurnTests.turn(listener, []);

    PiTurnTests.feed(turn, { type: "tool_execution_start", toolCallId: "c1", toolName: "bash", args: { command: "npm test" } },
      { type: "tool_execution_start", toolCallId: "c2", toolName: "write", args: { path: "a.ts" } });
    await Wait.until(() => listener.details.length === 1, "The listener did not see the first tool.");
    await new Promise(resolve => setImmediate(resolve));
    const whileHeld = listener.details.map(t => t.providerItemId);
    const finishedWhileHeld = listener.finishedDetails.length;
    held.resolve();
    PiTurnTests.feed(turn, { type: "agent_settled", aborted: false });
    await turn.waitForSettled();
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify(["c1"]), JSON.stringify(whileHeld));
    Assert.areEqual(0, finishedWhileHeld);
    Assert.areEqual(JSON.stringify(["c1", "c2"]), JSON.stringify(listener.details.map(t => t.providerItemId)));
    Assert.areEqual(JSON.stringify(["c1", "c2"]), JSON.stringify(listener.finishedDetails.map(t => t.providerItemId)));
    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
  }

  @TestMethod
  public async showsToolsWithTheirOutputAndNotesForCompactionRetriesExtensionFailuresAndNotifications(): Promise<void> {
    const listener = new RecordingTurnListener();
    const turn = PiTurnTests.turn(listener, []);

    PiTurnTests.feed(turn, { type: "tool_execution_start", toolCallId: "c1", toolName: "bash", args: { command: "npm test" } },
      { type: "tool_execution_end", toolCallId: "c1", toolName: "bash", isError: true, result: { content: [{ type: "text", text: "failed" }, { type: "image" }, "x"] } },
      { type: "tool_execution_start", toolCallId: "c2", toolName: "write", args: { path: "a.ts", content: "x" } },
      { type: "tool_execution_end", toolCallId: "c2", toolName: "write", result: "plain" },
      { type: "tool_execution_start", toolCallId: "c3", toolName: "grep" },
      { type: "tool_execution_end", toolCallId: "c3", toolName: "grep", args: ["odd"], result: { content: "text" } },
      { type: "tool_execution_end", toolCallId: "c4", toolName: "ls" },
      { type: "compaction_end", result: { summary: "S" } },
      { type: "compaction_end", result: null, errorMessage: "too large" },
      { type: "compaction_end" },
      { type: "auto_retry_start", errorMessage: "529 overloaded" },
      { type: "extension_error", error: "boom" },
      { type: "extension_ui_request", id: "n1", method: "notify", message: "Heads up" });
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify([
      [DetailKind.Command, "bash: npm test", "c1", null, null],
      [DetailKind.Command, "bash: npm test", "c1", "failed\n\n", true],
      [DetailKind.FileChange, "write: a.ts", "c2", null, null],
      [DetailKind.FileChange, "write: a.ts", "c2", "", false],
      [DetailKind.Note, "grep", "c3", null, null],
      [DetailKind.Note, "grep", "c3", "", false],
      [DetailKind.Note, "ls", "c4", null, null],
      [DetailKind.Note, Resources.piCompacted, null, null, null],
      [DetailKind.Note, Resources.formatPiCompactionFailed("too large"), null, null, null],
      [DetailKind.Note, Resources.formatPiCompactionFailed(""), null, null, null],
      [DetailKind.Note, Resources.formatPiRetrying("529 overloaded"), null, null, null],
      [DetailKind.Note, Resources.formatPiExtensionFailed("boom"), null, null, null],
      [DetailKind.Note, "Heads up", null, null, null]]), JSON.stringify(listener.details.map(t => {
      const payload = t.payload as JsonObject | null;
      return [t.kind, t.text, t.providerItemId, payload?.["output"] ?? null, payload?.["isError"] ?? null];
    })));
  }

  @TestMethod
  public async refusesAnUnreadableApprovalAndIgnoresWhatNeedsNoAnswer(): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "c2", method: "confirm", title: Resources.piApprovalTitle, message: "{" },
      { type: "extension_ui_request", id: "w1", method: "setWidget", widgetKey: "x" });
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify([{ type: "extension_ui_response", id: "c2", confirmed: false }]), JSON.stringify(replies));
    Assert.areEqual(0, listener.asks.length);
    Assert.areEqual(0, listener.questionAsks.length);
  }

  @TestMethod
  public asksAnExtensionsDialogsThroughTheQuestionCardAndAnswersEachWithThePersonsAnswer(): Promise<void> {
    return PiTurnTests.answerDialogs([new QuestionAnswer("s1", ["B"], null), new QuestionAnswer("c1", ["Yes"], null), new QuestionAnswer("c2", ["No"], null),
      new QuestionAnswer("i1", [], "Atlas"), new QuestionAnswer("e1", [], "Shipped the fix.")], [{ value: "B" }, { confirmed: true }, { confirmed: false }, { value: "Atlas" },
      { value: "Shipped the fix." }]);
  }

  @TestMethod
  public sendsADismissalForEachDialogThePersonDismisses(): Promise<void> {
    return PiTurnTests.answerDialogs([null, null, null, null, null], Array.from({ length: 5 }, () => ({ cancelled: true })));
  }

  @TestMethod
  public sendsADismissalForASelectAnsweredWithoutAChoice(): Promise<void> {
    return PiTurnTests.answerDialogs([new QuestionAnswer("s1", [], "C"), null, null, null, null], Array.from({ length: 5 }, () => ({ cancelled: true })));
  }

  @TestMethod
  public async dismissesADialogWithNothingToAskWithoutShowingIt(): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "s1", method: "select", title: "Pick", options: [" ", 3] },
      { type: "extension_ui_request", id: "s2", method: "select", title: "Pick" },
      { type: "extension_ui_request", id: "c1", method: "confirm", title: " " },
      { type: "extension_ui_request", id: "i1", method: "input" });
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify(["s1", "s2", "c1", "i1"].map(id => ({ type: "extension_ui_response", id, cancelled: true }))), JSON.stringify(replies));
    Assert.areEqual(0, listener.questionAsks.length);
  }

  @TestMethod
  public async dismissesADialogItCouldNotAskAndNotesWhy(): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    listener.decisionFailure = new Error("The window closed.");
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "i1", method: "input", title: "Name?" });
    await Wait.until(() => replies.length === 1, "Pi did not get a reply.");
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify([{ type: "extension_ui_response", id: "i1", cancelled: true }]), JSON.stringify(replies));
    Assert.areEqual(JSON.stringify([Resources.formatPiQuestionFailed("The window closed.")]), JSON.stringify(listener.texts));
  }

  @TestMethod
  public async dismissesADialogWhoseFailureItCannotNoteWithoutARejectionLeftOver(): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    listener.decisionFailure = new Error("The window closed.");
    let notes = 0;
    listener.onDetailAsync = (): Promise<void> => {
      notes += 1;
      return Promise.reject(new Error("The listener failed."));
    };
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "e1", method: "editor", title: "Notes" });
    await Wait.until(() => notes === 1, "The listener did not get the note.");
    await new Promise(resolve => setImmediate(resolve));
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify([{ type: "extension_ui_response", id: "e1", cancelled: true }]), JSON.stringify(replies));
  }

  @TestMethod
  public async dismissesADialogThatArrivesOnceTheTurnHasEndedWithoutACardAndAsksOneBefore(): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    listener.heldAnswer = new Promise(() => undefined);
    const turn = PiTurnTests.turn(listener, replies);
    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "i0", method: "input", title: "Before?" });
    await turn.drainAsync();
    const before = listener.questionAsks.length;

    turn.settle(TurnOutcome.Interrupted);
    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "s1", method: "select", title: "Pick", options: ["A"] },
      { type: "extension_ui_request", id: "c1", method: "confirm", title: "Clear?", message: "This removes every message." },
      { type: "extension_ui_request", id: "a1", method: "confirm", title: Resources.piApprovalTitle, message: JSON.stringify({ toolName: "bash", input: {} }) },
      { type: "extension_ui_request", id: "e1", method: "editor", title: "Notes" });
    await turn.drainAsync();

    Assert.areEqual(JSON.stringify([1, 1]), JSON.stringify([before, listener.questionAsks.length + listener.asks.length]));
    Assert.areEqual(JSON.stringify([{ type: "extension_ui_response", id: "s1", cancelled: true }, { type: "extension_ui_response", id: "c1", confirmed: false },
      { type: "extension_ui_response", id: "a1", confirmed: false }, { type: "extension_ui_response", id: "e1", cancelled: true }]), JSON.stringify(replies));
  }

  @TestMethod
  public async closesATimedDialogsCardAMarginBeforePiGivesUp(): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    const held = Promise.withResolvers<readonly QuestionAnswer[] | null>();
    listener.heldAnswer = held.promise;
    const turn = PiTurnTests.turn(listener, replies);
    const timeout = Resources.piDialogTimeoutMargin + 50;
    const started = Date.now();

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "i1", method: "input", title: "Name?", timeout });
    await Wait.until(() => listener.signals[0]?.aborted === true, "The card did not close.", timeout * 2);

    Assert.isTrue(Date.now() - started < timeout, "The card stayed open until Pi's own timeout.");
    held.resolve(null);
    await Wait.until(() => listener.texts.length === 1, "The timeout was not noted.");
    Assert.areEqual(JSON.stringify([Resources.formatPiDialogTimedOut("", "Name?")]), JSON.stringify(listener.texts));
    Assert.areEqual("[]", JSON.stringify(replies));
  }

  @TestMethod
  public async notesATimedOutConfirmByItsTitleAndItsMessage(): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    const held = Promise.withResolvers<readonly QuestionAnswer[] | null>();
    listener.heldAnswer = held.promise;
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "c1", method: "confirm", title: "Deploy now?", message: "It restarts the server.",
      timeout: Resources.piDialogTimeoutMargin + 1 });
    await Wait.until(() => listener.signals[0]?.aborted === true, "The card did not close.");
    held.resolve(null);
    await Wait.until(() => listener.texts.length === 1, "The timeout was not noted.");

    Assert.areEqual(JSON.stringify(["A Pi extension's question timed out, so Pi used its default answer: Deploy now?\nIt restarts the server."]),
      JSON.stringify(listener.texts));
    Assert.areEqual("[]", JSON.stringify(replies));
  }

  @TestMethod
  public async keepsTheCardOfADialogWithNoTimeoutOrTimeoutZeroOpenPastATimerAndAnswersIt(): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    const held = Promise.withResolvers<readonly QuestionAnswer[] | null>();
    listener.heldAnswer = held.promise;
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "i0", method: "input", title: "Zero?", timeout: 0 },
      { type: "extension_ui_request", id: "i1", method: "input", title: "None?" },
      { type: "extension_ui_request", id: "i2", method: "input", title: "Timed?", timeout: Resources.piDialogTimeoutMargin + 1 });
    await Wait.until(() => listener.signals[2]?.aborted === true, "The timed card did not close.");
    const open = listener.signals.slice(0, 2).map(t => t?.aborted);
    held.resolve([new QuestionAnswer("i", [], "Atlas")]);
    await Wait.until(() => replies.length === 2, "Pi did not get 2 replies.");

    Assert.areEqual(JSON.stringify([false, false]), JSON.stringify(open));
    Assert.areEqual(JSON.stringify(["i0", "i1"].map(id => ({ type: "extension_ui_response", id, value: "Atlas" }))), JSON.stringify(replies));
  }

  @TestMethod
  @TestData("timeout")
  @TestData("settle")
  public closesTheCardWhenPiGivesUpOnTheDialogOrTheTurnEndsAndAnswersNothing(reason: string): Promise<void> {
    return PiTurnTests.giveUp(reason);
  }

  @TestMethod
  @TestData("allow", true)
  @TestData("deny", false)
  @TestData("failure", false)
  public asksForEachToolTheApprovalsExtensionHoldsAndAnswersWithTheDecision(decision: string, confirmed: boolean): Promise<void> {
    return PiTurnTests.approve(decision, confirmed);
  }

  @TestMethod
  public refusesTheApprovalsStillOpenWhenItSettlesAndAnswersNoneOfThem(): Promise<void> {
    return PiTurnTests.approve("held", null);
  }

  private static async approve(decision: string, confirmed: boolean | null): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    const held = Promise.withResolvers<string>();
    if (decision === "failure")
      listener.decisionFailure = new Error("The window closed.");
    else if (decision === "held")
      listener.heldDecision = held.promise;
    else
      listener.decisions.push(decision, decision);
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "a1", method: "confirm", title: Resources.piApprovalTitle,
      message: JSON.stringify({ toolName: "edit", input: { path: "src/a.ts" } }) },
    { type: "extension_ui_request", id: "a2", method: "confirm", title: Resources.piApprovalTitle, message: JSON.stringify({ toolName: "custom" }) });
    await Wait.until(() => listener.asks.length === 2, "The listener did not see 2 questions.");
    if (decision === "held") {
      turn.settle(TurnOutcome.Interrupted);
      await turn.drainAsync();
      held.resolve("allow");
      await held.promise;
      await Promise.resolve();
    }
    else
      await Wait.until(() => replies.length === 2, "Pi did not get both replies.");

    Assert.areEqual(JSON.stringify([[ApprovalKind.FileChange, "edit", "edit: src/a.ts", ["allow", "deny"]], [ApprovalKind.Tool, "custom", "custom", ["allow", "deny"]]]),
      JSON.stringify(listener.asks.map(t => [t.kind, t.nativeKind, t.summary, t.options.map(u => u.id)])));
    Assert.areEqual(decision === "held", listener.signals.every(t => t?.aborted === true));
    Assert.areEqual(JSON.stringify(Object.isNull(confirmed) ? [] : [{ type: "extension_ui_response", id: "a1", confirmed },
      { type: "extension_ui_response", id: "a2", confirmed }]), JSON.stringify(replies));
    Assert.areEqual(decision === "failure" ? 2 : 0, listener.texts.filter(t => t === Resources.formatPiApprovalFailed("The window closed.")).length);
  }

  private static async answerDialogs(answers: readonly (QuestionAnswer | null)[], expected: readonly JsonObject[]): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    listener.answers.push(...answers.map(t => Object.isNull(t) ? null : [t]));
    const turn = PiTurnTests.turn(listener, replies);

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "s1", method: "select", title: "Pick", options: ["A", "B", "A", " ", 3], timeout: 60000 },
      { type: "extension_ui_request", id: "c1", method: "confirm", title: "Clear?", message: "This removes every message." },
      { type: "extension_ui_request", id: "c2", method: "confirm", title: "", message: "Keep going?" },
      { type: "extension_ui_request", id: "i1", method: "input", title: "Name?", placeholder: "a name" },
      { type: "extension_ui_request", id: "e1", method: "editor", title: "Notes", prefill: "x" });
    await Wait.until(() => replies.length === 5, "Pi did not get 5 replies.");

    Assert.areEqual(JSON.stringify([
      ["s1", "select", "", "Pick", ["A", "B"], false],
      ["c1", "confirm", "Clear?", "This removes every message.", [Resources.yesLabel, Resources.noLabel], false],
      ["c2", "confirm", "", "Keep going?", [Resources.yesLabel, Resources.noLabel], false],
      ["i1", "input", "", "Name?", [], true],
      ["e1", "editor", "", "Notes", [], true]]), JSON.stringify(listener.questionAsks.map(t => [t.providerRequestId, t.nativeKind,
      ...t.questions.flatMap(u => [u.header, u.text, u.options.map(v => v.label), u.other])])));
    Assert.areEqual(JSON.stringify(["s1", "c1", "c2", "i1", "e1"].map((id, index) => ({ type: "extension_ui_response", id, ...expected[index] }))),
      JSON.stringify(replies));
  }

  private static async giveUp(reason: string): Promise<void> {
    const replies: JsonObject[] = [];
    const listener = new RecordingTurnListener();
    const held = Promise.withResolvers<readonly QuestionAnswer[] | null>();
    listener.heldAnswer = held.promise;
    const turn = PiTurnTests.turn(listener, replies);
    const aborted = Promise.withResolvers<void>();

    PiTurnTests.feed(turn, { type: "extension_ui_request", id: "i1", method: "input", title: "Name?", ...reason === "timeout" ? { timeout: 1 } : {} });
    await turn.drainAsync();
    Assert.areEqual(1, listener.questionAsks.length);
    const [signal] = listener.signals;
    signal?.addEventListener("abort", () => aborted.resolve(), { once: true });
    if (reason === "settle")
      turn.settle(TurnOutcome.Interrupted);
    await aborted.promise;
    held.reject(new Error("The card closed."));
    await held.promise.catch(() => undefined);
    await Promise.resolve();
    await Wait.until(() => reason !== "timeout" || listener.texts.length === 1, "The timeout was not noted.");
    await turn.drainAsync();

    Assert.areEqual("[]", JSON.stringify(replies));
    Assert.areEqual(JSON.stringify(reason === "timeout" ? [Resources.formatPiDialogTimedOut("", "Name?")] : []), JSON.stringify(listener.texts));
  }

  private static turn(listener: RecordingTurnListener, replies: JsonObject[]): PiTurn {
    return new PiTurn(listener, new DeltaStream(listener, 1000), message => replies.push(message));
  }

  private static feed(turn: PiTurn, ...events: readonly JsonObject[]): void {
    for (const event of events)
      void turn.handle(JsonReader.fromValue(event));
  }
}
