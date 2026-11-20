/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, Category, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { type ITimer, McpEndpoint, NodeTimer, SessionTokens, type TaskEnd, TurnOutcome, TurnRequest, type TurnResult, TurnTools, type TurnWake, WakeTurn } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AuthStatus, BackgroundTaskStatus, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { AcpAdapter, AcpTasks, CommandRunner, type GrokAdapter, GrokAgent, GrokHome, GrokImageReader, type IProcessTree, NodeProcessStarter, ProcessTree, ProviderTimings, Resources, TaskException } from "@noldova/teamrun.providers";

import { FakeTaskTree } from "../../fixtures/fake-task-tree.fixture.js";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { HeldDelayTimer } from "../../fixtures/held-delay-timer.fixture.js";
import { LimitWaits } from "../../fixtures/limit-waits.fixture.js";
import { RecordedMcpServers } from "../../fixtures/recorded-mcp-servers.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { RefusedStopStarter } from "../../fixtures/refused-stop-starter.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const command = "Write-Output 'background wait started'; Start-Sleep -Seconds 60; Write-Output 'background wait done'";

class AdoptingEndpoint extends McpEndpoint {
  public readonly adoptions: (string | null)[] = [];
  private readonly registry: SessionTokens;

  public constructor(tokens: SessionTokens, session: string) {
    super("http://127.0.0.1:4711/mcp", tokens, session);
    this.registry = tokens;
  }

  public override adopt(token: string): boolean {
    const moved = super.adopt(token);
    this.adoptions.push(moved ? this.registry.find(token) : null);
    return moved;
  }
}

class TreeWatchingListener extends RecordingTurnListener {
  public readonly runningAtEnd: number[] = [];
  public tree: readonly number[] = [];

  public static runs(processId: number): boolean {
    return FakeTaskTree.runs(processId);
  }

  public override async onTaskEndedAsync(end: TaskEnd): Promise<void> {
    this.runningAtEnd.push(this.tree.filter(t => TreeWatchingListener.runs(t)).length);
    await super.onTaskEndedAsync(end);
  }
}

class HeldTaskEndListener extends RecordingTurnListener {
  public heldEnd: Promise<void> | null = null;

  public override async onTaskEndedAsync(end: TaskEnd): Promise<void> {
    await super.onTaskEndedAsync(end);
    const held = this.heldEnd;
    this.heldEnd = null;
    if (!Object.isNull(held))
      await held;
  }
}

class TreeEndTimer implements ITimer {
  private readonly listener: TreeWatchingListener;
  private readonly timer: ITimer = new NodeTimer();

  public constructor(listener: TreeWatchingListener) {
    this.listener = listener;
  }

  public now(): number {
    return this.timer.now();
  }

  public async delayAsync(_milliseconds: number, signal: AbortSignal): Promise<void> {
    await Wait.until(() => signal.aborted || !this.listener.tree.some(t => TreeWatchingListener.runs(t)), "The task tree still ran.");
    signal.throwIfAborted();
  }
}

@Category("ProcessListing")

