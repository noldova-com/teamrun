/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SlashCommand } from "@anthropic-ai/claude-agent-sdk";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Resources as CoreResources, TurnOutcome, TurnRequest, TurnSteer, WakeTurn } from "@noldova/teamrun.core";
import { BackgroundTaskStatus, DetailKind, ErrorCode, RequestedSettings, Resources as ProtocolResources, SharedMcpServerDefinition, SharedMcpTransport, SubAgent,
  SubAgentStatus } from "@noldova/teamrun.protocol";
import { ClaudeChat, ClaudeTurn, DeltaStream, ProviderTimings, Resources } from "@noldova/teamrun.providers";

import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { FailureStep } from "../../fixtures/failure-step.fixture.js";
import { FakeClaudeQuery } from "../../fixtures/fake-claude-query.fixture.js";
import { GateStep } from "../../fixtures/gate-step.fixture.js";
import { IdleLimit } from "../../fixtures/idle-limit.fixture.js";
import { LimitWaits } from "../../fixtures/limit-waits.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { SdkMessages } from "../../fixtures/sdk-messages.fixture.js";
import { StampedStep } from "../../fixtures/stamped-step.fixture.js";
import { ToolAskStep } from "../../fixtures/tool-ask-step.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { WaitForCloseStep } from "../../fixtures/wait-for-close-step.fixture.js";
import { WaitForInputStep } from "../../fixtures/wait-for-input-step.fixture.js";
import { WaitForInterruptStep } from "../../fixtures/wait-for-interrupt-step.fixture.js";
import { WaitForStopStep } from "../../fixtures/wait-for-stop-step.fixture.js";

