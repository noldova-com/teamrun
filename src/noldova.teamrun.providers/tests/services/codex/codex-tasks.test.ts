/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { TurnOutcome, TurnRequest } from "@noldova/teamrun.core";
import { BackgroundTaskStatus, DetailKind, RequestedSettings } from "@noldova/teamrun.protocol";

import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";
import { LimitWaits } from "../../fixtures/limit-waits.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class CodexTasksTests {
  @TestMethod
  public async showsABackgroundTerminalAndKeepsTheThreadUntilItEndsAfterTheReply(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    try {
      const result = await adapter.runTurn(host.createRequest("backgroundEnds"), listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, result.outcome);

      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      host.idleTimer.advance(host.timings.idleLimit);
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), result.nativeSessionId), next,
        new AbortController().signal);

      Assert.areEqual(JSON.stringify([["server", "npm run dev"]]), JSON.stringify(listener.taskStarts.map(start => [start.taskId, start.command])));
      Assert.areEqual("starting\ndone\n", listener.taskOutputs.filter(t => t.taskId === "server").map(t => t.text).join(""));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Completed, 0]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
      Assert.areEqual(JSON.stringify([result.nativeSessionId]), JSON.stringify(JSON.parse(next.details.find(t => t.kind === DetailKind.Text)!.text).unsubscribes));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsAndEndsABackgroundTerminalWhoseEndArrivesWithItsListing(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINAL_END: "withList" });
    const listener = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("backgroundEnds"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual(JSON.stringify([["server", "npm run dev"]]), JSON.stringify(listener.taskStarts.map(start => [start.taskId, start.command])));
      Assert.areEqual(JSON.stringify([{ taskId: "server", text: "starting\ndone\n" }]), JSON.stringify(listener.taskOutputs));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Completed, 0]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsNoTaskForACommandThatEndsBeforeItsListingAnswersThoughCodexCountsTokensMeanwhile(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINAL_END: "beforeList" });
    const listener = new RecordingTurnListener();
    const unsubscribed = host.directory.resolve("profile", "unsubscribed");
    try {
      const result = await adapter.runTurn(host.createRequest("backgroundEnds", host.createProvider()), listener, new AbortController().signal);
      host.idleTimer.advance(host.timings.idleLimit);
      await Wait.until(() => existsSync(unsubscribed), "The task output was not unsubscribed.");

      Assert.areEqual(result.nativeSessionId, readFileSync(unsubscribed, "utf8"));
      Assert.areEqual(0, listener.taskStarts.length);
      Assert.areEqual(0, listener.taskEnds.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async unsubscribesThroughAMarkerLockThatADeadServerLeftBehind(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINAL_END: "beforeList" });
    const unsubscribed = host.directory.resolve("profile", "unsubscribed");
    const lock = `${unsubscribed}.lock`;
    mkdirSync(host.directory.resolve("profile"), { recursive: true });
    writeFileSync(lock, String(spawnSync(process.execPath, ["-e", ""]).pid));
    try {
      const result = await adapter.runTurn(host.createRequest("backgroundEnds", host.createProvider()), new RecordingTurnListener(), new AbortController().signal);
      host.idleTimer.advance(host.timings.idleLimit);
      await Wait.until(() => existsSync(unsubscribed) && !existsSync(lock), "The thread was not unsubscribed past the dead server's lock.");

      Assert.areEqual(result.nativeSessionId, readFileSync(unsubscribed, "utf8"));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsTheAppServerNamingTheMarkerLockWhenARunningOwnerHoldsItPastTheWait(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINAL_END: "beforeList", TEAMRUN_FAKE_CODEX_LOCK_WAIT: "100" });
    const lock = host.directory.resolve("profile", "unsubscribed.lock");
    mkdirSync(host.directory.resolve("profile"), { recursive: true });
    writeFileSync(lock, String(process.pid));
    try {
      await adapter.runTurn(host.createRequest("backgroundEnds", host.createProvider()), new RecordingTurnListener(), new AbortController().signal);
      host.idleTimer.advance(host.timings.idleLimit);
      await Wait.until(() => host.programs.closed.length === 1, "The app server did not end while the lock was held.");

      const closed = host.programs.closed[0];
      Assert.areEqual(`6|true|true`, `${closed?.code}|${(closed?.stderr ?? "").includes(`The fake Codex app server waited 100 ms for ${lock}`)}|${existsSync(lock)}`, JSON.stringify(host.programs.closed));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsACommandStillRunningWhenItsModelRoundEndsAndStreamsItsOutputWhileOnlyCommandsFollow(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundRound"), listener, controller.signal);
      await Wait.until(() => listener.taskOutputs.length === 2, "The listener did not see 2 task outputs.");
      const during = JSON.stringify(listener.taskStarts.map(start => [start.taskId, start.command]));
      controller.abort();
      await running;

      Assert.areEqual(JSON.stringify([["server", "npm run dev"]]), during);
      Assert.areEqual(JSON.stringify([{ taskId: "server", text: "starting\n" }, { taskId: "server", text: "ready\n" }]), JSON.stringify(listener.taskOutputs));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsNoTaskForACommandThatEndsInItsRoundOrStartsInTheNextOne(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundRound"), listener, controller.signal);
      await Wait.until(() => listener.taskStarts.length > 0, "The listener did not see a task start.");
      controller.abort();
      await running;

      Assert.areEqual(JSON.stringify(["server"]), JSON.stringify(listener.taskStarts.map(start => start.taskId)));
      Assert.areEqual(0, listener.taskEnds.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsACommandShownWhenItsModelRoundEndsThroughTheProcessItStartedWith(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundRound"), listener, controller.signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      await listener.taskStarts[0]?.stop();
      controller.abort();
      const result = await running;
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), result.nativeSessionId), next,
        new AbortController().signal);

      Assert.areEqual(JSON.stringify(["p-1"]), JSON.stringify(JSON.parse(next.details.find(t => t.kind === DetailKind.Text)!.text).terminates));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped, null]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsACommandShownWhenItsModelRoundEndsWhenItsItemCompletes(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundRoundEnds"), listener, controller.signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      controller.abort();
      await running;

      Assert.areEqual(JSON.stringify(["server"]), JSON.stringify(listener.taskStarts.map(start => start.taskId)));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Completed, 0]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsACommandShownWhenItsModelRoundEndsWhenTheAppServerExits(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundRound"), listener, controller.signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      controller.abort();
      await running;
      await adapter.runTurn(host.createRequest("exit"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsNoTaskForACommandInItsFirstWaitWhenTheTurnIsStoppedAndCodexCountsTokensBeforeEndingIt(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundStoppedWait"), listener, controller.signal);
      await Wait.until(() => listener.details.length > 0, "The listener did not see a detail.");
      controller.abort();
      await running;

      Assert.areEqual(0, listener.taskStarts.length);
      Assert.areEqual(0, listener.taskEnds.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsACommandAndStreamsItsOutputWhileTheTurnRunsOnceCodexPollsItBesideAnotherCommand(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundPolled"), listener, controller.signal);
      await Wait.until(() => listener.taskOutputs.length === 2, "The listener did not see 2 task outputs.");
      const during = JSON.stringify(listener.taskStarts.map(start => [start.taskId, start.command]));
      controller.abort();

      Assert.areEqual(TurnOutcome.Interrupted, (await running).outcome);
      Assert.areEqual(JSON.stringify([["server", "npm run dev"]]), during);
      Assert.areEqual(JSON.stringify([{ taskId: "server", text: "starting\n" }, { taskId: "server", text: "ready\n" }]), JSON.stringify(listener.taskOutputs));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsNoTaskForAForegroundCommandThatRunsBesideAPolledOne(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundPolled"), listener, controller.signal);
      await Wait.until(() => listener.taskStarts.length > 0, "The listener did not see a task start.");
      controller.abort();
      await running;

      Assert.areEqual(JSON.stringify(["server"]), JSON.stringify(listener.taskStarts.map(start => start.taskId)));
      Assert.areEqual(0, listener.taskEnds.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsACommandShownOnceCodexPollsItThroughItsProcess(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundPolled"), listener, controller.signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      await listener.taskStarts[0]?.stop();
      controller.abort();
      const result = await running;
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), result.nativeSessionId), next,
        new AbortController().signal);

      Assert.areEqual(JSON.stringify(["p-1"]), JSON.stringify(JSON.parse(next.details.find(t => t.kind === DetailKind.Text)!.text).terminates));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped, null]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsACommandShownOnceCodexPollsItWhenItsItemCompletes(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(host.createRequest("backgroundPolledEnds"), listener, controller.signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      controller.abort();
      await running;

      Assert.areEqual(JSON.stringify(["server"]), JSON.stringify(listener.taskStarts.map(start => start.taskId)));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Completed, 0]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsABackgroundTerminalThroughCodexAndReleasesTheThreadOnlyAfterItsLastTurnAndTask(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const payload = async (threadId: string | null): Promise<{ unsubscribes: string[] }> => {
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), threadId), next,
        new AbortController().signal);
      return JSON.parse(next.details.find(t => t.kind === DetailKind.Text)!.text);
    };
    try {
      const result = await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      await payload(result.nativeSessionId);
      await listener.taskStarts[0]?.stop();
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit, host.timings.idleLimit]), "The thread was not kept for the idle limit after its turns and task.");
      host.idleTimer.advance(host.timings.idleLimit);

      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped, null]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
      Assert.areEqual(JSON.stringify([result.nativeSessionId]), JSON.stringify((await payload(result.nativeSessionId)).unsubscribes));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsATerminalSilentForTheSilenceLimitThenTheIdleAppServerAndResumesTheThreadOnANewOne(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_STORED: "thread-1" });
    const listener = new RecordingTurnListener();
    try {
      const result = await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1 && LimitWaits.are(host.idleTimer, [host.timings.silenceLimit, host.timings.idleLimit]), "The held thread did not start its silence and idle limits.");
      host.idleTimer.advance(host.timings.silenceLimit - 1);
      const held = [listener.taskEnds.length, adapter.clientCount];
      host.idleTimer.advance(1);
      await Wait.until(() => listener.taskEnds.length === 1, "The silent terminal was not stopped.");
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit]), "The app-server with no thread left did not start its idle limit.");
      host.idleTimer.advance(host.timings.idleLimit - 1);
      const kept = adapter.clientCount;
      host.idleTimer.advance(1);
      await Wait.until(() => adapter.clientCount === 0, "The idle app-server was not stopped.");
      const next = new RecordingTurnListener();
      const resumed = await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null),
        result.nativeSessionId), next, new AbortController().signal);
      const payload = JSON.parse(next.details.find(t => t.kind === DetailKind.Text)?.text ?? "{}");

      Assert.areEqual(1_800_000, host.timings.idleLimit);
      Assert.areEqual(JSON.stringify([0, 1, 1]), JSON.stringify([...held, kept]));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
      Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
      Assert.areEqual(JSON.stringify([result.nativeSessionId, []]), JSON.stringify([payload.thread?.threadId, payload.unsubscribes]));
      Assert.areEqual(1, adapter.clientCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsTheThreadForTheIdleLimitAfterATurnSoTheNextTurnSkipsTheResumeAndResumesItOnceReleased(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const payload = async (threadId: string | null): Promise<{ thread: { threadId?: string }; unsubscribes: string[] }> => {
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), threadId), next,
        new AbortController().signal);
      return JSON.parse(next.details.find(t => t.kind === DetailKind.Text)?.text ?? "{}");
    };
    try {
      const first = await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit]), "The thread was not kept for the idle limit after its turn.");
      host.idleTimer.advance(host.timings.idleLimit - 1);
      const kept = await payload(first.nativeSessionId);
      await Wait.until(() => LimitWaits.are(host.idleTimer, [1, host.timings.idleLimit]), "The thread was not kept for the idle limit after its second turn.");
      host.idleTimer.advance(host.timings.idleLimit);
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit]), "The released thread did not leave the app-server idle.");
      const resumed = await payload(first.nativeSessionId);

      Assert.areEqual(JSON.stringify([null, []]), JSON.stringify([kept.thread.threadId ?? null, kept.unsubscribes]));
      Assert.areEqual(JSON.stringify([first.nativeSessionId, [first.nativeSessionId]]), JSON.stringify([resumed.thread.threadId, resumed.unsubscribes]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async pausesTheSilenceLimitWhileANewTurnRunsOnTheThreadAndRestartsItWhenTheTurnEnds(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    try {
      const result = await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1 && LimitWaits.are(host.idleTimer, [host.timings.silenceLimit, host.timings.idleLimit]), "The held thread did not start its silence and idle limits.");
      const running = adapter.runTurn(host.createRequest("hold", null, result.nativeSessionId), new RecordingTurnListener(), controller.signal);
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit]), "The new turn did not pause the silence limit.");
      host.idleTimer.advance(host.timings.silenceLimit);
      const during = listener.taskEnds.length;
      controller.abort();
      await running;
      await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.silenceLimit, host.timings.idleLimit]), "The end of the turn did not restart the silence limit beside the turn's idle limit.");
      host.idleTimer.advance(host.timings.silenceLimit - 1);
      const before = listener.taskEnds.length;
      host.idleTimer.advance(1);
      await Wait.until(() => listener.taskEnds.length === 1, "The silent terminal was not stopped after the turn.");

      Assert.areEqual(JSON.stringify([0, 0]), JSON.stringify([during, before]));
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async runsATurnThatStartsWhileTheIdleAppServerStopsOnANewAppServer(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    try {
      await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
      const idle = (): boolean => {
        host.idleTimer.advance(host.timings.idleLimit);
        return adapter.clientCount === 0;
      };
      await Wait.until(idle, "The idle app-server was not stopped.");
      const result = await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => host.programs.ended.length === 1, "The idle app-server did not end.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify([2, host.programs.started[0]?.processId]), JSON.stringify([host.programs.started.length, host.programs.ended[0]]));
      Assert.areEqual(1, adapter.clientCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData("fail","thread/backgroundTerminals/terminate: terminate refused (code -32000)")
  @TestData("no", "Codex did not stop the command.")
  public async rejectsWithCodexsAnswerWhenTheTerminalIsNotStoppedAndEndsItWithCodex(mode: string, expected: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINATE: mode });
    const listener = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      let refusal: unknown = null;
      await listener.taskStarts[0]?.stop().catch((error: unknown) => { refusal = error; });

      Assert.areEqual(expected, refusal instanceof Error ? refusal.message : null);
      Assert.areEqual(0, listener.taskEnds.length);
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Ended]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
  }

  @TestMethod
  public async failsATaskWhoseCommandEndsWithAnExitCodeOtherThanZero(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINAL_EXIT: "2" });
    const listener = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("backgroundEnds"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Failed, 2]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsAStoppedTaskOnceWhenCodexEndsItsItemBeforeAnsweringTheStop(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINATE: "late" });
    const listener = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      await listener.taskStarts[0]?.stop();

      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped, null]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsTheOutputAndExitCodeCodexSendsForAStoppedTaskBeforeAnsweringTheStop(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINATE: "lateOutput" });
    const listener = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      await listener.taskStarts[0]?.stop();

      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped, 143]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status, end.exitCode])));
      Assert.areEqual(JSON.stringify(["server", "stopping\n"]), JSON.stringify([listener.taskOutputs.at(-1)?.taskId, listener.taskOutputs.at(-1)?.text]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async showsNoTaskAndReleasesTheThreadWhenCodexCannotListItsTerminals(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_LIST: "fail" });
    const listener = new RecordingTurnListener();
    const payload = async (threadId: string | null): Promise<{ unsubscribes: string[] }> => {
      const next = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), threadId), next,
        new AbortController().signal);
      return JSON.parse(next.details.find(t => t.kind === DetailKind.Text)!.text);
    };
    try {
      const result = await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      await payload(result.nativeSessionId);
      host.idleTimer.advance(host.timings.idleLimit);

      Assert.areEqual(0, listener.taskStarts.length);
      Assert.areEqual(result.nativeSessionId, (await payload(result.nativeSessionId)).unsubscribes[0] ?? null);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsTheOldAppServerForATaskAfterTheCodexCliChangesAndStopsItOnceTheTaskEnds(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile });
    const listener = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      host.idleTimer.advance(host.timings.idleLimit);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      host.installCodex(versionFile, "1.1.0");
      await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
      const during = adapter.clientCount;
      await listener.taskStarts[0]?.stop();
      await Wait.until(() => host.programs.ended.length === 1, "The task's program did not end.");

      Assert.areEqual(2, during);
      Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
      Assert.areEqual(1, adapter.clientCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async releasesTheThreadOnTheNewAppServerWhileATaskOnTheOldOneStillHoldsIt(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_STORED: "kept" });
    const listener = new RecordingTurnListener();
    const payload = async (): Promise<{ unsubscribes: string[] }> => {
      const next = new RecordingTurnListener();
      await adapter.runTurn(host.createRequest("role-payload", null, "kept"), next, new AbortController().signal);
      return JSON.parse(next.details.find(t => t.kind === DetailKind.Text)!.text);
    };
    try {
      await adapter.runTurn(host.createRequest("background", null, "kept"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      host.installCodex(versionFile, "1.1.0");
      await payload();
      host.idleTimer.advance(host.timings.idleLimit);
      const released = (await payload()).unsubscribes;
      await listener.taskStarts[0]?.stop();
      await Wait.until(() => host.programs.ended.length === 1, "The task's program did not end.");

      Assert.areEqual(JSON.stringify(["kept"]), JSON.stringify(released));
      Assert.areEqual(1, adapter.clientCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsARunningTaskThroughCodexBeforeShuttingItsAppServerDown(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
  }

  @TestMethod
  public async stopsATaskListedWhileTheAppServerShutsDown(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_LIST: "slow" });
    const listener = new RecordingTurnListener();
    let started = -1;
    try {
      await adapter.runTurn(host.createRequest("background"), listener, new AbortController().signal);
      started = listener.taskStarts.length;
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(0, started);
    Assert.areEqual(JSON.stringify([["server", BackgroundTaskStatus.Stopped]]), JSON.stringify(listener.taskEnds.map(end => [end.taskId, end.status])));
  }

  @TestMethod
  public async showsNoTaskForACommandThatEndsInItsTurn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("complete"), listener, new AbortController().signal);

      Assert.areEqual(0, listener.taskStarts.length);
    }
    finally { await adapter.shutdown(); }
  }
}
