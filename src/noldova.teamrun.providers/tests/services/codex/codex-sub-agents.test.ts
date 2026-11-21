/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { existsSync, writeFileSync } from "node:fs";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { SessionTokens, TurnOutcome, TurnRequest, TurnTools, WakeTurn } from "@noldova/teamrun.core";
import { ApprovalKind, BackgroundTaskStatus, DetailKind, ErrorCode, ObservedSettings, QuestionAnswer, RequestedSettings, SenderEnvironment,
  SubAgentStatus } from "@noldova/teamrun.protocol";
import { type AppServerClient, CodexItemReader, CodexSubAgents, CodexTurn, DeltaStream, type IOrphanSweep, Resources, UnsupportedServerRequestException }
  from "@noldova/teamrun.providers";

import { CodexSubAgentRecording } from "../../fixtures/codex-sub-agent.recording.js";
import { CodexSubAgentV2Recording } from "../../fixtures/codex-sub-agent-v2.recording.js";
import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingMcpEndpoint } from "../../fixtures/recording-mcp-endpoint.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class CodexSubAgentsTests {
  @TestMethod
  public async readsASpawnedSubAgentsTypeModelItemsToolUsesTokensTimeAndSummaryFromItsChildThreadAsATaskWithNoStopOfItsOwn(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.completed);
    const idleBeforeTheTurnEnds = agents.isIdle;
    agents.finishTurn();
    await agents.whenIdle();

    Assert.areEqual(JSON.stringify({ toolUseId: "call-spawn", type: null, description: "Read notes.txt and reply with its first line.", model: "gpt-5.4-mini",
      status: SubAgentStatus.Running, isBackground: true, toolUses: null, tokens: null, durationMs: null, summary: null }), JSON.stringify(CodexSubAgentsTests.rows(listener)[0]));
    Assert.areEqual(JSON.stringify({ toolUseId: "call-spawn", type: "explorer", description: "Read notes.txt and reply with its first line.", model: "gpt-5.4-mini",
      status: SubAgentStatus.Completed, isBackground: true, toolUses: 1, tokens: 1840, durationMs: 4200, summary: "notes.txt starts with: hello" }),
      JSON.stringify(CodexSubAgentsTests.rows(listener).at(-1)));
    Assert.areEqual("call-cat:call-spawn,call-cat:call-spawn,msg-1:call-spawn", listener.details.filter(t => t.kind !== DetailKind.SubAgent)
      .map(t => `${t.providerItemId}:${t.parentItemId}`).join(","));
    Assert.isTrue(listener.details.filter(t => t.kind === DetailKind.SubAgent).every(t => t.providerItemId === "call-spawn" && t.parentItemId === null));
    Assert.areEqual(DetailKind.Note, listener.details.find(t => t.providerItemId === "msg-1")?.kind);
    Assert.areEqual(JSON.stringify([["call-spawn", "Read notes.txt and reply with its first line.", "call-spawn", false]]),
      JSON.stringify(listener.taskStarts.map(t => [t.taskId, t.command, t.subAgentId, t.hasOwnStop])));
    Assert.areEqual(JSON.stringify([["call-spawn", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.isFalse(idleBeforeTheTurnEnds);
    Assert.isTrue(agents.isIdle);
  }

  @TestMethod
  public async failsASubAgentThatErrorsBeforeItsTurnOneWhoseTurnFailsAndOneWhoseSpawnFails(): Promise<void> {
    const outcomes = await Promise.all([CodexSubAgentRecording.errored, CodexSubAgentRecording.failedTurn, CodexSubAgentRecording.failedSpawn].map(async recording => {
      const listener = new RecordingTurnListener();
      await CodexSubAgentsTests.replayAsync(CodexSubAgentsTests.create(listener), recording);
      const row = CodexSubAgentsTests.rows(listener).at(-1)!;
      return [row["type"], row["model"], row["status"], row["durationMs"], row["summary"], listener.taskEnds.map(t => t.status).join()];
    }));

    Assert.areEqual(JSON.stringify([
      ["Ada", "gpt-5.4-mini", SubAgentStatus.Failed, null, "The model gpt-5.4-mini is unavailable.", ""],
      ["worker", "gpt-5.4-mini", SubAgentStatus.Failed, 900, "stream disconnected before completion", BackgroundTaskStatus.Failed],
      [null, "gpt-5.4-mini", SubAgentStatus.Failed, null, null, ""]
    ]), JSON.stringify(outcomes));
  }

  @TestMethod
  public async stopsASubAgentThroughTurnInterruptOnItsChildThreadThenEndsTheChildsBackgroundCommandsAndShowsItStopped(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const agents = CodexSubAgentsTests.create(listener, requests);
    const recording = CodexSubAgentRecording.interrupted;

    await CodexSubAgentsTests.replayAsync(agents, recording.slice(0, -1));
    const during = CodexSubAgentsTests.rows(listener).at(-1)!["status"];
    await listener.taskStarts[0]!.stop();
    await CodexSubAgentsTests.replayAsync(agents, recording.slice(-1));

    Assert.areEqual(SubAgentStatus.Running, during);
    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"child\",\"turnId\":\"child-turn\"}",
      "thread/backgroundTerminals/clean {\"threadId\":\"child\"}"]), JSON.stringify(requests));
    Assert.areEqual(JSON.stringify([SubAgentStatus.Stopped, 1500, null]),
      JSON.stringify(["status", "durationMs", "summary"].map(t => CodexSubAgentsTests.rows(listener).at(-1)![t])));
    Assert.areEqual(JSON.stringify([["call-spawn", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual("call-cat:call-spawn", listener.details.filter(t => t.kind !== DetailKind.SubAgent).map(t => `${t.providerItemId}:${t.parentItemId}`).join());
  }

  @TestMethod
  public async stopsEveryRunningSubAgentKeepsOneWhoseStopFailsRunningAndStillEndsItsBackgroundCommands(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const agents = CodexSubAgentsTests.create(listener, requests, true);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.interrupted.slice(0, -1));
    await agents.stopAll(Promise.resolve());

    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"child\",\"turnId\":\"child-turn\"}",
      "thread/backgroundTerminals/clean {\"threadId\":\"child\"}"]), JSON.stringify(requests));
    Assert.areEqual(SubAgentStatus.Running, CodexSubAgentsTests.rows(listener).at(-1)!["status"]);
    Assert.areEqual(0, listener.taskEnds.length);
  }

  @TestMethod
  public async endsTheBackgroundCommandsOfAChildWhoseTurnEndedTogetherWithARunningChildsAfterItsInterrupt(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const agents = CodexSubAgentsTests.create(listener, requests);

    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.spawn("item/completed", "call-done", "completed", ["done"]),
      CodexSubAgentsTests.thread("done", "parent", "worker"), CodexSubAgentsTests.turn("turn/started", "done", "done-turn"),
      CodexSubAgentsTests.turn("turn/completed", "done", "done-turn", "completed", 50), ...CodexSubAgentRecording.interrupted.slice(0, -1)]);
    await agents.stopAll(Promise.resolve());

    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"child\",\"turnId\":\"child-turn\"}", "thread/backgroundTerminals/clean {\"threadId\":\"done\"}",
      "thread/backgroundTerminals/clean {\"threadId\":\"child\"}"]), JSON.stringify(requests));
    Assert.areEqual(JSON.stringify([["call-done", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
  }

  @TestMethod
  public async sweepsNothingAndWaitsForNothingWhenAReplyWithNoChildStops(): Promise<void> {
    const requests: string[] = [];
    const swept: number[] = [];
    const sweep: IOrphanSweep = { endOrphaned: id => { swept.push(id); return Promise.resolve([]); } };
    const agents = CodexSubAgentsTests.sweeping(new RecordingTurnListener(), requests, { processId: 4242, timeouts: [] }, "linux", sweep);

    await agents.stopAll(Promise.withResolvers<void>().promise);

    Assert.isFalse(agents.isStopping);
    Assert.areEqual(0, swept.length);
    Assert.areEqual(0, requests.length);
  }

  @TestMethod
  public async sweepsOnceOnLinuxForEveryChildTheRepliesStopEndsUnderTheirThreadsOnceTheMainInterruptHasSettled(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const log = new RecordingLog();
    const swept: JsonValue[] = [];
    const sweep: IOrphanSweep = { endOrphaned: async (processId, _isRunning, threadIds, stop) => { swept.push([processId, [...threadIds]]); await stop(); return [7001, 7002]; } };
    const agents = CodexSubAgentsTests.sweeping(listener, requests, { processId: 4242, timeouts: [] }, "linux", sweep, log);
    const main = Promise.withResolvers<undefined>();

    await CodexSubAgentsTests.replayAsync(agents, ["one", "two"].flatMap(t => [CodexSubAgentsTests.spawn("item/completed", `call-${t}`, "completed", [t]),
      CodexSubAgentsTests.thread(t, "parent", "worker"), CodexSubAgentsTests.turn("turn/started", t, `${t}-turn`)]));
    const stopping = agents.stopAll(main.promise);
    await new Promise(resolve => setImmediate(resolve));
    const beforeMain = [...requests];
    main.resolve(undefined);
    await stopping;

    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"one\",\"turnId\":\"one-turn\"}", "turn/interrupt {\"threadId\":\"two\",\"turnId\":\"two-turn\"}"]),
      JSON.stringify(beforeMain));
    Assert.areEqual(JSON.stringify([...beforeMain, "thread/backgroundTerminals/clean {\"threadId\":\"one\"}", "thread/backgroundTerminals/clean {\"threadId\":\"two\"}"]),
      JSON.stringify(requests));
    Assert.areEqual(JSON.stringify([[4242, ["one", "two"]]]), JSON.stringify(swept));
    Assert.areEqual(JSON.stringify([Resources.formatCodexOrphansEnded("one, two", [7001, 7002])]), JSON.stringify(log.lines));
  }

  @TestMethod
  public async endsOnLinuxWhatTheCleanLeftRunningOutsideTheAppServerUnderTheThreadAndLogsItAndAsksWhetherTheServerStillRuns(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const log = new RecordingLog();
    const swept: JsonValue[] = [];
    const server: { processId: number | null; timeouts: number[] } = { processId: 4242, timeouts: [] };
    let running: () => boolean = () => false;
    const sweep: IOrphanSweep = { endOrphaned: async (processId, isRunning, threadIds, stop) => {
      swept.push([processId, [...threadIds]]);
      running = isRunning;
      await stop();
      return [7001, 7002];
    } };
    const agents = CodexSubAgentsTests.sweeping(listener, requests, server, "linux", sweep, log);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.interrupted.slice(0, -1));
    await listener.taskStarts[0]!.stop();
    const before = running();
    server.processId = null;

    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"child\",\"turnId\":\"child-turn\"}", "thread/backgroundTerminals/clean {\"threadId\":\"child\"}"]),
      JSON.stringify(requests));
    Assert.areEqual(JSON.stringify([[4242, ["child"]]]), JSON.stringify(swept));
    Assert.areEqual(JSON.stringify([Resources.formatCodexOrphansEnded("child", [7001, 7002])]), JSON.stringify(log.lines));
    Assert.areEqual(JSON.stringify([true, false]), JSON.stringify([before, running()]));
  }

  @TestMethod
  @TestData("darwin", 4242)
  @TestData("linux", null)
  public async cleansWithoutASweepOffLinuxOrWithoutTheAppServersProcess(platform: string, processId: number | null): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const swept: number[] = [];
    const sweep: IOrphanSweep = { endOrphaned: id => { swept.push(id); return Promise.resolve([]); } };
    const agents = CodexSubAgentsTests.sweeping(listener, requests, { processId, timeouts: [] }, platform, sweep);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.interrupted.slice(0, -1));
    await listener.taskStarts[0]!.stop();

    Assert.areEqual(JSON.stringify(["turn/interrupt", "thread/backgroundTerminals/clean"]), JSON.stringify(requests.map(t => t.split(" ")[0])));
    Assert.areEqual(0, swept.length);
  }

  @TestMethod
  @TestData(0)
  @TestData(1)
  @TestData(2)
  public async logsNothingWhenTheSweepEndsNothingFailsOrHasNoLog(scenario: number): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const log = new RecordingLog();
    const sweep: IOrphanSweep = { endOrphaned: () => [() => Promise.resolve([]), () => Promise.reject(new Error("The sweep failed.")), () => Promise.resolve([7001])][scenario]!() };
    const agents = CodexSubAgentsTests.sweeping(listener, requests, { processId: 4242, timeouts: [] }, "linux", sweep, scenario === 2 ? null : log);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.interrupted.slice(0, -1));
    await listener.taskStarts[0]!.stop();

    Assert.areEqual(0, log.lines.length);
    Assert.isFalse(agents.isStopping);
  }

  @TestMethod
  public async aSecondStopAllWithNothingLeftToCleanWaitsForTheFirstSweepAndSaysItIsStoppingUntilThen(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const held = Promise.withResolvers<readonly number[]>();
    const sweep: IOrphanSweep = { endOrphaned: async (_processId, _isRunning, threadIds, stop) => {
      await stop();
      return threadIds.length === 0 ? [] : held.promise;
    } };
    const agents = CodexSubAgentsTests.sweeping(listener, requests, { processId: 4242, timeouts: [] }, "linux", sweep);
    let returned = false;

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.interrupted.slice(0, -1));
    const first = agents.stopAll(Promise.resolve());
    await new Promise(resolve => setImmediate(resolve));
    const second = agents.stopAll(Promise.resolve()).then(() => { returned = true; });
    const stopped = agents.whenStopped();
    await new Promise(resolve => setImmediate(resolve));
    const whileSweeping = [returned, agents.isStopping];
    held.resolve([]);
    await Promise.all([first, second, stopped]);

    Assert.areEqual(JSON.stringify([false, true]), JSON.stringify(whileSweeping));
    Assert.isFalse(agents.isStopping);
  }

  @TestMethod
  public async boundsAStopAllsInterruptsAndCleansByTheTimeItIsGiven(): Promise<void> {
    const listener = new RecordingTurnListener();
    const server = { processId: 4242, timeouts: [] as number[] };
    const sweep: IOrphanSweep = { endOrphaned: async (_processId, _isRunning, _threadIds, stop) => { await stop(); return []; } };
    const agents = CodexSubAgentsTests.sweeping(listener, [], server, "linux", sweep);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.interrupted.slice(0, -1));
    await agents.stopAll(Promise.resolve(), 7);

    Assert.areEqual("7,7", server.timeouts.join(","));
  }

  @TestMethod
  public async endsTheRunningSubAgentsAsStoppedWhenTheAppServerExitsAndIgnoresWhatFollows(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.interrupted.slice(0, -1));
    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.spawn("item/completed", "call-other", "failed", [], " ")]);
    await agents.handleExitAsync();
    const shown = listener.details.length;
    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.interrupted.slice(-1));
    await agents.whenIdle();

    Assert.areEqual(JSON.stringify(["Read notes.txt and reply with its first line.:Stopped", "Sub-agent:Failed"]),
      JSON.stringify([...new Map(CodexSubAgentsTests.rows(listener).map(t => [t["toolUseId"], `${t["description"]}:${t["status"]}`])).values()]));
    Assert.areEqual(JSON.stringify([["call-spawn", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(shown, listener.details.length);
    Assert.isTrue(agents.isIdle);
  }

  @TestMethod
  public async linksEachChildToTheSpawnThatNamesItAndHoldsItsEarlierEventsUntilThen(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);

    await CodexSubAgentsTests.replayAsync(agents, [
      CodexSubAgentsTests.spawn("item/started", "call-a", "inProgress", []),
      CodexSubAgentsTests.spawn("item/started", "call-b", "inProgress", []),
      CodexSubAgentsTests.thread("child-b", "parent", "reviewer"),
      CodexSubAgentsTests.thread("child-a", "parent", "explorer"),
      CodexSubAgentsTests.turn("turn/started", "child-b", "turn-b"),
      CodexSubAgentsTests.spawn("item/completed", "call-a", "completed", ["child-a"]),
      CodexSubAgentsTests.spawn("item/completed", "call-b", "completed", ["child-b"]),
      CodexSubAgentsTests.turn("turn/started", "child-a", "turn-a")
    ]);

    Assert.areEqual("call-b,call-a", listener.taskStarts.map(t => t.taskId).join());
    Assert.areEqual(JSON.stringify({ "call-a": ["explorer", "Running"], "call-b": ["reviewer", "Running"] }),
      JSON.stringify(Object.fromEntries(CodexSubAgentsTests.rows(listener).map(t => [t["toolUseId"], [t["type"], t["status"]]]))));
  }

  @TestMethod
  public async runsASubAgentAgainForItsNextTurnAndAddsItsTimeWhileIgnoringWhatIsNotItsOwn(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);

    await CodexSubAgentsTests.replayAsync(agents, [
      ...CodexSubAgentRecording.completed,
      CodexSubAgentsTests.turn("turn/started", "child", "turn-2"),
      CodexSubAgentsTests.turn("turn/started", "child", "turn-2"),
      { method: "item/started", params: { threadId: "child", turnId: "turn-2", item: { type: "agentMessage", id: "msg-2", text: "" } } },
      { method: "item/completed", params: { threadId: "child", turnId: "turn-2", item: { type: "userMessage", id: "user-2", content: [] } } },
      { method: "item/agentMessage/delta", params: { threadId: "child", turnId: "turn-2", itemId: "msg-2", delta: "again" } },
      CodexSubAgentsTests.turn("turn/completed", "child", "turn-2", "completed", 300),
      CodexSubAgentsTests.turn("turn/started", "child", "turn-3"),
      CodexSubAgentsTests.turn("turn/completed", "child", "turn-3", "completed", null),
      { method: "account/rateLimits/updated", params: { rateLimits: { limitId: "codex" } } },
      CodexSubAgentsTests.thread("grandchild", "child", "worker"),
      CodexSubAgentsTests.turn("turn/started", "grandchild", "turn-g"),
      { method: "item/completed", params: { threadId: "parent", turnId: "parent-turn", item: { type: "agentMessage", id: "said", text: "Done." } } },
      { method: "item/completed", params: { threadId: "parent", turnId: "parent-turn", item: { type: "collabAgentToolCall", id: "call-wait-2", tool: "wait",
        status: "completed", senderThreadId: "parent", receiverThreadIds: ["ghost"], prompt: null, model: null, reasoningEffort: null,
        agentsStates: { ghost: { status: "completed", message: "Not ours." } } } } },
      { method: "item/started", params: { threadId: "parent", turnId: "parent-turn", item: { type: "collabAgentToolCall", id: "call-list", tool: "listAgents",
        status: "inProgress", senderThreadId: "parent" } } },
      CodexSubAgentsTests.turn("turn/completed", "parent", "parent-turn", "completed", 9000)
    ]);

    Assert.areEqual(JSON.stringify([SubAgentStatus.Completed, 4500, "notes.txt starts with: hello"]),
      JSON.stringify(["status", "durationMs", "summary"].map(t => CodexSubAgentsTests.rows(listener).at(-1)![t])));
    Assert.areEqual(JSON.stringify(["call-spawn", "call-spawn", "call-spawn"]), JSON.stringify(listener.taskStarts.map(t => t.taskId)));
    Assert.areEqual(JSON.stringify([BackgroundTaskStatus.Completed, BackgroundTaskStatus.Completed, BackgroundTaskStatus.Completed]),
      JSON.stringify(listener.taskEnds.map(t => t.status)));
    Assert.isTrue(listener.details.every(t => ["call-spawn", "call-cat", "msg-1"].includes(t.providerItemId ?? "")));
  }

  @TestMethod
  public async keepsAFailedSubAgentFailedWhenItsChildsTurnEndsAfterTheParentReportedTheError(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);

    await CodexSubAgentsTests.replayAsync(agents, [...CodexSubAgentRecording.errored, CodexSubAgentsTests.turn("turn/completed", "child", "late", "completed", 50)]);

    Assert.areEqual(JSON.stringify([SubAgentStatus.Failed, null]), JSON.stringify(["status", "durationMs"].map(t => CodexSubAgentsTests.rows(listener).at(-1)![t])));
  }

  @TestMethod
  public async endsASpawnThatEndsWithoutAChildStoppedWhenInterruptedAndFailedOtherwise(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);
    const unnamed = { method: "item/completed", params: { threadId: "parent", turnId: "parent-turn", item: { type: "collabAgentToolCall", id: "call-unnamed",
      tool: "spawnAgent", status: "completed", senderThreadId: "parent", prompt: "Task for call-unnamed.", model: null, reasoningEffort: null, agentsStates: {} } } };

    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.spawn("item/started", "call-stopped", "inProgress", []),
      CodexSubAgentsTests.spawn("item/completed", "call-stopped", "interrupted", []), unnamed]);
    agents.finishTurn();

    Assert.areEqual(JSON.stringify([SubAgentStatus.Stopped, SubAgentStatus.Failed]),
      JSON.stringify(["call-stopped", "call-unnamed"].map(id => CodexSubAgentsTests.rows(listener).filter(t => t["toolUseId"] === id).at(-1)!["status"])));
    Assert.isTrue(agents.isIdle);
    Assert.areEqual(0, listener.taskStarts.length);
  }

  @TestMethod
  public async stillCleansAChildStoppedBeforeItsFirstTurnWhenThatTurnsInterruptFails(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const agents = CodexSubAgentsTests.create(listener, requests, true);

    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.spawn("item/completed", "call-early", "completed", ["early"]),
      CodexSubAgentsTests.thread("early", "parent", "worker")]);
    await agents.stopAll(Promise.resolve());
    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.turn("turn/started", "early", "early-turn")]);
    await Wait.until(() => requests.length > 1, "Codex got only one request.");

    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"early\",\"turnId\":\"early-turn\"}",
      "thread/backgroundTerminals/clean {\"threadId\":\"early\"}"]), JSON.stringify(requests));
    Assert.areEqual(SubAgentStatus.Running, CodexSubAgentsTests.rows(listener).at(-1)!["status"]);
  }

  @TestMethod
  public async interruptsAChildStoppedBeforeItsFirstTurnAsSoonAsThatTurnStarts(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const agents = CodexSubAgentsTests.create(listener, requests);

    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.spawn("item/completed", "call-failed", "failed", []),
      CodexSubAgentsTests.spawn("item/completed", "call-early", "completed", ["early"]), CodexSubAgentsTests.thread("early", "parent", "worker")]);
    await agents.stopAll(Promise.resolve());
    const before = requests.length;
    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.turn("turn/started", "early", "early-turn"),
      CodexSubAgentsTests.turn("turn/completed", "early", "early-turn", "interrupted", 50), CodexSubAgentsTests.turn("turn/started", "early", "early-turn-2")]);

    await Wait.until(() => requests.length > 1, "Codex got only one request.");

    Assert.areEqual(0, before);
    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"early\",\"turnId\":\"early-turn\"}",
      "thread/backgroundTerminals/clean {\"threadId\":\"early\"}"]), JSON.stringify(requests));
    Assert.areEqual(JSON.stringify([["call-early", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual(SubAgentStatus.Running, CodexSubAgentsTests.rows(listener).at(-1)!["status"]);
  }

  @TestMethod
  public async dropsWhatAChildNoCallNamedSentOnceTheTurnEnds(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);

    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.thread("late", "parent", "worker"), CodexSubAgentsTests.turn("turn/started", "late", "late-turn")]);
    agents.finishTurn();
    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.spawn("item/completed", "call-late", "completed", ["late"])]);

    Assert.areEqual(SubAgentStatus.Running, CodexSubAgentsTests.rows(listener).at(-1)!["status"]);
    Assert.areEqual(0, listener.taskStarts.length);
  }

  @TestMethod
  public async followsAnEarlierTurnsChildThatThisTurnSendsMoreWorkAsItsOwnRow(): Promise<void> {
    const threads = new Map<string, JsonObject>();
    const listener = new RecordingTurnListener();
    await CodexSubAgentsTests.replayAsync(CodexSubAgentsTests.create(new RecordingTurnListener(), [], false, threads), CodexSubAgentRecording.completed);
    const agents = CodexSubAgentsTests.create(listener, [], false, threads);

    await CodexSubAgentsTests.replayAsync(agents, [
      CodexSubAgentsTests.spawn("item/started", "call-send", "inProgress", ["child"], "Read todo.txt too.", "sendInput"),
      CodexSubAgentsTests.spawn("item/completed", "call-send", "completed", ["child"], "Read todo.txt too.", "sendInput"),
      CodexSubAgentsTests.spawn("item/completed", "call-again", "completed", ["child"], "Again.", "followupTask"),
      CodexSubAgentsTests.spawn("item/completed", "call-ghost", "completed", ["ghost"], "Nobody.", "resumeAgent"),
      CodexSubAgentsTests.spawn("item/completed", "call-none", "completed", [], "No one.", "resumeAgent"),
      CodexSubAgentsTests.turn("turn/started", "child", "turn-2"),
      CodexSubAgentsTests.turn("turn/completed", "child", "turn-2", "completed", 700)
    ]);
    agents.finishTurn();

    Assert.areEqual(JSON.stringify(["call-send"]), JSON.stringify([...new Set(CodexSubAgentsTests.rows(listener).map(t => t["toolUseId"]))]));
    Assert.areEqual(JSON.stringify(["explorer", "Read todo.txt too.", SubAgentStatus.Completed, 700]),
      JSON.stringify(["type", "description", "status", "durationMs"].map(t => CodexSubAgentsTests.rows(listener).at(-1)![t])));
    Assert.areEqual(JSON.stringify(["call-send"]), JSON.stringify(listener.taskStarts.map(t => t.taskId)));
    Assert.isTrue(agents.isIdle);
  }

  @TestMethod
  public async followsAnEarlierRepliesSubAgentThatALaterReplySendsInputToAsARowOfThatReply(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const first = new RecordingTurnListener();
    try {
      const result = await adapter.runTurn(host.createRequest("subAgent"), first, new AbortController().signal);
      await first.taskStarts[0]!.stop();
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      const second = new RecordingTurnListener();
      const followed = await adapter.runTurn(new TurnRequest(null, host.directory.path, "subAgentFollowUp", new RequestedSettings("codex", null, null),
        result.nativeSessionId), second, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, followed.outcome);
      Assert.areEqual(JSON.stringify({ toolUseId: "call-send", type: "explorer", description: "Read todo.txt too.", model: "gpt-5.4-mini",
        status: SubAgentStatus.Completed, isBackground: true, toolUses: null, tokens: null, durationMs: 800, summary: "todo.txt is empty." }),
        JSON.stringify(CodexSubAgentsTests.rows(second).at(-1)));
      Assert.areEqual(JSON.stringify(["call-send"]), JSON.stringify(second.taskStarts.map(t => t.taskId)));
      Assert.areEqual("child-msg-2", second.details.filter(t => t.parentItemId === "call-send").map(t => t.providerItemId).join());
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsACodexSubAgentThatOutlivesTheReplyAndReleasesTheThreadOnceItsStopEndsIt(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    try {
      const result = await adapter.runTurn(host.createRequest("subAgent"), listener, new AbortController().signal);
      const during = CodexSubAgentsTests.rows(listener).at(-1)!["status"];
      await listener.taskStarts[0]!.stop();
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      host.idleTimer.advance(host.timings.idleLimit);
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), result.nativeSessionId), next,
        new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(SubAgentStatus.Running, during);
      Assert.areEqual(JSON.stringify(["explorer", SubAgentStatus.Stopped]), JSON.stringify(["type", "status"].map(t => CodexSubAgentsTests.rows(listener).at(-1)![t])));
      Assert.isFalse(listener.details.some(t => t.kind !== DetailKind.SubAgent && t.providerItemId === "call-spawn"));
      Assert.areEqual(JSON.stringify([result.nativeSessionId]), JSON.stringify(JSON.parse(next.details.find(t => t.kind === DetailKind.Text)!.text).unsubscribes));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async readsAMultiAgentV2SubAgentFromItsStartedActivityAndItsChildThread(): Promise<void> {
    const listener = new RecordingTurnListener();
    const threads = new Map<string, JsonObject>();
    const agents = CodexSubAgentsTests.create(listener, [], false, threads);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentV2Recording.completed);
    agents.finishTurn();

    Assert.areEqual(JSON.stringify({ toolUseId: "call-spawn", type: null, description: "read_notes", model: "gpt-5.4-mini", status: SubAgentStatus.Running,
      isBackground: true, toolUses: null, tokens: null, durationMs: null, summary: null }), JSON.stringify(CodexSubAgentsTests.rows(listener)[0]));
    Assert.areEqual(JSON.stringify({ toolUseId: "call-spawn", type: null, description: "read_notes", model: "gpt-5.4-mini", status: SubAgentStatus.Completed,
      isBackground: true, toolUses: 1, tokens: 1840, durationMs: 4200, summary: "notes.txt starts with: hello" }), JSON.stringify(CodexSubAgentsTests.rows(listener).at(-1)));
    Assert.areEqual(JSON.stringify(["call-spawn"]), JSON.stringify([...new Set(CodexSubAgentsTests.rows(listener).map(t => t["toolUseId"]))]));
    Assert.areEqual("call-cat:call-spawn,call-cat:call-spawn,msg-1:call-spawn", listener.details.filter(t => t.kind !== DetailKind.SubAgent)
      .map(t => `${t.providerItemId}:${t.parentItemId}`).join(","));
    Assert.areEqual(JSON.stringify([["call-spawn", "read_notes"]]), JSON.stringify(listener.taskStarts.map(t => [t.taskId, t.command])));
    Assert.areEqual(JSON.stringify([["call-spawn", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.areEqual("started", threads.get("child")?.["kind"]);
    Assert.isTrue(agents.isIdle);
  }

  @TestMethod
  public async stopsAMultiAgentV2SubAgentOnItsChildThreadAndFollowsItsNextTurnOnTheSameRow(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const agents = CodexSubAgentsTests.create(listener, requests);

    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentV2Recording.stopped.slice(0, 4));
    await listener.taskStarts[0]!.stop();
    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentV2Recording.stopped.slice(4));
    agents.finishTurn();

    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"child\",\"turnId\":\"child-turn\"}",
      "thread/backgroundTerminals/clean {\"threadId\":\"child\"}"]), JSON.stringify(requests));
    Assert.areEqual(JSON.stringify([["call-spawn", BackgroundTaskStatus.Stopped], ["call-spawn", BackgroundTaskStatus.Completed]]),
      JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.isTrue(CodexSubAgentsTests.rows(listener).some(t => t["status"] === SubAgentStatus.Stopped));
    Assert.areEqual(JSON.stringify(["call-spawn"]), JSON.stringify([...new Set(CodexSubAgentsTests.rows(listener).map(t => t["toolUseId"]))]));
    Assert.areEqual(JSON.stringify([SubAgentStatus.Completed, 1, 14_900, "notes.txt starts with: hello"]),
      JSON.stringify(["status", "toolUses", "durationMs", "summary"].map(t => CodexSubAgentsTests.rows(listener).at(-1)![t])));
    Assert.areEqual("call-cat-2:call-spawn,call-cat-2:call-spawn,msg-2:call-spawn", listener.details.filter(t => t.kind !== DetailKind.SubAgent)
      .map(t => `${t.providerItemId}:${t.parentItemId}`).join(","));
    Assert.isTrue(agents.isIdle);
  }

  @TestMethod
  public async startsAMultiAgentV2ChildsTurnThatStartedBeforeItsActivityNamedItOnceItDoes(): Promise<void> {
    const listener = new RecordingTurnListener();
    const requests: string[] = [];
    const agents = CodexSubAgentsTests.create(listener, requests);

    await CodexSubAgentsTests.replayAsync(agents, [
      CodexSubAgentsTests.turn("turn/started", "child", "child-turn"),
      { method: "account/updated", params: {} },
      { method: "item/started", params: { threadId: "stray", turnId: "stray-turn", item: { type: "agentMessage", id: "msg-stray", text: "" } } },
      CodexSubAgentsTests.activity("call-spawn", "started", "child", "/root/read_notes"),
      CodexSubAgentsTests.activity("call-stray", "started", "stray", "/root/stray")
    ]);
    agents.finishTurn();
    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.turn("turn/started", "late", "late-turn"),
      CodexSubAgentsTests.activity("call-late", "started", "late", "/root/late")]);

    Assert.areEqual(JSON.stringify(["call-spawn"]), JSON.stringify(listener.taskStarts.map(t => t.taskId)));
    Assert.areEqual(JSON.stringify(["call-spawn", "call-stray", "call-late"]),
      JSON.stringify([...new Set(CodexSubAgentsTests.rows(listener).map(t => t["toolUseId"]))]));
    Assert.isFalse(listener.details.some(t => t.providerItemId === "msg-stray"));
    Assert.isFalse(agents.isIdle);
    void listener.taskStarts[0]!.stop();
    Assert.areEqual(JSON.stringify(["turn/interrupt {\"threadId\":\"child\",\"turnId\":\"child-turn\"}"]), JSON.stringify(requests));
  }

  @TestMethod
  public async endsAMultiAgentV2SubAgentWhoseWholeTurnCameBeforeItsActivityNamedIt(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);
    const ofChild = (t: JsonObject): boolean => (t["params"] as JsonObject)["threadId"] === "child";

    await CodexSubAgentsTests.replayAsync(agents, [...CodexSubAgentV2Recording.completed.filter(ofChild),
      { method: "item/agentMessage/delta", params: { threadId: "child", turnId: "child-turn", itemId: "msg-1", delta: "notes" } },
      ...CodexSubAgentV2Recording.completed.filter(t => !ofChild(t))]);
    const idleBeforeTheTurnEnds = agents.isIdle;
    agents.finishTurn();

    Assert.areEqual(JSON.stringify({ toolUseId: "call-spawn", type: null, description: "read_notes", model: "gpt-5.4-mini", status: SubAgentStatus.Completed,
      isBackground: true, toolUses: 1, tokens: 1840, durationMs: 4200, summary: "notes.txt starts with: hello" }), JSON.stringify(CodexSubAgentsTests.rows(listener).at(-1)));
    Assert.areEqual("call-cat:call-spawn,call-cat:call-spawn,msg-1:call-spawn", listener.details.filter(t => t.kind !== DetailKind.SubAgent)
      .map(t => `${t.providerItemId}:${t.parentItemId}`).join(","));
    Assert.areEqual(JSON.stringify([["call-spawn", "read_notes"]]), JSON.stringify(listener.taskStarts.map(t => [t.taskId, t.command])));
    Assert.areEqual(JSON.stringify([["call-spawn", BackgroundTaskStatus.Completed]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.isFalse(idleBeforeTheTurnEnds);
    Assert.isTrue(agents.isIdle);
  }

  @TestMethod
  public async followsAnEarlierRepliesMultiAgentV2ChildThatThisReplyInteractsWithAsItsOwnRow(): Promise<void> {
    const threads = new Map<string, JsonObject>();
    const listener = new RecordingTurnListener();
    await CodexSubAgentsTests.replayAsync(CodexSubAgentsTests.create(new RecordingTurnListener(), [], false, threads), CodexSubAgentV2Recording.completed);
    const agents = CodexSubAgentsTests.create(listener, [], false, threads);

    await CodexSubAgentsTests.replayAsync(agents, [
      CodexSubAgentsTests.activity("call-more", "interacted", "child", "/root/read_notes"),
      CodexSubAgentsTests.activity("call-more", "interacted", "child", "/root/read_notes"),
      CodexSubAgentsTests.activity("call-ghost", "interacted", "ghost", "/root/ghost"),
      CodexSubAgentsTests.activity("call-root", "started", "root-child", "/"),
      CodexSubAgentsTests.activity("call-unnamed", "started", "unnamed-child", null),
      CodexSubAgentsTests.activity("call-nobody", "started", null, "/root/nobody"),
      CodexSubAgentsTests.turn("turn/started", "child", "child-turn-2"),
      CodexSubAgentsTests.turn("turn/completed", "child", "child-turn-2", "completed", 700)
    ]);
    agents.finishTurn();

    Assert.areEqual(JSON.stringify(["call-more", "call-root", "call-unnamed"]), JSON.stringify([...new Set(CodexSubAgentsTests.rows(listener).map(t => t["toolUseId"]))]));
    Assert.areEqual(JSON.stringify([null, "read_notes", "gpt-5.4-mini", SubAgentStatus.Completed, 700]),
      JSON.stringify(["type", "description", "model", "status", "durationMs"].map(t => CodexSubAgentsTests.rows(listener).filter(r => r["toolUseId"] === "call-more").at(-1)![t])));
    Assert.areEqual(JSON.stringify(["Sub-agent", "Sub-agent"]),
      JSON.stringify(["call-root", "call-unnamed"].map(id => CodexSubAgentsTests.rows(listener).find(t => t["toolUseId"] === id)!["description"])));
    Assert.areEqual(JSON.stringify(["call-more"]), JSON.stringify(listener.taskStarts.map(t => t.taskId)));
  }

  @TestMethod
  public async endsARunningMultiAgentV2SubAgentAsStoppedOnAnInterruptedActivityAndKeepsTheTimeOfTheTurnThatEndsAfterIt(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);

    await CodexSubAgentsTests.replayAsync(agents, [...CodexSubAgentV2Recording.completed.slice(0, 3),
      CodexSubAgentsTests.activity("call-stop", "interrupted", "child", "/root/read_notes"),
      CodexSubAgentsTests.activity("call-stop-again", "interrupted", "child", "/root/read_notes"),
      CodexSubAgentsTests.activity("call-stop-ghost", "interrupted", "ghost", "/root/ghost"),
      CodexSubAgentsTests.turn("turn/completed", "child", "child-turn", "interrupted", 5100),
      CodexSubAgentsTests.turn("turn/completed", "child", "child-turn", "interrupted", 300)]);
    agents.finishTurn();

    Assert.areEqual(JSON.stringify([SubAgentStatus.Stopped, 5100]), JSON.stringify(["status", "durationMs"].map(t => CodexSubAgentsTests.rows(listener).at(-1)![t])));
    Assert.areEqual(JSON.stringify([["call-spawn", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
    Assert.isTrue(agents.isIdle);
  }

  @TestMethod
  public async asksAChildsApprovalsAndQuestionThroughTheParentsTurnNamingItsSubAgent(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);
    const signal = new AbortController().signal;
    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.completed.slice(0, 4));
    listener.decisions.push("decline", "acceptForSession", "decline");
    listener.answers.push([new QuestionAnswer("file", ["notes.txt"], null)]);

    const command = await agents.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("child"), signal);
    const fileChange = await agents.handleServerRequest("item/fileChange/requestApproval", JsonReader.fromValue({ threadId: "child", turnId: "child-turn",
      itemId: "call-edit", reason: "Write notes.txt", grantRoot: null }), signal);
    const question = await agents.handleServerRequest("item/tool/requestUserInput", CodexSubAgentsTests.question("child"), signal);
    const tool = await agents.handleServerRequest("mcpServer/elicitation/request", JsonReader.fromValue({ threadId: "child", turnId: "child-turn", serverName: "docs",
      mode: "form", message: "Allow the docs MCP server to run tool \"search\"?", _meta: { codex_approval_kind: "mcp_tool_call", persist: "session",
        tool_title: "Search", tool_params: { q: "notes" } }, requestedSchema: { type: "object", properties: {} } }), signal);
    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.completed.slice(4));

    Assert.areEqual(JSON.stringify([{ decision: "decline" }, { decision: "acceptForSession" }, { answers: { file: { answers: ["notes.txt"] } } }, { action: "decline" }]),
      JSON.stringify([command, fileChange, question, tool]));
    Assert.areEqual(JSON.stringify([ApprovalKind.Command, ApprovalKind.FileChange, ApprovalKind.Tool]), JSON.stringify(listener.asks.map(t => t.kind)));
    Assert.isTrue(listener.asks.every(t => (t.payload as JsonObject)["subAgent"] === "Read notes.txt and reply with its first line."));
    Assert.areEqual("Read notes.txt and reply with its first line.", listener.questionAsks.map(t => t.subAgent).join(","));
    Assert.isTrue(listener.signals.length === 4 && listener.signals.every(t => t === signal));
    Assert.isTrue((listener.details.filter(t => t.providerItemId === "call-cat").at(-1)!.payload as JsonObject)["denied"] === true);
    Assert.isFalse(listener.details.some(t => t.kind === DetailKind.Note && t.parentItemId === "call-spawn" && t.providerItemId === null));
  }

  @TestMethod
  public async cancelsAChildsRequestOnceTheReplyIsStoppedAndDeclinesItWithANoteOnceTheReplyTakesNoMoreApprovals(): Promise<void> {
    const signal = new AbortController().signal;
    const stoppedListener = new RecordingTurnListener();
    const stopped = CodexSubAgentsTests.create(stoppedListener);
    await CodexSubAgentsTests.replayAsync(stopped, CodexSubAgentRecording.completed.slice(0, 4));
    stoppedListener.decisionFailure = CodexSubAgentsTests.closedRun();
    await stopped.stopAll(Promise.resolve());
    const cancelled = [await stopped.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("child"), signal),
      await stopped.handleServerRequest("item/tool/requestUserInput", CodexSubAgentsTests.question("child"), signal)];

    const endedListener = new RecordingTurnListener();
    const ended = CodexSubAgentsTests.create(endedListener);
    await CodexSubAgentsTests.replayAsync(ended, CodexSubAgentRecording.completed.slice(0, 4));
    endedListener.decisionFailure = CodexSubAgentsTests.closedRun();
    const declined = [await ended.handleServerRequest("item/fileChange/requestApproval", JsonReader.fromValue({ threadId: "child", turnId: "child-turn",
      itemId: "call-edit" }), signal)];
    ended.finishTurn();
    declined.push(await ended.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("child"), signal),
      await ended.handleServerRequest("item/tool/requestUserInput", CodexSubAgentsTests.question("child"), signal),
      await ended.handleServerRequest("mcpServer/elicitation/request", JsonReader.fromValue({ threadId: "child", turnId: "child-turn", serverName: "docs",
      mode: "form", message: "Allow the docs MCP server to run tool \"search\"?", _meta: { codex_approval_kind: "mcp_tool_call", persist: "session",
        tool_title: "Search", tool_params: { q: "notes" } }, requestedSchema: { type: "object", properties: {} } }), signal));

    Assert.areEqual(JSON.stringify([{ decision: "cancel" }, { answers: {} }]), JSON.stringify(cancelled));
    Assert.isFalse(stoppedListener.details.some(t => t.kind === DetailKind.Note));
    Assert.areEqual(JSON.stringify([{ decision: "decline" }, { decision: "decline" }, { answers: {} }, { action: "decline" }]), JSON.stringify(declined));
    Assert.areEqual(JSON.stringify(["TeamRun declined its file change without asking, since the reply had ended.",
      "TeamRun declined its command without asking, since the reply had ended.", "TeamRun skipped its question without asking, since the reply had ended.",
      "TeamRun declined its MCP tool call without asking, since the reply had ended."]),
      JSON.stringify(endedListener.details.filter(t => t.kind === DetailKind.Note && t.parentItemId === "call-spawn").map(t => t.text)));
    Assert.areEqual("3,1", [endedListener.asks.length, endedListener.questionAsks.length].join(","));
  }

  @TestMethod
  public async asksAChildsRequestInTheParentsReplyAfterItsTurnEndedWhileThatReplyStillTakesApprovals(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);
    const signal = new AbortController().signal;
    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.completed.slice(0, 4));
    agents.finishTurn();
    listener.decisions.push("accept");
    listener.answers.push([new QuestionAnswer("file", ["notes.txt"], null)]);

    const command = await agents.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("child"), signal);
    const question = await agents.handleServerRequest("item/tool/requestUserInput", CodexSubAgentsTests.question("child"), signal);

    Assert.areEqual(JSON.stringify([{ decision: "accept" }, { answers: { file: { answers: ["notes.txt"] } } }]), JSON.stringify([command, question]));
    Assert.areEqual("Read notes.txt and reply with its first line.", listener.asks.map(t => (t.payload as JsonObject)["subAgent"]).join(","));
    Assert.areEqual(1, listener.questionAsks.length);
    Assert.isFalse(listener.details.some(t => t.kind === DetailKind.Note && t.parentItemId === "call-spawn"));
  }

  @TestMethod
  public async passesOnAWithdrawnChildRequestsRejectionAndAnyOtherFailureAndRefusesOneItCannotAsk(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);
    const withdrawn = new AbortController();
    withdrawn.abort();
    await CodexSubAgentsTests.replayAsync(agents, CodexSubAgentRecording.completed.slice(0, 4));
    listener.decisionFailure = CodexSubAgentsTests.closedRun();

    const rejected = await Assert.throwsAsync(() => agents.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("child"),
      withdrawn.signal), Error);
    listener.decisionFailure = new Error("The window is gone.");
    const failed = await Assert.throwsAsync(() => agents.handleServerRequest("item/tool/requestUserInput", CodexSubAgentsTests.question("child"),
      new AbortController().signal), Error);
    const unsupported = await Assert.throwsAsync(() => agents.handleServerRequest("item/permissions/requestApproval", CodexSubAgentsTests.command("child"),
      withdrawn.signal), UnsupportedServerRequestException);
    const unknown = await Assert.throwsAsync(() => agents.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("ghost"),
      withdrawn.signal), UnsupportedServerRequestException);

    Assert.areEqual("The message is not open.", rejected.message);
    Assert.areEqual("The window is gone.", failed.message);
    Assert.areEqual("item/permissions/requestApproval", unsupported.method);
    Assert.areEqual("item/commandExecution/requestApproval", unknown.method);
    Assert.areEqual(JSON.stringify([true, false, false, false, false]), JSON.stringify([agents.follows("child"), agents.follows("ghost"), agents.follows(null),
      agents.mayFollow("ghost"), agents.mayFollow(null)]));
    Assert.isFalse(listener.details.some(t => t.kind === DetailKind.Note));
  }

  @TestMethod
  public async asksARequestFromAChildNoCallNamedYetOnceACallNamesItAndRefusesItIfNoneDoes(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);
    const signal = new AbortController().signal;
    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.turn("turn/started", "child", "child-turn"), CodexSubAgentsTests.thread("early", "parent", "worker"),
      CodexSubAgentsTests.turn("turn/started", "lost", "lost-turn")]);
    const before = [agents.follows("child"), agents.mayFollow("child"), agents.mayFollow("early"), agents.mayFollow("lost")];

    const waiting = [agents.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("child"), signal),
      agents.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("child"), signal),
      agents.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("early"), signal)];
    const lost = agents.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("lost"), signal);
    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.activity("call-spawn", "started", "child", "/root/read_notes"),
      CodexSubAgentsTests.spawn("item/completed", "call-early", "completed", ["early"])]);
    const answers = await Promise.all(waiting);
    agents.finishTurn();
    await Assert.throwsAsync(() => lost, UnsupportedServerRequestException);

    const exitedListener = new RecordingTurnListener();
    const exited = CodexSubAgentsTests.create(exitedListener);
    await CodexSubAgentsTests.replayAsync(exited, [CodexSubAgentsTests.turn("turn/started", "gone", "gone-turn")]);
    const gone = exited.handleServerRequest("item/commandExecution/requestApproval", CodexSubAgentsTests.command("gone"), signal);
    await exited.handleExitAsync();
    await Assert.throwsAsync(() => gone, UnsupportedServerRequestException);

    Assert.areEqual(JSON.stringify([false, true, true, true]), JSON.stringify(before));
    Assert.areEqual(JSON.stringify([{ decision: "accept" }, { decision: "accept" }, { decision: "accept" }]), JSON.stringify(answers));
    Assert.areEqual(JSON.stringify(["read_notes", "read_notes", "Task for call-early."]), JSON.stringify(listener.asks.map(t => (t.payload as JsonObject)["subAgent"])));
    Assert.areEqual(JSON.stringify([false, false]), JSON.stringify([exited.follows("gone"), exited.mayFollow("gone")]));
    Assert.areEqual(0, exitedListener.asks.length);
  }

  @TestMethod
  public async asksASubAgentsApprovalAndQuestionInItsParentsReplyAndSendsTheAnswersToItsThread(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.heldDecisions.push(Promise.resolve("decline"), new Promise<string>(() => undefined));
    listener.answers.push([new QuestionAnswer("file", ["notes.txt"], null)]);
    try {
      const result = await adapter.runTurn(host.createRequest("subAgentAsks"), listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify([{ result: { decision: "decline" }, error: null }, { result: { answers: { file: { answers: ["notes.txt"] } } }, error: null }]),
        listener.details.find(t => t.providerItemId === "answers")!.text);
      Assert.areEqual(JSON.stringify([[ApprovalKind.Command, "Read notes.txt."], [ApprovalKind.Command, "Read notes.txt."]]),
        JSON.stringify(listener.asks.map(t => [t.kind, (t.payload as JsonObject)["subAgent"]])));
      Assert.areEqual(1, listener.questionAsks.length);
      Assert.areEqual(JSON.stringify([false, false, true]), JSON.stringify(listener.signals.map(t => t!.aborted)));
      Assert.areEqual(SubAgentStatus.Completed, CodexSubAgentsTests.rows(listener).at(-1)!["status"]);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsNoTimeForAnInterruptedMultiAgentV2SubAgentWhoseTurnHadNotStartedOrRanAgain(): Promise<void> {
    const listener = new RecordingTurnListener();
    const agents = CodexSubAgentsTests.create(listener);

    await CodexSubAgentsTests.replayAsync(agents, [...CodexSubAgentV2Recording.completed.slice(0, 2),
      CodexSubAgentsTests.activity("call-stop", "interrupted", "child", "/root/read_notes"),
      CodexSubAgentsTests.turn("turn/completed", "child", "child-turn", "interrupted", 5100)]);
    const unstarted = CodexSubAgentsTests.rows(listener).at(-1)!["durationMs"];
    await CodexSubAgentsTests.replayAsync(agents, [CodexSubAgentsTests.turn("turn/started", "child", "child-turn-2"),
      CodexSubAgentsTests.activity("call-stop-2", "interrupted", "child", "/root/read_notes"),
      CodexSubAgentsTests.turn("turn/started", "child", "child-turn-3"),
      CodexSubAgentsTests.turn("turn/completed", "child", "child-turn-3", "completed", 700),
      CodexSubAgentsTests.turn("turn/completed", "child", "child-turn-2", "interrupted", 900)]);
    agents.finishTurn();

    Assert.isNull(unstarted);
    Assert.areEqual(JSON.stringify([SubAgentStatus.Completed, 700]), JSON.stringify(["status", "durationMs"].map(t => CodexSubAgentsTests.rows(listener).at(-1)![t])));
    Assert.isTrue(agents.isIdle);
  }

  @TestMethod
  @TestData("completed", true, null)
  @TestData("failed", false, "resumable")
  public async wakesTheChatOnTheParentThreadWhenASubAgentEndsAfterTheRepliesTurn(status: string, withTools: boolean, resume: string | null): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const tokens = new SessionTokens();
    const first = new RecordingMcpEndpoint(tokens, "turn-1");
    const woken = new RecordingMcpEndpoint(tokens, "wake");
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const senders: string[] = [];
    listener.wakeTurn = new WakeTurn({}, false, t => senders.push(t) > 0);
    const wake = listener.wakeTurn.follow(reply, new AbortController().signal);
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, withTools ? first : null, withTools ? "subAgentWakesCounted" : "subAgentWakes",
        resume), listener, new AbortController().signal);
      const during = JSON.stringify([listener.taskEnds.length, listener.wakes.length]);
      await listener.wakeTurn.useToolsAsync(CodexSubAgentsTests.tools(withTools ? woken : null));
      writeFileSync(host.directory.resolve("sub-agent-end"), status);
      const ended = await wake;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify([0, 0]), during);
      Assert.areEqual(JSON.stringify([["call-spawn", status === "completed" ? BackgroundTaskStatus.Completed : BackgroundTaskStatus.Failed]]),
        JSON.stringify(listener.taskEnds.map(t => [t.taskId, t.status])));
      Assert.areEqual(JSON.stringify([["call-spawn", "Read notes.txt."]]), JSON.stringify(listener.wakes.map(t => [t.taskId, t.command])));
      Assert.areEqual(TurnOutcome.Completed, ended.outcome);
      Assert.areEqual(result.nativeSessionId, reply.starts[0]?.nativeSessionId);
      Assert.areEqual(resume ?? result.nativeSessionId, result.nativeSessionId);
      Assert.isTrue(reply.texts.includes(status === "completed" ? "Woken with: notes.txt says hello." : "Woken with: null"));
      Assert.isFalse(listener.texts.some(t => t.startsWith("Woken")));
      Assert.areEqual(JSON.stringify(withTools ? [first.lastIssued] : []), JSON.stringify(woken.adopted));
      Assert.areEqual(JSON.stringify(withTools ? ["first-turn"] : []), JSON.stringify(senders));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsTheWakeTurnWhenThePersonStopsTheWakeReplyAndSaysSoWhenItsSenderTokenIsRefused(): Promise<void> {
    using host = new CodexTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter({ ...CodexSubAgentsTests.endsOnSignal(host), TEAMRUN_FAKE_CODEX_WAKE: "hold" }, host.command, host.timings, undefined, log);
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const stop = new AbortController();
    listener.wakeTurn = new WakeTurn({}, false, () => false);
    const wake = listener.wakeTurn.follow(reply, stop.signal);
    try {
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "subAgentWakes", new RequestedSettings("codex", null, null), null, [], null, null,
        SenderEnvironment.of("first-turn")), listener, new AbortController().signal);
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      await Wait.until(() => reply.texts.includes("Waking"), "The reply listener did not see 'Waking'.");
      stop.abort();
      const ended = await wake;

      Assert.areEqual(TurnOutcome.Interrupted, ended.outcome);
      Assert.isFalse(reply.texts.some(t => t.startsWith("Woken")));
      Assert.isTrue(reply.details.some(t => t.kind === DetailKind.Note && t.text === Resources.codexSenderRefused));
      Assert.isTrue(log.lines.some(t => t.includes(Resources.formatCodexHeldSenderRefused(String(ended.nativeSessionId)))));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async wakesTheChatOnceATurnOnItsParentThreadEndsWhenTheSubAgentEndsDuringThatTurnsFinalAnswer(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const next = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const wake = listener.wakeTurn.follow(reply, new AbortController().signal);
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "answering", new RequestedSettings("codex", null, null), result.nativeSessionId),
        next, new AbortController().signal);
      await Wait.until(() => next.thinking === 1, "The next listener did not see thinking.");
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      const after = await running;
      const ended = await wake;

      Assert.areEqual(TurnOutcome.Completed, after.outcome);
      Assert.isTrue(next.texts.includes("Done."));
      Assert.areEqual(1, listener.wakes.length);
      Assert.areEqual(TurnOutcome.Completed, ended.outcome);
      Assert.isTrue(reply.texts.includes("Woken with: notes.txt says hello."));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async wakesTheChatWhenTheSubAgentEndsAfterATurnsFinalReasoningAndBeforeItsAnswerSinceCodexBuiltThatSamplingBeforeTheResultCame(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const next = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const wake = listener.wakeTurn.follow(reply, new AbortController().signal);
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "reasoningThenAnswer", new RequestedSettings("codex", null, null),
        result.nativeSessionId), next, new AbortController().signal);
      await Wait.until(() => next.texts.includes("Weighing it."), "The next listener did not see 'Weighing it.'");
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      const after = await running;
      const ended = await wake;

      Assert.areEqual(TurnOutcome.Completed, after.outcome);
      Assert.isTrue(next.texts.includes("Done."));
      Assert.areEqual(1, listener.wakes.length);
      Assert.areEqual(TurnOutcome.Completed, ended.outcome);
      Assert.isTrue(reply.texts.includes("Woken with: notes.txt says hello."));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async runsTheWakeTurnWhenATurnOnTheParentThreadFailedBeforeItsTurnStarted(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const wake = new WakeTurn({});
    listener.wakeTurn = wake;
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      await Wait.until(() => listener.wakes.length === 1, "The listener did not see a wake.");
      const refused = await adapter.runTurn(new TurnRequest(null, host.directory.path, "reject", new RequestedSettings("codex", null, null),
        result.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);
      const ended = await wake.follow(reply, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Failed, refused.outcome);
      Assert.areEqual(TurnOutcome.Completed, ended.outcome);
      Assert.isTrue(reply.texts.includes("Woken with: notes.txt says hello."));
      Assert.isFalse(reply.details.some(t => t.text === Resources.codexWakeTaken));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async wakesTheChatOnceTheSpawningTurnEndsWhenTheSubAgentEndsAfterThatTurnsFinalAnswer(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const wake = listener.wakeTurn.follow(reply, new AbortController().signal);
    try {
      const running = adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null, "subAgentWakesLate"), listener, new AbortController().signal);
      await Wait.until(() => listener.texts.includes("Spawned."), "The listener did not see 'Spawned.'");
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      const result = await running;
      const ended = await wake;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(1, listener.wakes.length);
      Assert.areEqual(TurnOutcome.Completed, ended.outcome);
      Assert.isTrue(reply.texts.includes("Woken with: notes.txt says hello."));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async runsTheWakeTurnInTheModeTheChatHoldsWhenTheWakeStarts(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...CodexSubAgentsTests.endsOnSignal(host), TEAMRUN_FAKE_CODEX_WAKE: "policy" });
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({}, false, undefined, Resources.codexReadOnlyMode);
    const wake = listener.wakeTurn.follow(reply, new AbortController().signal);
    try {
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "subAgentWakesLate",
        new RequestedSettings("codex", null, null, null, Resources.codexFullAccessMode), null), listener, new AbortController().signal);
      await Wait.until(() => listener.texts.includes("Spawned."), "The listener did not see 'Spawned.'");
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      const result = await running;
      const ended = await wake;
      const policy = JsonReader.parse(reply.texts.join()).toJson();

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(TurnOutcome.Completed, ended.outcome);
      Assert.areEqual(Resources.readOnlyPolicy, JsonReader.fromValue(policy["sandboxPolicy"] ?? null).toJson()["type"]);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async wakesWithTheSubAgentsResultWhenTheFakeSeesItsEndSignalBeforeTheSignalIsWritten(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const wake = listener.wakeTurn.follow(reply, new AbortController().signal);
    try {
      const running = adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null, "subAgentWakesLate"), listener, new AbortController().signal);
      await Wait.until(() => listener.texts.includes("Spawned."), "The listener did not see 'Spawned.'");
      writeFileSync(host.directory.resolve("sub-agent-end"), "");
      await Wait.until(() => existsSync(host.directory.resolve("sub-agent-end-seen")), "The fake did not write sub-agent-end-seen.");
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      await running;
      const ended = await wake;

      Assert.areEqual(BackgroundTaskStatus.Completed, listener.taskEnds[0]?.status);
      Assert.areEqual(TurnOutcome.Completed, ended.outcome);
      Assert.isTrue(reply.texts.includes("Woken with: notes.txt says hello."));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async runsOneWakeTurnForTwoSubAgentsThatEndAfterTheSpawningTurnsFinalAnswerAndTellsTheOtherWakeItsResultWasTaken(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const one = new WakeTurn({});
    const two = new WakeTurn({});
    listener.wakeTurns.push(one, two);
    const firstEnd = one.follow(first, new AbortController().signal);
    const secondEnd = two.follow(second, new AbortController().signal);
    try {
      const running = adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null, "subAgentPairLate"), listener, new AbortController().signal);
      await Wait.until(() => listener.texts.includes("Spawned."), "The listener did not see 'Spawned.'");
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      const result = await running;
      const woken = await firstEnd;
      const taken = await secondEnd;
      host.idleTimer.advance(host.timings.idleLimit);
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), result.nativeSessionId), next,
        new AbortController().signal);

      Assert.areEqual(2, listener.wakes.length);
      Assert.areEqual(TurnOutcome.Completed, woken.outcome);
      Assert.isTrue(first.texts.includes("Woken with: notes.txt says hello."));
      Assert.areEqual(TurnOutcome.Completed, taken.outcome);
      Assert.isTrue(second.details.some(t => t.kind === DetailKind.Note && t.text === Resources.codexWakeTaken));
      Assert.isFalse(second.texts.some(t => t.startsWith("Woken")));
      Assert.areEqual(JSON.stringify([result.nativeSessionId]), JSON.stringify(JSON.parse(next.details.find(t => t.kind === DetailKind.Text)?.text ?? "{}").unsubscribes));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async startsNoWakeWhenATurnOnItsParentThreadGoesOnAfterTheSubAgentEnds(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const next = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "toolThenAnswer", new RequestedSettings("codex", null, null),
        result.nativeSessionId), next, new AbortController().signal);
      await Wait.until(() => next.texts.includes("Looking."), "The next listener did not see 'Looking.'");
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      const after = await running;

      Assert.areEqual(TurnOutcome.Completed, after.outcome);
      Assert.isTrue(next.texts.includes("Done."));
      Assert.areEqual(BackgroundTaskStatus.Completed, listener.taskEnds[0]?.status);
      Assert.areEqual(0, listener.wakes.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async startsAPersonsTurnOnTheParentThreadOnlyOnceTheWakeTurnRunningOnItEnds(): Promise<void> {
    using host = new CodexTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter({ ...CodexSubAgentsTests.endsOnSignal(host), TEAMRUN_FAKE_CODEX_WAKE: "hold" }, host.command, host.timings, undefined, log);
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const next = new RecordingTurnListener();
    const stop = new AbortController();
    listener.wakeTurn = new WakeTurn({});
    const wake = listener.wakeTurn.follow(reply, stop.signal);
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      await Wait.until(() => reply.texts.includes("Waking"), "The reply listener did not see 'Waking'.");
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null),
        result.nativeSessionId), next, new AbortController().signal);
      await Wait.until(() => log.lines.some(t => t.includes(Resources.formatCodexTurnAwaitsThread(String(result.nativeSessionId)))), "The log did not say the turn awaits the sub-agent's thread.");
      const during = next.starts.length;
      stop.abort();
      const ended = await wake;
      const after = await running;

      Assert.areEqual(0, during);
      Assert.areEqual(TurnOutcome.Interrupted, ended.outcome);
      Assert.areEqual(TurnOutcome.Completed, after.outcome);
      Assert.areEqual(result.nativeSessionId, after.nativeSessionId);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async runsNoWakeTurnWhenATurnThatStartedOnTheParentThreadBeforeTheChatFollowsTheWakeTookTheResult(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const next = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      await Wait.until(() => listener.wakes.length === 1, "The listener did not see a wake.");
      const after = await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null),
        result.nativeSessionId), next, new AbortController().signal);
      const ended = await listener.wakeTurn.follow(reply, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, after.outcome);
      Assert.areEqual(TurnOutcome.Completed, ended.outcome);
      Assert.isTrue(reply.details.some(t => t.kind === DetailKind.Note && t.text === Resources.codexWakeTaken));
      Assert.isFalse(reply.texts.some(t => t.startsWith("Woken")));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData("cancel")
  @TestData("abort")
  public async releasesTheThreadWithoutAWakeTurnWhenThePersonStopsTheWakeReplyBeforeItRuns(how: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const reply = new RecordingTurnListener();
    const next = new RecordingTurnListener();
    const stop = new AbortController();
    const wake = new WakeTurn({});
    listener.wakeTurn = wake;
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      if (how === "cancel")
        wake.cancel();
      else
        stop.abort();
      const ended = await wake.follow(reply, stop.signal);
      host.idleTimer.advance(host.timings.idleLimit);
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), result.nativeSessionId), next,
        new AbortController().signal);

      Assert.areEqual(1, listener.wakes.length);
      Assert.areEqual(TurnOutcome.Interrupted, ended.outcome);
      Assert.areEqual(0, reply.starts.length);
      Assert.areEqual(JSON.stringify([result.nativeSessionId]), JSON.stringify(JSON.parse(next.details.find(t => t.kind === DetailKind.Text)?.text ?? "{}").unsubscribes));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async releasesTheThreadWithoutAWakeTurnWhenTheChatTakesNoWake(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      host.idleTimer.advance(host.timings.idleLimit);
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), result.nativeSessionId), next,
        new AbortController().signal);

      Assert.areEqual(1, listener.wakes.length);
      Assert.areEqual(JSON.stringify([result.nativeSessionId]), JSON.stringify(JSON.parse(next.details.find(t => t.kind === DetailKind.Text)?.text ?? "{}").unsubscribes));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async startsNoWakeWhenThePersonStopsTheTurnOnItsParentThreadThatTheSubAgentEndedDuring(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    const next = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const stop = new AbortController();
    try {
      const result = await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "hold", new RequestedSettings("codex", null, null), result.nativeSessionId), next,
        stop.signal);
      await Wait.until(() => next.starts.length === 1, "The next listener did not see a turn start.");
      writeFileSync(host.directory.resolve("sub-agent-end"), "completed");
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      stop.abort();
      await running;

      Assert.areEqual(BackgroundTaskStatus.Completed, listener.taskEnds[0]?.status);
      Assert.areEqual(0, listener.wakes.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData("stop")
  @TestData("shutdown")
  public async startsNoWakeForASubAgentTeamRunStops(how: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter(CodexSubAgentsTests.endsOnSignal(host));
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    try {
      await adapter.runTurn(CodexSubAgentsTests.wakingRequest(host, null), listener, new AbortController().signal);
      if (how === "stop")
        await listener.taskStarts[0]?.stop();
      else
        await adapter.shutdown();
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual(BackgroundTaskStatus.Stopped, listener.taskEnds[0]?.status);
      Assert.areEqual(0, listener.wakes.length);
    }
    finally { await adapter.shutdown(); }
  }

  private static endsOnSignal(host: CodexTestHost): NodeJS.ProcessEnv {
    return { ...host.environment, TEAMRUN_FAKE_CODEX_SUB_AGENT_END: host.directory.resolve("sub-agent-end") };
  }

  private static wakingRequest(host: CodexTestHost, endpoint: RecordingMcpEndpoint | null, prompt: string = "subAgentWakes", resume: string | null = null): TurnRequest {
    return new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("codex", null, null), resume, [], null, null,
      Object.isNull(endpoint) ? {} : SenderEnvironment.of("first-turn"), false,
      Object.isNull(endpoint) ? null : CodexSubAgentsTests.tools(endpoint));
  }

  private static tools(endpoint: RecordingMcpEndpoint | null): TurnTools {
    return new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [], endpoint);
  }

  private static create(listener: RecordingTurnListener, requests: string[] = [], refuses: boolean = false,
    threads: Map<string, JsonObject> = new Map()): CodexSubAgents {
    const client = { request: (method: string, params: JsonValue): Promise<JsonValue> => {
      requests.push(`${method} ${JSON.stringify(params)}`);
      return refuses ? Promise.reject(new Error("refused")) : Promise.resolve({});
    } } as unknown as AppServerClient;
    const turn = new CodexTurn("parent", listener, new ObservedSettings("codex", null, null, null), new CodexItemReader(), new DeltaStream(listener, 1));
    return new CodexSubAgents(client, turn, threads, listener, new CodexItemReader(), 1000, () => Promise.resolve());
  }

  private static sweeping(listener: RecordingTurnListener, requests: string[], server: { processId: number | null; timeouts: number[] },
    platform: string, sweep: IOrphanSweep, log: RecordingLog | null = null): CodexSubAgents {
    const client = Object.assign(server, { request: (method: string, params: JsonValue, timeout: number): Promise<JsonValue> => {
      requests.push(`${method} ${JSON.stringify(params)}`);
      server.timeouts.push(timeout);
      return Promise.resolve({});
    } }) as unknown as AppServerClient;
    const turn = new CodexTurn("parent", listener, new ObservedSettings("codex", null, null, null), new CodexItemReader(), new DeltaStream(listener, 1));
    return new CodexSubAgents(client, turn, new Map(), listener, new CodexItemReader(), 1000, () => Promise.resolve(), platform, sweep, log);
  }

  private static closedRun(): Error {
    return Object.assign(new Error("The message is not open."), { info: { name: ErrorCode.Conflict } });
  }

  private static async replayAsync(agents: CodexSubAgents, messages: readonly JsonObject[]): Promise<void> {
    for (const message of messages)
      await agents.handleNotificationAsync(message["method"] as string, JsonReader.fromValue(message["params"]!));
  }

  private static rows(listener: RecordingTurnListener): JsonObject[] {
    return listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => t.payload as JsonObject);
  }

  private static spawn(method: string, id: string, status: string, receiverThreadIds: string[], prompt: string = `Task for ${id}.`,
    tool: string = "spawnAgent"): JsonObject {
    return { method, params: { threadId: "parent", turnId: "parent-turn", item: { type: "collabAgentToolCall", id, tool, status, senderThreadId: "parent",
      receiverThreadIds, prompt, model: null, reasoningEffort: null, agentsStates: {} } } };
  }

  private static thread(id: string, parentThreadId: string, agentRole: string): JsonObject {
    return { method: "thread/started", params: { thread: { id, parentThreadId, agentRole, agentNickname: null, model: null } } };
  }

  private static command(threadId: string): JsonReader {
    return JsonReader.fromValue({ threadId, turnId: `${threadId}-turn`, itemId: "call-cat", command: "cat notes.txt", cwd: "/work", reason: null });
  }

  private static question(threadId: string): JsonReader {
    return JsonReader.fromValue({ threadId, turnId: `${threadId}-turn`, itemId: "call-ask", questions: [{ id: "file", header: "File", question: "Which file?",
      options: [{ label: "notes.txt", description: "" }], isOther: false }] });
  }

  private static activity(id: string, kind: string, agentThreadId: string | null, agentPath: string | null): JsonObject {
    return { method: "item/completed", params: { threadId: "parent", turnId: "parent-turn", item: { type: "subAgentActivity", model: null, reasoningEffort: null,
      id, kind, agentThreadId, agentPath } } };
  }

  private static turn(method: string, threadId: string, id: string, status: string = "inProgress", durationMs: number | null = null): JsonObject {
    return { method, params: { threadId, turn: { id, status, error: null, durationMs } } };
  }
}