@TestClass
export class ClaudeChatTests {
  @TestMethod
  public async keepsATaskRunningPastItsReplyAndRunsTheNextMessageOnTheSameQuery(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-1", "none", null, []),
      SdkMessages.taskStarted("s-1", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Started")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-1", "Started")),
      new WaitForInputStep(),
      SdkMessages.init("s-1", "none", null, []),
      new StampedStep(SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.text("Still up")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-1", "Still up")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();

    try {
      const started = await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, started.outcome);
      Assert.areEqual("s-1", started.nativeSessionId);
      Assert.areEqual("server", first.taskStarts.map(t => t.taskId).join(","));
      Assert.areEqual(0, first.taskEnds.length);
      Assert.areEqual(0, query.closeCount);
      Assert.areEqual(1, adapter.activeRunCount);
      Assert.isTrue(host.factory.lastOptions?.perTaskStopAffordance ?? false);

      const next = await adapter.runTurn(host.createRequest("Check", null, "s-1"), second, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, next.outcome);
      Assert.areEqual(1, host.factory.queries.length);
      Assert.areEqual("Start,Check", host.factory.promptTexts.join(","));
      Assert.isTrue(second.starts[0]?.resumedNativeSession ?? false);
      Assert.areEqual(1, second.starts.length);
      Assert.areEqual("Still up", second.texts.join("|"));
      Assert.isTrue(first.texts.includes("Started"));
      Assert.isFalse(first.texts.includes("Still up"));
      Assert.areEqual(0, first.taskEnds.length);

      await adapter.shutdown();

      Assert.areEqual("server", query.stoppedTasks.join(","));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Ended]]), JSON.stringify(first.taskEnds.map(end => [end.taskId, end.status])));
      Assert.areEqual(0, second.taskEnds.length);
      Assert.areEqual(1, query.closeCount);
      Assert.areEqual(0, adapter.activeRunCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsTheTurnButLeavesTheChatsTasksRunning(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-2", "none", null, []),
      SdkMessages.taskStarted("s-2", "server", undefined, true, "npm start"),
      new WaitForInterruptStep(),
      SdkMessages.failure("s-2", "error_during_execution", ["Interrupted"]),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const controller = new AbortController();

    try {
      const running = adapter.runTurn(host.createRequest("Start"), listener, controller.signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      controller.abort();
      const result = await running;

      Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
      Assert.areEqual(1, query.interruptCount);
      Assert.areEqual(0, query.stoppedTasks.length);
      Assert.areEqual(0, listener.taskEnds.length);
      Assert.areEqual(0, query.closeCount);
      Assert.isFalse(query.options?.abortController?.signal.aborted ?? true);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async offersNoSteerSoAMessageSentWhileItRepliesWaitsAndNeverReachesOrStopsTheRunningQuery(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-9", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Working")], "claude-opus-5")),
      gate,
      new StampedStep(SdkMessages.success("s-9", "Working")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);

    try {
      const running = adapter.runTurn(host.createRequest("Start"), listener, new AbortController().signal);
      await Wait.until(() => listener.texts.join("").includes("Working"), "The listener did not see 'Working'.");
      gate.open();
      const result = await running;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(0, offers.length);
      Assert.areEqual(1, query.inputs.length);
      Assert.areEqual(0, query.interruptCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async closesTheQueryOnceNoTurnAndNoTaskIsLeft(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-3", "none", null, []),
      SdkMessages.backgroundTasks("s-3", [["server", false], ["agent", false]]),
      SdkMessages.taskStarted("s-3", "server", undefined, true, "npm start"),
      SdkMessages.success("s-3", "Started"),
      SdkMessages.taskNotification("s-3", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.backgroundTasks("s-3", [["agent", false]]),
      gate,
      SdkMessages.backgroundTasks("s-3", [["watcher", true]]),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    try {
      const result = await adapter.runTurn(host.createRequest("Start"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(BackgroundTaskStatus.Completed, listener.taskEnds[0]?.status);
      Assert.areEqual(0, query.closeCount);
      Assert.areEqual(1, adapter.activeRunCount);

      gate.open();
      await IdleLimit.elapseAsync(host.idleTimer, host.timings.idleLimit, "No wait was due within the idle limit.");
      await Wait.until(() => query.closeCount === 1, "The query was not closed after the idle limit.");

      Assert.areEqual(0, adapter.activeRunCount);
      Assert.areEqual(0, query.stoppedTasks.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsATurnClaudeStartsItselfAsAWakeReplyMarkedWithTheTaskThatEnded(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "npm start" });
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-4", "none", null, []),
      SdkMessages.backgroundTasks("s-4", [["agent", false]]),
      SdkMessages.taskStarted("s-4", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Started")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-4", "Started")),
      SdkMessages.taskNotification("s-4", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      ask,
      SdkMessages.success("s-4", "Restarted"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    reply.defaultDecision = "allow";
    first.wakeTurn = new WakeTurn({ [ProtocolResources.senderTokenVariable]: "wake-token" });
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);
      const result = await woken;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify([["server", "npm start"]]), JSON.stringify(first.wakes.map(t => [t.taskId, t.command])));
      Assert.areEqual(1, reply.starts.length);
      Assert.areEqual("The server stopped", reply.texts.join("|"));
      Assert.isFalse(first.texts.includes("The server stopped"));
      Assert.areEqual("allow", ask.result?.behavior);
      Assert.areEqual(1, reply.asks.length);
      Assert.areEqual(0, first.asks.length);
      Assert.areEqual(JSON.stringify([{ env: { [ProtocolResources.senderTokenVariable]: "wake-token" } }]), JSON.stringify(query.flagSettings));
      Assert.areEqual(0, query.closeCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async marksAWakeReplyWithNoTaskWhenTwoTasksEndBeforeIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-16", "none", null, []),
      SdkMessages.taskStarted("s-16", "server", undefined, true, "npm start"),
      SdkMessages.taskStarted("s-16", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-16", "Started")),
      SdkMessages.taskNotification("s-16", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.taskNotification("s-16", "tests", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Both ended")], "claude-opus-5"),
      SdkMessages.success("s-16", "Both ended"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);
      await woken;

      Assert.areEqual(JSON.stringify([[null, null]]), JSON.stringify(first.wakes.map(t => [t.taskId, t.command])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async marksALaterWakeReplyWithNoTaskWhenATaskEndedInsideAReply(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-17", "none", null, []),
      SdkMessages.taskStarted("s-17", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Waiting")], "claude-opus-5")),
      SdkMessages.taskNotification("s-17", "tests", "completed", host.directory.resolve("missing.output")),
      SdkMessages.success("s-17", "The tests pass"),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Checking again")], "claude-opus-5"),
      SdkMessages.success("s-17", "Checked"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await woken;

      Assert.areEqual(JSON.stringify([[null, null]]), JSON.stringify(first.wakes.map(t => [t.taskId, t.command])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async deniesTheToolsOfATurnClaudeStartsItselfWhenNoWakeReplyTakesIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "npm start" });
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-6", "none", null, []),
      SdkMessages.backgroundTasks("s-6", [["agent", false]]),
      SdkMessages.taskStarted("s-6", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Started")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-6", "Started")),
      SdkMessages.taskNotification("s-6", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      SdkMessages.status("s-6"),
      ask,
      SdkMessages.success("s-6", "Restarted"),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.text("Second")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-6", "Second")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      const next = await adapter.runTurn(host.createRequest("Next", null, "s-6"), second, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, next.outcome);
      Assert.areEqual(1, first.wakes.length);
      Assert.areEqual("deny", ask.result?.behavior);
      Assert.areEqual(0, first.asks.length + second.asks.length);
      Assert.isTrue(first.texts.includes("Started"));
      Assert.isFalse(first.texts.includes("The server stopped"));
      Assert.areEqual("Second", second.texts.join("|"));
      Assert.areEqual(1, host.factory.queries.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsATurnClaudeStartsItselfWhenNoWakeReplyTakesItAndFollowsNoTaskItStarts(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-6", "none", null, []),
      SdkMessages.taskStarted("s-6", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Started")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-6", "Started")),
      SdkMessages.taskNotification("s-6", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Restarting the server")], "claude-opus-5"),
      SdkMessages.taskStarted("s-6", "again", undefined, true, "npm start again"),
      new WaitForInterruptStep(),
      SdkMessages.success("s-6", "Interrupted"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);
      await Wait.until(() => query.interruptCount === 1, "The query was not interrupted.");

      Assert.areEqual(1, first.wakes.length);
      Assert.areEqual(JSON.stringify(["server"]), JSON.stringify(first.taskStarts.map(t => t.taskId)));
      Assert.isFalse(first.texts.includes("Restarting the server"));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async failsAWakeReplyWhoseQueryFailsAndStartsNoneForFramesOutsideATurn(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-10", "none", null, []),
      SdkMessages.taskStarted("s-10", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-10", "Started")),
      SdkMessages.toolProgress("s-10", "tool-1"),
      SdkMessages.taskStarted("s-10", "watcher", undefined, true, "npm run watch"),
      gate,
      { ...SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.text("Woke")], "claude-opus-5"),
        user_message_uuid: "55555555-5555-5555-5555-555555555555" },
      SdkMessages.status("s-10"),
      SdkMessages.user(undefined, [SdkMessages.toolResult("tool-1", "ok")]),
      new FailureStep(new Error("Claude stopped"))
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);
      await Wait.until(() => first.taskStarts.length === 2, "The first listener did not see 2 task starts.");

      Assert.areEqual(0, first.wakes.length);

      gate.open();
      const result = await woken;

      Assert.areEqual(TurnOutcome.Failed, result.outcome);
      Assert.isTrue(result.error?.includes("Claude stopped") ?? false);
      Assert.areEqual(JSON.stringify([[null, null]]), JSON.stringify(first.wakes.map(t => [t.taskId, t.command])));
      Assert.isTrue(reply.texts.includes("Woke"));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsAWakeReplyWhoseListenerFailsToTakeItsLastTextWhenTheQueryFails(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-63", "none", null, []),
      new StampedStep(SdkMessages.success("s-63", "Started")),
      SdkMessages.textDelta("s-63", "33333333-3333-3333-3333-333333333333", 0, "Restarting"),
      new FailureStep(new Error("Claude stopped"))
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    reply.onDetailAsync = detail => {
      reply.details.push(detail);
      return Promise.reject(new Error("The text wasn't kept"));
    };
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);
      const result = await woken;

      Assert.areEqual(TurnOutcome.Failed, result.outcome);
      Assert.isTrue(result.error?.includes("Claude stopped") ?? false, result.error ?? String.empty);
      Assert.areEqual(1, first.wakes.length);
      Assert.areEqual("Restarting", reply.texts.join("|"));
      Assert.isTrue(log.lines.includes(Resources.formatClaudeChatCloseFailed("s-63", "The text wasn't kept")), JSON.stringify(log.lines));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsAWakeReplyItsFollowerStopsWhenTheQueryRefusesItsSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-11", "none", null, []),
      SdkMessages.taskStarted("s-11", "tests", undefined, true, "npm test"),
      SdkMessages.success("s-11", "Started"),
      SdkMessages.taskNotification("s-11", "tests", "failed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Fixing")], "claude-opus-5"),
      new WaitForInterruptStep(),
      SdkMessages.failure("s-11", "error_during_execution", ["Interrupted"]),
      new WaitForCloseStep()
    ]);
    query.flagSettingsFailure = new Error("not in streaming mode");
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const follower = new AbortController();
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(reply, follower.signal);

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => reply.texts.includes("Fixing"), "The reply listener did not see 'Fixing'.");
      follower.abort();
      const result = await woken;

      Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
      Assert.areEqual(1, query.interruptCount);
      Assert.areEqual(0, query.flagSettings.length);
      Assert.areEqual(DetailKind.Note, reply.details[0]?.kind);
      Assert.areEqual(Resources.formatClaudeSenderRefused("not in streaming mode"), reply.details[0]?.text);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async runsAWakeClaudeStartsAheadOfAPushedTurnWithItsApprovalsAndGivesTheTurnBackItsTokenAndTasks(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "cat test.log" });
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-13", "none", null, []),
      SdkMessages.taskStarted("s-13", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-13", "Started")),
      SdkMessages.sessionState("s-13", "idle"),
      new WaitForInputStep(),
      SdkMessages.taskNotification("s-13", "tests", "failed", host.directory.resolve("missing.output")),
      SdkMessages.sessionState("s-13", "running"),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Reading the log")], "claude-opus-5"),
      ask,
      SdkMessages.success("s-13", "Read"),
      new StampedStep(SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.text("Checked")], "claude-opus-5")),
      SdkMessages.taskStarted("s-13", "watch", undefined, true, "npm run watch"),
      new StampedStep(SdkMessages.success("s-13", "Checked")),
      SdkMessages.sessionState("s-13", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    reply.defaultDecision = "allow";
    second.wakeTurn = new WakeTurn({ [ProtocolResources.senderTokenVariable]: "wake-token" });
    const woken = second.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(ClaudeChatTests.request(host, "Test", null, "token-one"), first, new AbortController().signal);
      const next = await adapter.runTurn(ClaudeChatTests.request(host, "Check the logs", "s-13", "token-two"), second, new AbortController().signal);
      const result = await woken;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(TurnOutcome.Completed, next.outcome);
      Assert.areEqual("allow", ask.result?.behavior);
      Assert.areEqual(1, reply.asks.length);
      Assert.areEqual(0, second.asks.length);
      Assert.areEqual("Reading the log", reply.texts.join("|"));
      Assert.areEqual("Checked", second.texts.join("|"));
      Assert.areEqual(JSON.stringify(["token-two", "wake-token", "token-two"]),
        JSON.stringify(query.flagSettings.map(t => t.env?.[ProtocolResources.senderTokenVariable])));
      Assert.areEqual(JSON.stringify(["watch"]), JSON.stringify(second.taskStarts.map(t => t.taskId)));
      Assert.areEqual(0, reply.taskStarts.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async holdsATurnSentDuringAWakeUntilTheWakeEndsAndNotesItsRefusedToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-15", "none", null, []),
      SdkMessages.taskStarted("s-15", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-15", "Started")),
      SdkMessages.taskNotification("s-15", "tests", "failed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Fixing")], "claude-opus-5"),
      gate,
      SdkMessages.success("s-15", "Fixed"),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.text("Checked")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-15", "Checked")),
      new WaitForCloseStep()
    ]);
    query.flagSettingsFailure = new Error("not in streaming mode");
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({ [ProtocolResources.senderTokenVariable]: "wake-token" });
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(ClaudeChatTests.request(host, "Test", null, "token-one"), first, new AbortController().signal);
      await Wait.until(() => reply.texts.includes("Fixing"), "The reply listener did not see 'Fixing'.");
      const next = adapter.runTurn(ClaudeChatTests.request(host, "Check the logs", "s-15", "token-two"), second, new AbortController().signal);
      await Wait.until(() => second.starts.length === 1, "The second listener did not see a turn start.");

      Assert.areEqual(1, query.inputs.length);

      gate.open();
      const result = await woken;
      const checked = await next;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(TurnOutcome.Completed, checked.outcome);
      Assert.areEqual(1, host.factory.queries.length);
      Assert.areEqual(JSON.stringify([Resources.formatClaudeSenderRefused("not in streaming mode"), "Fixing"]), JSON.stringify(reply.texts));
      Assert.areEqual(JSON.stringify([Resources.formatClaudeSenderRefused("not in streaming mode"), "Checked"]), JSON.stringify(second.texts));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsATurnStoppedWhileItWaitsForAWakeWithoutSendingIt(): Promise<void> {
    await ClaudeChatTests.stopDuringAWake(false);
  }

  @TestMethod
  public async endsATurnStoppedBeforeItReachesAChatThatRunsAWakeWithoutSendingIt(): Promise<void> {
    await ClaudeChatTests.stopDuringAWake(true);
  }

  @TestMethod
  public async endsASentTurnClaudeCodeAnswersInsideItsOwnTurnOnceItGoesIdle(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-19", "none", null, []),
      SdkMessages.taskStarted("s-19", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-19", "Started")),
      SdkMessages.sessionState("s-19", "idle"),
      SdkMessages.taskNotification("s-19", "tests", "completed", host.directory.resolve("missing.output")),
      new WaitForInputStep(),
      SdkMessages.sessionState("s-19", "running"),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The tests pass, and the logs are clean")], "claude-opus-5"),
      SdkMessages.success("s-19", "Answered"),
      SdkMessages.sessionState("s-19", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});
    const woken = second.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      const next = await adapter.runTurn(host.createRequest("Check the logs", null, "s-19"), second, new AbortController().signal);
      const result = await woken;

      Assert.areEqual(TurnOutcome.Completed, next.outcome);
      Assert.areEqual(JSON.stringify([Resources.claudeAnsweredInOwnTurn]), JSON.stringify(second.texts));
      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("The tests pass, and the logs are clean", reply.texts.join("|"));
      Assert.areEqual(Resources.enabledValue, host.factory.lastOptions?.env?.[Resources.claudeSessionStateEventsVariable]);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsATurnStoppedWhileClaudeCodeAnswersItInsideItsOwnTurnInterruptedOnceItGoesIdleAndLeavesTheWakeReplyRunning(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-22", "none", null, []),
      SdkMessages.taskStarted("s-22", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-22", "Started")),
      SdkMessages.sessionState("s-22", "idle"),
      SdkMessages.taskNotification("s-22", "tests", "completed", host.directory.resolve("missing.output")),
      new WaitForInputStep(),
      SdkMessages.sessionState("s-22", "running"),
      SdkMessages.assistant("66666666-6666-6666-6666-666666666666", [SdkMessages.text("The tests pass")], "claude-opus-5"),
      gate,
      SdkMessages.assistant("77777777-7777-7777-7777-777777777777", [SdkMessages.text("and the logs are clean")], "claude-opus-5"),
      SdkMessages.success("s-22", "Answered"),
      SdkMessages.sessionState("s-22", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});
    const woken = second.wakeTurn.follow(reply, new AbortController().signal);
    const stop = new AbortController();

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      const next = adapter.runTurn(host.createRequest("Check the logs", null, "s-22"), second, stop.signal);
      await Wait.until(() => reply.texts.includes("The tests pass"), "The reply listener did not see 'The tests pass'.");
      stop.abort();

      Assert.areEqual(0, query.interruptCount);

      gate.open();
      const result = await woken;
      const stopped = await next;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("The tests pass|and the logs are clean", reply.texts.join("|"));
      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.isNull(stopped.error);
      Assert.areEqual(JSON.stringify([Resources.claudeAnsweredInOwnTurn]), JSON.stringify(second.texts));
      Assert.areEqual(0, query.interruptCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsATurnStoppedAfterClaudeCodeAnsweredItInsideItsOwnTurnInterruptedOnceItGoesIdle(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-23", "none", null, []),
      SdkMessages.taskStarted("s-23", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-23", "Started")),
      SdkMessages.sessionState("s-23", "idle"),
      SdkMessages.taskNotification("s-23", "tests", "completed", host.directory.resolve("missing.output")),
      new WaitForInputStep(),
      SdkMessages.sessionState("s-23", "running"),
      SdkMessages.assistant("88888888-8888-8888-8888-888888888888", [SdkMessages.text("The tests pass, and the logs are clean")], "claude-opus-5"),
      SdkMessages.success("s-23", "Answered"),
      gate,
      SdkMessages.sessionState("s-23", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});
    const woken = second.wakeTurn.follow(reply, new AbortController().signal);
    const stop = new AbortController();

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      const next = adapter.runTurn(host.createRequest("Check the logs", null, "s-23"), second, stop.signal);
      const result = await woken;
      stop.abort();
      gate.open();
      const stopped = await next;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.areEqual(JSON.stringify([Resources.claudeAnsweredInOwnTurn]), JSON.stringify(second.texts));
      Assert.areEqual(0, query.interruptCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async leavesASecondWakeRunningAfterAStopOfATurnClaudeCodeAnsweredInsideItsOwnTurnAndEndsTheTurnInterruptedOnceItGoesIdle(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-24", "none", null, []),
      SdkMessages.taskStarted("s-24", "tests", undefined, true, "npm test"),
      SdkMessages.taskStarted("s-24", "lint", undefined, true, "npm run lint"),
      new StampedStep(SdkMessages.success("s-24", "Started")),
      SdkMessages.sessionState("s-24", "idle"),
      SdkMessages.taskNotification("s-24", "tests", "completed", host.directory.resolve("missing.output")),
      new WaitForInputStep(),
      SdkMessages.sessionState("s-24", "running"),
      SdkMessages.assistant("99999999-9999-9999-9999-999999999999", [SdkMessages.text("The tests pass, and the logs are clean")], "claude-opus-5"),
      SdkMessages.success("s-24", "Answered"),
      gate,
      SdkMessages.taskNotification("s-24", "lint", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", [SdkMessages.text("The lint passes")], "claude-opus-5"),
      SdkMessages.success("s-24", "Linted"),
      SdkMessages.sessionState("s-24", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const lint = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});
    reply.wakeTurn = new WakeTurn({});
    const woken = second.wakeTurn.follow(reply, new AbortController().signal);
    const linted = reply.wakeTurn.follow(lint, new AbortController().signal);
    const stop = new AbortController();

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      const next = adapter.runTurn(host.createRequest("Check the logs", null, "s-24"), second, stop.signal);
      const result = await woken;
      stop.abort();
      gate.open();
      const lintResult = await linted;
      const stopped = await next;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(TurnOutcome.Completed, lintResult.outcome);
      Assert.areEqual("The lint passes", lint.texts.join("|"));
      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.areEqual(JSON.stringify([Resources.claudeAnsweredInOwnTurn]), JSON.stringify(second.texts));
      Assert.areEqual(0, query.interruptCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsATurnStoppedAfterAWakesResultOnlyOnceItsOwnReplyBegins(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-25", "none", null, []),
      SdkMessages.taskStarted("s-25", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-25", "Started")),
      SdkMessages.sessionState("s-25", "idle"),
      SdkMessages.taskNotification("s-25", "tests", "completed", host.directory.resolve("missing.output")),
      new WaitForInputStep(),
      SdkMessages.sessionState("s-25", "running"),
      SdkMessages.assistant("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", [SdkMessages.text("The tests pass")], "claude-opus-5"),
      SdkMessages.success("s-25", "Answered"),
      gate,
      new StampedStep(SdkMessages.assistant("cccccccc-cccc-cccc-cccc-cccccccccccc", [SdkMessages.text("Reading the logs")], "claude-opus-5")),
      new WaitForInterruptStep(),
      new StampedStep(SdkMessages.failure("s-25", "error_during_execution", ["Interrupted"])),
      SdkMessages.sessionState("s-25", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});
    const woken = second.wakeTurn.follow(reply, new AbortController().signal);
    const stop = new AbortController();

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      const next = adapter.runTurn(host.createRequest("Check the logs", null, "s-25"), second, stop.signal);
      const result = await woken;
      stop.abort();

      Assert.areEqual(0, query.interruptCount);

      gate.open();
      const stopped = await next;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.isFalse(second.texts.includes(Resources.claudeAnsweredInOwnTurn));
      Assert.areEqual(1, query.interruptCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsATurnStoppedOnceClaudeCodeRunsItAndBeforeItsFirstFrame(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-26", "none", null, []),
      SdkMessages.sessionState("s-26", "running"),
      SdkMessages.taskStarted("s-26", "server", undefined, true, "npm start"),
      new WaitForInterruptStep(),
      new StampedStep(SdkMessages.failure("s-26", "error_during_execution", ["Interrupted"])),
      SdkMessages.sessionState("s-26", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const stop = new AbortController();

    try {
      const running = adapter.runTurn(host.createRequest("Start"), listener, stop.signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      stop.abort();

      Assert.areEqual(1, query.interruptCount);

      const result = await running;

      Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
      Assert.isFalse(listener.texts.includes(Resources.claudeAnsweredInOwnTurn));
      Assert.areEqual(1, query.interruptCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsASentTurnClaudeCodeFoldsIntoATurnItStartedBeforeTheSendOnceItGoesIdle(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-21", "none", null, []),
      SdkMessages.taskStarted("s-21", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-21", "Started")),
      SdkMessages.sessionState("s-21", "idle"),
      SdkMessages.taskNotification("s-21", "tests", "completed", host.directory.resolve("missing.output")),
      SdkMessages.sessionState("s-21", "running"),
      new WaitForInputStep(),
      SdkMessages.assistant("55555555-5555-5555-5555-555555555555", [SdkMessages.text("The tests pass, and the logs are clean")], "claude-opus-5"),
      SdkMessages.success("s-21", "Answered"),
      SdkMessages.sessionState("s-21", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});
    const woken = second.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      const next = await adapter.runTurn(host.createRequest("Check the logs", null, "s-21"), second, new AbortController().signal);
      const result = await woken;

      Assert.areEqual(TurnOutcome.Completed, next.outcome);
      Assert.areEqual(JSON.stringify([Resources.claudeAnsweredInOwnTurn]), JSON.stringify(second.texts));
      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("The tests pass, and the logs are clean", reply.texts.join("|"));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsASentTurnRunningThroughTheIdleOfTheTurnBeforeIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-20", "none", null, []),
      SdkMessages.taskStarted("s-20", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-20", "Started")),
      new WaitForInputStep(),
      SdkMessages.sessionState("s-20", "idle"),
      SdkMessages.sessionState("s-20", "running"),
      new StampedStep(SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.text("Second")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-20", "Second")),
      SdkMessages.sessionState("s-20", "idle"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const second = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      const next = await adapter.runTurn(host.createRequest("Next", null, "s-20"), second, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, next.outcome);
      Assert.areEqual("Second", second.texts.join("|"));
      Assert.areEqual(0, second.wakes.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsAPushedTurnOnlyOnceItsReplyBeginsWhileAWakeRunsAheadOfIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-14", "none", null, []),
      SdkMessages.taskStarted("s-14", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-14", "Started")),
      new WaitForInputStep(),
      SdkMessages.taskNotification("s-14", "tests", "failed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Reading the log")], "claude-opus-5"),
      gate,
      SdkMessages.success("s-14", "Read"),
      new StampedStep(SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.text("Checking")], "claude-opus-5")),
      new WaitForInterruptStep(),
      new StampedStep(SdkMessages.failure("s-14", "error_during_execution", ["Interrupted"])),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});
    const woken = second.wakeTurn.follow(reply, new AbortController().signal);
    const stop = new AbortController();

    try {
      await adapter.runTurn(host.createRequest("Test"), new RecordingTurnListener(), new AbortController().signal);
      const next = adapter.runTurn(host.createRequest("Check the logs", null, "s-14"), second, stop.signal);
      await Wait.until(() => reply.texts.includes("Reading the log"), "The reply listener did not see 'Reading the log'.");
      stop.abort();

      Assert.areEqual(0, query.interruptCount);

      gate.open();
      const result = await woken;
      const stopped = await next;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.areEqual(1, query.interruptCount);
      Assert.areEqual("Checking", second.texts[0]);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async listsNoCommandsBeforeAQueryIsAttachedAndAsksTheQueryOnceAfter(): Promise<void> {
    const chat = new ClaudeChat("chat", 10, 1, 50, () => undefined);
    const query = new FakeClaudeQuery([]);
    query.commands = [{ name: "review", description: "Review", argumentHint: "" }];
    const signal = new AbortController().signal;
    const before = await chat.listedCommands(signal);
    chat.attach(query, "acceptEdits");

    Assert.areEqual(JSON.stringify([[], ["review"], ["review"], 1]),
      JSON.stringify([before, await chat.listedCommands(signal), await chat.listedCommands(signal), query.commandReads]));
  }

  @TestMethod
  public async keepsTheListTheSessionGaveWhileClaudeCodesOwnListWasStillComing(): Promise<void> {
    const chat = new ClaudeChat("chat", 10, 1, 50, () => undefined);
    const query = new FakeClaudeQuery([SdkMessages.commandsChanged("s-1", [{ name: "deploy", description: "Deploy", argumentHint: "" }]),
      SdkMessages.success("s-1", "done")]);
    const pending = Promise.withResolvers<SlashCommand[]>();
    query.commandsPending = pending;
    chat.attach(query, "acceptEdits");
    const signal = new AbortController().signal;
    const listing = chat.listedCommands(signal);
    const listener = new RecordingTurnListener();
    await chat.run(new ClaudeTurn(listener, null, new DeltaStream(listener, 1), null, chat.tasks), SdkMessages.user("11111111-1111-1111-1111-111111111111", "hello"), {},
      () => undefined);
    pending.resolve([{ name: "review", description: "Review", argumentHint: "" }]);

    Assert.areEqual(JSON.stringify([["deploy"], ["deploy"], 1]), JSON.stringify([await listing, await chat.listedCommands(signal), query.commandReads]));
  }

  @TestMethod
  public async keepsEachCommandsAliasesWhenTheSessionsInitNamesItWithoutThem(): Promise<void> {
    const chat = new ClaudeChat("chat", 10, 1, 50, () => undefined);
    const query = new FakeClaudeQuery([{ ...SdkMessages.init("s-1", "none", null, []), slash_commands: ["usage", "/deploy"] }, SdkMessages.success("s-1", "done")]);
    query.commands = [{ name: "usage", description: "Usage", argumentHint: "", aliases: ["cost", "/stats"] }, { name: "review", description: "Review", argumentHint: "" }];
    chat.attach(query, "acceptEdits");
    const signal = new AbortController().signal;
    const before = await chat.listedCommands(signal);
    const listener = new RecordingTurnListener();
    await chat.run(new ClaudeTurn(listener, null, new DeltaStream(listener, 1), null, chat.tasks), SdkMessages.user("11111111-1111-1111-1111-111111111111", "hello"), {},
      () => undefined);

    Assert.areEqual(JSON.stringify([["usage", "cost", "stats", "review"], ["usage", "cost", "stats", "deploy"]]),
      JSON.stringify([before, await chat.listedCommands(signal)]));
  }

  @TestMethod
  public async returnsToPlanOnlyOnceAQueryIsAttachedAndKeepsItsModeWhenClaudeRefuses(): Promise<void> {
    const chat = new ClaudeChat("chat", 10, 1, 50, () => undefined);
    const query = new FakeClaudeQuery([]);
    await chat.returnToPlan();
    chat.attach(query, "acceptEdits");
    query.permissionModeFailures.set("plan", new Error("Mode refused"));

    const refused = await chat.returnToPlan().then(() => null, (error: unknown) => error instanceof Error ? error.message : null);
    const kept = chat.isPlanning;
    query.permissionModeFailures.clear();
    await chat.returnToPlan();

    Assert.areEqual(JSON.stringify(["Mode refused", false, true, ["plan"]]), JSON.stringify([refused, kept, chat.isPlanning, query.permissionModes]));
  }

  @TestMethod
  public async failsATurnThatReachesAChatWhoseQueryHasEnded(): Promise<void> {
    const chat = new ClaudeChat("chat", 10, 1, 50, () => undefined);
    chat.attach(new FakeClaudeQuery([SdkMessages.init("s-12", "none", null, [])]), "acceptEdits");
    const first = new RecordingTurnListener();
    const ended = new ClaudeTurn(first, null, new DeltaStream(first, 1), null, chat.tasks);
    await chat.run(ended, SdkMessages.user("11111111-1111-1111-1111-111111111111", "First"), {}, () => undefined);
    const late = new RecordingTurnListener();
    const turn = new ClaudeTurn(late, "s-12", new DeltaStream(late, 1), null, chat.tasks);

    await chat.run(turn, SdkMessages.user("22222222-2222-2222-2222-222222222222", "Late"), {}, () => undefined);

    Assert.isTrue(chat.isClosed);
    Assert.areEqual(TurnOutcome.Failed, turn.toResult().outcome);
    Assert.isTrue(turn.toResult().error?.includes(Resources.claudeNoResult) ?? false);
    Assert.areEqual(1, late.starts.length);
  }

  @TestMethod
  public async closesAChatWhoseQueryRefusesTheInterruptWhenItStops(): Promise<void> {
    const query = new FakeClaudeQuery([new WaitForCloseStep()]);
    query.interruptFailure = new Error("Interrupt refused");
    let closed = 0;
    const chat = new ClaudeChat("chat", 10, 1, 50, () => { closed += 1; });
    chat.attach(query, "acceptEdits");

    await chat.stop();

    Assert.isTrue(chat.isClosed);
    Assert.isTrue(chat.abort.signal.aborted);
    Assert.areEqual(1, closed);
    Assert.areEqual(1, query.closeCount);
  }

  @TestMethod
  public async endsEveryTaskAndClosesAStoppedChatWhoseListenerFailsToTakeATasksEnd(): Promise<void> {
    const query = new FakeClaudeQuery([new WaitForCloseStep()]);
    const log = new RecordingLog();
    let closed = 0;
    const chat = new ClaudeChat("chat", 10, 1, 50, () => { closed += 1; }, undefined, undefined, undefined, null, log);
    chat.attach(query, "acceptEdits");
    const listener = new RecordingTurnListener();
    listener.onTaskEndedAsync = end => {
      listener.taskEnds.push(end);
      return end.taskId === "server" ? Promise.reject(new Error("The task end wasn't kept")) : Promise.resolve();
    };
    await chat.tasks.handleStartedAsync(SdkMessages.taskStarted("s-60", "server", undefined, true, "npm start"), query, listener);
    await chat.tasks.handleStartedAsync(SdkMessages.taskStarted("s-60", "watcher", undefined, true, "npm run watch"), query, listener);

    await chat.stop();

    Assert.isTrue(chat.abort.signal.aborted);
    Assert.areEqual(1, closed);
    Assert.areEqual(1, query.closeCount);
    Assert.areEqual(1, query.interruptCount);
    Assert.areEqual(JSON.stringify(["server", "watcher"]), JSON.stringify(listener.taskEnds.map(t => t.taskId)));
    Assert.areEqual(JSON.stringify([Resources.formatClaudeTaskEndUnrecorded("server", "The task end wasn't kept")]), JSON.stringify(log.lines));
  }

  @TestMethod
  public async passesOnTheFailureToTakeTheLastTextOfATurnWhoseQueryEndsWithoutAResult(): Promise<void> {
    const chat = new ClaudeChat("chat", 10, 1, 50, () => undefined);
    chat.attach(new FakeClaudeQuery([
      SdkMessages.init("s-70", "none", null, []),
      SdkMessages.textDelta("s-70", "33333333-3333-3333-3333-333333333333", 0, "Partial")
    ]), "acceptEdits");
    const listener = new RecordingTurnListener();
    listener.onDetailAsync = detail => {
      listener.details.push(detail);
      return Promise.reject(new Error("The text wasn't kept"));
    };
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1), null, chat.tasks);

    const failure = await Assert.throwsAsync(() => chat.run(turn, SdkMessages.user("11111111-1111-1111-1111-111111111111", "Hi"), {}, () => undefined), Error);

    Assert.areEqual("The text wasn't kept", failure.message);
    Assert.areEqual("Partial", listener.texts.join("|"));
    Assert.isTrue(chat.isClosed);
    Assert.isFalse(chat.isBusy);
  }

  @TestMethod
  public async settlesTheTurnOfAnEndedQueryWhoseListenerFailsToTakeASubAgentsStop(): Promise<void> {
    const log = new RecordingLog();
    const chat = new ClaudeChat("chat", 10, 1, 50, () => undefined, undefined, undefined, undefined, null, log);
    chat.attach(new FakeClaudeQuery([
      SdkMessages.init("s-61", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent", { description: "Explore the parser", prompt: "Find it" })],
        "claude-opus-5")
    ]), "acceptEdits");
    const listener = new RecordingTurnListener();
    const record = listener.onDetailAsync.bind(listener);
    listener.onDetailAsync = async detail => {
      await record(detail);
      if (detail.kind === DetailKind.SubAgent && SubAgent.fromJson(detail.payload).status === SubAgentStatus.Stopped)
        throw new Error("The stop wasn't kept");
    };
    const turn = new ClaudeTurn(listener, null, new DeltaStream(listener, 1), null, chat.tasks, undefined, chat.plan, chat.subAgents);

    await chat.run(turn, SdkMessages.user("22222222-2222-2222-2222-222222222222", "Explore"), {}, () => undefined);

    Assert.isTrue(chat.isClosed);
    Assert.areEqual(TurnOutcome.Failed, turn.toResult().outcome);
    Assert.areEqual(Resources.claudeNoResult, turn.toResult().error);
    Assert.areEqual(JSON.stringify(["Running", "Stopped"]),
      JSON.stringify(listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload).status)));
    Assert.areEqual(JSON.stringify([Resources.formatClaudeChatCloseFailed("s-61", "The stop wasn't kept")]), JSON.stringify(log.lines));
  }

  @TestMethod
  public async givesEachTurnOnTheOpenQueryItsOwnSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-7", "none", null, []),
      SdkMessages.taskStarted("s-7", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-7", "Started")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-7", "Second")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const request = (prompt: string, resume: string | null, token: string): TurnRequest => new TurnRequest(null, host.directory.path, prompt,
      new RequestedSettings("claude", null, null), resume, [], null, null, { [ProtocolResources.senderTokenVariable]: token });

    try {
      await adapter.runTurn(request("Start", null, "token-one"), new RecordingTurnListener(), new AbortController().signal);
      const next = await adapter.runTurn(request("Next", "s-7", "token-two"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, next.outcome);
      Assert.areEqual(1, host.factory.queries.length);
      Assert.areEqual("token-one", host.factory.lastOptions?.env?.[ProtocolResources.senderTokenVariable]);
      Assert.areEqual(JSON.stringify([{ env: { [ProtocolResources.senderTokenVariable]: "token-two" } }]), JSON.stringify(query.flagSettings));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async forksTheOpenQuerysSessionOnANewQueryAtTheKeptTurn(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const open = new FakeClaudeQuery([
      SdkMessages.init("s-7", "none", null, []),
      SdkMessages.taskStarted("s-7", "server", undefined, true, "npm start"),
      SdkMessages.success("s-7", "Started"),
      new WaitForCloseStep()
    ]);
    host.factory.next = open;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-9", "none", null, []), SdkMessages.success("s-9", "Forked")]));
    const base = host.createRequest("Again", null, "s-7");

    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      const result = await adapter.runTurn(new TurnRequest(base.provider, base.workingDirectory, base.prompt, base.requested, "s-7", [], null, null, {}, false, null,
        [], "entry-1"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("s-9", result.nativeSessionId);
      Assert.areEqual(2, host.factory.queries.length);
      Assert.areEqual(JSON.stringify(["s-7", "entry-1", true]),
        JSON.stringify([host.factory.optionsList[1]?.resume, host.factory.optionsList[1]?.resumeSessionAt, host.factory.optionsList[1]?.forkSession]));
      Assert.areEqual(0, open.closeCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async resumesTheSessionOnANewQueryWhenTheOpenOneRefusesTheNextSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const open = new FakeClaudeQuery([
      SdkMessages.init("s-8", "none", null, []),
      SdkMessages.taskStarted("s-8", "server", undefined, true, "npm start"),
      SdkMessages.success("s-8", "Started"),
      new WaitForCloseStep()
    ]);
    open.flagSettingsFailure = new Error("not in streaming mode");
    host.factory.next = open;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-8", "none", null, []), SdkMessages.success("s-8", "Again")]));

    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      const result = await adapter.runTurn(host.createRequest("Again", null, "s-8"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => open.closeCount === 1, "The open query was not closed.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(2, host.factory.queries.length);
      Assert.areEqual("s-8", host.factory.optionsList[1]?.resume);
      Assert.areEqual("server", open.stoppedTasks.join(","));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsTheQueryOpenForTheWakeGraceAfterATaskEnds(): Promise<void> {
    using host = new ClaudeTestHost();
    const t = host.timings;
    const adapter = host.createAdapter(host.environment, host.command, new ProviderTimings(t.versionTimeout, t.signInCheckTimeout, t.initializeTimeout,
      t.requestTimeout, t.interruptTimeout, t.interruptGrace, t.stopGrace, t.killWait, t.abortGrace, t.streamInterval, t.resumeRetryDelay, 60_000));
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-9", "none", null, []),
      SdkMessages.taskStarted("s-9", "tests", undefined, true, "npm test"),
      SdkMessages.success("s-9", "Started"),
      SdkMessages.taskNotification("s-9", "tests", "completed", host.directory.resolve("missing.output")),
      gate,
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The tests passed")], "claude-opus-5"),
      SdkMessages.success("s-9", "Done"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");

      Assert.areEqual(0, query.closeCount);
      Assert.areEqual(1, adapter.activeRunCount);

      gate.open();
      await woken;
      await IdleLimit.elapseAsync(host.idleTimer, host.timings.idleLimit, "No wait was due within the idle limit.");
      await Wait.until(() => query.closeCount === 1, "The query was not closed after the idle limit.");

      Assert.areEqual("The tests passed", reply.texts.join("|"));
      Assert.areEqual(0, adapter.activeRunCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsTheOpenQueryAndResumesItsSessionOnAnotherWhenTheSettingsChange(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const open = new FakeClaudeQuery([
      SdkMessages.init("s-5", "none", null, []),
      SdkMessages.taskStarted("s-5", "server", undefined, true, "npm start"),
      SdkMessages.success("s-5", "Started"),
      new WaitForCloseStep()
    ]);
    host.factory.next = open;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-5", "none", null, []), SdkMessages.success("s-5", "On opus")]));
    const first = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);
      const result = await adapter.runTurn(host.createRequest("Again", null, "s-5", "opus"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => open.closeCount === 1, "The open query was not closed.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(2, host.factory.queries.length);
      Assert.areEqual("s-5", host.factory.optionsList[1]?.resume);
      Assert.areEqual("opus", host.factory.optionsList[1]?.model);
      Assert.areEqual("server", open.stoppedTasks.join(","));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Ended]]), JSON.stringify(first.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async closesTheKeptQueriesOfTheProviderThatSignsOutAndKeepsTheOthers(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider();
    const signedOut = new FakeClaudeQuery([SdkMessages.init("s-11", "none", null, []), SdkMessages.success("s-11", "Done"), new WaitForCloseStep()]);
    const other = new FakeClaudeQuery([SdkMessages.init("s-12", "none", null, []), SdkMessages.success("s-12", "Done"), new WaitForCloseStep()]);
    host.factory.next = signedOut;
    host.factory.queued.push(other);

    try {
      await adapter.runTurn(host.createRequest("Start", provider), new RecordingTurnListener(), new AbortController().signal);
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      const before = [signedOut.closeCount, other.closeCount];
      await adapter.signOut(provider);
      await Wait.until(() => signedOut.closeCount === 1, "The signed-out provider's kept query was not closed.");

      Assert.areEqual(JSON.stringify([[0, 0], 0, 1]), JSON.stringify([before, other.closeCount, adapter.activeRunCount]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async closesADeletedChatsIdleQueryNowAndItsBusyQueryWhenItsTurnEnds(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const idle = new FakeClaudeQuery([SdkMessages.init("s-31", "none", null, []), SdkMessages.success("s-31", "Done"), new WaitForCloseStep()]);
    const busy = new FakeClaudeQuery([SdkMessages.init("s-32", "none", null, []), gate, SdkMessages.success("s-32", "Done"), new WaitForCloseStep()]);
    const kept = new FakeClaudeQuery([SdkMessages.init("s-33", "none", null, []), SdkMessages.success("s-33", "Done"), new WaitForCloseStep()]);
    host.factory.next = idle;
    host.factory.queued.push(kept, busy);
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      const running = adapter.runTurn(host.createRequest("Start"), listener, new AbortController().signal);
      await Wait.until(() => listener.starts.length === 1, "The busy turn did not start.");
      await adapter.closeSessions(["s-31", "s-32", "s-missing"]);
      await Wait.until(() => idle.closeCount === 1, "The idle query was not closed.");
      const whileBusy = busy.closeCount;
      gate.open();
      const result = await running;
      await Wait.until(() => busy.closeCount === 1, "The busy query was not closed after its turn.");

      Assert.areEqual(JSON.stringify([0, TurnOutcome.Completed, 0, 1]), JSON.stringify([whileBusy, result.outcome, kept.closeCount, adapter.activeRunCount]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async resumesTheOpenQuerysSessionOnAnotherWhenItsSharedServersChange(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const open = new FakeClaudeQuery([
      SdkMessages.init("s-6", "none", null, []),
      SdkMessages.taskStarted("s-6", "server", undefined, true, "npm start"),
      SdkMessages.success("s-6", "Started"),
      new WaitForCloseStep()
    ]);
    host.factory.next = open;
    const searching = new FakeClaudeQuery([SdkMessages.init("s-6", "none", null, []), SdkMessages.success("s-6", "With search")]);
    host.factory.queued.push(searching);
    const search = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null);

    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      const again = host.createRequest("Again", null, "s-6");
      const result = await adapter.runTurn(new TurnRequest(again.provider, again.workingDirectory, again.prompt, again.requested, "s-6", [], null, null, {}, false,
        null, [search]), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => open.closeCount === 1, "The open query was not closed.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(2, host.factory.queries.length);
      Assert.areEqual("s-6", host.factory.optionsList[1]?.resume);
      Assert.areEqual(JSON.stringify([["search"]]), JSON.stringify(searching.servers.map(t => Object.keys(t))));
      Assert.areEqual(JSON.stringify([]), JSON.stringify(open.servers));
    }
    finally { await adapter.shutdown(); }
  }

  private static async stopDuringAWake(stoppedFirst: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-18", "none", null, []),
      SdkMessages.taskStarted("s-18", "tests", undefined, true, "npm test"),
      new StampedStep(SdkMessages.success("s-18", "Started")),
      SdkMessages.taskNotification("s-18", "tests", "failed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Fixing")], "claude-opus-5"),
      gate,
      SdkMessages.success("s-18", "Fixed"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);
    const stop = new AbortController();

    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => reply.texts.includes("Fixing"), "The reply listener did not see 'Fixing'.");
      if (stoppedFirst)
        stop.abort();
      const next = adapter.runTurn(host.createRequest("Check the logs", null, "s-18"), second, stop.signal);
      await Wait.until(() => second.starts.length === 1, "The second listener did not see a turn start.");
      stop.abort();
      const stopped = await next;

      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.areEqual(1, query.inputs.length);
      Assert.areEqual(0, query.interruptCount);

      gate.open();
      const result = await woken;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(1, query.inputs.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async followsABackgroundSubAgentPastItsReplyDeniesWhatItAsksWithNoReplyRunningAndStopsItWhenTheQueryEnds(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "npm test" }, "toolu_b", "task-a");
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-30", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-30", "task-a", "toolu_a", true, "Explore the parser", "local_agent"),
      new StampedStep(SdkMessages.success("s-30", "Started")),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.toolUse("toolu_b", "Bash", { command: "npm test" })], "claude-haiku-5", "toolu_a"),
      ask,
      SdkMessages.taskProgress("s-30", "task-a", 3, 1200, 4000, "Running the tests")
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.heldDecisions.push(ClaudeChatTests.closed());

    try {
      const result = await adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      await Wait.until(() => first.details.some(t => t.kind === DetailKind.SubAgent && SubAgent.fromJson(t.payload).status === SubAgentStatus.Stopped), "The first listener did not see the sub-agent stop.");
      const agents = first.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
      const note = first.details.find(t => t.kind === DetailKind.Note);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(`deny|${Resources.claudeSubAgentUnasked}`, `${ask.result?.behavior}|${ask.result?.behavior === "deny" ? ask.result.message : null}`);
      Assert.areEqual("Explore the parser", first.asks.map(t => (t.payload as Record<string, unknown>)["subAgent"]).join(","));
      Assert.areEqual(`${Resources.formatClaudeSubAgentUnasked("Bash")}|11111111-1111-1111-1111-111111111111:0:toolu_b|11111111-1111-1111-1111-111111111111:0`,
        `${note?.text}|${note?.providerItemId}|${note?.parentItemId}`);
      Assert.areEqual("11111111-1111-1111-1111-111111111111:0", first.details.find(t => t.providerItemId === "22222222-2222-2222-2222-222222222222:0")?.parentItemId);
      Assert.areEqual(JSON.stringify(["Running", "Running", "Running", "Stopped"]), JSON.stringify(agents.map(t => t.status)));
      Assert.areEqual("claude-haiku-5|3|Running the tests", `${agents.at(-1)?.model}|${agents.at(-1)?.toolUses}|${agents.at(-1)?.summary}`);
      Assert.areEqual(0, first.wakes.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async asksWhatABackgroundSubAgentAsksAfterItsReplyEndedInThatReplyWhileItStillTakesApprovals(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "npm test" }, "toolu_b", "task-a");
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-31", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-31", "task-a", "toolu_a", true, "Explore the parser", "local_agent"),
      new StampedStep(SdkMessages.success("s-31", "Started")),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.toolUse("toolu_b", "Bash", { command: "npm test" })], "claude-haiku-5", "toolu_a"),
      ask
    ]);
    const first = new RecordingTurnListener();
    first.defaultDecision = "allow";

    try {
      const result = await adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      await Wait.until(() => !Object.isNull(ask.result), "The question got no result.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("allow", ask.result?.behavior);
      Assert.areEqual("Explore the parser", first.asks.map(t => (t.payload as Record<string, unknown>)["subAgent"]).join(","));
      Assert.isFalse(first.details.some(t => t.kind === DetailKind.Note && t.providerItemId?.endsWith(":toolu_b") === true));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async asksWhatABackgroundSubAgentAsksThroughItsReplyThenThroughTheReplyRunningAndMarksADenialInItsOwnResult(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const early = new ToolAskStep("Read", { file_path: "parser.ts" }, "toolu_r", "task-a");
    const ask = new ToolAskStep("Bash", { command: "npm test" }, "toolu_b", "task-a");
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-32", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-32", "task-a", "toolu_a", true, "Explore the parser", "local_agent"),
      SdkMessages.taskStarted("s-32", "server", undefined, true, "npm start"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.toolUse("toolu_r", "Read", { file_path: "parser.ts" })], "claude-haiku-5", "toolu_a"),
      early,
      new StampedStep(SdkMessages.success("s-32", "Started")),
      SdkMessages.taskNotification("s-32", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.toolUse("toolu_b", "Bash", { command: "npm test" })], "claude-haiku-5", "toolu_a"),
      ask,
      SdkMessages.user("55555555-5555-5555-5555-555555555555", [SdkMessages.toolResult("toolu_b", Resources.claudeDenied, true)], "toolu_a"),
      SdkMessages.success("s-32", "Restarted"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.heldDecisions.push(Promise.resolve("allow"), ClaudeChatTests.closed());
    const reply = new RecordingTurnListener();
    reply.defaultDecision = "deny";
    first.wakeTurn = new WakeTurn({ [ProtocolResources.senderTokenVariable]: "wake-token" });
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      await woken;
      const results = (listener: RecordingTurnListener) => listener.details.map(t => JSON.stringify(t.payload)).filter(t => t.startsWith("{\"toolUseId\":\"toolu_b\""));

      Assert.areEqual(`deny|${Resources.claudeDenied}`, `${ask.result?.behavior}|${ask.result?.behavior === "deny" ? ask.result.message : null}`);
      Assert.areEqual("allow", early.result?.behavior);
      Assert.areEqual(JSON.stringify(["Explore the parser", "Explore the parser"]), JSON.stringify(first.asks.map(t => (t.payload as Record<string, unknown>)["subAgent"])));
      Assert.areEqual(1, reply.asks.length);
      Assert.areEqual("Explore the parser", (reply.asks[0]?.payload as Record<string, unknown> | undefined)?.["subAgent"]);
      Assert.areEqual("{\"toolUseId\":\"toolu_b\",\"isError\":true,\"denied\":true}", results(first).join(","));
      Assert.areEqual(0, results(reply).length);
      Assert.isFalse([...first.details, ...reply.details].some(t => t.kind === DetailKind.Note && t.providerItemId?.endsWith(":toolu_b") === true));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async asksASubAgentsWaitingRequestAgainThroughTheReplyRunningWhenItsOwnReplyClosesFirst(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "npm test" }, "toolu_b", "task-a", true);
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-33", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-33", "task-a", "toolu_a", true, "Explore the parser", "local_agent"),
      SdkMessages.taskStarted("s-33", "server", undefined, true, "npm start"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.toolUse("toolu_b", "Bash", { command: "npm test" })], "claude-haiku-5", "toolu_a"),
      ask,
      new StampedStep(SdkMessages.success("s-33", "Started")),
      SdkMessages.taskNotification("s-33", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      gate,
      SdkMessages.success("s-33", "Restarted"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const held = Promise.withResolvers<string>();
    first.heldDecision = held.promise;
    const reply = new RecordingTurnListener();
    reply.defaultDecision = "allow";
    first.wakeTurn = new WakeTurn({ [ProtocolResources.senderTokenVariable]: "wake-token" });
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      await Wait.until(() => reply.texts.includes("The server stopped"), "The reply listener did not see 'The server stopped'.");
      held.reject(ClaudeChatTests.closedRun());
      await ask.answered;
      gate.open();
      await woken;

      Assert.areEqual("allow", ask.result?.behavior);
      Assert.areEqual(JSON.stringify([["Explore the parser"], ["Explore the parser"]]),
        JSON.stringify([first, reply].map(t => t.asks.map(u => (u.payload as Record<string, unknown>)["subAgent"]))));
      Assert.isFalse(first.details.some(t => t.kind === DetailKind.Note && t.providerItemId?.endsWith(":toolu_b") === true));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async deniesASubAgentsWaitingRequestWithARowNoteWhenItsReplyClosesFirstAndNoReplyRuns(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "npm test" }, "toolu_b", "task-a", true);
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-34", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-34", "task-a", "toolu_a", true, "Explore the parser", "local_agent"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.toolUse("toolu_b", "Bash", { command: "npm test" })], "claude-haiku-5", "toolu_a"),
      ask,
      new StampedStep(SdkMessages.success("s-34", "Started")),
      gate
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const held = Promise.withResolvers<string>();
    first.heldDecision = held.promise;

    try {
      const result = await adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      held.reject(ClaudeChatTests.closedRun());
      await ask.answered;
      const note = first.details.find(t => t.kind === DetailKind.Note);
      gate.open();

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(`deny|${Resources.claudeSubAgentUnasked}`, `${ask.result?.behavior}|${ask.result?.behavior === "deny" ? ask.result.message : null}`);
      Assert.areEqual(1, first.asks.length);
      Assert.areEqual(`${Resources.formatClaudeSubAgentUnasked("Bash")}|11111111-1111-1111-1111-111111111111:0:toolu_b|11111111-1111-1111-1111-111111111111:0`,
        `${note?.text}|${note?.providerItemId}|${note?.parentItemId}`);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async deniesASubAgentsRequestWithARowNoteWhenStopClosesItsReplyBeforeItsResult(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "npm test" }, "toolu_b", "task-a", true);
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-36", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-36", "task-a", "toolu_a", true, "Explore the parser", "local_agent"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.toolUse("toolu_b", "Bash", { command: "npm test" })], "claude-haiku-5", "toolu_a"),
      ask,
      gate,
      new StampedStep(SdkMessages.success("s-36", "Started"))
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const held = Promise.withResolvers<string>();
    first.heldDecision = held.promise;

    try {
      const running = adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      await Wait.until(() => first.asks.length === 1, "The first listener did not see a question.");
      held.reject(ClaudeChatTests.closedRun());
      await ask.answered;
      const note = first.details.find(t => t.kind === DetailKind.Note);
      gate.open();
      await running;

      Assert.areEqual(`deny|${Resources.claudeSubAgentUnasked}`, `${ask.result?.behavior}|${ask.result?.behavior === "deny" ? ask.result.message : null}`);
      Assert.areEqual(1, first.asks.length);
      Assert.areEqual("11111111-1111-1111-1111-111111111111:0:toolu_b", note?.providerItemId);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async deniesASubAgentsRequestWithARowNoteWhenTheReplyItWasAskedAgainInClosesToo(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const ask = new ToolAskStep("Bash", { command: "npm test" }, "toolu_b", "task-a", true);
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-37", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-37", "task-a", "toolu_a", true, "Explore the parser", "local_agent"),
      SdkMessages.taskStarted("s-37", "server", undefined, true, "npm start"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.toolUse("toolu_b", "Bash", { command: "npm test" })], "claude-haiku-5", "toolu_a"),
      ask,
      new StampedStep(SdkMessages.success("s-37", "Started")),
      SdkMessages.taskNotification("s-37", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      gate,
      SdkMessages.success("s-37", "Restarted"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const held = Promise.withResolvers<string>();
    first.heldDecision = held.promise;
    const reply = new RecordingTurnListener();
    reply.decisionFailure = ClaudeChatTests.closedRun();
    first.wakeTurn = new WakeTurn({ [ProtocolResources.senderTokenVariable]: "wake-token" });
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      await Wait.until(() => reply.texts.includes("The server stopped"), "The reply listener did not see 'The server stopped'.");
      held.reject(ClaudeChatTests.closedRun());
      await ask.answered;
      gate.open();
      await woken;

      Assert.areEqual(`deny|${Resources.claudeSubAgentUnasked}`, `${ask.result?.behavior}|${ask.result?.behavior === "deny" ? ask.result.message : null}`);
      Assert.areEqual("1|1", `${first.asks.length}|${reply.asks.length}`);
      Assert.isTrue(first.details.some(t => t.kind === DetailKind.Note && t.providerItemId === "11111111-1111-1111-1111-111111111111:0:toolu_b"));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async passesOnTheRejectionOfTheMainAgentsOwnRequestAndOfASubAgentsRequestThatTheSdkWithdrewOrNoClosedReplyRejected(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const own = new ToolAskStep("Write", { file_path: "a.ts" }, "toolu_w", undefined, true);
    const withdrawn = new ToolAskStep("Bash", { command: "npm test" }, "toolu_b", "task-a", true);
    const failed = new ToolAskStep("Bash", { command: "npm run build" }, "toolu_c", "task-a", true);
    const thrown = new ToolAskStep("Bash", { command: "npm start" }, "toolu_d", "task-a", true);
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-35", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-35", "task-a", "toolu_a", true, "Explore the parser", "local_agent"),
      own,
      withdrawn,
      failed,
      thrown,
      gate,
      new StampedStep(SdkMessages.success("s-35", "Done"))
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const holds = [0, 1, 2, 3].map(() => Promise.withResolvers<string>());
    first.heldDecisions.push(...holds.map(t => t.promise));

    try {
      const running = adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      await Wait.until(() => first.asks.length === 4, "The first listener did not see 4 questions.");
      withdrawn.controller.abort();
      const failures = new Map<string, unknown>([["a.ts", ClaudeChatTests.closedRun()], ["npm test", ClaudeChatTests.closedRun()],
        ["npm run build", new Error("The payload could not be read.")], ["npm start", { reason: "refused" }]]);
      first.asks.forEach((t, i) => {
        const input = (t.payload as Record<string, Record<string, unknown>>)["input"];
        holds[i]!.reject(failures.get(String(input?.["file_path"] ?? input?.["command"])));
      });
      const outcomes = await Promise.allSettled([own.answered, withdrawn.answered, failed.answered, thrown.answered]);
      gate.open();
      await running;

      Assert.areEqual("rejected|rejected|rejected|rejected", outcomes.map(t => t.status).join("|"));
      Assert.areEqual(4, first.asks.length);
      Assert.isFalse(first.details.some(t => t.kind === DetailKind.Note));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async wakesWithTheSubAgentThatEndedAfterItsReplyAndKeepsItsLaterFramesWithItsOwnTurn(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-31", "none", null, []),
      new StampedStep(SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("toolu_a", "Agent",
        { description: "Explore the parser", prompt: "Find it" })], "claude-opus-5")),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("toolu_a", "Launched")], null, { status: "async_launched", agentId: "agent-a" }),
      new StampedStep(SdkMessages.success("s-31", "Started")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("toolu_b", "Grep", { pattern: "parse" })], "claude-haiku-5", "toolu_a"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("toolu_b", "parser.ts")], "toolu_a"),
      SdkMessages.taskNotification("s-31", "agent-a", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("55555555-5555-5555-5555-555555555555", [SdkMessages.text("The explore finished")], "claude-opus-5"),
      SdkMessages.success("s-31", "Finished"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({ [ProtocolResources.senderTokenVariable]: "wake-token" });
    const woken = first.wakeTurn.follow(reply, new AbortController().signal);

    try {
      await adapter.runTurn(host.createRequest("Explore"), first, new AbortController().signal);
      await woken;
      const agents = first.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));

      Assert.areEqual(JSON.stringify([["agent-a", "Explore the parser"]]), JSON.stringify(first.wakes.map(t => [t.taskId, t.command])));
      Assert.areEqual(JSON.stringify(["33333333-3333-3333-3333-333333333333:0", "44444444-4444-4444-4444-444444444444:0"]),
        JSON.stringify(first.details.filter(t => t.parentItemId === "11111111-1111-1111-1111-111111111111:0").map(t => t.providerItemId)));
      Assert.areEqual("Completed|true|Task completed", `${agents.at(-1)?.status}|${agents.at(-1)?.isBackground}|${agents.at(-1)?.summary}`);
      Assert.areEqual("The explore finished", reply.texts.join("|"));
      Assert.isFalse(reply.details.some(t => t.parentItemId !== null));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsTheWorkAndClosesAChatHeldOnlyByItWhenItIsSilentForTheSilenceLimit(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-40", "none", null, []),
      SdkMessages.taskStarted("s-40", "server", undefined, true, "npm start"),
      SdkMessages.success("s-40", "Started"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), listener, new AbortController().signal);
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.silenceLimit]), "The held chat did not start its silence limit.");
      host.idleTimer.advance(host.timings.silenceLimit - 1);
      const held = [query.closeCount, query.stoppedTasks.length, listener.taskEnds.length, adapter.activeRunCount];
      host.idleTimer.advance(1);
      await Wait.until(() => query.closeCount === 1, "The silent chat was not closed.");

      Assert.areEqual(14_400_000, host.timings.silenceLimit);
      Assert.areEqual(JSON.stringify([0, 0, 0, 1]), JSON.stringify(held));
      Assert.areEqual(JSON.stringify(["server"]), JSON.stringify(query.stoppedTasks));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
      Assert.areEqual(0, adapter.activeRunCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsAChatHeldByItsWorkOpenWhileTheWorkReportsWithinTheSilenceLimit(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-41", "none", null, []),
      SdkMessages.taskStarted("s-41", "server", undefined, true, "npm start"),
      SdkMessages.success("s-41", "Started"),
      gate,
      SdkMessages.taskProgress("s-41", "server", 1, 10, 100),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;

    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => host.idleTimer.begun === 1, "The held chat did not start its silence limit.");
      host.idleTimer.advance(host.timings.silenceLimit - 1);
      gate.open();
      await Wait.until(() => host.idleTimer.begun === 3, "The work's report did not start the silence limit again.");
      host.idleTimer.advance(host.timings.silenceLimit - 1);
      const reported = [query.closeCount, host.idleTimer.pending];
      host.idleTimer.advance(1);
      await Wait.until(() => query.closeCount === 1, "The chat was not closed once its work fell silent.");

      Assert.areEqual(JSON.stringify([0, 1]), JSON.stringify(reported));
      Assert.areEqual(JSON.stringify(["server"]), JSON.stringify(query.stoppedTasks));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async startsTheSilenceLimitAgainAfterATurnOnTheHeldChat(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-42", "none", null, []),
      SdkMessages.taskStarted("s-42", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-42", "Started")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-42", "Second")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;

    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.silenceLimit]), "The held chat did not start its silence limit.");
      host.idleTimer.advance(host.timings.silenceLimit - 1);
      const next = await adapter.runTurn(host.createRequest("Next", null, "s-42"), new RecordingTurnListener(), new AbortController().signal);
      host.idleTimer.advance(1);
      const after = [query.closeCount, host.idleTimer.pending, host.factory.queries.length];
      host.idleTimer.advance(host.timings.silenceLimit - 1);
      await Wait.until(() => query.closeCount === 1, "The chat was not closed once its work fell silent after the turn.");

      Assert.areEqual(TurnOutcome.Completed, next.outcome);
      Assert.areEqual(JSON.stringify([0, 1, 1]), JSON.stringify(after));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsAnIdleChatOpenForTheIdleLimitForItsNextTurnAndResumesTheSessionOnANewQueryOnceItCloses(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-44", "none", null, []),
      new StampedStep(SdkMessages.success("s-44", "First")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-44", "Second")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-44", "none", null, []), SdkMessages.success("s-44", "Third")]));

    try {
      await adapter.runTurn(host.createRequest("First"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit]), "The idle chat did not start its idle limit.");
      host.idleTimer.advance(host.timings.idleLimit - 1);
      const second = await adapter.runTurn(host.createRequest("Second", null, "s-44"), new RecordingTurnListener(), new AbortController().signal);
      const kept = [query.closeCount, host.factory.queries.length];
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit]), "The chat did not start its idle limit again after its turn.");
      host.idleTimer.advance(host.timings.idleLimit - 1);
      const before = query.closeCount;
      host.idleTimer.advance(1);
      await Wait.until(() => query.closeCount === 1, "The idle chat was not closed.");
      const third = await adapter.runTurn(host.createRequest("Third", null, "s-44"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(1_800_000, host.timings.idleLimit);
      Assert.areEqual(JSON.stringify([0, 1, 0]), JSON.stringify([...kept, before]));
      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed]), JSON.stringify([second.outcome, third.outcome]));
      Assert.areEqual(JSON.stringify([undefined, "s-44"]), JSON.stringify(host.factory.optionsList.map(t => t.resume)));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async startsNoWakeTurnForATaskThatEndsWhileTheChatIsStoppingForOtherSettings(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-216", "none", null, []),
      SdkMessages.taskStarted("s-216", "server", undefined, true, "npm start"),
      SdkMessages.success("s-216", "Started"),
      new WaitForStopStep(),
      SdkMessages.taskNotification("s-216", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("21621621-6216-2162-1621-621621621621", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      SdkMessages.success("s-216", "Noted"),
      new WaitForCloseStep()
    ]);
    query.stopTaskGate = new GateStep();
    host.factory.next = query;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-216", "none", null, []), SdkMessages.success("s-216", "Again")]));
    const first = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), first, new AbortController().signal);
      const result = await adapter.runTurn(host.createRequest("Again", null, "s-216", "sonnet"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify(["server", 1, 0]), JSON.stringify([query.stoppedTasks.join(","), query.closeCount, first.wakes.length]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async resumesTheSessionOnANewQueryOnceAChatClosingForSilenceHasClosed(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const stopping = new GateStep();
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-43", "none", null, []),
      SdkMessages.taskStarted("s-43", "server", undefined, true, "npm start"),
      SdkMessages.success("s-43", "Started"),
      new WaitForCloseStep()
    ]);
    query.stopTaskGate = stopping;
    host.factory.next = query;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-43", "none", null, []), SdkMessages.success("s-43", "Again")]));
    const listener = new RecordingTurnListener();

    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.silenceLimit]), "The held chat did not start its silence limit.");
      host.idleTimer.advance(host.timings.silenceLimit);
      await Wait.until(() => query.stoppedTasks.length === 1, "The silent chat did not stop its work.");
      const again = adapter.runTurn(host.createRequest("Again", null, "s-43"), listener, new AbortController().signal);
      await Wait.until(() => listener.starts.length === 1, "The next turn did not start.");
      const closedFirst = query.closeCount;
      stopping.open();
      const result = await again;

      Assert.areEqual(1, closedFirst);
      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("s-43", result.nativeSessionId);
      Assert.areEqual(JSON.stringify([undefined, "s-43"]), JSON.stringify(host.factory.optionsList.map(t => t.resume)));
      Assert.isFalse(listener.details.some(t => t.payload === Resources.resumeNotePayload));
    }
    finally {
      stopping.open();
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async compactsALargeChatOnTheHourCacheInItsLiveSessionBeforeTheCacheExpiresAndThenClosesAtTheIdleLimit(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-1", "none", null, []),
      new StampedStep(SdkMessages.cached("s-1", "Done", 4000, 0)),
      new WaitForInputStep(),
      SdkMessages.init("s-1", "none", null, []),
      new StampedStep(SdkMessages.success("s-1", "Compacted")),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    try {
      const result = await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      host.idleTimer.advance(host.timings.idleLimit);
      const before = [query.closeCount, first.wakes.length, query.inputs.length].join();
      host.idleTimer.advance(Resources.idleCompactionDelay);
      const compacted = await woken;
      await IdleLimit.elapseAsync(host.idleTimer, host.timings.idleLimit, "No wait was due within the idle limit.");
      await Wait.until(() => query.closeCount === 1, "The query was not closed after the compaction.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("0,0,1", before);
      Assert.areEqual(TurnOutcome.Completed, compacted.outcome);
      Assert.areEqual(JSON.stringify([[null, null, true]]), JSON.stringify(first.wakes.map(t => [t.taskId, t.command, t.compaction])));
      Assert.areEqual(2, query.inputs.length);
      Assert.isTrue(JSON.stringify(query.inputs.at(-1)?.message.content).includes(CoreResources.compactCommand), JSON.stringify(query.inputs.at(-1)));
      Assert.areEqual(1, host.factory.queries.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData(0, 4000, 160_000, true)
  @TestData(4000, 0, 149_999, true)
  @TestData(4000, 0, 160_000, false)
  public async closesAtTheIdleLimitWithoutCompactingAChatOffTheHourCacheSmallOrNotAllowedTo(hourTokens: number, fiveMinuteTokens: number, context: number,
    allowed: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-2", "none", null, []),
      new StampedStep(SdkMessages.cached("s-2", "Done", hourTokens, fiveMinuteTokens)),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(context);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, allowed), first, new AbortController().signal);
      await IdleLimit.elapseAsync(host.idleTimer, host.timings.idleLimit, "No wait was due within the idle limit.");
      await Wait.until(() => query.closeCount === 1, "The query was not closed after the idle limit.");

      Assert.areEqual(0, first.wakes.length);
      Assert.areEqual(1, query.inputs.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async closesWithoutCompactingWhenTheTurnsListenerRefusesTheCompaction(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-3", "none", null, []),
      new StampedStep(SdkMessages.cached("s-3", "Done", 4000, 0)),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const first = new RecordingTurnListener();

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      host.idleTimer.advance(Resources.idleCompactionDelay);
      await Wait.until(() => query.closeCount === 1, "The query was not closed after the refused compaction.");

      Assert.areEqual(JSON.stringify([true]), JSON.stringify(first.wakes.map(t => t.compaction)));
      Assert.areEqual(1, query.inputs.length);
      Assert.areEqual(0, adapter.activeRunCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async waitsFromTheLastTurnSoANewTurnBeforeTheDeadlineDropsTheCompactionItNoLongerQualifiesFor(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-4", "none", null, []),
      new StampedStep(SdkMessages.cached("s-4", "Done", 4000, 0)),
      new WaitForInputStep(),
      SdkMessages.init("s-4", "none", null, []),
      new StampedStep(SdkMessages.cached("s-4", "Again", 0, 4000)),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const second = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true, "s-4"), second, new AbortController().signal);
      await IdleLimit.elapseAsync(host.idleTimer, host.timings.idleLimit, "No wait was due within the idle limit.");
      await Wait.until(() => query.closeCount === 1, "The query was not closed after the idle limit.");
      host.idleTimer.advance(Resources.idleCompactionDelay);

      Assert.areEqual("0,0", [first.wakes.length, second.wakes.length].join());
      Assert.areEqual(2, query.inputs.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async movesTheCompactionToFiftyFourMinutesAfterALaterCompactableTurn(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-7", "none", null, []),
      new StampedStep(SdkMessages.cached("s-7", "Done", 4000, 0)),
      new WaitForInputStep(),
      SdkMessages.init("s-7", "none", null, []),
      new StampedStep(SdkMessages.cached("s-7", "Again", 4000, 0)),
      new WaitForInputStep(),
      SdkMessages.init("s-7", "none", null, []),
      new StampedStep(SdkMessages.success("s-7", "Compacted")),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const half = Resources.idleCompactionDelay / 2;
    const first = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const second = new RecordingTurnListener();
    second.wakeTurn = new WakeTurn({});
    const woken = second.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      host.idleTimer.advance(half);
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true, "s-7"), second, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      host.idleTimer.advance(half + 1);
      const atFirstDeadline = [first.wakes.length, second.wakes.length, query.inputs.length].join();
      host.idleTimer.advance(half);
      const compacted = await woken;

      Assert.areEqual("0,0,2", atFirstDeadline);
      Assert.areEqual(TurnOutcome.Completed, compacted.outcome);
      Assert.areEqual("0,1", [first.wakes.length, second.wakes.length].join());
      Assert.isTrue(JSON.stringify(query.inputs.at(-1)?.message.content).includes(CoreResources.compactCommand), JSON.stringify(query.inputs.at(-1)));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async neverCompactsAChatClearedSinceItsLargeTurnAndClosesAtTheIdleLimit(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-8", "none", null, []),
      new StampedStep(SdkMessages.cached("s-8", "Done", 4000, 0)),
      new WaitForInputStep(),
      SdkMessages.init("s-8", "none", null, []),
      new StampedStep(SdkMessages.cached("s-8", String.empty, 0, 0)),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const cleared = new RecordingTurnListener();
    cleared.wakeTurn = new WakeTurn({});

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      query.contextUsageResult = ClaudeChatTests.context(18_000);
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true, "s-8", "/clear"), cleared, new AbortController().signal);
      await IdleLimit.elapseAsync(host.idleTimer, host.timings.idleLimit, "No wait was due within the idle limit.");
      await Wait.until(() => query.closeCount === 1, "The query was not closed after the idle limit.");
      host.idleTimer.advance(Resources.idleCompactionDelay);

      Assert.areEqual("0,0", [first.wakes.length, cleared.wakes.length].join());
      Assert.areEqual(2, query.inputs.length);
      Assert.isTrue(JSON.stringify(query.inputs.at(-1)?.message.content).includes("/clear"), JSON.stringify(query.inputs.at(-1)));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async closesAtTheIdleLimitWithoutCompactingAChatWhoseTasksKeptItBusyPastTheCompactionTime(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-6", "none", null, []),
      new StampedStep(SdkMessages.cached("s-6", "Done", 4000, 0)),
      SdkMessages.backgroundTasks("s-6", [["agent", false]]),
      gate,
      SdkMessages.backgroundTasks("s-6", []),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      host.idleTimer.jump(Resources.idleCompactionDelay);
      gate.open();
      await IdleLimit.elapseAsync(host.idleTimer, host.timings.idleLimit, "No wait was due within the idle limit.");
      await Wait.until(() => query.closeCount === 1, "The query was not closed after the idle limit.");

      Assert.areEqual(0, first.wakes.length);
      Assert.areEqual(1, query.inputs.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsTheCompactionTheWakesFollowerStops(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-5", "none", null, []),
      new StampedStep(SdkMessages.cached("s-5", "Done", 4000, 0)),
      new WaitForInputStep(),
      SdkMessages.init("s-5", "none", null, []),
      new WaitForInterruptStep(),
      new StampedStep(SdkMessages.failure("s-5", "error_during_execution", ["Interrupted"])),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const follower = new AbortController();
    first.wakeTurn = new WakeTurn({});
    const woken = first.wakeTurn.follow(new RecordingTurnListener(), follower.signal);

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      host.idleTimer.advance(Resources.idleCompactionDelay);
      await Wait.until(() => query.inputs.length === 2, "The compaction was not sent.");
      follower.abort();
      const result = await woken;

      Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
      Assert.areEqual(1, query.interruptCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async sendsATurnThatComesWhileTheListenerDecidesOnTheCompactionAndCompactsNothing(fails: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-62", "none", null, []),
      new StampedStep(SdkMessages.cached("s-62", "Done", 4000, 0)),
      new WaitForInputStep(),
      SdkMessages.init("s-62", "none", null, []),
      new StampedStep(SdkMessages.success("s-62", "Next")),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const decided = Promise.withResolvers<WakeTurn | null>();
    first.onWakeAsync = wake => {
      first.wakes.push(wake);
      return decided.promise;
    };
    const second = new RecordingTurnListener();

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      host.idleTimer.advance(Resources.idleCompactionDelay);
      await Wait.until(() => first.wakes.length === 1, "The compaction was not asked for.");
      const next = adapter.runTurn(ClaudeChatTests.idleRequest(host, true, "s-62", "Next"), second, new AbortController().signal);
      await Wait.until(() => second.starts.length === 1, "The next turn did not reach the chat.");
      if (fails)
        decided.reject(new Error("The wake wasn't kept"));
      else
        decided.resolve(null);
      const result = await next;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(2, query.inputs.length);
      Assert.isFalse(JSON.stringify(query.inputs.at(-1)?.message.content).includes(CoreResources.compactCommand), JSON.stringify(query.inputs.at(-1)));
      Assert.areEqual(0, query.closeCount);
      Assert.areEqual(1, host.factory.queries.length);
      Assert.areEqual(fails, log.lines.includes(Resources.formatClaudeCompactionWakeFailed("s-62", "The wake wasn't kept")));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsAWakeTheListenerGivesAfterATurnTookTheChatWithoutCompacting(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-64", "none", null, []),
      new StampedStep(SdkMessages.cached("s-64", "Done", 4000, 0)),
      new WaitForInputStep(),
      SdkMessages.init("s-64", "none", null, []),
      new StampedStep(SdkMessages.success("s-64", "Next")),
      new WaitForCloseStep()
    ]);
    query.contextUsageResult = ClaudeChatTests.context(160_000);
    host.factory.next = query;
    const first = new RecordingTurnListener();
    const decided = Promise.withResolvers<WakeTurn | null>();
    first.onWakeAsync = wake => {
      first.wakes.push(wake);
      return decided.promise;
    };
    const wake = new WakeTurn({});
    const woken = wake.follow(new RecordingTurnListener(), new AbortController().signal);
    const second = new RecordingTurnListener();

    try {
      await adapter.runTurn(ClaudeChatTests.idleRequest(host, true), first, new AbortController().signal);
      await ClaudeChatTests.waitingToCompact(host);
      host.idleTimer.advance(Resources.idleCompactionDelay);
      await Wait.until(() => first.wakes.length === 1, "The compaction was not asked for.");
      const next = adapter.runTurn(ClaudeChatTests.idleRequest(host, true, "s-64", "Next"), second, new AbortController().signal);
      await Wait.until(() => second.starts.length === 1, "The next turn did not reach the chat.");
      decided.resolve(wake);
      const [result, compacted] = await Promise.all([next, woken]);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(TurnOutcome.Interrupted, compacted.outcome);
      Assert.areEqual("s-64", compacted.nativeSessionId);
      Assert.areEqual(2, query.inputs.length);
      Assert.isFalse(JSON.stringify(query.inputs.at(-1)?.message.content).includes(CoreResources.compactCommand), JSON.stringify(query.inputs.at(-1)));
    }
    finally { await adapter.shutdown(); }
  }

  private static closedRun(): Error {
    return Object.assign(new Error("The message is not open."), { info: { name: ErrorCode.Conflict } });
  }

  private static closed(): Promise<string> {
    const closed = Promise.withResolvers<string>();
    void closed.promise.catch(() => undefined);
    closed.reject(ClaudeChatTests.closedRun());
    return closed.promise;
  }

  private static request(host: ClaudeTestHost, prompt: string, resume: string | null, token: string): TurnRequest {
    return new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("claude", null, null), resume, [], null, null,
      { [ProtocolResources.senderTokenVariable]: token });
  }

  private static idleRequest(host: ClaudeTestHost, compactsWhenIdle: boolean, resume: string | null = null, prompt: string = "Look"): TurnRequest {
    return new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("claude", null, null, null, null, false, null), resume, [], null, null, {}, false,
      null, [], null, () => false, undefined, null, false, null, compactsWhenIdle);
  }

  private static context(totalTokens: number): unknown {
    return { totalTokens, maxTokens: 200_000, isAutoCompactEnabled: true, autoCompactThreshold: 167_000 };
  }

  private static waitingToCompact(host: ClaudeTestHost): Promise<void> {
    return Wait.until(() => host.idleTimer.pendingWithin(Resources.idleCompactionDelay) === 1 && host.idleTimer.pendingWithin(host.timings.idleLimit) === 0,
      "The chat did not wait to compact.");
  }
}