@TestClass
export class AcpTasksTests {
  @TestMethod
  public async leavesOtherSessionsAndMessagesThatAreNoTasksToTheTurn(): Promise<void> {
    const listener = new RecordingTurnListener();
    const tasks = new AcpTasks(listener, "s", "Agent", new ManualTimer(), () => Promise.resolve(), () => undefined);
    const started = { sessionUpdate: "task_backgrounded", task_id: "t", tool_call_id: "c", command: "npm start" };

    const handled = [
      await tasks.handleAsync("_x.ai/task_backgrounded", JsonReader.fromValue({ update: started })),
      await tasks.handleAsync("_x.ai/task_backgrounded", JsonReader.fromValue({ sessionId: "other", update: started })),
      await tasks.handleAsync("_x.ai/task_backgrounded", JsonReader.fromValue({ sessionId: "s" })),
      await tasks.handleAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "agent_message_chunk" } })),
      await tasks.handleAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId: "c" } })),
      await tasks.handleAsync("_x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId: "c" } }))
    ];

    Assert.areEqual(JSON.stringify([false, false, false, false, false, false]), JSON.stringify(handled));
    Assert.isTrue(tasks.isIdle);
    Assert.areEqual(0, listener.taskStarts.length);
  }

  @TestMethod
  public async startsATaskOnceAndShowsOnlyTheOutputItsToolCallAdds(): Promise<void> {
    const listener = new RecordingTurnListener();
    const tasks = new AcpTasks(listener, "s", "Agent", new ManualTimer(), () => Promise.resolve(), () => undefined);
    const outputAsync = (text: JsonObject[] | null, status: string | null = null, toolCallId: string = "c"): Promise<boolean> => tasks.handleAsync("session/update",
      JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId, ...Object.isNull(text) ? {} : { content: text },
        ...Object.isNull(status) ? {} : { status } } }));
    const text = (value: string): JsonObject => ({ type: "content", content: { type: "text", text: value } });

    await AcpTasksTests.startAsync(tasks, "t", "c");
    await AcpTasksTests.startAsync(tasks, "t", "c");
    const handled = [
      await outputAsync([text("one")]),
      await outputAsync([text("one")]),
      await outputAsync([text("one"), text(" two")]),
      await outputAsync([text("new")]),
      await outputAsync([{ type: "diff" }, { type: "content", content: { type: "image" } }]),
      await outputAsync(null),
      await outputAsync([text("done")], "completed"),
      await outputAsync([text("x")], null, "unknown")
    ];

    Assert.areEqual(JSON.stringify([true, true, true, true, true, true, false, false]), JSON.stringify(handled));
    Assert.areEqual(JSON.stringify([["t", "npm start"]]), JSON.stringify(listener.taskStarts.map(t => [t.taskId, t.command])));
    Assert.areEqual(JSON.stringify(["one", " two", "new"]), JSON.stringify(listener.taskOutputs.map(t => t.text)));
    Assert.isFalse(tasks.isIdle);
  }

  @TestMethod
  public async endsATaskWithTheRestOfItsSnapshotAndSaysWhenATurnFollows(): Promise<void> {
    const listener = new RecordingTurnListener();
    const wakes: TurnWake[] = [];
    const tasks = new AcpTasks(listener, "s", "Agent", new ManualTimer(), () => Promise.resolve(), t => wakes.push(t));

    await AcpTasksTests.startAsync(tasks, "done", "c");
    await AcpTasksTests.startAsync(tasks, "failed", null);
    await AcpTasksTests.startAsync(tasks, "unknown", null);
    await AcpTasksTests.completeAsync(tasks, { task_id: "done", output: "all", exit_code: 0, explicitly_killed: false }, true);
    await AcpTasksTests.completeAsync(tasks, { task_id: "failed", exit_code: 1 }, false);
    await AcpTasksTests.completeAsync(tasks, { task_id: "unknown", output: "" });
    await AcpTasksTests.completeAsync(tasks, { task_id: "late", command: "npm test" }, true);
    await AcpTasksTests.completeAsync(tasks, { task_id: "gone" }, true);
    const output = await tasks.handleAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId: "c",
      content: [{ type: "content", content: { type: "text", text: "after" } }] } }));

    Assert.areEqual(JSON.stringify([["done", "all"]]), JSON.stringify(listener.taskOutputs.map(t => [t.taskId, t.text])));
    Assert.areEqual(JSON.stringify([["done", BackgroundTaskStatus.Completed, 0], ["failed", BackgroundTaskStatus.Failed, 1], ["unknown", BackgroundTaskStatus.Failed, null]]),
      JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status, t.exitCode])));
    Assert.areEqual(JSON.stringify([["done", "npm start"], ["late", "npm test"], ["gone", null]]), JSON.stringify(wakes.map(t => [t.taskId, t.command])));
    Assert.isFalse(output);
    Assert.isTrue(tasks.isIdle);
  }

  @TestMethod
  public async stopsATaskGrokListsAsRunningThroughItsProcessTreeAndShowsItStoppedWhenItEnds(): Promise<void> {
    const listener = new RecordingTurnListener();
    const ended: number[][] = [];
    const timer = new ManualTimer();
    const tasks = new AcpTasks(listener, "s", "Agent", timer, (t, u) => { ended.push([t, u]); return Promise.resolve(); }, () => undefined);
    const stop = (index: number): Promise<string | null> => (listener.taskStarts[index]?.stop() ?? Promise.resolve()).then(() => null,
      (error: unknown) => error instanceof TaskException ? error.message : String(error));

    await AcpTasksTests.startAsync(tasks, "a", "c");
    await AcpTasksTests.startAsync(tasks, "b", "d");
    await AcpTasksTests.startAsync(tasks, "c", "e");
    const unlisted = await stop(0);
    timer.advance(500);
    await AcpTasksTests.startedAsync(tasks, "c", { type: "BackgroundTaskStarted", pid: 41 });
    timer.advance(500);
    await AcpTasksTests.startedAsync(tasks, "e", { type: "BackgroundTaskStarted", pid: 43 });
    await AcpTasksTests.startedAsync(tasks, "d", { type: "Bash", pid: 42 });
    await tasks.handleAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId: "d", status: "completed",
      rawOutput: null } }));
    await tasks.handleAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId: "d", status: "completed" } }));
    await AcpTasksTests.startedAsync(tasks, "d", { type: "BackgroundTaskStarted", pid: "42" });
    const listed = await tasks.handleAsync("x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "background_tasks", tasks: [
      { task_id: "a", status: "running" }, { task_id: "b", status: "running" }, { task_id: "c", status: "completed" }] } }));
    const unknown = await stop(1);
    const gone = await stop(2);
    const stopped = await stop(0);
    await AcpTasksTests.completeAsync(tasks, { task_id: "a", exit_code: null, explicitly_killed: false });

    Assert.isTrue(listed);
    Assert.areEqual("Agent no longer lists this task as running, so TeamRun stopped nothing.", unlisted);
    Assert.areEqual("Agent named no process for this task, so TeamRun can't stop it.", unknown);
    Assert.areEqual("Agent no longer lists this task as running, so TeamRun stopped nothing.", gone);
    Assert.isNull(stopped);
    Assert.areEqual(JSON.stringify([[41, timer.now() - 500]]), JSON.stringify(ended));
    Assert.areEqual(JSON.stringify([["a", BackgroundTaskStatus.Stopped, null]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status, t.exitCode])));
  }

  @TestMethod
  public async endsOnlyOnceATaskThatGrokCompletesWhileTheTurnEndsTheTasksBeforeIt(): Promise<void> {
    const listener = new HeldTaskEndListener();
    const tasks = new AcpTasks(listener, "s", "Agent", new ManualTimer(), () => Promise.resolve(), () => undefined);
    await AcpTasksTests.startAsync(tasks, "first", "c");
    await AcpTasksTests.startAsync(tasks, "second", "d");
    const held = Promise.withResolvers<void>();
    listener.heldEnd = held.promise;

    const ending = tasks.endAllAsync();
    await Wait.until(() => listener.taskEnds.length === 1, "The first task did not end.");
    await AcpTasksTests.completeAsync(tasks, { task_id: "second", exit_code: 0 });
    held.resolve();
    await ending;

    Assert.areEqual(JSON.stringify([["first", BackgroundTaskStatus.Ended], ["second", BackgroundTaskStatus.Completed]]),
      JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.isTrue(tasks.isIdle);
  }

  @TestMethod
  public async keepsATaskWhoseTreeCouldNotBeEndedAsGrokEndsItAndEndsTheRestStoppedOrEnded(): Promise<void> {
    const listener = new RecordingTurnListener();
    const tasks = new AcpTasks(listener, "s", "Agent", new ManualTimer(), t => t === 41 ? Promise.reject(new Error("Not under the agent")) : Promise.resolve(),
      () => undefined);

    await AcpTasksTests.startAsync(tasks, "refused", "c");
    await AcpTasksTests.startAsync(tasks, "stopped", "d");
    await AcpTasksTests.startAsync(tasks, "unknown", "e");
    await AcpTasksTests.startedAsync(tasks, "c", { type: "BackgroundTaskStarted", pid: 41 });
    await AcpTasksTests.startedAsync(tasks, "d", { type: "BackgroundTaskStarted", pid: 42 });
    await tasks.handleAsync("_x.ai/session_notification", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "background_tasks", tasks: [
      { task_id: "refused", status: "running" }, { task_id: "stopped", status: "running" }, { task_id: "unknown", status: "running" }] } }));
    const refused = await listener.taskStarts[0]!.stop().then(() => null, (error: unknown) => (error as Error).message);
    await AcpTasksTests.completeAsync(tasks, { task_id: "refused", exit_code: 1 });
    await AcpTasksTests.startAsync(tasks, "again", "f");
    await AcpTasksTests.startedAsync(tasks, "f", { type: "BackgroundTaskStarted", pid: 41 });
    await tasks.stopAll();
    await tasks.endAllAsync();

    Assert.areEqual("Not under the agent", refused);
    Assert.areEqual(JSON.stringify([["refused", BackgroundTaskStatus.Failed], ["stopped", BackgroundTaskStatus.Stopped], ["unknown", BackgroundTaskStatus.Ended],
      ["again", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.isTrue(tasks.isIdle);
  }

  @TestMethod
  public async movesItsProcesssKeptTokenToTheWakesToolsSoTheWakeReachesTeamRunOverHttpUntilTheProcessCloses(): Promise<void> {
    await using host = new GrokTestHost();
    const tokens = new SessionTokens();
    tokens.open("turn", "c1/t1");
    tokens.open("wake", "c1/t1");
    const toolHost = { listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) };
    const approvedTools: readonly string[] = [];
    const wakeEndpoint = new AdoptingEndpoint(tokens, "wake");
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const woken = listener.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: false }, mcpCapabilities: { http: true, sse: true } } };
    const environment = { ...host.environment, TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) };
    const profile = host.directory.resolve("profile");
    const adapter = new AcpAdapter(new GrokAgent(host.command, environment, profile), host.info, host.programs.wrap(new NodeProcessStarter(host.terminator)), host.timings,
      host.timer, new GrokImageReader(new GrokHome(environment, profile)), null, new ProcessTree(process.platform, new CommandRunner(new NodeProcessStarter(host.terminator)),
        process.env, Resources.processListTimeout, host.timer, host.timings.stopGrace), host.elapsedIdleTimer);
    const turnTools = new TurnTools(toolHost, approvedTools, new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "turn"));
    turnTools.markListed();

    const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "background", new RequestedSettings("grok", null, null), null, [], null, null, {},
      false, turnTools), listener, new AbortController().signal);
    tokens.close("turn");
    const token = RecordedMcpServers.bearerOf(readFileSync(join(host.directory.resolve("person"), "mcp-servers.txt"), "utf8").trimEnd());
    const between = tokens.find(token);
    await listener.wakeTurn.useToolsAsync(new TurnTools(toolHost, approvedTools, wakeEndpoint));
    AcpTasksTests.endTask(host, {});
    const wake = await woken;
    await host.programs.endedAt(1);
    await Wait.until(() => Object.isNull(tokens.find(token)), "The task's token was not withdrawn.");

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(TurnOutcome.Completed, wake.outcome);
    Assert.areEqual(43, token.length);
    Assert.isNull(between);
    Assert.areEqual("wake", wakeEndpoint.adoptions.join(","));
    Assert.isFalse(tokens.adopt(token, "wake"));
  }

  @TestMethod
  public async followsTheRecordedTaskShowsTheTurnGrokStartsWhenItEndsInItsOwnReplyAndThenClosesGrok(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const woken = listener.wakeTurn.follow(reply, new AbortController().signal);

    const result = await AcpTasksTests.adapter(host).runTurn(host.request("background"), listener, new AbortController().signal);
    const during = JSON.stringify([listener.taskOutputs.map(t => t.text), listener.taskEnds.length, host.programs.ended.length]);
    await listener.wakeTurn.useToolsAsync(new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) },
      []));
    AcpTasksTests.endTask(host, {});
    const wake = await woken;
    await host.programs.endedAt(1);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([["background wait started", "\r\n"], 0, 0]), during);
    Assert.areEqual(JSON.stringify([["TASK", command]]), JSON.stringify(listener.taskStarts.map(t => [t.taskId, t.command])));
    Assert.areEqual(JSON.stringify(["background wait started", "\r\n", "background wait done", "\r\n"]), JSON.stringify(listener.taskOutputs.map(t => t.text)));
    Assert.isTrue(listener.taskOutputs.every(t => t.taskId === "TASK"));
    Assert.areEqual(JSON.stringify([["TASK", BackgroundTaskStatus.Completed, 0]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status, t.exitCode])));
    Assert.areEqual(JSON.stringify([["TASK", command]]), JSON.stringify(listener.wakes.map(t => [t.taskId, t.command])));
    Assert.areEqual(TurnOutcome.Completed, wake.outcome);
    Assert.areEqual("grok-session", wake.nativeSessionId);
    Assert.isTrue(reply.starts[0]?.resumedNativeSession ?? false);
    Assert.isTrue(reply.texts.some(t => t.includes("finished")));
    Assert.isFalse(listener.texts.some(t => t.includes("finished")));
  }

  @TestMethod
  @TestData(JSON.stringify({ exitCode: 2, willWake: false }), BackgroundTaskStatus.Failed, 2)
  @TestData(JSON.stringify({ exitCode: null, killed: true, willWake: false }), BackgroundTaskStatus.Stopped, null)
  public async endsTheTaskAsItsSnapshotSaysAndClosesGrokWhenNoTurnFollows(end: string, status: BackgroundTaskStatus, exitCode: number | null): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    await AcpTasksTests.adapter(host).runTurn(host.request("background"), listener, new AbortController().signal);
    AcpTasksTests.endTask(host, JSON.parse(end) as object);
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify([["TASK", status, exitCode]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status, t.exitCode])));
    Assert.areEqual(0, listener.wakes.length);
  }

  @TestMethod
  public async endsTheTaskAndLetsGrokGoWhenGrokRefusesToStopOnceNoTaskRuns(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const starter = new RefusedStopStarter({ TEAMRUN_FAKE_ACP_STAY_OPEN: "1" }, true);

    await host.createAdapter(host.environment, host.command, host.terminator, host.timings, starter).runTurn(host.request("background"), listener, new AbortController().signal);
    AcpTasksTests.endTask(host, { willWake: false });
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify([["TASK", BackgroundTaskStatus.Completed, 0]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status, t.exitCode])));
    Assert.isFalse(AcpTasksTests.runs(host.programs.started[0]?.processId ?? 0));
  }

  @TestMethod
  public async keepsGrokAfterItsTaskEndsForTheIdleLimitAndThenClosesIt(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const adapter = AcpTasksTests.adapter(host, host.idleTimer);

    await adapter.runTurn(host.request("background"), listener, new AbortController().signal);
    await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.silenceLimit]), "The silence limit did not start for the task.");
    host.idleTimer.advance(host.timings.silenceLimit - 1);
    AcpTasksTests.endTask(host, {});
    await Wait.until(() => listener.taskEnds.length === 1 && LimitWaits.are(host.idleTimer, [host.timings.idleLimit]),
      "The idle limit did not start once the task ended.");
    const kept = host.programs.ended.length;
    host.idleTimer.advance(host.timings.idleLimit);
    await Wait.until(() => host.programs.ended.length === 1, "Grok did not close once the idle limit passed.");

    Assert.areEqual(JSON.stringify([0, [BackgroundTaskStatus.Completed]]), JSON.stringify([kept, listener.taskEnds.map(t => t.status)]));
  }

  @TestMethod
  public async keepsNoIsolatedSessionAndClosesItsGrokOnceTheTaskItStartedEnds(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const adapter = AcpTasksTests.adapter(host, host.idleTimer);
    const request = new TurnRequest(null, host.directory.path, "background", new RequestedSettings("grok", null, null), null, [], null, null, {}, false, null, [],
      null, undefined, undefined, null, true);

    const result = await adapter.runTurn(request, listener, new AbortController().signal);
    await Wait.until(() => listener.taskStarts.length === 1, "The isolated turn's task did not start.");
    const during = [host.programs.ended.length, host.idleTimer.pending];
    AcpTasksTests.endTask(host, { willWake: false });
    await host.programs.endedAt(1);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([0, 0]), JSON.stringify(during));
    Assert.areEqual(0, host.idleTimer.pending);
  }

  @TestMethod
  public async stopsTheTaskOfAKeptGrokThatFallsSilentForTheSilenceLimitAndClosesGrok(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const adapter = AcpTasksTests.adapter(host, host.idleTimer);

    await adapter.runTurn(host.request("background"), listener, new AbortController().signal);
    await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.silenceLimit]), "The silence limit did not start for the task.");
    host.idleTimer.advance(host.timings.silenceLimit);
    await host.programs.endedAt(1);

    Assert.areEqual(1, listener.taskEnds.length);
    Assert.areEqual(1, host.programs.started.length);
  }

  @TestMethod
  public async cancelsTheTurnGrokStartsWhenNoReplyTakesItAndShowsItNowhere(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    await AcpTasksTests.adapter(host).runTurn(host.request("background"), listener, new AbortController().signal);
    AcpTasksTests.endTask(host, {});
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify({ starts: 1, ends: [BackgroundTaskStatus.Completed], wakes: 1, finished: false, started: 1, ended: 1 }), JSON.stringify({
      starts: listener.taskStarts.length, ends: listener.taskEnds.map(t => t.status), wakes: listener.wakes.length,
      finished: listener.texts.some(t => t.includes("finished")), started: host.programs.started.length, ended: host.programs.ended.length
    }));
  }

  @TestMethod
  public async interruptsTheTurnGrokStartsWhenItsReplyIsStopped(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const stopping = new AbortController();
    listener.wakeTurn = new WakeTurn({});
    const woken = listener.wakeTurn.follow(reply, stopping.signal);

    await AcpTasksTests.adapter(host).runTurn(host.request("background"), listener, new AbortController().signal);
    AcpTasksTests.endTask(host, { wakeReason: "hold" });
    await Wait.until(() => reply.texts.some(t => t.includes("finished")), "The reply listener did not see a text with 'finished'.");
    stopping.abort();
    const wake = await woken;
    await host.programs.endedAt(1);

    Assert.areEqual(TurnOutcome.Interrupted, wake.outcome);
    Assert.isTrue(reply.texts.some(t => t.includes("wake cancelled")));
  }

  @TestMethod
  @TestData("refusal", TurnOutcome.Completed)
  @TestData("max_tokens", TurnOutcome.Failed)
  public async endsTheTurnGrokStartsAsItsStopReasonSays(reason: string, outcome: TurnOutcome): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const woken = listener.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    await AcpTasksTests.adapter(host).runTurn(host.request("background"), listener, new AbortController().signal);
    AcpTasksTests.endTask(host, { wakeReason: reason });
    const wake = await woken;

    Assert.areEqual(outcome, wake.outcome);
    Assert.areEqual(outcome === TurnOutcome.Failed, wake.error?.includes("max_tokens") ?? false);
  }

  @TestMethod
  public async asksTheReplyOfTheTurnGrokStartsForItsApprovals(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    reply.decisions.push("yes");
    listener.wakeTurn = new WakeTurn({});
    const woken = listener.wakeTurn.follow(reply, new AbortController().signal);

    await AcpTasksTests.adapter(host).runTurn(host.request("background"), listener, new AbortController().signal);
    AcpTasksTests.endTask(host, { wakeReason: "approve" });
    const wake = await woken;

    Assert.areEqual(TurnOutcome.Completed, wake.outcome);
    Assert.areEqual(0, listener.asks.length);
    Assert.areEqual(1, reply.asks.length);
    Assert.isTrue(reply.texts.some(t => t.includes("\"yes\"")));
  }

  @TestMethod
  public async closesGrokWhenTheTurnItSaidItWouldStartDoesNotStartInTime(): Promise<void> {
    await using host = new GrokTestHost();
    const timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, 100, host.timings.killWait, 100, 1, 10, 50);
    const listener = new RecordingTurnListener();

    await host.createAdapter(host.environment, host.command, host.terminator, timings).runTurn(host.request("background"), listener, new AbortController().signal);
    AcpTasksTests.endTask(host, { woken: false });
    await host.programs.endedAt(1);

    Assert.areEqual(1, listener.taskEnds.length);
    Assert.areEqual(0, listener.wakes.length);
  }

  @TestMethod
  @TestData(false, BackgroundTaskStatus.Completed)
  @TestData(true, BackgroundTaskStatus.Ended)
  public async keepsFollowingTheTaskAfterAStoppedTurnUnlessGrokHadToBeStopped(ignore: boolean, status: BackgroundTaskStatus): Promise<void> {
    await using host = new GrokTestHost();
    const answered = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 60_000, 100, 5000, 100, 1, 10);
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_IGNORE_CANCEL: ignore ? "1" : "0" }, host.command, host.terminator,
      ignore ? host.ignoredCancelTimings : answered);
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const run = adapter.runTurn(host.request("background-held"), listener, controller.signal);
    await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
    const written = AcpTasksTests.writtenTree(host).length;
    controller.abort();
    const result = await run;
    const ended = listener.taskEnds.length;
    AcpTasksTests.endTask(host, { willWake: false });
    await host.programs.endedAt(1);
    await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

    Assert.areEqual(2, written);
    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.areEqual(ignore ? 1 : 0, ended);
    Assert.areEqual(JSON.stringify([status]), JSON.stringify(listener.taskEnds.map(t => t.status)));
  }

  @TestMethod
  public async endsTheTasksProcessTreeBeforeShowingItEndedWhenGrokHadToBeStopped(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_IGNORE_CANCEL: "1" }, host.command, host.terminator, host.ignoredCancelTimings,
      new NodeProcessStarter(host.terminator), host.realTree(undefined, host.ignoredCancelTimings));
    const controller = new AbortController();
    const listener = new TreeWatchingListener();

    const run = adapter.runTurn(host.request("background-held"), listener, controller.signal);
    await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
    listener.tree = await AcpTasksTests.tree(host);
    controller.abort();
    await run;

    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Ended]), JSON.stringify(listener.taskEnds.map(t => t.status)));
    Assert.areEqual(JSON.stringify([0]), JSON.stringify(listener.runningAtEnd));
  }

  @TestMethod
  public async endsTheTasksProcessTreeBeforeShowingItEndedWhenGrokExitsByItself(): Promise<void> {
    await using host = new GrokTestHost();
    const starter = new NodeProcessStarter(host.terminator);
    const listener = new TreeWatchingListener();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_TASK_OUTLIVES: "1" }, host.command, host.terminator, host.timings, starter,
      new ProcessTree(process.platform, new CommandRunner(starter), process.env, Resources.processListTimeout, new TreeEndTimer(listener), host.timings.stopGrace));

    await adapter.runTurn(host.request("background"), listener, new AbortController().signal);
    listener.tree = await AcpTasksTests.tree(host);
    try {
      AcpTasksTests.endTask(host, { exit: true });
      await host.programs.endedAt(1);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Ended]), JSON.stringify(listener.taskEnds.map(t => t.status)));
      Assert.areEqual(JSON.stringify([0]), JSON.stringify(listener.runningAtEnd));
    }
    finally {
      const home = host.directory.resolve("person");
      for (const tree of readdirSync(home).filter(t => t.startsWith("task-tree-")))
        FakeTaskTree.endAll(join(home, tree));
    }
  }

  @TestMethod
  public async endsAProcessGrokStartsAsItClosesOnceGrokHasExited(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_CLOSE_CHILD: "1" }, host.command, host.terminator, host.closingTimings,
      new NodeProcessStarter(host.terminator), host.realTree(undefined, host.closingTimings));

    const result = await adapter.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal);
    await host.programs.endedAt(1);
    await adapter.shutdown();
    const child = Number(readFileSync(join(host.directory.resolve("person"), "close-child.txt"), "utf8"));
    try {
      await Wait.until(() => !TreeWatchingListener.runs(child), "The child process still ran.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
    }
    finally {
      FakeTaskTree.endAll(join(host.directory.resolve("person"), "close-child-tree.txt"));
    }
  }

  @TestMethod
  public async showsATaskStoppedWhoseStopFindsItsProcessGoneOnceTeamRunIsStoppingGrok(): Promise<void> {
    await using host = new GrokTestHost();
    const ended = Promise.withResolvers<boolean>();
    const processTree: IProcessTree = {
      endTree: () => ended.promise,
      endOwnTree: () => Promise.resolve(true),
      endDescendants: () => {
        ended.resolve(false);
        return Promise.resolve();
      },
      endLeftovers: () => Promise.resolve()
    };
    const listener = new RecordingTurnListener();
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, host.timings, new NodeProcessStarter(host.terminator), processTree);

    await adapter.runTurn(host.request("background"), listener, new AbortController().signal);
    await AcpTasksTests.tree(host);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([["TASK", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
  }

  @TestMethod
  public async runsANewTurnOnANewGrokWhileTheFirstFollowsItsTaskAndClosesEachWhenItIsDone(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpTasksTests.adapter(host);
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();

    const started = await adapter.runTurn(host.request("background"), first, new AbortController().signal);
    const next = await adapter.runTurn(host.request("complete", started.nativeSessionId), second, new AbortController().signal);
    await host.programs.endedAt(1);
    const during = JSON.stringify([host.programs.started.length, host.programs.ended.length, first.taskEnds.length]);
    AcpTasksTests.endTask(host, { willWake: false });
    await host.programs.endedAt(2);

    Assert.areEqual(TurnOutcome.Completed, next.outcome);
    Assert.areEqual(JSON.stringify([2, 1, 0]), during);
    Assert.areEqual(JSON.stringify(host.programs.started.map(t => t.processId).reverse()), JSON.stringify(host.programs.ended));
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Completed]), JSON.stringify(first.taskEnds.map(t => t.status)));
    Assert.areEqual(0, second.taskStarts.length);
  }

  @TestMethod
  public async resumesTheSessionOnTheNewerKeptGrokAndClosesTheOlderOnceItsTaskEnds(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpTasksTests.adapter(host, host.idleTimer);

    const started = await adapter.runTurn(host.request("background"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.runTurn(host.request("complete", started.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);
    const older = host.programs.started.slice(0, 1).map(t => t.processId);
    AcpTasksTests.endTask(host, { willWake: false });
    await host.programs.endedAt(1);
    const third = await adapter.runTurn(host.request("complete", started.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, 2, older]), JSON.stringify([third.outcome, host.programs.started.length, host.programs.ended]));
  }

  @TestMethod
  public async closesADeletedChatsIdleGrokNowItsBusyGrokOnceItsTaskEndsAndItsRunningGrokOnceItsTurnEnds(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpTasksTests.adapter(host, host.idleTimer);
    const listener = new RecordingTurnListener();
    const groks = (): number[] => host.programs.started.filter(t => t.arguments.some(a => a.endsWith("fake-acp-agent.fixture.js"))).map(t => t.processId);
    const turn = async (prompt: string, resume: string | null = null): Promise<readonly [number, TurnResult]> => {
      const before = groks().length;
      const result = await adapter.runTurn(host.request(prompt, resume), new RecordingTurnListener(), new AbortController().signal);
      return [groks()[before] ?? 0, result];
    };
    const closed = (processId: number): boolean => host.programs.ended.includes(processId);

    const [idleGrok, idle] = await turn("complete");
    const [busyGrok, busy] = await turn("background");
    const [otherGrok] = await turn("complete", "other-session");
    const before = groks().length;
    const running = adapter.runTurn(host.request("released"), listener, new AbortController().signal);
    await Wait.until(() => listener.starts.length === 1, "The running turn did not start.");
    const runningGrok = groks()[before] ?? 0;
    await adapter.closeSessions([String(idle.nativeSessionId), String(busy.nativeSessionId), String(listener.starts[0]?.nativeSessionId), "missing"]);
    await Wait.until(() => closed(idleGrok), "The deleted chat's idle Grok did not close.");
    const whileWorking = [closed(busyGrok), closed(runningGrok)];
    AcpTasksTests.endTask(host, { willWake: false });
    await Wait.until(() => closed(busyGrok), "The deleted chat's busy Grok did not close once its task ended.");
    writeFileSync(host.directory.resolve("person", "prompt-released.txt"), "");
    const result = await running;
    await Wait.until(() => closed(runningGrok), "The deleted chat's running Grok did not close once its turn ended.");

    Assert.areEqual(JSON.stringify([[false, false], false, TurnOutcome.Completed]), JSON.stringify([whileWorking, closed(otherGrok), result.outcome]));
  }

  @TestMethod
  public async retiresTheOlderKeptGrokWhenATurnOnItsOwnGrokFailsAndResumesTheSessionOnANewOne(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpTasksTests.adapter(host, host.idleTimer);

    const started = await adapter.runTurn(host.request("background"), new RecordingTurnListener(), new AbortController().signal);
    const failed = await adapter.runTurn(host.request("reject", started.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);
    AcpTasksTests.endTask(host, { willWake: false });
    await host.programs.endedAt(2);
    const third = await adapter.runTurn(host.request("complete", started.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Failed, TurnOutcome.Completed, 3]), JSON.stringify([failed.outcome, third.outcome, host.programs.started.length]));
  }

  @TestMethod
  public async keepsFollowingTheTaskOfATurnWhoseFirstGrokExitedDuringTheResume(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    const result = await AcpTasksTests.adapter(host).runTurn(host.request("background", "crash", null, null, "background"), listener, new AbortController().signal);
    const during = JSON.stringify([listener.taskStarts.length, listener.taskEnds.length, host.programs.ended.length]);
    AcpTasksTests.endTask(host, { willWake: false });
    await host.programs.endedAt(2);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([1, 0, 1]), during);
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Completed]), JSON.stringify(listener.taskEnds.map(t => t.status)));
  }

  @TestMethod
  public async endsTheRunningTaskWhenGrokExits(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    await AcpTasksTests.adapter(host).runTurn(host.request("background"), listener, new AbortController().signal);
    AcpTasksTests.endTask(host, { exit: true });
    await host.programs.endedAt(1);
    await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

    Assert.areEqual(JSON.stringify([["TASK", BackgroundTaskStatus.Ended, null]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status, t.exitCode])));
  }

  @TestMethod
  public async stopsTheTaskAndEndsTheTurnsGrokStartsOrWillStartWhenTheAdapterShutsDown(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpTasksTests.adapter(host);
    const running = new RecordingTurnListener();
    await adapter.runTurn(host.request("background"), running, new AbortController().signal);
    const tree = await AcpTasksTests.tree(host);
    await adapter.shutdown();
    await Wait.until(() => tree.every(t => !AcpTasksTests.runs(t)), `On shutdown, the task's tree ${tree.join(", ")} still ran.`, Resources.processListTimeout + host.timings.killWait);
    await using expectingHost = new GrokTestHost();
    const expecting = new RecordingTurnListener();
    const expectingAdapter = AcpTasksTests.adapter(expectingHost);
    await expectingAdapter.runTurn(expectingHost.request("background"), expecting, new AbortController().signal);
    AcpTasksTests.endTask(expectingHost, { woken: false });
    await Wait.until(() => expecting.taskEnds.length === 1, "The expecting listener did not see a task end.");
    await expectingAdapter.shutdown();
    await using wakingHost = new GrokTestHost();
    const waking = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    waking.wakeTurn = new WakeTurn({});
    const woken = waking.wakeTurn.follow(reply, new AbortController().signal);
    const wakingAdapter = AcpTasksTests.adapter(wakingHost);
    await wakingAdapter.runTurn(wakingHost.request("background"), waking, new AbortController().signal);
    AcpTasksTests.endTask(wakingHost, { wakeReason: "hold" });
    await Wait.until(() => reply.texts.some(t => t.includes("finished")), "The reply listener did not see a text with 'finished'.");
    await wakingAdapter.shutdown();

    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Stopped]), JSON.stringify(running.taskEnds.map(t => t.status)));
    Assert.areEqual(0, expecting.wakes.length);
    Assert.areEqual(1, expectingHost.programs.ended.length);
    Assert.areEqual(TurnOutcome.Interrupted, (await woken).outcome);
  }

  @TestMethod
  public async endsTheTasksProcessTreeOnItsStopShowsItStoppedAndThenClosesGrok(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    await AcpTasksTests.adapter(host).runTurn(host.request("background"), listener, new AbortController().signal);
    const tree = await AcpTasksTests.tree(host);
    const running = tree.every(t => AcpTasksTests.runs(t));
    await listener.taskStarts[0]?.stop();
    await host.programs.endedAt(1);
    await Wait.until(() => tree.every(t => !AcpTasksTests.runs(t)), `On the task's stop, its tree ${tree.join(", ")} still ran.`, Resources.processListTimeout + host.timings.killWait);

    Assert.isTrue(running);
    Assert.areEqual(JSON.stringify([["TASK", BackgroundTaskStatus.Stopped, null]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status, t.exitCode])));
    Assert.areEqual(1, listener.wakes.length);
  }

  @TestMethod
  public async refusesToStopATaskWhoseProcessNoLongerRunsUnderGrokAndEndsNothing(): Promise<void> {
    await using host = new GrokTestHost();
    const checked: number[][] = [];
    const processTree: IProcessTree = {
      endTree: (processId, startedBy, ancestorId) => { checked.push([processId, startedBy, ancestorId]); return Promise.resolve(false); },
      endOwnTree: () => Promise.resolve(true),
      endDescendants: () => Promise.resolve(),
      endLeftovers: () => Promise.resolve()
    };
    const listener = new RecordingTurnListener();
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, host.timings, new NodeProcessStarter(host.terminator), processTree);

    const before = Date.now();
    await adapter.runTurn(host.request("background"), listener, new AbortController().signal);
    const after = Date.now();
    const [task] = await AcpTasksTests.tree(host);
    if (task === undefined)
      throw new Error("Grok's task wrote no process tree.");
    const stop = await listener.taskStarts[0]?.stop().then(() => null, (error: unknown) => error instanceof TaskException ? error.message : String(error));
    const [, checkedStart = -1, checkedAncestor] = checked[0] ?? [];

    Assert.areEqual("TeamRun couldn't confirm that this task's process still runs under Grok, so it stopped nothing.", stop);
    Assert.areEqual(JSON.stringify([task]), JSON.stringify(checked.map(t => t[0])));
    Assert.isTrue(checkedStart >= before && checkedStart <= after);
    Assert.isTrue(host.programs.started.some(t => t.processId === checkedAncestor));
    Assert.areEqual(0, listener.taskEnds.length);
    Assert.isTrue(AcpTasksTests.runs(task));
  }

  @TestMethod
  public async shutsDownWithinTheInterruptTimeoutAndTheKillWaitWhenATasksStopAndEndingWhatGrokStartedDoNotEndAndShowsTheTaskStopped(): Promise<void> {
    await using host = new GrokTestHost();
    const swept: string[] = [];
    const processTree: IProcessTree = {
      endTree: () => new Promise<boolean>(() => undefined),
      endOwnTree: () => Promise.resolve(true),
      endDescendants: () => { swept.push("descendants"); return new Promise<void>(() => undefined); },
      endLeftovers: () => { swept.push("leftovers"); return new Promise<void>(() => undefined); }
    };
    const listener = new RecordingTurnListener();
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, 150, 1, 100, 1, 10),
      new NodeProcessStarter(host.terminator), processTree, new HeldDelayTimer(150));

    await adapter.runTurn(host.request("background"), listener, new AbortController().signal);
    await AcpTasksTests.tree(host);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([["TASK", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(JSON.stringify(["descendants", "leftovers"]), JSON.stringify(swept));
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async listsNoProcessesWhenItStopsAGrokThatSentNoPromptAsASignInCheckOrAModelListDoesButDoesForATurn(): Promise<void> {
    await using host = new GrokTestHost();
    const swept: string[] = [];
    const processTree: IProcessTree = {
      endTree: () => Promise.resolve(true),
      endOwnTree: () => Promise.resolve(true),
      endDescendants: () => { swept.push("descendants"); return Promise.resolve(); },
      endLeftovers: () => { swept.push("leftovers"); return Promise.resolve(); }
    };
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, host.timings, new NodeProcessStarter(host.terminator), processTree);
    const provider = new Provider("g1", "grok", "Work", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");

    await adapter.checkSignIn(provider);
    await adapter.listModels(provider);
    const before = [...swept];
    await adapter.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal);
    await Wait.until(() => swept.length === 2, "Grok's processes were not swept once it closed.");

    Assert.areEqual(JSON.stringify([]), JSON.stringify(before));
    Assert.areEqual(JSON.stringify(["descendants", "leftovers"]), JSON.stringify(swept));
  }

  @TestMethod
  public async endsWhatGrokStartedWhenATurnThatOpenedItsSessionWithMcpServersIsStoppedBeforeItsPrompt(): Promise<void> {
    await using host = new GrokTestHost();
    const swept: string[] = [];
    const processTree: IProcessTree = {
      endTree: () => Promise.resolve(true),
      endOwnTree: () => Promise.resolve(true),
      endDescendants: () => { swept.push("descendants"); return Promise.resolve(); },
      endLeftovers: () => { swept.push("leftovers"); return Promise.resolve(); }
    };
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: false }, mcpCapabilities: { http: true, sse: true } } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) }, host.command, host.terminator, host.timings,
      new NodeProcessStarter(host.terminator), processTree);
    const tokens = new SessionTokens();
    tokens.open("turn", "c1/t1");
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [],
      new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "turn"));

    const stop = new AbortController();

    const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("grok", null, null), null, [], null, null, {},
      false, tools), new RecordingTurnListener(), stop.signal);
    await Wait.until(() => host.timer.requested.includes(Resources.teamRunToolsWait), "The adapter did not wait for the TeamRun tools.");
    stop.abort();
    const result = await running;
    const servers = readFileSync(join(host.directory.resolve("person"), "mcp-servers.txt"), "utf8");

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isTrue(servers.includes("http://127.0.0.1:4711/mcp"));
    Assert.areEqual(JSON.stringify(["descendants", "leftovers"]), JSON.stringify(swept));
  }

  @TestMethod
  public async stopsGrokAndShowsTheTaskStoppedWhenWhatGrokStartedCannotBeListed(): Promise<void> {
    await using host = new GrokTestHost();
    const swept: number[] = [];
    const processTree: IProcessTree = {
      endTree: () => new Promise<boolean>(() => undefined),
      endOwnTree: () => Promise.resolve(true),
      endDescendants: processId => { swept.push(processId); return Promise.reject(new Error("The listing failed.")); },
      endLeftovers: processId => { swept.push(processId); return Promise.reject(new Error("The listing failed.")); }
    };
    const listener = new RecordingTurnListener();
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, host.timings, new NodeProcessStarter(host.terminator), processTree);

    await adapter.runTurn(host.request("background"), listener, new AbortController().signal);
    await AcpTasksTests.tree(host);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([["TASK", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    const [agent] = host.programs.started;
    Assert.isDefined(agent);
    Assert.areEqual(JSON.stringify([agent.processId, agent.processId]), JSON.stringify(swept));
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  private static async startedAsync(tasks: AcpTasks, toolCallId: string, rawOutput: JsonObject): Promise<void> {
    await tasks.handleAsync("session/update", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "tool_call_update", toolCallId, status: "completed", rawOutput } }));
  }

  private static async startAsync(tasks: AcpTasks, taskId: string, toolCallId: string | null): Promise<void> {
    await tasks.handleAsync("x.ai/task_backgrounded", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "task_backgrounded", task_id: taskId,
      command: "npm start", ...Object.isNull(toolCallId) ? {} : { tool_call_id: toolCallId } } }));
  }

  private static async completeAsync(tasks: AcpTasks, snapshot: JsonObject, willWake: boolean | null = null): Promise<void> {
    await tasks.handleAsync("_x.ai/task_completed", JsonReader.fromValue({ sessionId: "s", update: { sessionUpdate: "task_completed", task_snapshot: snapshot,
      ...Object.isNull(willWake) ? {} : { will_wake: willWake } } }));
  }

  private static adapter(host: GrokTestHost, idleTimer: ITimer = host.elapsedIdleTimer): GrokAdapter {
    return host.createAdapter(host.environment, host.command, host.terminator, host.timings, new NodeProcessStarter(host.terminator),
      new ProcessTree(process.platform, new CommandRunner(new NodeProcessStarter(host.terminator)), process.env, Resources.processListTimeout, host.timer,
      host.timings.stopGrace), host.timer, null, idleTimer);
  }

  private static async tree(host: GrokTestHost): Promise<number[]> {
    await Wait.until(() => AcpTasksTests.writtenTree(host).length === 2, "The task tree did not get both processes.");
    return AcpTasksTests.writtenTree(host);
  }

  private static writtenTree(host: GrokTestHost): number[] {
    const home = host.directory.resolve("person");
    return existsSync(home) ? readdirSync(home).filter(t => t.startsWith("task-tree-")).flatMap(t => FakeTaskTree.read(join(home, t))) : [];
  }

  private static runs(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  private static endTask(host: GrokTestHost, end: object): void {
    const home = host.directory.resolve("person");
    writeFileSync(join(home, "task-end.json"), JSON.stringify(end));
    renameSync(join(home, "task-end.json"), join(home, "task-end.txt"));
  }
}
