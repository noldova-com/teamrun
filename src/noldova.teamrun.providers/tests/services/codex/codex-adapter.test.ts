/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ForkRequest, NodeTimer, SessionCarry, SessionTokens, SharedMcpFailureKind, SharedMcpValues, TitleTurn, TurnOutcome, TurnRequest, type TurnResult, TurnSteer, TurnTools } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { ApprovalKind, AuthStatus, DetailKind, MessageAttachment, type Provider, ProviderAbility, RequestedSettings, RoleApplication, SenderEnvironment, SharedMcpHeader,
  SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";
import { AppServerException, AppServerUnavailableException, CodexAdapter, ExecutableNotFoundException, type IOrphanSweep, ProcessCommand, ProviderAbilityTable, ProviderTimings, Resources, SharedMcpLaunch } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { CodexModelListRecording } from "../../fixtures/codex-model-list.recording.js";
import { CodexTestHost } from "../../fixtures/codex-test-host.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingMcpEndpoint } from "../../fixtures/recording-mcp-endpoint.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { RefusedStopStarter } from "../../fixtures/refused-stop-starter.fixture.js";
import { RunningProgramsStarter } from "../../fixtures/running-programs-starter.fixture.js";
import { TokenRecordingTurnListener } from "../../fixtures/token-recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { WatchingProcessStarter } from "../../fixtures/watching-process-starter.fixture.js";

@TestClass
export class CodexAdapterTests {
  private static readonly stopWaitsForTheWindow: string = "the row says can't, and making the Stop control and stop tool read it isn't built yet";
  private static readonly configuredModels: string = JSON.stringify({ data: [
    { model: "gpt-5.6-sol", hidden: false, displayName: "Sol", description: "Fixture", isDefault: true, defaultReasoningEffort: "low",
      supportedReasoningEfforts: [{ reasoningEffort: "high" }, { reasoningEffort: "low" }] },
    { model: "gpt-astra", hidden: false, displayName: "Astra", description: "Fixture", isDefault: false, defaultReasoningEffort: "medium",
      supportedReasoningEfforts: [{ reasoningEffort: "medium" }, { reasoningEffort: "xhigh" }], inputModalities: ["text", "image"], defaultServiceTier: "priority",
      serviceTiers: [{ id: "priority", name: "Fast", description: "" }] },
    { model: "gpt-hidden", hidden: true }], nextCursor: null });

  @TestMethod
  public async readsAThreadsCompactionSummaryFromTheProvidersProfileOrTheDefaultOne(): Promise<void> {
    using host = new CodexTestHost();
    const provider = host.createProvider();
    const native = host.directory.resolve("native");
    const write = (folder: string, text: string): void => {
      mkdirSync(join(folder, "sessions", "2026", "11", "12"), { recursive: true });
      writeFileSync(join(folder, "sessions", "2026", "11", "12", "rollout-2026-11-12T08-00-00-t-1.jsonl"),
        JSON.stringify({ timestamp: "t", type: "compacted", payload: { message: text } }));
    };
    write(provider.profileDir, "Profile summary");
    write(native, "Default summary");
    const adapter = host.createAdapter({ ...host.environment, CODEX_HOME: native });

    const read = [await adapter.readCompaction(provider, "t-1"), await adapter.readCompaction(null, "t-1")];

    Assert.areEqual("Profile summary|Default summary", read.join("|"));
  }

  @TestMethod
  public async carriesAThreadsRolloutFileIntoTheOtherAccountsProfileReplacingAnEarlierCopy(): Promise<void> {
    using host = new CodexTestHost();
    const from = host.createProvider("acc-1", "work");
    const to = host.createProvider("acc-2", "team");
    const day = join("sessions", "2026", "11", "12");
    const name = "rollout-2026-11-12T08-00-00-t-1.jsonl";
    mkdirSync(join(from.profileDir, day), { recursive: true });
    writeFileSync(join(from.profileDir, day, name), "{\"type\":\"session_meta\"}\n{\"type\":\"compacted\"}\n");
    mkdirSync(join(to.profileDir, day), { recursive: true });
    writeFileSync(join(to.profileDir, day, name), "{\"type\":\"session_meta\"}\n");
    const adapter = host.createAdapter();

    const carried = await adapter.carrySession(from, to, "t-1");

    Assert.areEqual(SessionCarry.Carried, carried);
    Assert.areEqual(readFileSync(join(from.profileDir, day, name), "utf8"), readFileSync(join(to.profileDir, day, name), "utf8"));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async carriesNoThreadWhoseRolloutFileIsMissingAndLogsAProfileItCantRead(hasSessions: boolean): Promise<void> {
    using host = new CodexTestHost();
    const from = host.createProvider("acc-1", "work");
    const to = host.createProvider("acc-2", "team");
    if (hasSessions)
      mkdirSync(join(from.profileDir, "sessions"), { recursive: true });
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);

    const carried = await adapter.carrySession(from, to, "t-1");

    Assert.areEqual(SessionCarry.Unread, carried);
    Assert.areEqual(false, existsSync(join(to.profileDir, "sessions")));
    Assert.areEqual(hasSessions ? 0 : 1, log.lines.filter(t => t.startsWith(Resources.formatSessionNotCarried("Codex", "t-1", ""))).length);
  }

  @TestMethod
  public async waitsForTheReloadOfAThreadKeptAfterTwoTurnsBeforeCarryingItSoAMoveBackReadsTheCopy(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_UNSUBSCRIBE: "slow" });
    const from = host.createProvider("acc-1", "work");
    const to = host.createProvider("acc-2", "team");
    let carried: SessionCarry | null = null;
    let threadId = String.empty;
    let reloaded: readonly string[] = [];
    try {
      threadId = String((await adapter.runTurn(host.createRequest("echo", from), new RecordingTurnListener(), new AbortController().signal)).nativeSessionId);
      await adapter.runTurn(host.createRequest("echo", from, threadId), new RecordingTurnListener(), new AbortController().signal);
      const day = join(from.profileDir, "sessions", "2026", "11", "12");
      mkdirSync(day, { recursive: true });
      writeFileSync(join(day, `rollout-2026-11-12T08-00-00-${threadId}.jsonl`), "{\"type\":\"session_meta\"}\n");
      carried = await adapter.carrySession(from, to, threadId);
      const marks = join(from.profileDir, "unarchived");
      reloaded = existsSync(marks) ? readFileSync(marks, "utf8").split(",") : [];
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(SessionCarry.Carried, carried);
    Assert.areEqual(threadId, reloaded.filter(t => t === threadId).join(","));
  }

  @TestMethod
  public async carriesNoThreadWhileItsBackgroundTaskStillRuns(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const to = host.createProvider("acc-2", "team");
    let carried: SessionCarry | null = null;
    try {
      const threadId = (await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", null,
        new RecordingMcpEndpoint(new SessionTokens(), "turn-1")), listener, new AbortController().signal)).nativeSessionId;
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      carried = await adapter.carrySession(null, to, String(threadId));
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(SessionCarry.Held, carried);
    Assert.areEqual(false, existsSync(join(to.profileDir, "sessions")));
  }

  @TestMethod
  public async turnsOffThePersonsOwnServersAndAppsInATitleThreadEvenWhenTheProviderUsesThem(): Promise<void> {
    using host = new CodexTestHost();
    const servers = { docs: { command: "docs" }, notes: { url: "https://example.com/mcp", enabled: true } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: JSON.stringify(servers) });
    const provider = host.createProvider().withOwnMcpServers(true);
    const asked = host.createRequest("echo");

    const answer = await TitleTurn.ask(adapter, new TurnRequest(provider, asked.workingDirectory, asked.prompt, asked.requested, null, [], null, null, {}, false, null, [],
      null, () => false, SharedMcpValues.none, null, true), new AbortController().signal);
    await adapter.shutdown();

    const config = (JSON.parse(String(answer)) as { thread: { config: Record<string, Record<string, unknown>> } }).thread.config;
    Assert.areEqual(JSON.stringify({ docs: { enabled: false }, notes: { enabled: false } }), JSON.stringify(config["mcp_servers"]));
    Assert.areEqual(false, config["features"]?.["apps"]);
  }

  @TestMethod
  public async asksForATitleInAThreadWithNoToolsThatCodexKeepsNowhere(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const asked = host.createRequest("echo");
    const answer = await TitleTurn.ask(adapter, new TurnRequest(null, asked.workingDirectory, asked.prompt, asked.requested, null, [], null, null, {}, false, null, [], null,
      () => false, SharedMcpValues.none, null, true), new AbortController().signal);
    const listener = new RecordingTurnListener();
    await adapter.runTurn(asked, listener, new AbortController().signal);
    await adapter.shutdown();

    const thread = (JSON.parse(String(answer)) as { thread: { ephemeral: boolean; sandbox: string; approvalPolicy: string; config: Record<string, unknown> } }).thread;
    Assert.isTrue(thread.ephemeral);
    Assert.areEqual("read-only", thread.sandbox);
    Assert.areEqual("never", thread.approvalPolicy);
    Assert.areEqual(JSON.stringify({ plugins: false, hooks: false, shell_tool: false, unified_exec: false, multi_agent: false, multi_agent_v2: false, apps: false, goals: false,
      image_generation: false, view_image: false, sleep_tool: false, skill_search: false, tool_suggest: false, browser_use: false, computer_use: false, in_app_browser: false,
      memories: false, skill_mcp_dependency_install: false, workspace_dependencies: false, code_mode_host: false }), JSON.stringify(thread.config["features"]));
    Assert.areEqual(JSON.stringify({ update_plan: { enabled: false }, view_image: false }), JSON.stringify(thread.config["tools"]));
    Assert.areEqual("disabled", thread.config["web_search"]);
    const usual = (JSON.parse(String(listener.texts[0])) as { thread: { ephemeral: boolean; config: Record<string, unknown> } }).thread;
    Assert.isFalse(usual.ephemeral);
    Assert.areEqual("{}|[]", `${JSON.stringify(thread.config["plugins"])}|${JSON.stringify(thread.config["notify"])}`);
    Assert.areEqual(JSON.stringify({ plugins: false, apps: false, browser_use: false, computer_use: false }), JSON.stringify(usual.config["features"]));
    Assert.isUndefined(usual.config["plugins"]);
    Assert.isUndefined(usual.config["notify"]);
    Assert.isUndefined(usual.config["web_search"]);
  }

  @TestMethod
  public async appliesCurrentRoleInstructionsAndUsesFullContextAfterResumeFailure(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    try {
      for (const resume of [null, "resumable", "missing"]) {
        const listener = new RecordingTurnListener();
        const request = new TurnRequest(null, host.directory.path, "role-payload incremental", new RequestedSettings("codex", null, null),
          resume, [], "Review carefully", "role-payload full transcript");
        const result = await adapter.runTurn(request, listener, new AbortController().signal);
        Assert.areEqual(TurnOutcome.Completed, result.outcome);
        const payload = JSON.parse(listener.details.find(t => t.kind === DetailKind.Text)!.text);
        Assert.areEqual("Review carefully", payload.thread.developerInstructions);
        Assert.areEqual(resume === "resumable" ? request.prompt : request.freshPrompt, payload.input[0].text);
        Assert.areEqual(RoleApplication.Instructions, listener.starts[0]?.roleApplied);
      }
      const cleared = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null),
        "resumable"), cleared, new AbortController().signal);
      Assert.areEqual("", JSON.parse(cleared.details.find(t => t.kind === DetailKind.Text)!.text).thread.developerInstructions);
      Assert.isNull(cleared.starts[0]?.roleApplied);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async setsTheTeammatesChatAndTeammateInTheThreadsShellOnStartAndResume(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    try {
      for (const resume of [null, "resumable"]) {
        const listener = new RecordingTurnListener();
        await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), resume, [], null, null,
          { TEAMRUN_SENDER_TOKEN: "c1", TEAMRUN_TEST_VARIABLE: "t1" }), listener, new AbortController().signal);
        const config = JSON.parse(listener.details.find(t => t.kind === DetailKind.Text)!.text).thread.config as Record<string, unknown>;
        Assert.areEqual("c1,t1", [config["shell_environment_policy.set.TEAMRUN_SENDER_TOKEN"], config["shell_environment_policy.set.TEAMRUN_TEST_VARIABLE"]].join(","));
        Assert.isUndefined(config["shell_environment_policy"]);
      }
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async setsTheThreadsPathAsPathInCapitalsWhateverItsSpelling(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    try {
      const listener = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), null, [], null, null,
        { Path: "command;system", TEAMRUN_COMMAND_PROGRAM: "program" }), listener, new AbortController().signal);
      const config = JSON.parse(listener.details.find(t => t.kind === DetailKind.Text)!.text).thread.config as Record<string, unknown>;
      Assert.areEqual("command;system", config["shell_environment_policy.set.PATH"]);
      Assert.isUndefined(config["shell_environment_policy.set.Path"]);
      Assert.areEqual("program", config["shell_environment_policy.set.TEAMRUN_COMMAND_PROGRAM"]);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async unsubscribesAfterEveryTurnAndReloadsOnlyAFailedThreadSoTheNextResumeCarriesItsOwnToken(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const seen: (string | null)[] = [];
    const archived: number[] = [];
    const outcomes: TurnOutcome[] = [];
    const run = async (prompt: string, resume: string | null, environment: Readonly<Record<string, string>>): Promise<string> => {
      const listener = new RecordingTurnListener();
      const controller = new AbortController();
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("codex", null, null), resume, [], null, null,
        environment), listener, controller.signal);
      if (prompt === "hold") {
        await Wait.untilOrSettled(() => listener.details.length === 1, running);
        controller.abort();
      }
      const result = await running;
      outcomes.push(result.outcome);
      if (result.outcome !== TurnOutcome.Failed)
        host.idleTimer.advance(host.timings.idleLimit);
      const echoed = listener.details.find(t => t.kind === DetailKind.Text && t.text.startsWith("{"));
      if (prompt === "role-payload") {
        seen.push(((JSON.parse(echoed!.text).thread.config ?? {}) as Record<string, string>)["shell_environment_policy.set.TEAMRUN_SENDER_TOKEN"] ?? null);
        archived.push((JSON.parse(echoed!.text).archives as string[]).length);
      }
      return result.nativeSessionId!;
    };
    try {
      const thread = await run("fail", null, { TEAMRUN_SENDER_TOKEN: "t1" });
      await run("role-payload", thread, { TEAMRUN_SENDER_TOKEN: "t2" });
      await run("hold", thread, { TEAMRUN_SENDER_TOKEN: "t3" });
      await run("role-payload", thread, { TEAMRUN_SENDER_TOKEN: "t4" });
      await run("role-payload", thread, { TEAMRUN_SENDER_TOKEN: "t5" });
      await run("role-payload", thread, {});
      await run("role-payload", thread, { TEAMRUN_SENDER_TOKEN: "t7" });
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual([TurnOutcome.Failed, TurnOutcome.Completed, TurnOutcome.Interrupted, TurnOutcome.Completed, TurnOutcome.Completed,
      TurnOutcome.Completed, TurnOutcome.Completed].join(","), outcomes.join(","));
    Assert.areEqual("t2,t4,t5,,t7", seen.map(t => t ?? String.empty).join(","));
    Assert.areEqual("1,1,1,1,1", archived.join(","));
  }

  @TestMethod
  public async stopsTheMainThreadsTasksAtShutdownBeforeItSweepsTheSubAgents(): Promise<void> {
    using host = new CodexTestHost();
    const listener = new RecordingTurnListener();
    const seen: boolean[] = [];
    const sweep: IOrphanSweep = { endOrphaned: async (_processId, _isRunning, _threadIds, stop) => {
      seen.push(listener.taskEnds.some(t => t.taskId === "server"));
      await stop();
      return [];
    } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINATE: "late" }, host.command, host.timings, new NodeTimer(), null, "linux", sweep);

    await adapter.runTurn(host.createRequest("backgroundWithSubAgent"), listener, new AbortController().signal);
    await Wait.until(() => listener.taskStarts.length === 2, "The listener did not see 2 task starts.");
    await adapter.shutdown();

    Assert.areEqual("true", seen.join(","));
  }

  @TestMethod
  public async boundsTheStopOfASubAgentOfAStoppedReplyByTheInterruptTime(): Promise<void> {
    using host = new CodexTestHost();
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    let sweeps = 0;
    const sweep: IOrphanSweep = { endOrphaned: async (_processId, _isRunning, _threadIds, stop) => {
      sweeps++;
      await stop();
      return [];
    } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_INTERRUPT: "hang" }, host.command,
      new ProviderTimings(5000, 5000, 5000, 60_000, 50, 300, 500, 500, 200, 1, 20), new NodeTimer(), null, "linux", sweep);
    try {
      const running = adapter.runTurn(host.createRequest("subAgentWakesLate"), listener, controller.signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      controller.abort();
      await Wait.until(() => sweeps === 1, "The sweep did not run.");
      await running;

      Assert.areEqual(1, sweeps);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async waitsAtShutdownForASweepAStoppedSubAgentStartedBeforeItStopsTheAppServer(): Promise<void> {
    using host = new CodexTestHost();
    const listener = new RecordingTurnListener();
    const held = Promise.withResolvers<readonly number[]>();
    let sweeps = 0;
    const sweep: IOrphanSweep = { endOrphaned: async (_processId, _isRunning, _threadIds, stop) => {
      sweeps++;
      await stop();
      return held.promise;
    } };
    const adapter = host.createAdapter(host.environment, host.command, host.timings, new NodeTimer(), null, "linux", sweep);

    await adapter.runTurn(host.createRequest("subAgent"), listener, new AbortController().signal);
    await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
    const stopped = listener.taskStarts[0]!.stop();
    await Wait.until(() => sweeps === 1, "The sweep did not run.");
    const stopping = adapter.shutdown();
    await new Promise(resolve => setImmediate(resolve));
    const during = host.programs.ended.length;
    held.resolve([]);
    await Promise.all([stopped, stopping]);

    Assert.areEqual(0, during);
    Assert.areEqual(1, host.programs.ended.length);
  }

  @TestMethod
  public async stopsARetiredClientOnlyOnceTheSweepAStoppedSubAgentStartedHasSettled(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const listener = new RecordingTurnListener();
    const provider = host.createProvider();
    const held = Promise.withResolvers<readonly number[]>();
    let sweeps = 0;
    const sweep: IOrphanSweep = { endOrphaned: async (_processId, _isRunning, _threadIds, stop) => {
      sweeps++;
      await stop();
      return held.promise;
    } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile }, host.command, host.timings, new NodeTimer(), null,
      "linux", sweep);
    try {
      await adapter.runTurn(host.createRequest("subAgent", provider), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      const stopped = listener.taskStarts[0]!.stop();
      await Wait.until(() => sweeps === 1, "The sweep did not run.");
      host.installCodex(versionFile, "1.1.0");
      await adapter.listModels(provider);
      await new Promise(resolve => setImmediate(resolve));
      const during = host.programs.ended.length;
      held.resolve([]);
      await stopped;
      const retired = host.programs.started[0]!.processId;
      host.idleTimer.advance(host.timings.idleLimit);
      await host.programs.endOf(retired);

      Assert.areEqual(0, during);
      Assert.isTrue(host.programs.ended.includes(retired));
      Assert.areEqual(2, host.programs.started.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async reloadsAThreadAStopLeftRunningPastTheGraceSoTheNextTeammateTurnCarriesItsOwnToken(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_INTERRUPT: "fail" }, host.command, host.refusedInterruptTimings);
    const controller = new AbortController();
    const held = new RecordingTurnListener();
    const listener = new RecordingTurnListener();
    try {
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "hold", new RequestedSettings("codex", null, null), null, [], null, null,
        { TEAMRUN_SENDER_TOKEN: "t1" }), held, controller.signal);
      await Wait.untilOrSettled(() => held.details.length === 1, running);
      controller.abort();
      const stopped = await running;
      const next = await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null),
        stopped.nativeSessionId, [], null, null, { TEAMRUN_SENDER_TOKEN: "t2" }), listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.areEqual(stopped.nativeSessionId, next.nativeSessionId);
      Assert.areEqual("t2", CodexAdapterTests.senderToken(listener));
      Assert.areEqual(JSON.stringify([stopped.nativeSessionId]), JSON.stringify(JSON.parse(listener.details.find(t => t.kind === DetailKind.Text)!.text).archives));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async resumesAThreadWhoseUnarchiveFailedAfterAFailedTurnWithTheNextTeammateTurnsOwnToken(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_UNARCHIVE: "failOnce" });
    const listener = new RecordingTurnListener();
    try {
      const failed = await adapter.runTurn(new TurnRequest(null, host.directory.path, "fail", new RequestedSettings("codex", null, null), null, [], null, null,
        { TEAMRUN_SENDER_TOKEN: "t1" }), new RecordingTurnListener(), new AbortController().signal);
      const next = await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null),
        failed.nativeSessionId, [], null, null, { TEAMRUN_SENDER_TOKEN: "t2" }), listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Failed, failed.outcome);
      Assert.areEqual(failed.nativeSessionId, next.nativeSessionId);
      Assert.areEqual("t2", CodexAdapterTests.senderToken(listener));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async compactsAResumedThreadInsteadOfSendingThePromptAndSaysThereIsNothingToCompactWithoutOne(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "role-payload context", new RequestedSettings("codex", null, null),
      resume, [], null, "role-payload fresh", {}, true);
    try {
      const compacted = new RecordingTurnListener();
      const fresh = new RecordingTurnListener();
      const resumed = await adapter.runTurn(request("resumable"), compacted, new AbortController().signal);
      const restarted = await adapter.runTurn(request("missing"), fresh, new AbortController().signal);
      const unresumed = new RecordingTurnListener();
      const sessionless = await adapter.runTurn(request(null), unresumed, new AbortController().signal);
      const next = await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
      Assert.areEqual("resumable", resumed.nativeSessionId);
      Assert.areEqual("turn-1", resumed.nativeTurnId);
      Assert.areEqual(JSON.stringify(["Codex compacted its context."]), JSON.stringify(compacted.texts));
      Assert.areEqual(TurnOutcome.Completed, restarted.outcome);
      Assert.isNull(restarted.nativeSessionId);
      Assert.areEqual("There's no session to compact.", fresh.texts.at(-1));
      Assert.isFalse(fresh.texts.some(t => t.startsWith("{")));
      Assert.areEqual(TurnOutcome.Completed, sessionless.outcome);
      Assert.areEqual("There's no session to compact.", unresumed.texts.at(-1));
      Assert.areEqual("thread-1", next.nativeSessionId);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async failsATurnWhoseContextIsFullAsSuchWhetherTheErrorOrTheTurnSaysSo(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const run = (prompt: string): Promise<TurnResult> => adapter.runTurn(new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("codex", null, null), null, [],
      null, null, {}), new RecordingTurnListener(), new AbortController().signal);
    try {
      const errored = await run("full");
      const ended = await run("fullTurn");
      const other = await run("fail");

      Assert.areEqual(TurnOutcome.Failed, errored.outcome);
      Assert.areEqual("Codex's context is full. Send /compact to compact it, then retry.", errored.error);
      Assert.areEqual("Codex's context is full. Send /compact to compact it, then retry.", ended.error);
      Assert.areEqual("boom", other.error);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async marksAFailedTurnAsAUsageLimitOnlyWhenAnUnretriedErrorOrTheTurnSaysSo(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const run = (prompt: string): Promise<TurnResult> => adapter.runTurn(new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("codex", null, null), null, [],
      null, null, {}), new RecordingTurnListener(), new AbortController().signal);
    try {
      const results = [await run("limit"), await run("limitTurn"), await run("limitRetried"), await run("fail")];

      Assert.areEqual(`${TurnOutcome.Failed},${TurnOutcome.Failed},${TurnOutcome.Failed},${TurnOutcome.Failed}`, results.map(t => t.outcome).join(","));
      Assert.areEqual("true,true,false,false", results.map(t => String(!Object.isNull(t.limit))).join(","));
      Assert.areEqual("null,null", results.slice(0, 2).map(t => String(t.limit?.resetsAt)).join(","));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsAFailedTeammateTurnsResultWhenTheReloadFails(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ARCHIVE: "fail" });
    try {
      const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "fail", new RequestedSettings("codex", null, null), null, [], null, null,
        { TEAMRUN_SENDER_TOKEN: "t1" }), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(TurnOutcome.Failed, result.outcome);
      Assert.areEqual("boom", result.error);
      Assert.areEqual("thread-1", result.nativeSessionId);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData("0.161.0", "Update Codex CLI to 0.163.0 or later, or close the Codex app, then retry.")
  @TestData("unknown", "Update Codex CLI to 0.163.0 or later, or close the Codex app, then retry.")
  @TestData("0.163.0", "Close the Codex app, then retry.")
  @TestData("1.0.0", "Close the Codex app, then retry.")
  public async stopsATurnAtItsFirstCommandCodexsWindowsSandboxCouldNotSetUpAndSaysWhatToDo(version: string, advice: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION: version });
    const listener = new RecordingTurnListener();
    const counted = new RecordingTurnListener();
    try {
      const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "sandboxRefresh", new RequestedSettings("codex", null, null), null, [], null, null),
        listener, new AbortController().signal);
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "interrupts", new RequestedSettings("codex", null, null), null, [], null, null),
        counted, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Failed, result.outcome);
      Assert.areEqual(`Codex's Windows sandbox couldn't update its file permissions, so Codex can't run commands. ${advice}`, result.error);
      Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Command && t.text.includes("setup refresh had errors")));
      Assert.areEqual("1", counted.details.find(t => t.kind === DetailKind.Text)?.text);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async completesATurnWhoseCommandsOnlyMentionTheSandboxFailure(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    try {
      const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "sandboxPhrase", new RequestedSettings("codex", null, null), null, [], null, null),
        listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.isNull(result.error);
      Assert.areEqual(4, listener.details.filter(t => t.kind === DetailKind.Command && t.text.includes("setup refresh had errors")).length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsATeammateTurnsResultWhenTheUnsubscribeFails(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_UNSUBSCRIBE: "fail" });
    const listener = new RecordingTurnListener();
    try {
      const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), null, [],
        null, null, { TEAMRUN_SENDER_TOKEN: "t1" }), listener, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("thread-1", result.nativeSessionId);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async deliversImagesAsLocalImageInputsAlongsideText(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const request = new TurnRequest(null, host.directory.path, "attachments", new RequestedSettings("codex", null, null), null,
      [new MessageAttachment("image.png", "image/png", 1, host.directory.resolve("image.png")),
        new MessageAttachment("notes.txt", "text/plain", 1, host.directory.resolve("notes.txt"))]);
    try {
      const result = await adapter.runTurn(request, listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      const expected = [{ type: "text", text: "attachments", text_elements: [] }, { type: "localImage", path: request.attachments[0]!.path }];
      Assert.areEqual(JSON.stringify(expected), listener.details.find(t => t.kind === DetailKind.Text)?.text);
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async steersTheRunningTurnByItsIdAndRefusesASteerOnceTheTurnEnded(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);
    const image = new MessageAttachment("image.png", "image/png", 1, host.directory.resolve("image.png"));
    const notes = new MessageAttachment("notes.txt", "text/plain", 1, host.directory.resolve("notes.txt"));
    try {
      const running = adapter.runTurn(new TurnRequest(null, host.directory.path, "hold", new RequestedSettings("codex", null, null), null), listener,
        new AbortController().signal);
      await Wait.untilOrSettled(() => offers.length === 1, running);
      const offered = offers[0];
      const taken = await offered?.(new TurnSteer("Look again", [image, notes]));
      const result = await running;
      const late = await offered?.(new TurnSteer("Too late", []));

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual("true|false", [taken, late].join("|"));
      Assert.areEqual("function|null", offers.map(t => Object.isNull(t) ? "null" : typeof t).join("|"));
      Assert.areEqual(JSON.stringify([{ type: "text", text: "Look again", text_elements: [] }, { type: "localImage", path: image.path }]),
        listener.details.find(t => t.text.includes("Look again"))?.text);
    }
    finally {
      await adapter.shutdown();
    }
  }
  @TestMethod
  public async startsItsAppServerForTheProviderItServes(): Promise<void> {
    using host = new CodexTestHost();
    const starter = new WatchingProcessStarter(() => undefined);
    const adapter = new CodexAdapter(host.command, host.environment, host.clientInfo, host.programs.wrap(starter), host.timings, host.versionReader);

    await adapter.checkSignIn(host.createProvider());
    await adapter.listModels(null);
    await adapter.shutdown();

    Assert.areEqual("codex acc-1,codex null", starter.started.map(t => `${t.origin?.kind} ${t.origin?.providerId}`).join(","));
  }

  @TestMethod
  public async checksAFoundFolderThroughLoginStatusAndNeverStartsItsAppServer(): Promise<void> {
    using host = new CodexTestHost();
    const starter = new WatchingProcessStarter(() => undefined);
    const adapterOf = (account: string, command: ProcessCommand | null = host.command): CodexAdapter => new CodexAdapter(command,
      { ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: account }, host.clientInfo, host.programs.wrap(starter), host.timings, host.versionReader);

    const checks = [await adapterOf("chatgpt").checkFoundSignIn(host.createProvider()), await adapterOf("none").checkFoundSignIn(host.createProvider()),
      await adapterOf("error").checkFoundSignIn(host.createProvider()), await adapterOf("chatgpt", null).checkFoundSignIn(host.createProvider())];

    Assert.areEqual("LoggedIn null,LoggedOut null,Error null,Error null", checks.map(t => `${t.authStatus} ${t.identity}`).join(","));
    Assert.areEqual(Resources.codexNotFound, checks[3]?.error);
    Assert.areEqual("login status acc-1,login status acc-1,login status acc-1",
      starter.started.map(t => `${t.arguments.slice(1).join(" ")} ${t.origin?.providerId}`).join(","));
  }

  @TestMethod
  public async startsEachAppServerWithTheEnvironmentReadAtItsStartAndLeavesARunningOneWithTheEnvironmentItStartedWith(): Promise<void> {
    using host = new CodexTestHost();
    const starter = new WatchingProcessStarter(() => undefined);
    starter.current = { TEAMRUN_TEST_SET_SINCE: "before" };
    const adapter = new CodexAdapter(host.command, host.environment, host.clientInfo, host.programs.wrap(starter), host.timings, host.versionReader);
    const provider = host.createProvider();

    await adapter.checkSignIn(provider);
    starter.current = { TEAMRUN_TEST_SET_SINCE: "after" };
    await adapter.listModels(null);
    await adapter.checkSignIn(provider);
    await adapter.shutdown();

    Assert.areEqual("acc-1 before,null after",
      starter.started.map((t, i) => `${t.origin?.providerId} ${starter.environments[i]?.["TEAMRUN_TEST_SET_SINCE"]}`).join(","));
  }

  @TestMethod
  public async signsOutThroughTheProfilesAppServerSoItsNextCheckReadsSignedOut(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const failing = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_LOGOUT: "fail" });
    const missing = host.createAdapter(host.environment, null);
    const provider = host.createProvider();

    const before = await adapter.checkSignIn(provider);
    await adapter.signOut(provider);
    const after = await adapter.checkSignIn(provider);
    const refused = await Assert.throwsAsync(() => failing.signOut(host.createProvider()), Error);
    await Assert.throwsAsync(() => missing.signOut(host.createProvider()), Error);
    await Promise.all([adapter.shutdown(), failing.shutdown()]);

    Assert.areEqual([AuthStatus.LoggedIn, AuthStatus.LoggedOut].join(","), [before.authStatus, after.authStatus].join(","));
    Assert.isTrue(refused.message.includes("logout failed"), refused.message);
  }

  @TestMethod
  public async describesItselfAndChecksSignIn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const loggedOut = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const apiKey = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "apikey" });
    const failing = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "error" });
    const missing = host.createAdapter(host.environment, null);

    const signedIn = await adapter.checkSignIn(host.createProvider());
    const signedOut = await loggedOut.checkSignIn(host.createProvider());
    const keyed = await apiKey.checkSignIn(host.createProvider());
    const failed = await failing.checkSignIn(host.createProvider());
    const notFound = await missing.checkSignIn(host.createProvider());
    await Promise.all([adapter.shutdown(), loggedOut.shutdown(), apiKey.shutdown(), failing.shutdown()]);

    Assert.areEqual("codex", adapter.descriptor.id);
    Assert.isTrue(adapter.descriptor.abilities === ProviderAbilityTable.codex);
    Assert.areEqual("Codex", adapter.descriptor.displayName);
    Assert.isTrue(adapter.descriptor.supportsSignIn);
    Assert.isTrue(adapter.descriptor.supportsSignOut);
    Assert.areEqual(JSON.stringify({ variable: "CODEX_HOME", signInCommand: null, usualFolder: "/work/codex-home", toolCommand: null, signInVariables: {}, signInValues: {}, personFolders: [] }),
      JSON.stringify(host.createAdapter({ ...host.environment, CODEX_HOME: "/work/codex-home" }).descriptor.profile?.toJson()));
    Assert.areEqual(join(homedir(), ".codex"), host.createAdapter({ ...host.environment, CODEX_HOME: " " }).descriptor.profile?.usualFolder);
    Assert.areEqual([join(homedir(), ".codex"), "/work/codex-home"].join(),
      host.createAdapter({ ...host.environment, CODEX_HOME: "/work/codex-home" }).profileSearch.folders.join());
    Assert.areEqual("config.toml,sessions,history.jsonl,version.json,log", adapter.profileSearch.entries.join());
    Assert.isNull(adapter.descriptor.ownMcpServersUnavailable);
    Assert.areEqual(Resources.codexOwnMcpServersNote, adapter.descriptor.ownMcpServersNote);
    Assert.areEqual("the apps on your Codex account", adapter.descriptor.ownMcpServersShortNote);
    Assert.areEqual("true:true:true", [adapter.descriptor.reportsLimits, adapter.descriptor.carriesSessions, adapter.descriptor.sessionsChecked].join(":"));
    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual("dev@example.com", signedIn.identity?.email);
    Assert.areEqual("plus", signedIn.identity?.plan);
    Assert.areEqual("9.9.9", signedIn.harnessVersion);
    Assert.areEqual(AuthStatus.LoggedOut, signedOut.authStatus);
    Assert.areEqual("apiKey", keyed.identity?.authMethod);
    Assert.areEqual(AuthStatus.Error, failed.authStatus);
    Assert.areEqual("account/read: account unavailable (code -32000)", failed.error);
    Assert.areEqual(AuthStatus.Error, notFound.authStatus);
    Assert.isTrue(notFound.error?.includes("Codex CLI was not found") ?? false);
    Assert.isTrue(existsSync(host.directory.resolve("profile")));
  }

  @TestMethod
  public async signsInWithChatGptThroughThePageItAsksToOpen(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const early = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: "early" });
    const signedIn = host.createAdapter();
    const links: string[] = [];
    const listener = { openLink: (url: string): void => { links.push(url); } };
    const provider = host.createProvider();
    try {
      await adapter.signIn(provider, new AbortController().signal, listener);
      const checked = await adapter.checkSignIn(provider);
      await early.signIn(provider, new AbortController().signal, listener);
      await signedIn.signIn(provider, new AbortController().signal, listener);

      Assert.areEqual(JSON.stringify(["https://auth.openai.com/oauth/authorize?state=fake", "https://auth.openai.com/oauth/authorize?state=fake"]), JSON.stringify(links));
      Assert.areEqual(AuthStatus.LoggedIn, checked.authStatus);
      Assert.areEqual("signed-in@example.com", checked.identity?.email);
      Assert.areEqual(1, adapter.clientCount);
      Assert.isFalse(existsSync(host.directory.resolve("profile", "login-cancelled")));
    }
    finally {
      await Promise.all([adapter.shutdown(), early.shutdown(), signedIn.shutdown()]);
    }
  }

  @TestMethod
  public async reportsASignInCodexFailsRefusesOrLeavesUnfinished(): Promise<void> {
    using host = new CodexTestHost();
    const create = (login: string): CodexAdapter => host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: login });
    const failing = create("fail");
    const unfinishing = create("failNoError");
    const refusing = create("refuse");
    const exiting = create("exit");
    const listener = { openLink: (): void => undefined };
    const signal = new AbortController().signal;
    try {
      const failed = await Assert.throwsAsync(() => failing.signIn(host.createProvider(), signal, listener), Error);
      const unfinished = await Assert.throwsAsync(() => unfinishing.signIn(host.createProvider(), signal, listener), Error);
      const refused = await Assert.throwsAsync(() => refusing.signIn(host.createProvider(), signal, listener), AppServerException);
      await Assert.throwsAsync(() => exiting.signIn(host.createProvider(), signal, listener), Error);
      const missing = await Assert.throwsAsync(() => host.createAdapter(host.environment, null).signIn(host.createProvider(), signal, listener), ExecutableNotFoundException);

      Assert.areEqual("Codex couldn't sign in: Login server error: access denied.", failed.message);
      Assert.areEqual("Codex couldn't sign in: the sign-in did not complete.", unfinished.message);
      Assert.areEqual("account/login/start: ChatGPT login is disabled. Use API key login instead. (code -32600)", refused.message);
      Assert.isTrue(missing.message.includes("Codex CLI was not found"));
    }
    finally {
      await Promise.all([failing.shutdown(), unfinishing.shutdown(), refusing.shutdown(), exiting.shutdown()]);
    }
  }

  @TestMethod
  public async refusesASignInPageOffCodexsHostOverHttpsAndCancelsItsLogin(): Promise<void> {
    using host = new CodexTestHost();
    const pages = ["http://auth.openai.com/oauth/authorize?state=fake", "https://auth.example.com/oauth/authorize?state=fake", "file:///etc/passwd",
      "teamrun-test://sign-in", "https://someone:secret@auth.openai.com/oauth/authorize", "https://auth.openai.com.example.com/oauth/authorize",
      "https://auth.openai.com:8443/oauth/authorize", "not a page"];
    const links: string[] = [];
    const listener = { openLink: (url: string): void => { links.push(url); } };
    const refusals: string[] = [];
    const cancelled: string[] = [];
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: "hold",
      TEAMRUN_FAKE_CODEX_AUTH_URLS: JSON.stringify(pages) });
    const provider = host.createProvider();
    const cancelledFile = host.directory.resolve("profile", "login-cancelled");
    let starts = String.empty;
    try {
      for (let attempt = 0; attempt < pages.length; attempt++) {
        rmSync(cancelledFile, { force: true });
        refusals.push((await Assert.throwsAsync(() => adapter.signIn(provider, new AbortController().signal, listener), Error)).message);
        await adapter.checkSignIn(provider);
        cancelled.push(readFileSync(cancelledFile, "utf8"));
      }
      starts = readFileSync(host.directory.resolve("profile", "login-starts"), "utf8");
    }
    finally {
      await adapter.shutdown();
    }

    Assert.areEqual(pages.map(() => "Codex asked to open a sign-in page that isn't on auth.openai.com over HTTPS, so TeamRun didn't open it.").join("\n"), refusals.join("\n"));
    Assert.areEqual(pages.map(() => "login-1").join(","), cancelled.join(","));
    Assert.areEqual(String(pages.length), starts);
    Assert.areEqual(0, links.length);
  }

  @TestMethod
  public async endsASignInAtOnceWhenItIsAbortedBeforeCodexStartsTheLoginAndCancelsTheLoginOnceItStarts(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: "holdStart" });
    const provider = host.createProvider();
    const links: string[] = [];
    const controller = new AbortController();
    try {
      const signing = adapter.signIn(provider, controller.signal, { openLink: (url: string): void => { links.push(url); } })
        .then(() => "resolved", (error: unknown) => error instanceof Error ? error.message : null);
      await Wait.untilOrSettled(() => existsSync(host.directory.resolve("profile", "login-started")), signing);
      controller.abort();
      const cancelled = await signing;
      await adapter.checkSignIn(provider);
      await adapter.checkSignIn(provider);

      Assert.areEqual("The Codex sign-in was cancelled.", cancelled);
      Assert.areEqual("login-1", readFileSync(host.directory.resolve("profile", "login-cancelled"), "utf8"));
      Assert.areEqual(0, links.length);
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async failsASignInWhoseEndCodexReportsUnreadablyAndCancelsItsLogin(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: "unreadable" });
    const provider = host.createProvider();
    const cancelledFile = host.directory.resolve("profile", "login-cancelled");
    try {
      const failed = await Assert.throwsAsync(() => adapter.signIn(provider, new AbortController().signal, { openLink: (): void => undefined }), Error);
      await adapter.checkSignIn(provider);

      Assert.areEqual("Codex reported the end of the sign-in in a form TeamRun can't read.", failed.message);
      Assert.areEqual("login-1", readFileSync(cancelledFile, "utf8"));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async cancelsTheLoginWhenItsSignInIsAborted(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: "hold" });
    const links: string[] = [];
    const opened = Promise.withResolvers<void>();
    const listener = { openLink: (url: string): void => { links.push(url); opened.resolve(); } };
    const controller = new AbortController();
    try {
      const signing = adapter.signIn(host.createProvider(), controller.signal, listener).then(() => "resolved", (error: unknown) => error instanceof Error ? error.message : null);
      await Promise.race([opened.promise, signing]);
      controller.abort();
      const cancelled = await signing;

      Assert.areEqual("The Codex sign-in was cancelled.", cancelled);
      Assert.areEqual("login-1", readFileSync(host.directory.resolve("profile", "login-cancelled"), "utf8"));
      Assert.areEqual(1, links.length);
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async startsNoLoginForASignInAbortedBeforeItsLoginStarts(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: "hold" });
    const listener = { openLink: (): void => undefined };
    const aborted = new AbortController();
    aborted.abort();
    const connecting = new AbortController();
    try {
      const early = await Assert.throwsAsync(() => adapter.signIn(host.createProvider("acc-2", "other"), aborted.signal, listener), Error);
      const signing = adapter.signIn(host.createProvider(), connecting.signal, listener);
      connecting.abort();
      const late = await Assert.throwsAsync(() => signing, Error);
      await adapter.checkSignIn(host.createProvider());

      Assert.areEqual("The Codex sign-in was cancelled.", early.message);
      Assert.areEqual("The Codex sign-in was cancelled.", late.message);
      Assert.areEqual(1, adapter.clientCount);
      Assert.isFalse(existsSync(host.directory.resolve("profile", "login-started")));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async endsAnAbortedSignInEvenWhenCodexRefusesItsCancel(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: "holdRefusingCancel" });
    const provider = host.createProvider();
    let opened = false;
    const controller = new AbortController();
    try {
      const signing = adapter.signIn(provider, controller.signal, { openLink: () => { opened = true; } }).then(() => "resolved", (error: unknown) => error instanceof Error ? error.message : null);
      await Wait.untilOrSettled(() => opened, signing);
      controller.abort();
      const cancelled = await signing;
      const checked = await adapter.checkSignIn(provider);

      Assert.areEqual("The Codex sign-in was cancelled.", cancelled);
      Assert.areEqual(AuthStatus.LoggedOut, checked.authStatus);
      Assert.isFalse(existsSync(host.directory.resolve("profile", "login-cancelled")));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async endsAnAbortedSignInAfterTheAbortGraceWhenCodexNeverAnswersItsCancel(): Promise<void> {
    using host = new CodexTestHost();
    const timings = new ProviderTimings(5000, 5000, 5000, 60_000, 1000, 300, 500, 500, 200, 1, 20);
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none", TEAMRUN_FAKE_CODEX_LOGIN: "holdIgnoringCancel" }, host.command, timings);
    const opened = Promise.withResolvers<void>();
    const controller = new AbortController();
    try {
      const signing = adapter.signIn(host.createProvider(), controller.signal, { openLink: (): void => opened.resolve() })
        .then(() => "resolved", (error: unknown) => error instanceof Error ? error.message : null);
      await Promise.race([opened.promise, signing]);
      const aborted = Date.now();
      controller.abort();
      const cancelled = await signing;
      const waited = Date.now() - aborted;

      Assert.areEqual("The Codex sign-in was cancelled.", cancelled);
      Assert.areEqual("login-1", readFileSync(host.directory.resolve("profile", "login-cancelled"), "utf8"));
      Assert.isTrue(waited < 30_000);
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async endsASignInAbortedWhileItsAppServerStartsOrReadsTheAccountAtOnce(): Promise<void> {
    using host = new CodexTestHost();
    const timings = new ProviderTimings(5000, 5000, 60_000, 60_000, 1000, 300, 500, 500, 200, 1, 20);
    const starting = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_INIT: "hang" }, host.command, timings);
    const reading = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "hang" }, host.command, timings);
    const sign = (adapter: CodexAdapter, signal: AbortSignal): Promise<string | null> => adapter.signIn(host.createProvider(), signal, { openLink: (): void => undefined })
      .then(() => "resolved", (error: unknown) => error instanceof Error ? error.message : null);
    try {
      const whileStarting = new AbortController();
      const startingSignIn = sign(starting, whileStarting.signal);
      const startingAborted = Date.now();
      whileStarting.abort();
      const startingEnd = await startingSignIn;
      const startingWait = Date.now() - startingAborted;
      const whileReading = new AbortController();
      const readingSignIn = sign(reading, whileReading.signal);
      await Wait.untilOrSettled(() => existsSync(host.directory.resolve("profile", "account-read")), readingSignIn);
      const readingAborted = Date.now();
      whileReading.abort();
      const readingEnd = await readingSignIn;
      const readingWait = Date.now() - readingAborted;

      Assert.areEqual("The Codex sign-in was cancelled.", startingEnd);
      Assert.isTrue(startingWait < 30_000);
      Assert.areEqual("The Codex sign-in was cancelled.", readingEnd);
      Assert.isTrue(readingWait < 30_000);
    }
    finally {
      await Promise.all([starting.shutdown(), reading.shutdown()]);
    }
  }

  @TestMethod
  public async stopsAnAppServerStillInInitializeAtShutdown(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_INIT: "hang" }, host.command,
      new ProviderTimings(5000, 5000, 60_000, 60_000, 1000, 300, 500, 500, 200, 1, 20));
    const listing = adapter.listModels(host.createProvider()).then(() => null, (error: unknown) => error);
    await Wait.untilOrSettled(() => existsSync(host.directory.resolve("profile", "initialize-held")), listing);

    const stopping = Date.now();
    await adapter.shutdown();
    const stopped = Date.now() - stopping;

    Assert.isInstanceOf(await listing, AppServerUnavailableException);
    Assert.isTrue(stopped < 30_000);
    Assert.areEqual(0, adapter.clientCount);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async stopsEveryAppServerWhenOneStopFailsAndThenReportsIt(): Promise<void> {
    using host = new CodexTestHost();
    const starter = new RefusedStopStarter({ TEAMRUN_FAKE_CODEX_INIT: "hang", TEAMRUN_FAKE_CODEX_IGNORE_STDIN_END: "1" });
    const adapter = new CodexAdapter(host.command, host.environment, host.clientInfo, host.programs.wrap(starter),
      new ProviderTimings(5000, 5000, 60_000, 60_000, 1000, 300, 1, 500, 200, 1, 20), host.versionReader);
    await adapter.listModels(null);
    const listing = adapter.listModels(host.createProvider()).then(() => null, (error: unknown) => error);
    await Wait.untilOrSettled(() => existsSync(host.directory.resolve("profile", "initialize-held")), listing);

    const failure = await adapter.shutdown().then(() => null, (error: unknown) => error);
    await host.programs.endedAt(2);

    Assert.areEqual("stop refused", failure instanceof Error ? failure.message : null);
    Assert.isInstanceOf(await listing, AppServerUnavailableException);
    Assert.areEqual(0, adapter.clientCount);
    Assert.areEqual(2, host.programs.started.length);
  }

  @TestMethod
  public async stopsAVersionReadStillRunningAtShutdownAndWaitsForIt(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile,
      TEAMRUN_FAKE_CODEX_VERSION_RELEASE: host.directory.resolve("version-release") });
    const provider = host.createProvider();
    await adapter.checkSignIn(provider);
    host.installCodex(versionFile, "1.1.0");
    const checking = adapter.checkSignIn(provider).then(() => null, (error: unknown) => error);
    await Wait.untilOrSettled(() => host.versionReader.reads === 1, checking);

    const stopping = Date.now();
    await adapter.shutdown();
    const stopped = Date.now() - stopping;
    const ended = host.versionReader.ended;
    await checking;

    Assert.areEqual(1, ended);
    Assert.isTrue(stopped < 4000);
    Assert.areEqual(0, adapter.clientCount);
  }

  @TestMethod
  public async listsModelsThroughOneProcessPerProfile(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const missing = host.createAdapter(host.environment, null);

    const [first, second] = await Promise.all([adapter.listModels(null), adapter.listModels(null)]);
    const forProvider = await adapter.listModels(host.createProvider());
    const notFound = await Assert.throwsAsync(() => missing.listModels(null), ExecutableNotFoundException);
    const clientCount = adapter.clientCount;
    await adapter.shutdown();

    Assert.areEqual("gpt-5.6-sol", first.models.map(t => t.id).join(","));
    Assert.areEqual("gpt-5.6-sol", second.models.map(t => t.id).join(","));
    Assert.areEqual("gpt-5.6-sol", forProvider.models.map(t => t.id).join(","));
    Assert.areEqual(true, first.signedIn);
    Assert.areEqual(2, clientCount);
    Assert.areEqual(0, adapter.clientCount);
    Assert.isTrue(notFound.message.includes("npm install -g @openai/codex"));
  }

  @TestMethod
  public async listsModelsWithWhetherItsAccountAnswerSaysItIsSignedIn(): Promise<void> {
    using host = new CodexTestHost();
    const loggedOut = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const apiKey = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "apikey" });
    const noAuth = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "noauth" });
    const failing = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "error" });
    const hanging = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "hang" }, host.command,
      new ProviderTimings(5000, 5000, 5000, 250, 1000, 300, 500, 500, 200, 1, 20));

    const [signedOut, keyed, unneeded, failed, slow] = await Promise.all([loggedOut.listModels(null), apiKey.listModels(null), noAuth.listModels(null),
      failing.listModels(null), hanging.listModels(null)]);
    await Promise.all([loggedOut.shutdown(), apiKey.shutdown(), noAuth.shutdown(), failing.shutdown(), hanging.shutdown()]);

    Assert.areEqual(false, signedOut.signedIn);
    Assert.areEqual("gpt-5.6-sol", signedOut.models.map(t => t.id).join(","));
    Assert.areEqual(true, keyed.signedIn);
    Assert.isNull(unneeded.signedIn);
    Assert.isNull(failed.signedIn);
    Assert.areEqual("gpt-5.6-sol", failed.models.map(t => t.id).join(","));
    Assert.isNull(slow.signedIn);
    Assert.areEqual("gpt-5.6-sol", slow.models.map(t => t.id).join(","));
  }

  @TestMethod
  public async streamsAgentMessageDeltasUnderTheItemId(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("stream"), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    const streamed = listener.details.filter(t => t.providerItemId === "s1");
    Assert.isTrue(streamed.length >= 2, String(streamed.length));
    Assert.areEqual("Hello stream", streamed[streamed.length - 1]?.text);
    Assert.isTrue(streamed.every(t => "Hello stream".startsWith(t.text)));
    Assert.isFalse(listener.details.some(t => t.providerItemId === "s2"));
  }

  @TestMethod
  public async notesInTheReplyOnceEachMethodAndFailureItsHandlersFailOn(): Promise<void> {
    using host = new CodexTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const listener = new RecordingTurnListener();
    const methods = ["thread/started", "item/completed"];

    const result = await adapter.runTurn(host.createRequest("garbage"), listener, new AbortController().signal);
    await adapter.shutdown();

    const failed = listener.details.flatMap(t => t.kind === DetailKind.Note ? methods.filter(m => t.text.startsWith(Resources.formatCodexNotificationFailed(m, ""))) : []);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify(["thread/started", "item/completed"]), JSON.stringify(failed));
    Assert.isTrue(listener.texts.some(t => t.includes("after garbage")));
    Assert.areEqual(0, log.lines.filter(t => methods.some(m => t.startsWith(Resources.formatCodexNotificationFailed(m, "")))).length);
  }

  @TestMethod
  public async logsAFailureOnItsBackgroundTasksNotificationAfterTheTurnReturned(): Promise<void> {
    using host = new CodexTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_TERMINAL_DELTA: "broken" }, host.command, host.timings, undefined, log);
    const listener = new RecordingTurnListener();
    const failed = (text: string): boolean => text.startsWith(Resources.formatCodexNotificationFailed("item/commandExecution/outputDelta", ""));
    try {
      const result = await adapter.runTurn(host.createRequest("backgroundEnds"), listener, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(1, log.lines.filter(failed).length);
      Assert.isFalse(listener.texts.some(failed));
      Assert.areEqual(JSON.stringify([{ taskId: "server", text: "starting\n" }]), JSON.stringify(listener.taskOutputs));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async streamsACompleteTurn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("complete"), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("thread-1", result.nativeSessionId);
    Assert.areEqual("gpt-5.6-mini", result.observed.model);
    Assert.areEqual("9.9.9", result.observed.harnessVersion);
    Assert.isFalse(Object.hasOwn(result.observed.toJson(), "identity"));
    Assert.isFalse(JSON.stringify(listener.observations.map(t => t.toJson())).includes("dev@example.com"));
    Assert.areEqual("thread-1", listener.starts[0]?.nativeSessionId);
    Assert.isFalse(listener.starts[0]?.resumedNativeSession ?? true);
    Assert.areEqual("gpt-5.6-sol", listener.observations[0]?.model);
    Assert.isNull(listener.observations[0]?.effort);
    const expectedTexts = [
      "Working on it", "Think\nMore", "Step 1", "$ ls\n",
      "Edited a.ts, d.ts; Moved b.ts to c.ts", "Generated image: D:/work/out.png",
      "Codex item plugin", "MCP tool srv/tool", "Tool dyn",
      "Web search: cats", "Codex compacted its context.", "Codex rerouted the model from gpt-5.6-sol to gpt-5.6-mini (capacity).",
      "Retryable error: rate limited", "Error: fatal", "Done"
    ];
    Assert.areEqual(expectedTexts.join("|"), listener.texts.filter(t => !t.startsWith("$ npm test")).join("|"));
    Assert.isTrue(listener.texts.some(t => t.startsWith("$ npm test\n…") && t.endsWith("(exit 0)")));
    Assert.areEqual(DetailKind.Error, listener.details.find(t => t.text === "Error: fatal")?.kind);
  }

  @TestMethod
  public async listsItsPresetsAtDefaultAndStartsAThreadInTheChosenOneButNoUnlistedOne(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const run = async (mode: string | null): Promise<string> => {
      const listener = new RecordingTurnListener();
      await adapter.runTurn(host.createRequest("echo", null, null, null, null, null, mode), listener, new AbortController().signal);
      const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> };
      return `${String(echoed.thread["sandbox"])}+${String(echoed.thread["approvalPolicy"])}`;
    };

    const list = await adapter.listModels(null);
    const threads = [await run(null), await run("read-only"), await run("auto"), await run("full-access"), await run("plan"), await run("unknown")];
    await adapter.shutdown();

    Assert.areEqual("read-only:Read Only:false:true|auto:Default:false:false|full-access:Full Access:true:false|plan:Plan:false:true",
      list.modes.map(t => `${t.id}:${t.name}:${String(t.unrestricted)}:${String(t.readOnly)}`).join("|"));
    Assert.areEqual("auto", list.defaultMode);
    Assert.areEqual(list.modes.map(t => t.id).join(","), adapter.modes.map(t => t.id).join(","));
    Assert.areEqual("auto", adapter.defaultMode);
    Assert.isFalse("explorerMode" in adapter);
    Assert.areEqual("Codex runs the commands your Codex rules allow outside its read-only sandbox, and TeamRun can't turn those rules off for one chat, so an explorer there could change files.", adapter.explorerUnavailable);
    Assert.isFalse("backgroundSubAgentsNote" in adapter);
    Assert.isTrue(adapter.takesTeamRunTools);
    Assert.areEqual("plan", adapter.planMode);
    Assert.areEqual("workspace-write+on-request|read-only+on-request|workspace-write+on-request|danger-full-access+never|read-only+on-request|workspace-write+on-request",
      threads.join("|"));
  }

  @TestMethod
  public async goesBackToDefaultOnceAfterAPlanningTurnEvenWhenTheResumeDoesntReportItsMode(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_PLAN: "unreported" });
    const run = async (requested: RequestedSettings, resume: string | null): Promise<[string | null, string | null]> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "collaboration", requested, resume), listener, new AbortController().signal);
      const echoed = JsonReader.parse(String(listener.texts[0]));
      return [result.nativeSessionId, Object.isNull(echoed.toJson()["collaboration"] ?? null) ? null : echoed.readObject("collaboration").readString("mode")];
    };

    const [thread, planned] = await run(new RequestedSettings("codex", "gpt-x", "high", null, "full-access", true), null);
    const [, followed] = await run(new RequestedSettings("codex", null, null, null, "full-access"), thread);
    const [, settled] = await run(new RequestedSettings("codex", null, null, null, "full-access"), thread);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify(["plan", "default", null]), JSON.stringify([planned, followed, settled]));
  }

  @TestMethod
  public async plansInCodexsPlanCollaborationModeOnTheThreadsModelThenGoesBackToDefaultOnceAndOnlyOnce(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const run = async (requested: RequestedSettings, resume: string | null): Promise<[string | null, string]> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "collaboration", requested, resume), listener, new AbortController().signal);
      const echoed = JsonReader.parse(String(listener.texts[0])).toJson();
      return [result.nativeSessionId, `${JSON.stringify(echoed["collaboration"])}@${String(echoed["sandbox"])}+${String(echoed["approvalPolicy"])}`];
    };

    const [thread, planned] = await run(new RequestedSettings("codex", "gpt-x", "high", null, "full-access", true), null);
    const [, followed] = await run(new RequestedSettings("codex", null, null, null, "full-access"), thread);
    const [, settled] = await run(new RequestedSettings("codex", null, null, null, "full-access"), thread);
    const collaborationOf = (echoed: string): string => echoed.replace(/@.*$/su, "");
    const [, chosen] = await run(new RequestedSettings("codex", null, null, null, "plan"), null);
    const [, plain] = await run(new RequestedSettings("codex", null, null, null, "auto"), null);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([
      "{\"mode\":\"plan\",\"settings\":{\"model\":\"gpt-x\",\"reasoning_effort\":\"high\",\"developer_instructions\":null}}@read-only+on-request",
      "{\"mode\":\"default\",\"settings\":{\"model\":\"gpt-x\",\"reasoning_effort\":\"high\",\"developer_instructions\":null}}",
      "null",
      "{\"mode\":\"plan\",\"settings\":{\"model\":\"gpt-5.6-sol\",\"reasoning_effort\":null,\"developer_instructions\":null}}@read-only+on-request",
      "null@workspace-write+on-request"
    ]), JSON.stringify([planned, collaborationOf(followed), collaborationOf(settled), chosen, plain]));
  }

  @TestMethod
  public async failsAPlanTurnVisiblyWhenCodexRefusesItsPlanCollaborationModeAndStillRunsOtherTurns(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_PLAN: "refuse" });
    const run = (requested: RequestedSettings): Promise<TurnResult> =>
      adapter.runTurn(new TurnRequest(null, host.directory.path, "collaboration", requested, null), new RecordingTurnListener(), new AbortController().signal);

    const refused = await run(new RequestedSettings("codex", null, null, null, "auto", true));
    const plain = await run(new RequestedSettings("codex", null, null, null, "auto"));
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([TurnOutcome.Failed, TurnOutcome.Completed]), JSON.stringify([refused.outcome, plain.outcome]));
    Assert.isTrue(refused.error?.includes("turn/start.collaborationMode requires experimentalApi capability") === true, refused.error ?? "");
  }

  @TestMethod
  public async startsThreadsWithTheIsolatedConfigurationAndProfile(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, OPENAI_API_KEY: "secret" });
    const provider = host.createProvider("acc-2", "work-profile");
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo", provider, null, "gpt-x", "high"), listener, new AbortController().signal);
    await adapter.shutdown();

    const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown>; configRead: Record<string, unknown>; codexHome: string | null; apiKey: string | null };
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("workspace-write", echoed.thread["sandbox"]);
    Assert.areEqual("on-request", echoed.thread["approvalPolicy"]);
    Assert.areEqual(host.directory.path, echoed.thread["cwd"]);
    Assert.areEqual("gpt-x", echoed.thread["model"]);
    Assert.areEqual(host.directory.path, echoed.configRead["cwd"]);
    Assert.areEqual("{\"mcp_servers\":{},\"features\":{\"plugins\":false,\"apps\":false,\"browser_use\":false,\"computer_use\":false},\"tools\":{\"update_plan\":{\"enabled\":true}},\"model_reasoning_effort\":\"high\"}",
      JSON.stringify(echoed.thread["config"]));
    Assert.areEqual(host.directory.resolve("work-profile"), echoed.codexHome);
    Assert.isNull(echoed.apiKey);
    Assert.areEqual("high", result.observed.effort);
    Assert.areEqual("gpt-x", result.observed.model);
    Assert.isTrue(existsSync(host.directory.resolve("work-profile")));
  }

  @TestMethod
  public async leavesThePersonsAgentsMdAndMemoriesToCodexInTheirOwnHomeInAChatTurnAndTurnsMemoriesOffOnlyInATitleThread(): Promise<void> {
    using host = new CodexTestHost();
    const own = host.directory.resolve(".codex");
    mkdirSync(join(own, "memories"), { recursive: true });
    writeFileSync(join(own, "AGENTS.md"), "Answer in haiku.");
    writeFileSync(join(own, "memories", "notes.md"), "Prefers tabs.");
    const adapter = host.createAdapter({ ...host.environment, CODEX_HOME: own });
    const native = new RecordingTurnListener();
    const usual = new RecordingTurnListener();
    const asked = host.createRequest("echo");

    await adapter.runTurn(asked, native, new AbortController().signal);
    await adapter.runTurn(host.createRequest("echo", host.createProvider("acc-1", ".codex")), usual, new AbortController().signal);
    const answer = await TitleTurn.ask(adapter, new TurnRequest(null, asked.workingDirectory, asked.prompt, asked.requested, null, [], null, null, {}, false, null, [], null,
      () => false, SharedMcpValues.none, null, true), new AbortController().signal);
    await adapter.shutdown();

    const turns = [native, usual].map(t => JSON.parse(String(t.texts[0])) as { thread: { developerInstructions: string; config: Record<string, unknown> }; codexHome: string });
    Assert.areEqual(JSON.stringify([own, own]), JSON.stringify(turns.map(t => t.codexHome)));
    for (const turn of turns) {
      Assert.areEqual(String.empty, turn.thread.developerInstructions);
      Assert.areEqual(JSON.stringify({ plugins: false, apps: false, browser_use: false, computer_use: false }),
        JSON.stringify(turn.thread.config["features"]));
      Assert.isFalse(["memories", "project_doc_max_bytes", "model_instructions_file", "experimental_instructions_file"].some(t => t in turn.thread.config));
    }
    const title = (JSON.parse(String(answer)) as { thread: { config: Record<string, Record<string, unknown>> } }).thread;
    Assert.areEqual(false, title.config["features"]?.["memories"]);
  }

  @TestMethod
  public async startsAThreadWithAChosenContextWindowAsItsModelContextWindow(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo", null, null, null, null, null, null, 128_000), listener, new AbortController().signal);
    await adapter.shutdown();

    const echoed = JSON.parse(String(listener.texts[0])) as { thread: { config: Record<string, unknown> } };
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(128_000, echoed.thread.config["model_context_window"]);
  }

  @TestMethod
  public async offersOnly128KUntilAThreadWithoutAChosenWindowReportsTheModelsOwnWindow(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_WINDOW: "258400" });
    const windowsOf = async (): Promise<string> =>
      JSON.stringify((await adapter.listModels(null)).models.find(t => t.id === "gpt-5.6-sol")?.contextWindows?.toJson() ?? null);

    const before = await windowsOf();
    const chosen = await adapter.runTurn(host.createRequest("window", null, null, null, null, null, null, 128_000), new RecordingTurnListener(), new AbortController().signal);
    const afterChosen = await windowsOf();
    const own = await adapter.runTurn(host.createRequest("window"), new RecordingTurnListener(), new AbortController().signal);
    const afterOwn = await windowsOf();
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, chosen.outcome);
    Assert.areEqual(TurnOutcome.Completed, own.outcome);
    Assert.areEqual(JSON.stringify({ presets: [128_000], minimum: 64_000, maximum: 128_000, reported: false }), before);
    Assert.areEqual(before, afterChosen);
    Assert.areEqual(JSON.stringify({ presets: [128_000, 256_000, 272_000], minimum: 64_000, maximum: 272_000, reported: true }), afterOwn);
  }

  @TestMethod
  @TestData(60_800, "{\"presets\":[64000],\"minimum\":64000,\"maximum\":64000,\"reported\":true}")
  @TestData(475_000, "{\"presets\":[128000,256000,500000],\"minimum\":64000,\"maximum\":500000,\"reported\":true}")
  @TestData(60_000, "null")
  public async readsTheModelsOwnWindowAsTheReportedOneOver95PercentAsTheCaptureOnIssue1390Showed(reported: number, expected: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_WINDOW: String(reported) });

    await adapter.runTurn(host.createRequest("window"), new RecordingTurnListener(), new AbortController().signal);
    const windows = (await adapter.listModels(null)).models.find(t => t.id === "gpt-5.6-sol")?.contextWindows?.toJson() ?? null;
    await adapter.shutdown();

    Assert.areEqual(0.95, Resources.codexUsableWindowShare);
    Assert.areEqual(expected, JSON.stringify(windows));
  }

  @TestMethod
  public async readsNoModelWindowFromAResumedThreadWhichMayKeepASizeChosenEarlier(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_WINDOW: "121600" });

    const resumed = await adapter.runTurn(host.createRequest("window", null, "resumable"), new RecordingTurnListener(), new AbortController().signal);
    const windows = (await adapter.listModels(null)).models.find(t => t.id === "gpt-5.6-sol")?.contextWindows?.toJson() ?? null;
    await adapter.shutdown();

    Assert.areEqual("resumable", resumed.nativeSessionId);
    Assert.areEqual(JSON.stringify({ presets: [128_000], minimum: 64_000, maximum: 128_000, reported: false }), JSON.stringify(windows));
  }

  @TestMethod
  public async resumesAThreadWithANewlyChosenContextWindowAsItsModelContextWindow(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const started = await adapter.runTurn(host.createRequest("echo", null, null, null, null, null, null, 128_000), new RecordingTurnListener(), new AbortController().signal);
    const resumed = await adapter.runTurn(host.createRequest("echo", null, started.nativeSessionId, null, null, null, null, 256_000), listener,
      new AbortController().signal);
    await adapter.shutdown();

    const echoed = JSON.parse(String(listener.texts[0])) as { resume: { threadId: string; config: Record<string, unknown> } };
    Assert.areEqual(started.nativeSessionId, echoed.resume.threadId);
    Assert.areEqual(started.nativeSessionId, resumed.nativeSessionId);
    Assert.areEqual(256_000, echoed.resume.config["model_context_window"]);
  }

  @TestMethod
  public async sendsAChosenServiceTierOnlyForAListedModelThatListsIt(): Promise<void> {
    using host = new CodexTestHost();
    const models = { data: [{ model: "gpt-tiered", hidden: false, displayName: "Tiered", description: "Fixture", isDefault: true,
      serviceTiers: [{ id: "priority", name: "Fast", description: "" }] }, { model: "gpt-plain", hidden: false, displayName: "Plain", description: "Fixture", isDefault: false }],
    nextCursor: null };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify(models) });
    const tierOf = async (model: string | null): Promise<string> => {
      const listener = new RecordingTurnListener();
      await adapter.runTurn(host.createRequest("echo", null, null, model, null, "priority"), listener, new AbortController().signal);
      return String((JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> }).thread["serviceTier"]);
    };

    try {
      Assert.areEqual("priority,priority,null,null", [await tierOf("gpt-tiered"), await tierOf(null), await tierOf("gpt-plain"), await tierOf("gpt-unlisted")].join(","));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  @TestData({ model: "gpt-astra", model_reasoning_effort: "xhigh" }, "gpt-5.6-sol:false:low:xhigh:high,low:Extra high|gpt-astra:true:medium:xhigh:medium,xhigh:Extra high")
  @TestData({ model: "gpt-astra", model_reasoning_effort: "low" }, "gpt-5.6-sol:false:low:low:high,low|gpt-astra:true:medium:low:medium,xhigh:Extra high")
  @TestData({ model: "gpt-astra" }, "gpt-5.6-sol:false:low:null:high,low|gpt-astra:true:medium:null:medium,xhigh:Extra high")
  @TestData({ model_reasoning_effort: "high" }, "gpt-5.6-sol:true:low:high:high,low|gpt-astra:false:medium:high:medium,xhigh:Extra high")
  @TestData({ model: "gpt-custom" }, "gpt-5.6-sol:false:low:null:high,low|gpt-astra:false:medium:null:medium,xhigh:Extra high|gpt-custom:true:null:null:null")
  @TestData({ model: "gpt-custom", model_reasoning_effort: "xhigh" }, "gpt-5.6-sol:false:low:xhigh:high,low:Extra high|gpt-astra:false:medium:xhigh:medium,xhigh:Extra high|gpt-custom:true:null:xhigh:null:Extra high")
  @TestData({ model: "gpt-hidden" }, "gpt-5.6-sol:false:low:null:high,low|gpt-astra:false:medium:null:medium,xhigh:Extra high|gpt-hidden:true:null:null:null")
  @TestData({ model: "  ", model_reasoning_effort: "  " }, "gpt-5.6-sol:true:low:null:high,low|gpt-astra:false:medium:null:medium,xhigh:Extra high")
  @TestData({ model: 5 }, "gpt-5.6-sol:true:low:null:high,low|gpt-astra:false:medium:null:medium,xhigh:Extra high")
  @TestData({}, "gpt-5.6-sol:true:low:null:high,low|gpt-astra:false:medium:null:medium,xhigh:Extra high")
  public async listsTheModelCodexsConfigNamesAsTheDefaultAndItsEffortAsConfiguredBesideEachModelsOwnLevelsAndDefault(config: object, expected: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify(config), TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });

    const list = await adapter.listModels(null);
    await adapter.shutdown();

    Assert.areEqual(expected, list.models.map(t => [t.id, t.isDefault, t.defaultEffort, t.configuredEffort, t.effortLevels?.join(",") ?? null, ...Object.values(t.effortNames)].map(String).join(":")).join("|"));
  }

  @TestMethod
  public async keepsAListedModelsOtherDetailsAndNamesAnUnlistedOneByItsIdWhenCodexsConfigMakesItTheDefault(): Promise<void> {
    using host = new CodexTestHost();
    const environment = { ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels };
    const listed = host.createAdapter({ ...environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-astra" }) });
    const unlisted = host.createAdapter({ ...environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-custom" }) });

    const [models, others] = [(await listed.listModels(null)).models, (await unlisted.listModels(null)).models];
    await Promise.all([listed.shutdown(), unlisted.shutdown()]);

    const astra = models.find(t => t.id === "gpt-astra");
    const sol = models.find(t => t.id === "gpt-5.6-sol");
    Assert.areEqual("Astra/Fixture/priority/priority/true", [astra?.displayName, astra?.description, astra?.speeds[1]?.id, astra?.defaultSpeed, astra?.supportsImages].map(String).join("/"));
    Assert.areEqual("Sol/Fixture", [sol?.displayName, sol?.description].map(String).join("/"));
    Assert.areEqual("gpt-custom", others.find(t => t.isDefault)?.displayName);
  }

  @TestMethod
  public async listsTheListedDefaultWhenCodexsConfigCantBeRead(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: "fail", TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });

    const list = await adapter.listModels(null);
    await adapter.shutdown();

    Assert.areEqual("gpt-5.6-sol:low", list.models.filter(t => t.isDefault).map(t => `${t.id}:${String(t.defaultEffort)}`).join(","));
    Assert.areEqual(2, list.models.length);
    Assert.isTrue(list.partial);
  }

  @TestMethod
  public async marksAListFullWhenCodexsConfigIsRead(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();

    const list = await adapter.listModels(null);
    await adapter.shutdown();

    Assert.isFalse(list.partial);
  }

  @TestMethod
  public async listsWhatAFoldersOwnCodexConfigNamesForThatFolderAndThePersonsOwnForNoFolder(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-5.6-sol" }),
      TEAMRUN_FAKE_CODEX_PROJECT_CONFIG: JSON.stringify({ model: "gpt-astra" }), TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });

    const inFolder = await adapter.listModels(null, false, host.directory.path);
    const noFolder = await adapter.listModels(null);
    await adapter.shutdown();

    Assert.areEqual("gpt-astra", inFolder.models.find(t => t.isDefault)?.id);
    Assert.areEqual("gpt-5.6-sol", noFolder.models.find(t => t.isDefault)?.id);
  }

  @TestMethod
  @TestData(null)
  @TestData("gpt-astra")
  public async runsTheLevelCodexsConfigSetsWhenItIsSentThoughTheModelDoesNotListIt(model: string | null): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-astra", model_reasoning_effort: "high" }),
      TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });

    const result = await adapter.runTurn(host.createRequest("echo", null, null, model, "high"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("gpt-astra", result.observed.model);
    Assert.areEqual("high", result.observed.effort);
  }

  @TestMethod
  public async listsAndNamesCodexsConfiguredEffortForANamedModelWithNoEffort(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-5.6-sol", model_reasoning_effort: "xhigh" }),
      TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });

    const list = await adapter.listModels(null);
    const result = await adapter.runTurn(host.createRequest("echo", null, null, "gpt-astra"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(result.observed.effort, list.models.find(t => t.id === "gpt-astra")?.configuredEffort);
    Assert.areEqual("gpt-astra/xhigh", `${String(result.observed.model)}/${String(result.observed.effort)}`);
  }

  @TestMethod
  public async leavesAResumedThreadWithNothingChosenOnWhatCodexStoredWithItAndNamesThat(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-astra", model_reasoning_effort: "xhigh" }),
      TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });
    const first = await adapter.runTurn(host.createRequest("complete", null, null, "gpt-5.6-sol", "high"), new RecordingTurnListener(), new AbortController().signal);
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo", null, first.nativeSessionId), listener, new AbortController().signal);
    await adapter.shutdown();

    const resume = (JSON.parse(String(listener.texts[0])) as { resume: Record<string, unknown> }).resume;
    Assert.isNull(resume["model"]);
    Assert.isFalse("model_reasoning_effort" in (resume["config"] as object));
    Assert.isFalse("serviceTier" in resume);
    Assert.areEqual("gpt-5.6-sol/high", `${String(result.observed.model)}/${String(result.observed.effort)}`);
  }

  @TestMethod
  public async runsAResumedThreadOnCodexsConfiguredModelWhenOnlyAnEffortIsChosenAndNamesThat(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-astra" }), TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });
    const first = await adapter.runTurn(host.createRequest("complete", null, null, "gpt-5.6-sol", "high"), new RecordingTurnListener(), new AbortController().signal);
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo", null, first.nativeSessionId, null, "xhigh"), listener, new AbortController().signal);
    await adapter.shutdown();

    const resume = (JSON.parse(String(listener.texts[0])) as { resume: Record<string, unknown> }).resume;
    Assert.areEqual("priority", resume["serviceTier"]);
    Assert.areEqual("gpt-astra/xhigh", `${String(result.observed.model)}/${String(result.observed.effort)}`);
  }

  @TestMethod
  public async letsAnEffortThroughForAModelOnlyCodexsConfigNamesThoughItsOwnLevelIsAnother(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-custom", model_reasoning_effort: "low" }),
      TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });

    const result = await adapter.runTurn(host.createRequest("echo", null, null, null, "xhigh"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual("gpt-custom/xhigh", `${String(result.observed.model)}/${String(result.observed.effort)}`);
  }

  @TestMethod
  public async leavesATurnWithNoModelToCodexsConfigAndNamesWhatCodexReports(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-astra", model_reasoning_effort: "xhigh" }),
      TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo"), listener, new AbortController().signal);
    await adapter.shutdown();

    const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> };
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isNull(echoed.thread["model"]);
    Assert.isFalse("model_reasoning_effort" in (echoed.thread["config"] as object));
    Assert.areEqual("gpt-astra", result.observed.model);
    Assert.areEqual("xhigh", result.observed.effort);
  }

  @TestMethod
  public async runsANamedModelAndEffortOverCodexsConfigAndNamesThem(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-astra", model_reasoning_effort: "xhigh" }),
      TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo", null, null, "gpt-5.6-sol", "high"), listener, new AbortController().signal);
    await adapter.shutdown();

    const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> };
    Assert.areEqual("gpt-5.6-sol", echoed.thread["model"]);
    Assert.areEqual("high", (echoed.thread["config"] as Record<string, unknown>)["model_reasoning_effort"]);
    Assert.areEqual("gpt-5.6-sol", result.observed.model);
    Assert.areEqual("high", result.observed.effort);
  }

  @TestMethod
  public async checksATurnsEffortAndTierAgainstTheModelCodexsConfigNames(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-astra" }), TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });
    const listener = new RecordingTurnListener();

    const fits = await adapter.runTurn(host.createRequest("echo", null, null, null, "xhigh"), listener, new AbortController().signal);
    const refused = await adapter.runTurn(host.createRequest("echo", null, null, null, "low"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> };
    Assert.areEqual(TurnOutcome.Completed, fits.outcome);
    Assert.isNull(echoed.thread["model"]);
    Assert.areEqual("priority", echoed.thread["serviceTier"]);
    Assert.areEqual(Resources.formatUnknownEffort("low", "Astra"), refused.error);
  }

  @TestMethod
  public async runsATurnOnAModelCodexDoesntListWhenCodexsConfigNamesIt(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_CONFIG: JSON.stringify({ model: "gpt-custom" }), TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo", null, null, null, "xhigh"), listener, new AbortController().signal);
    await adapter.shutdown();

    const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> };
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isNull(echoed.thread["serviceTier"]);
    Assert.areEqual("gpt-custom", result.observed.model);
    Assert.areEqual("xhigh", result.observed.effort);
  }

  @TestMethod
  public async startsAThreadWithNoTierChosenAtTheModelsDefaultTierAsTheWindowShowsItAndAtStandardWhenThatIsChosen(): Promise<void> {
    using host = new CodexTestHost();
    const models = { data: [{ model: "gpt-fast", hidden: false, displayName: "Fast first", description: "Fixture", isDefault: true, defaultServiceTier: "priority",
      serviceTiers: [{ id: "priority", name: "Fast", description: "" }] }, { model: "gpt-tiered", hidden: false, displayName: "Tiered", description: "Fixture", isDefault: false,
      serviceTiers: [{ id: "priority", name: "Fast", description: "" }] }], nextCursor: null };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify(models) });
    const tierOf = async (model: string | null, speed: string | null): Promise<string> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(host.createRequest("echo", null, null, model, null, speed), listener, new AbortController().signal);
      const thread = (JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> }).thread;
      return `${String(thread["serviceTier"])}/${String(result.observed.speed)}/${String(result.observed.speedUnavailable)}`;
    };

    try {
      const shown = (await adapter.listModels(null)).models.map(t => String(t.defaultSpeed)).join(",");
      Assert.areEqual("priority,standard", shown);
      Assert.areEqual("priority/priority/null,priority/priority/null,null/standard/null", [await tierOf(null, null), await tierOf("gpt-fast", null),
        await tierOf("gpt-tiered", null)].join(","));
      Assert.areEqual("null/standard/null,priority/priority/null", [await tierOf("gpt-fast", Resources.codexStandardTier), await tierOf(null, "flex")].join(","));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async startsAThreadAtTheChosenServiceTierOrExplicitlyAtTheStandardOneAndReportsTheTierItServesAndWhenItIsAnother(): Promise<void> {
    using host = new CodexTestHost();
    const models = JSON.stringify({ data: [{ model: "gpt-x", hidden: false, displayName: "X", description: "Fixture", isDefault: true,
      serviceTiers: [{ id: "priority", name: "Fast", description: "" }] }], nextCursor: null });
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: models });
    const tierOf = async (speed: string | null): Promise<string> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(host.createRequest("echo", null, null, "gpt-x", null, speed), listener, new AbortController().signal);
      const thread = (JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> }).thread;
      return `${String(thread["serviceTier"])}/${String(result.observed.speed)}/${String(result.observed.speedUnavailable)}`;
    };
    const flex = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: models, TEAMRUN_FAKE_CODEX_SERVED_TIER: "flex" });
    const silent = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: models, TEAMRUN_FAKE_CODEX_OMITS_TIER: "1" });
    const servedBy = async (served: CodexAdapter, speed: string): Promise<string> => {
      const result = await served.runTurn(host.createRequest("echo", null, null, "gpt-x", null, speed), new RecordingTurnListener(), new AbortController().signal);
      return `${String(result.observed.speed)}/${String(result.observed.speedUnavailable)}`;
    };

    try {
      Assert.areEqual("priority/priority/null", await tierOf("priority"));
      Assert.areEqual("null/standard/null", await tierOf(null));
      Assert.areEqual(`flex/${Resources.codexTierNotServedReason}`, await servedBy(flex, "priority"));
      Assert.areEqual("null/null,null/null", [await servedBy(silent, "priority"), await servedBy(silent, Resources.codexStandardTier)].join(","));
    }
    finally {
      await adapter.shutdown();
      await flex.shutdown();
      await silent.shutdown();
    }
  }

  @TestMethod
  public async servesTeamRunsEndpointInEveryThreadInPlaceOfAServerOfItsNameAndRunsItsApprovedToolsWithoutCodexAsking(): Promise<void> {
    using host = new CodexTestHost();
    const servers = { node_repl: { command: "node_repl" }, teamrun: { command: "someone-elses" } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: JSON.stringify(servers) });
    const endpoint = new RecordingMcpEndpoint();
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) },
      ["teamrun_delete_chat", "teamrun_send_message"], endpoint);
    const listeners = [new RecordingTurnListener(), new RecordingTurnListener()];

    for (const [index, resume] of [null, "resumable"].entries()) {
      const request = host.createRequest("echo", null, resume);
      await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, request.resumeNativeSessionId,
        [], null, null, { TEAMRUN_SENDER_TOKEN: "sender" }, false, tools), listeners[index]!, new AbortController().signal);
    }
    await adapter.shutdown();

    Assert.areEqual(2, endpoint.issued.length);
    for (const [index, listener] of listeners.entries()) {
      const token = endpoint.issued[index] ?? String.empty;
      const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> };
      Assert.areEqual(JSON.stringify({
        node_repl: { enabled: false },
        teamrun: {
          url: "http://127.0.0.1:4711/mcp", http_headers: { Authorization: `Bearer ${token}` },
          tool_timeout_sec: 420, tools: { teamrun_delete_chat: { approval_mode: "approve" }, teamrun_send_message: { approval_mode: "approve" } }
        }
      }), JSON.stringify((echoed.thread["config"] as Record<string, unknown>)["mcp_servers"]));
      Assert.areEqual(2, JSON.stringify(echoed.thread).split(token).length);
    }
  }

  @TestMethod
  public async failsATurnWithTeamRunsToolsBeforeCodexStartsWhileTheEndpointIsntServingAndRunsOneWithoutThem(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const unserved = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, []);
    const results: TurnResult[] = [];
    try {
      for (const tools of [unserved, null]) {
        const request = host.createRequest("echo");
        results.push(await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null,
          {}, false, tools), new RecordingTurnListener(), new AbortController().signal));
      }
    }
    finally { await adapter.shutdown(); }

    const refused = "Codex can't reach TeamRun's tools: TeamRun's tool endpoint isn't serving, and the runtime's log says why. Restart TeamRun to try again.";
    Assert.areEqual(JSON.stringify([[TurnOutcome.Failed, refused, null], [TurnOutcome.Completed, null]]),
      JSON.stringify([[results[0]?.outcome, results[0]?.error, results[0]?.observed.harnessVersion], [results[1]?.outcome, results[1]?.error]]));
  }

  @TestMethod
  public async reachesTeamRunsToolsAtTheEndpointWithEachTurnsOwnTokenAndRevokesItOnceTheTurnReleasesTheThread(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const endpoint = new RecordingMcpEndpoint();
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) },
      ["teamrun_send_message"], endpoint);
    const servers: unknown[] = [];
    const live: boolean[] = [];
    let threadId: string | null = null;
    try {
      for (let index = 0; index < 2; index += 1) {
        const listener = new RecordingTurnListener();
        const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "echo", new RequestedSettings("codex", null, null), threadId,
          [], null, null, {}, false, tools), listener, new AbortController().signal);
        threadId = result.nativeSessionId;
        servers.push(CodexAdapterTests.teamRunServerOf(String(listener.texts[0])).toJson());
        live.push(endpoint.isLive(endpoint.lastIssued));
        host.idleTimer.advance(host.timings.idleLimit);
        await Wait.until(() => !endpoint.isLive(endpoint.lastIssued), "The turn's token was not revoked once its thread was released.");
      }
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(2, new Set(endpoint.issued).size);
    Assert.areEqual(JSON.stringify(endpoint.issued.map(token => ({
      url: "http://127.0.0.1:4711/mcp", http_headers: { Authorization: `Bearer ${token}` },
      tool_timeout_sec: 420, tools: { teamrun_send_message: { approval_mode: "approve" } }
    }))), JSON.stringify(servers));
    Assert.areEqual("true,true", live.join(","));
  }

  @TestMethod
  public async reloadsAKeptThreadBeforeATurnWhenTheServedToolsChangedSoCodexListsThemAgain(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const endpoint = new RecordingMcpEndpoint();
    const served = ["browser_navigate", "terminal_run"];
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve(served.map(t => ({ name: t }))), callToolAsync: () => Promise.resolve({}) },
      [], endpoint);
    const archives: string[] = [];
    let threadId: string | null = null;
    try {
      for (const added of [null, "computer_click", null]) {
        if (!Object.isNull(added))
          served.push(added);
        const listener = new RecordingTurnListener();
        const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), threadId,
          [], null, null, {}, false, tools), listener, new AbortController().signal);
        threadId = result.nativeSessionId;
        archives.push(JSON.stringify((JSON.parse(String(listener.details.find(t => t.kind === DetailKind.Text)?.text)) as { archives: unknown }).archives));
      }
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(JSON.stringify(["[]", JSON.stringify([threadId]), JSON.stringify([threadId])]), JSON.stringify(archives));
    Assert.areEqual(2, new Set(endpoint.issued).size);
  }

  @TestMethod
  public async runsATurnOnAThreadWhoseBackgroundTaskStillRunsWithoutReloadingItWhenTheServedToolsChanged(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const served = ["terminal_run"];
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve(served.map(t => ({ name: t }))), callToolAsync: () => Promise.resolve({}) },
      [], new RecordingMcpEndpoint());
    const request = (prompt: string, threadId: string | null): TurnRequest => new TurnRequest(null, host.directory.path, prompt,
      new RequestedSettings("codex", null, null), threadId, [], null, null, {}, false, tools);
    const started = new RecordingTurnListener();
    const next = new RecordingTurnListener();
    let outcome: TurnOutcome | null = null;
    try {
      const threadId = (await adapter.runTurn(request("background", null), started, new AbortController().signal)).nativeSessionId;
      await Wait.until(() => started.taskStarts.length === 1, "The listener did not see a task start.");
      served.push("computer_click");
      outcome = (await adapter.runTurn(request("role-payload", threadId), next, new AbortController().signal)).outcome;
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(TurnOutcome.Completed, outcome);
    Assert.areEqual("[]", JSON.stringify((JSON.parse(String(next.details.find(t => t.kind === DetailKind.Text)?.text)) as { archives: unknown }).archives));
  }

  @TestMethod
  public async releasesADeletedChatsKeptThreadNowAndItsRunningThreadOnceItsTurnEnds(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const endpoint = new RecordingMcpEndpoint();
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) },
      ["teamrun_send_message"], endpoint);
    const request = (prompt: string): TurnRequest => new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("codex", null, null), null,
      [], null, null, {}, false, tools);
    const controller = new AbortController();
    const held = new RecordingTurnListener();
    try {
      const idle = await adapter.runTurn(request("echo"), new RecordingTurnListener(), new AbortController().signal);
      const idleToken = endpoint.lastIssued;
      await adapter.runTurn(request("echo"), new RecordingTurnListener(), new AbortController().signal);
      const otherToken = endpoint.lastIssued;
      const running = adapter.runTurn(request("hold"), held, controller.signal);
      await Wait.untilOrSettled(() => held.details.length === 1, running);
      const heldToken = endpoint.lastIssued;
      await adapter.closeSessions([String(idle.nativeSessionId), String(held.starts[0]?.nativeSessionId), "missing"]);
      await Wait.until(() => !endpoint.isLive(idleToken), "The deleted chat's kept thread was not released.");
      const whileHeld = endpoint.isLive(heldToken);
      controller.abort();
      const stopped = await running;
      await Wait.until(() => !endpoint.isLive(heldToken), "The deleted chat's running thread was not released once its turn ended.");

      Assert.areEqual(JSON.stringify([true, TurnOutcome.Interrupted, true]), JSON.stringify([whileHeld, stopped.outcome, endpoint.isLive(otherToken)]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData("explode", false)
  @TestData(null, true)
  public async revokesTheTurnsTokenWhenNoThreadOpens(model: string | null, compacts: boolean): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const endpoint = new RecordingMcpEndpoint();
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) },
      [], endpoint);
    let result: TurnResult;
    try {
      result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "echo", new RequestedSettings("codex", model, null), null,
        [], null, null, {}, compacts, tools), new RecordingTurnListener(), new AbortController().signal);
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(compacts ? TurnOutcome.Completed : TurnOutcome.Failed, result.outcome);
    const [token] = endpoint.issued;
    Assert.areEqual(1, endpoint.issued.length);
    Assert.isDefined(token);
    Assert.isFalse(endpoint.isLive(token));
  }

  @TestMethod
  public async reachesALaterTurnOnAHeldThreadWithTheThreadsTokenAndRefusesItOnceTheThreadIsReleased(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const first = new RecordingMcpEndpoint(tokens, "turn-1");
    const second = new RecordingMcpEndpoint(tokens, "turn-2");
    const listener = new RecordingTurnListener();
    const later = new RecordingTurnListener();
    let between: string | null = null;
    let during: string | null = null;
    try {
      const result = await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", null, first), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      tokens.close("turn-1");
      between = tokens.find(first.lastIssued);
      await adapter.runTurn(CodexAdapterTests.toolRequest(host, "role-payload", result.nativeSessionId, second), later, new AbortController().signal);
      during = tokens.find(first.lastIssued);
      await listener.taskStarts[0]?.stop();
      await Wait.until(() => {
        host.idleTimer.advance(host.timings.idleLimit);
        return Object.isNull(tokens.find(first.lastIssued));
      }, "The first turn's token was not withdrawn.");
    }
    finally { await adapter.shutdown(); }

    const [token] = first.issued;
    const echoed = later.details.find(t => t.kind === DetailKind.Text);
    Assert.isDefined(token);
    Assert.isDefined(echoed);
    Assert.areEqual(1, first.issued.length);
    Assert.areEqual(0, second.issued.length);
    Assert.isNull(between);
    Assert.areEqual("turn-2", during);
    Assert.areEqual(JSON.stringify({ Authorization: `Bearer ${token}` }), JSON.stringify(CodexAdapterTests.teamRunServerOf(echoed.text).readObject("http_headers").toJson()));
    Assert.isFalse(tokens.adopt(token, "turn-2"));
  }

  @TestMethod
  public async setsTheTurnsModelAndEffortOnTurnStartOnlyWhenTheyChangeOnAKeptThreadAndSendsTheDefaultsOnAReturnToThem(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: CodexAdapterTests.configuredModels });
    const settings: string[] = [];
    let threadId: string | null = null;
    try {
      for (const [model, effort] of [[null, null], [null, "high"], ["gpt-astra", "xhigh"], ["gpt-astra", null], [null, "high"], [null, null]] as const) {
        const listener = new RecordingTurnListener();
        const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "collaboration", new RequestedSettings("codex", model, effort), threadId), listener,
          new AbortController().signal);
        threadId = result.nativeSessionId;
        const echoed = listener.texts.join("");
        settings.push(echoed.startsWith("{") ? JSON.stringify(JsonReader.parse(echoed).toJson()["turnSettings"])
          : JSON.stringify([result.outcome, result.error, echoed]));
      }
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(JSON.stringify([{}, { effort: "high" }, { model: "gpt-astra", effort: "xhigh" }, { effort: "medium" }, { model: "gpt-5.6-sol", effort: "high" }, { effort: "low" }]),
      `[${settings.join(",")}]`);
  }

  @TestMethod
  public async movesAHeldThreadToTheTurnsFolderOnTurnStartWhenTheChatsFolderHasChangedSinceItsLastTurn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const own = join(host.directory.path, "own");
    const attached = join(host.directory.path, "attached");
    mkdirSync(own);
    mkdirSync(attached);
    const seen: string[] = [];
    let threadId: string | null = null;
    try {
      for (const folder of [own, attached, attached, own]) {
        const listener = new RecordingTurnListener();
        const result = await adapter.runTurn(new TurnRequest(null, folder, "where", new RequestedSettings("codex", null, null), threadId), listener,
          new AbortController().signal);
        threadId = result.nativeSessionId;
        seen.push(listener.texts.join(""));
      }
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual([own, attached, attached, own].join("|"), seen.join("|"));
  }

  @TestMethod
  public async setsTheTurnsSandboxAndApprovalOnTurnStartOnlyWhenAHeldThreadRunsInAnotherMode(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const background = new RecordingTurnListener();
    const policies: string[] = [];
    const request = (prompt: string, mode: string, threadId: string | null): TurnRequest =>
      new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("codex", null, null, null, mode), threadId);
    const run = async (mode: string, threadId: string | null): Promise<string | null> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(request("collaboration", mode, threadId), listener, new AbortController().signal);
      policies.push(JSON.stringify(JsonReader.parse(String(listener.texts[0])).toJson()["turnPolicy"]));
      return result.nativeSessionId;
    };
    try {
      await run("auto", await run("full-access", null));
      const held = await adapter.runTurn(request("background", "full-access", null), background, new AbortController().signal);
      await Wait.until(() => background.taskStarts.length === 1, "The listener did not see a task start.");
      for (const mode of ["auto", "auto", "read-only", "full-access"])
        await run(mode, held.nativeSessionId);
      await background.taskStarts[0]?.stop();
    }
    finally { await adapter.shutdown(); }

    const workspace = { type: "workspaceWrite", writableRoots: [], networkAccess: false, excludeTmpdirEnvVar: false, excludeSlashTmp: false };
    Assert.areEqual([[null, null], ["on-request", workspace], ["on-request", workspace], [null, null], ["on-request", { type: "readOnly", networkAccess: false }],
      ["never", { type: "dangerFullAccess" }]].map(t => JSON.stringify(t)).join("|"), policies.join("|"));
  }

  @TestMethod
  @TestData("t1", true)
  @TestData(null, true)
  @TestData("t1", false)
  public async routesTheSenderTokenAHeldThreadsShellKeepsToALaterTurnOnItAndSaysSoWhenTheTokenIsRefused(first: string | null, routes: boolean): Promise<void> {
    using host = new CodexTestHost();
    const log = new RecordingLog();

    const [shell, adopted, later] = await CodexAdapterTests.heldSenderOf(host, Object.isNull(first) ? {} : SenderEnvironment.of(first), routes, log);

    Assert.areEqual(first, shell);
    Assert.areEqual(JSON.stringify(Object.isNull(first) ? [] : [first]), JSON.stringify(adopted));
    Assert.areEqual(!routes, later.details.some(t => t.kind === DetailKind.Note && t.text === Resources.codexSenderRefused));
    Assert.areEqual(!routes, log.lines.some(t => t.includes(Resources.formatCodexHeldSenderRefused("thread-1"))));
  }

  @TestMethod
  public async keepsTheHeldThreadsTokenLiveThroughAResumeDuringWhichItsLastBackgroundTaskEnds(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_RESUME: "endsTasks" });
    const tokens = new SessionTokens();
    const first = new RecordingMcpEndpoint(tokens, "turn-1");
    const second = new RecordingMcpEndpoint(tokens, "turn-2");
    const listener = new RecordingTurnListener();
    const later = new TokenRecordingTurnListener(tokens, first);
    let outcome: TurnOutcome | null = null;
    try {
      const result = await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", null, first), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      tokens.close("turn-1");
      const resuming = adapter.runTurn(CodexAdapterTests.toolRequest(host, "role-payload", result.nativeSessionId, second), later, new AbortController().signal);
      await Wait.until(() => listener.taskEnds.length === 1, "The listener did not see a task end.");
      await adapter.listOwnMcpServers(null);
      outcome = (await resuming).outcome;
      await Wait.until(() => {
        host.idleTimer.advance(host.timings.idleLimit);
        return Object.isNull(tokens.find(first.lastIssued));
      }, "The first turn's token was not withdrawn.");
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(TurnOutcome.Completed, outcome);
    Assert.areEqual("turn-2", later.sessionsAtStart.join(","));
    Assert.areEqual(0, second.issued.length);
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async releasesTheHeldThreadOnceItsTaskEndsAfterAResumeOfItFails(compacts: boolean): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_RESUME: "fails" });
    const tokens = new SessionTokens();
    const first = new RecordingMcpEndpoint(tokens, "turn-1");
    const second = new RecordingMcpEndpoint(tokens, "turn-2");
    const listener = new RecordingTurnListener();
    let held: string | null = null;
    let opened: string | null = null;
    try {
      held = (await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", null, first), listener, new AbortController().signal)).nativeSessionId;
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      opened = (await adapter.runTurn(CodexAdapterTests.toolRequest(host, "echo", held, second, compacts), new RecordingTurnListener(),
        new AbortController().signal)).nativeSessionId;
      await listener.taskStarts[0]?.stop();
      await Wait.until(() => {
        host.idleTimer.advance(host.timings.idleLimit);
        return Object.isNull(tokens.find(first.lastIssued));
      }, "The first turn's token was not withdrawn.");
    }
    finally { await adapter.shutdown(); }

    Assert.isNotNull(held);
    Assert.areEqual(compacts, Object.isNull(opened));
    Assert.areNotEqual(held, opened);
  }

  @TestMethod
  public async startsTheThreadThatReplacesAHeldThreadWhoseResumeFailsWithATokenOfItsOwn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_RESUME: "fails" });
    const tokens = new SessionTokens();
    const first = new RecordingMcpEndpoint(tokens, "turn-1");
    const second = new RecordingMcpEndpoint(tokens, "turn-2");
    const listener = new RecordingTurnListener();
    const replacing = new RecordingTurnListener();
    let during: string | null = null;
    let live = false;
    try {
      const held = (await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", null, first), listener, new AbortController().signal)).nativeSessionId;
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      tokens.close("turn-1");
      await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", held, second), replacing, new AbortController().signal);
      await Wait.until(() => replacing.taskStarts.length === 1, "The replacing listener did not see a task start.");
      during = tokens.find(first.lastIssued);
      await listener.taskStarts[0]?.stop();
      await Wait.until(() => {
        host.idleTimer.advance(host.timings.idleLimit);
        return Object.isNull(tokens.ownerOf(first.lastIssued));
      }, "The first turn's token kept its owner.");
      live = second.isLive(second.lastIssued);
      await replacing.taskStarts[0]?.stop();
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual("1,1", [first.issued.length, second.issued.length].join(","));
    Assert.areNotEqual(first.lastIssued, second.lastIssued);
    Assert.isNull(during);
    Assert.isTrue(live);
  }

  @TestMethod
  public async saysTeamRunsToolsWaitForTheBackgroundTasksWhenTheHeldThreadsTokenIsRefused(): Promise<void> {
    using host = new CodexTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    let now = 0;
    const tokens = new SessionTokens(() => now);
    const first = new RecordingMcpEndpoint(tokens, "turn-1");
    const second = new RecordingMcpEndpoint(tokens, "turn-2");
    const third = new RecordingMcpEndpoint(tokens, "turn-3");
    const listener = new RecordingTurnListener();
    const later = new RecordingTurnListener();
    const last = new RecordingTurnListener();
    let held: string | null = null;
    try {
      held = (await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", null, first), listener, new AbortController().signal)).nativeSessionId;
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      now += 13 * 60 * 60 * 1000;
      await adapter.runTurn(CodexAdapterTests.toolRequest(host, "role-payload", held, second), later, new AbortController().signal);
      await adapter.runTurn(CodexAdapterTests.toolRequest(host, "role-payload", held, third), last, new AbortController().signal);
    }
    finally { await adapter.shutdown(); }

    Assert.isNotNull(held);
    Assert.isTrue([later, last].every(u => u.details.some(t => t.kind === DetailKind.Note && t.text === Resources.codexToolsAwaitTasks)));
    Assert.areEqual([Resources.formatCodexHeldTokenRefused(held), Resources.formatCodexHeldTokenRefused(held)].join("\n"), log.lines.join("\n"));
    Assert.areEqual("0,0", [second.issued.length, third.issued.length].join(","));
  }

  @TestMethod
  public async neverReachesAnotherThreadOfTheSameMemberWithAThreadsToken(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const firstOfA = new RecordingMcpEndpoint(tokens, "a-1");
    const firstOfB = new RecordingMcpEndpoint(tokens, "b-1");
    const secondOfA = new RecordingMcpEndpoint(tokens, "a-2");
    const listenerOfA = new RecordingTurnListener();
    const listenerOfB = new RecordingTurnListener();
    let reached: (string | null)[] = [];
    try {
      const threadA = await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", null, firstOfA), listenerOfA, new AbortController().signal);
      await adapter.runTurn(CodexAdapterTests.toolRequest(host, "background", null, firstOfB), listenerOfB, new AbortController().signal);
      await Wait.until(() => listenerOfA.taskStarts.length === 1, "The listener of A did not see a task start.");
      await Wait.until(() => listenerOfB.taskStarts.length === 1, "The listener of B did not see a task start.");
      await adapter.runTurn(CodexAdapterTests.toolRequest(host, "echo", threadA.nativeSessionId, secondOfA), new RecordingTurnListener(),
        new AbortController().signal);
      reached = [firstOfA.lastIssued, firstOfB.lastIssued].map(t => tokens.find(t));
      await listenerOfA.taskStarts[0]?.stop();
      await listenerOfB.taskStarts[0]?.stop();
      await Wait.until(() => {
        host.idleTimer.advance(host.timings.idleLimit);
        return Object.isNull(tokens.find(firstOfA.lastIssued));
      }, "The first turn of A kept its token.");
      await Wait.until(() => {
        host.idleTimer.advance(host.timings.idleLimit);
        return Object.isNull(tokens.find(firstOfB.lastIssued));
      }, "The first turn of B kept its token.");
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual("1,1,0", [firstOfA.issued.length, firstOfB.issued.length, secondOfA.issued.length].join(","));
    Assert.areNotEqual(firstOfA.lastIssued, firstOfB.lastIssued);
    Assert.areEqual("a-2,b-1", reached.join(","));
  }

  @TestMethod
  public async namesEachSharedServersVariablesInPlaceOfThePersonsServerOfItsNameAndReportsThoseItsThreadFailedToStartWithoutCodexsErrorText(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: JSON.stringify({ search: { command: "theirs" } }),
      TEAMRUN_FAKE_CODEX_MCP_STARTUP: JSON.stringify([
        { name: "docs", status: "failed", error: "DOCS_TOKEN is empty: token-value", failureReason: null },
        { name: "search", status: "failed", error: "token-value expired", failureReason: "reauthenticationRequired" },
        { name: "open", status: "ready" },
        { name: "theirs", status: "failed" },
        { name: "open", status: "failed", threadId: "thread-other" }
      ]) });
    const shared = [
      new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", ["-y", "search-server"], ["SEARCH_KEY"], null, [], null),
      new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [new SharedMcpHeader("X-Team", "DOCS_TEAM")], "DOCS_TOKEN"),
      new SharedMcpServerDefinition("open", SharedMcpTransport.Http, null, [], [], "https://open.example/mcp", [], null)
    ];
    const listeners = [new RecordingTurnListener(), new RecordingTurnListener()];
    const results: (TurnResult | undefined)[] = [];

    for (const [index, resume] of [null, "resumable"].entries()) {
      const request = host.createRequest("echo", null, resume);
      results[index] = await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, request.resumeNativeSessionId,
        [], null, null, {}, false, null, shared), listeners[index]!, new AbortController().signal);
    }
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed]), JSON.stringify(results.map(t => t?.outcome)));
    const launch = new SharedMcpLaunch();
    for (const listener of listeners) {
      const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown> };
      Assert.areEqual(JSON.stringify({
        search: { command: launch.program, args: [launch.script, "--variables", "SEARCH_KEY", "--", "npx", "-y", "search-server"], env: { ELECTRON_RUN_AS_NODE: "1" },
          env_vars: ["SEARCH_KEY"] },
        docs: { url: "https://docs.example/mcp", env_http_headers: { "X-Team": "DOCS_TEAM" }, bearer_token_env_var: "DOCS_TOKEN" },
        open: { url: "https://open.example/mcp", env_http_headers: {} }
      }), JSON.stringify((echoed.thread["config"] as Record<string, unknown>)["mcp_servers"]));
    }
    const kind = [adapter.descriptor.id, adapter.descriptor.displayName];
    Assert.areEqual(JSON.stringify([[[...kind, "docs", SharedMcpFailureKind.Connection], [...kind, "search", SharedMcpFailureKind.SignIn]], []]),
      JSON.stringify(listeners.map(t => t.sharedFailures.map(u => [u.providerId, u.providerLabel, u.server, u.kind]))));
    Assert.isFalse(JSON.stringify(listeners.map(t => [t.details, t.sharedFailures])).includes("token-value"));
  }

  @TestMethod
  public async takesASharedServerUnlessItNamesCodexsOwnCredentialVariable(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const server = (variable: string): SharedMcpServerDefinition => new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [variable], null,
      [], null);

    Assert.isNull(adapter.sharedServerUnavailable(server("SEARCH_KEY")));
    Assert.areEqual(JSON.stringify({ reason: "TeamRun keeps OPENAI_API_KEY out of Codex's environment.", short: "OPENAI_API_KEY kept from it" }),
      JSON.stringify(adapter.sharedServerUnavailable(server("OPENAI_API_KEY"))));
    Assert.areEqual("TeamRun keeps CODEX_API_KEY out of Codex's environment.", adapter.sharedServerUnavailable(server("CODEX_API_KEY"))?.reason);
  }

  @TestMethod
  public async takesNoSharedServerWithASavedSecretSinceItReadsValuesFromItsOwnEnvironment(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();

    Assert.areEqual(JSON.stringify({ reason: "Codex reads a shared server's values only from its own environment, where TeamRun puts no saved secret.",
      short: "reads values only from its environment" }), JSON.stringify(adapter.savedSecretsUnavailable()));
  }

  @TestMethod
  public async takesNoSharedServerThatNamesTheSenderToken(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["TEAMRUN_SENDER_TOKEN"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp",
      [new SharedMcpHeader("X-Team", "Teamrun_Sender_Token")], null);

    Assert.areEqual(JSON.stringify(["TEAMRUN_SENDER_TOKEN", "Teamrun_Sender_Token"].map(t => `TeamRun keeps ${t}, TeamRun's own sender token, from the MCP servers it `
      + "passes Codex.")), JSON.stringify([adapter.sharedServerUnavailable(stdio)?.reason, adapter.sharedServerUnavailable(http)?.reason]));
  }

  @TestMethod
  public answersAnAsyncQuestionAsCodexsOwnClientDoes(): void {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();

    const reply = adapter.formatQuestionReply("msg-1", "Which platform?\nPick one", "Desktop app, \"web\" too");

    Assert.areEqual("<send_user_message_question_reply>{\"questionItemId\":\"msg-1\",\"question\":\"Which platform?\\nPick one\",\"answer\":\"Desktop app, \\\"web\\\" too\"}"
      + "</send_user_message_question_reply>", reply);
  }

  @TestMethod
  public async listsTheServersItsConfigurationNamesWithoutTeamRunsOwnEnabledOrDisabledForAProfileAndForTheDefaultProfile(): Promise<void> {
    using host = new CodexTestHost();
    const servers = { node_repl: { command: "node_repl" }, docs: { url: "https://example.com/mcp", enabled: false }, notes: { command: "notes", enabled: true },
      teamrun: { command: "old" } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: JSON.stringify(servers) });

    const listed = [await adapter.listOwnMcpServers(host.createProvider()), await adapter.listOwnMcpServers(null)];
    await adapter.shutdown();

    const expected = [{ name: "node_repl", state: "Enabled" }, { name: "docs", state: "Disabled" }, { name: "notes", state: "Enabled" }];
    Assert.areEqual(JSON.stringify([expected, expected]), JSON.stringify(listed.map(t => t.map(u => u.toJson()))));
  }

  @TestMethod
  public async listsNoServersWhenItsConfigurationNamesNone(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();

    const listed = await adapter.listOwnMcpServers(host.createProvider());
    await adapter.shutdown();

    Assert.areEqual(0, listed.length);
  }

  @TestMethod
  public async runsItsAppServerAndEachThreadWithItsAppsFeatureOffWhileTheSwitchIsOff(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo"), first, new AbortController().signal);
    await adapter.runTurn(host.createRequest("echo", null, result.nativeSessionId), second, new AbortController().signal);
    await adapter.shutdown();

    for (const listener of [first, second]) {
      const echoed = JSON.parse(String(listener.texts[0])) as { thread: { config: { features: { apps: boolean } } }; argv: readonly string[] };
      Assert.isFalse(echoed.thread.config.features.apps);
      Assert.areEqual("app-server -c features.apps=false", echoed.argv.join(" "));
    }
  }

  @TestMethod
  public async keepsThePersonsMcpServersAndAppsInEveryThreadWhileTheSwitchIsOn(): Promise<void> {
    using host = new CodexTestHost();
    const servers = { node_repl: { command: "node_repl" } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: JSON.stringify(servers), TEAMRUN_FAKE_CODEX_STARTS_OWN_SERVERS: "true" });
    const provider = host.createProvider().withOwnMcpServers(true);
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("echo", provider), first, new AbortController().signal);
    await adapter.runTurn(host.createRequest("echo", provider, result.nativeSessionId), second, new AbortController().signal);
    await adapter.shutdown();

    for (const listener of [first, second]) {
      const echoed = JSON.parse(String(listener.texts[0])) as { thread: { config: Record<string, unknown> }; argv: readonly string[] };
      Assert.areEqual("{}", JSON.stringify(echoed.thread.config["mcp_servers"]));
      Assert.areEqual(JSON.stringify({ browser_use: false, computer_use: false }), JSON.stringify(echoed.thread.config["features"]));
      Assert.areEqual("app-server", echoed.argv.join(" "));
    }
  }

  @TestMethod
  public async listsModelsOnAnAppServerWithItsAppsFeatureOffWhileTheSwitchIsOffAndOnWhileItIsOn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const off = host.createProvider();
    try {
      await adapter.listModels(off);
      await adapter.listModels(off.withOwnMcpServers(true));

      Assert.areEqual("app-server -c features.apps=false|app-server", host.programs.started.map(t => t.arguments.slice(1).join(" ")).join("|"));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async letsATurnEndOnItsAppServerWhenTheSwitchChangesAndRunsTheNextOnOneThatFollowsIt(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const off = host.createProvider();
    const on = off.withOwnMcpServers(true);
    const controller = new AbortController();
    const held = new RecordingTurnListener();
    const turnedOn = new RecordingTurnListener();
    const turnedOff = new RecordingTurnListener();
    try {
      const holding = adapter.runTurn(host.createRequest("hold", off), held, controller.signal);
      await Wait.untilOrSettled(() => held.starts.length === 1, holding);
      await adapter.runTurn(host.createRequest("echo", on), turnedOn, new AbortController().signal);
      const during = adapter.clientCount;
      const stoppedDuring = host.programs.ended.length;
      const appsOff = (program: { arguments: readonly string[] }): boolean => program.arguments.includes("features.apps=false");
      const offServer = host.programs.started.find(t => appsOff(t))?.processId ?? -1;
      const onServer = host.programs.started.find(t => !appsOff(t))?.processId ?? -1;
      Assert.areNotEqual(-1, offServer, JSON.stringify(host.programs.started));
      Assert.areNotEqual(-1, onServer, JSON.stringify(host.programs.started));
      controller.abort();
      const stopped = await holding;
      host.idleTimer.advance(host.timings.idleLimit);
      await host.programs.endOf(offServer);
      const onRunning = !host.programs.ended.includes(onServer);
      const after = adapter.clientCount;
      const closed = JSON.stringify(host.programs.closed);
      await adapter.runTurn(host.createRequest("echo", off), turnedOff, new AbortController().signal);
      await host.programs.endedAt(2);

      const argvOf = (listener: RecordingTurnListener): string => (JSON.parse(String(listener.texts[0])) as { argv: readonly string[] }).argv.join(" ");
      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.areEqual(2, during);
      Assert.areEqual(0, stoppedDuring);
      Assert.isTrue(onRunning, `The app server the switch turned on closed with the old one: ${closed}`);
      Assert.areEqual(1, after, closed);
      Assert.areEqual("app-server", argvOf(turnedOn));
      Assert.areEqual("app-server -c features.apps=false", argvOf(turnedOff));
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async failsBothTurnsWhenTheSwitchChangesWhileAnAppServerFailsToStart(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_INIT: "exit" });
    const off = host.createProvider();

    const results = await Promise.all([off, off.withOwnMcpServers(true)].map(t => adapter.runTurn(host.createRequest("complete", t), new RecordingTurnListener(), new AbortController().signal)));
    await adapter.shutdown();

    Assert.areEqual(`${TurnOutcome.Failed},${TurnOutcome.Failed}`, results.map(t => t.outcome).join());
    Assert.areEqual("The Codex app-server exited (code 3, signal null)", results[1]?.error);
  }

  @TestMethod
  public async keepsThePersonsMcpServersAndAppsInAForkWhileTheSwitchIsOnAndTurnsThemOffOtherwise(): Promise<void> {
    using host = new CodexTestHost();
    const servers = { node_repl: { command: "node_repl" } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: JSON.stringify(servers), TEAMRUN_FAKE_CODEX_STARTS_OWN_SERVERS: "true" });
    const configOfFork = async (provider: Provider): Promise<Record<string, unknown>> => {
      await adapter.forkSession(new ForkRequest(provider, host.directory.path, "resumable", "turn-7", new RequestedSettings("codex", null, null)));
      const listener = new RecordingTurnListener();
      await adapter.runTurn(host.createRequest("echo", provider, "resumable"), listener, new AbortController().signal);
      return (JSON.parse(String(listener.texts[0])) as { fork: { config: Record<string, unknown> } }).fork.config;
    };

    const on = await configOfFork(host.createProvider("on", "on").withOwnMcpServers(true));
    const off = await configOfFork(host.createProvider("off", "off"));
    await adapter.shutdown();

    Assert.areEqual("{}|{\"browser_use\":false,\"computer_use\":false}", `${JSON.stringify(on["mcp_servers"])}|${JSON.stringify(on["features"])}`);
    Assert.areEqual("{\"node_repl\":{\"enabled\":false}}|{\"plugins\":false,\"apps\":false,\"browser_use\":false,\"computer_use\":false}", `${JSON.stringify(off["mcp_servers"])}|${JSON.stringify(off["features"])}`);
  }

  @TestMethod
  public async turnsOffThePersonsMcpServersInEveryThread(): Promise<void> {
    using host = new CodexTestHost();
    const servers = { node_repl: { command: "node_repl" }, docs: { url: "https://example.com/mcp", enabled: true } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: JSON.stringify(servers) });
    const started = new RecordingTurnListener();
    const resumed = new RecordingTurnListener();

    const startResult = await adapter.runTurn(host.createRequest("echo"), started, new AbortController().signal);
    const resumeResult = await adapter.runTurn(host.createRequest("echo", null, "resumable"), resumed, new AbortController().signal);
    const forked = await adapter.forkSession(new ForkRequest(null, host.directory.path, "resumable", "turn-7", new RequestedSettings("codex", null, null)));
    await adapter.shutdown();

    for (const [result, listener] of [[startResult, started], [resumeResult, resumed]] as const) {
      const echoed = JSON.parse(String(listener.texts[0])) as { thread: Record<string, unknown>; configRead: Record<string, unknown> };
      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(host.directory.path, echoed.configRead["cwd"]);
      Assert.areEqual("{\"node_repl\":{\"enabled\":false},\"docs\":{\"enabled\":false}}", JSON.stringify((echoed.thread["config"] as Record<string, unknown>)["mcp_servers"]));
    }
    Assert.areEqual("fork-resumable-turn-7", forked.nativeSessionId);
  }

  @TestMethod
  public async turnsCodexsPlanToolOnInEveryThreadItStartsResumesOrForks(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const started = new RecordingTurnListener();
    const resumed = new RecordingTurnListener();
    try {
      await adapter.runTurn(host.createRequest("echo"), started, new AbortController().signal);
      await adapter.forkSession(new ForkRequest(null, host.directory.path, "resumable", "turn-7", new RequestedSettings("codex", null, null)));
      await adapter.runTurn(host.createRequest("echo", null, "resumable"), resumed, new AbortController().signal);
    }
    finally { await adapter.shutdown(); }

    const first = JSON.parse(String(started.texts[0])) as { thread: { config: Record<string, unknown> } };
    const second = JSON.parse(String(resumed.texts[0])) as { thread: { config: Record<string, unknown> }; fork: { config: Record<string, unknown> } };
    Assert.areEqual(Array(3).fill("{\"update_plan\":{\"enabled\":true}}").join("|"),
      [first.thread, second.thread, second.fork].map(t => JSON.stringify(t.config["tools"])).join("|"));
  }

  @TestMethod
  public async failsTheTurnAndTheForkWhenTheConfigurationCannotBeRead(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MCP_SERVERS: "fail" });

    const result = await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    await Assert.throwsAsync(() => adapter.forkSession(new ForkRequest(null, host.directory.path, "resumable", "turn-7", new RequestedSettings("codex", null, null))),
      AppServerException);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual("config/read: config unreadable (code -32000)", result.error);
  }

  @TestMethod
  public async forksThreadsThroughATurn(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const fork = async (threadId: string): Promise<string> => {
      const forked = await adapter.forkSession(new ForkRequest(null, host.directory.path, threadId, "turn-7", new RequestedSettings("codex", null, "low")));
      return JSON.stringify([forked.kind, forked.providerId, forked.nativeSessionId, forked.resumeAt]);
    };

    Assert.isTrue(adapter.descriptor.supportsResume);
    Assert.isTrue(adapter.descriptor.supportsFork);
    Assert.areEqual(JSON.stringify(["codex", null, "fork-resumable-turn-7", null]), await fork("resumable"));
    Assert.areEqual(JSON.stringify(["codex", null, "fork-archived-turn-7", null]), await fork("archived"));
    await Assert.throwsAsync(() => fork("gone"), AppServerException);
    await adapter.shutdown();
  }

  @TestMethod
  public async resumesOrRestartsNativeSessions(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const resumed = new RecordingTurnListener();
    const restarted = new RecordingTurnListener();

    const unarchived = new RecordingTurnListener();
    const stuck = new RecordingTurnListener();

    const resumedResult = await adapter.runTurn(host.createRequest("fail", null, "resumable"), resumed, new AbortController().signal);
    const restartedResult = await adapter.runTurn(host.createRequest("fail", null, "gone"), restarted, new AbortController().signal);
    const unarchivedResult = await adapter.runTurn(host.createRequest("fail", null, "archived"), unarchived, new AbortController().signal);
    const stuckResult = await adapter.runTurn(host.createRequest("fail", null, "stuck"), stuck, new AbortController().signal);
    const busy = new RecordingTurnListener();
    const jammed = new RecordingTurnListener();
    const busyResult = await adapter.runTurn(host.createRequest("fail", null, "busy"), busy, new AbortController().signal);
    const jammedResult = await adapter.runTurn(host.createRequest("fail", null, "jammed"), jammed, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual("busy", busyResult.nativeSessionId);
    Assert.isTrue(busy.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(0, busy.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual("thread-3", jammedResult.nativeSessionId);
    Assert.isFalse(jammed.starts[0]?.resumedNativeSession ?? true);
    Assert.isTrue(jammed.texts[0]?.includes("active writer") ?? false);
    Assert.areEqual(1, host.programs.started.length);
    Assert.isTrue((host.programs.started[0]?.processId ?? 0) > 0);
    Assert.areEqual(process.execPath, host.programs.started[0]?.executable);
    Assert.areEqual(host.programs.started[0]?.processId, host.programs.ended[0]);

    Assert.areEqual("archived", unarchivedResult.nativeSessionId);
    Assert.isTrue(unarchived.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(0, unarchived.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual("thread-2", stuckResult.nativeSessionId);
    Assert.isTrue(stuck.texts[0]?.includes("cannot unarchive") ?? false);

    Assert.areEqual("resumable", resumedResult.nativeSessionId);
    Assert.isTrue(resumed.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(TurnOutcome.Failed, resumedResult.outcome);
    Assert.areEqual("boom", resumedResult.error);
    Assert.areEqual("thread-1", restartedResult.nativeSessionId);
    Assert.isFalse(restarted.starts[0]?.resumedNativeSession ?? true);
    Assert.areEqual("The native session could not be resumed, so a fresh one was started: thread/resume: thread not found (code -32602)", restarted.texts[0]);
    Assert.areEqual(JSON.stringify({ source: "resume" }), JSON.stringify(restarted.details[0]?.payload));
  }

  @TestMethod
  public async routesApprovalsToTheListenerIncludingATeamRunProviderChecksMcpApproval(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.decisions.push("accept", "decline", "acceptForSession");
    listener.defaultDecision = "accept";

    const result = await adapter.runTurn(host.createRequest("approve"), listener, new AbortController().signal);
    await adapter.shutdown();

    const answers = JSON.parse(String(listener.texts.at(-1))) as { result: unknown; error: { message: string } | null }[];
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(5, listener.asks.length);
    Assert.areEqual(ApprovalKind.Command, listener.asks[0]?.kind);
    Assert.areEqual("commandExecution", listener.asks[0]?.nativeKind);
    Assert.areEqual("thread-1:cmd-1:1", listener.asks[0]?.providerRequestId);
    Assert.areEqual("Run command: rm -rf build", listener.asks[0]?.summary);
    Assert.areEqual("Run command: (unknown command)", listener.asks[1]?.summary);
    Assert.areEqual("Apply file changes: apply (grant root D:/work)", listener.asks[2]?.summary);
    Assert.areEqual("Apply file changes", listener.asks[3]?.summary);
    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(answers[0]?.result));
    Assert.areEqual("{\"decision\":\"decline\"}", JSON.stringify(answers[1]?.result));
    Assert.areEqual("{\"decision\":\"acceptForSession\"}", JSON.stringify(answers[2]?.result));
    Assert.areEqual("{\"decision\":\"accept\"}", JSON.stringify(answers[3]?.result));
    Assert.areEqual("{\"answers\":{}}", JSON.stringify(answers[4]?.result));
    Assert.areEqual("TeamRun does not handle the server request item/permissions/requestApproval.", answers[5]?.error?.message);
    Assert.areEqual("TeamRun does not handle the server request item/commandExecution/requestApproval.", answers[6]?.error?.message);
    Assert.areEqual("TeamRun does not handle the server request item/commandExecution/requestApproval.", answers[7]?.error?.message);
    Assert.areEqual(ApprovalKind.Tool, listener.asks[4]?.kind);
    Assert.areEqual("thread-1:check-1:5|Allow the teamrun MCP server to run tool \"teamrun_check_provider\"?",
      [listener.asks[4]?.providerRequestId, listener.asks[4]?.summary].join("|"));
    Assert.areEqual(JSON.stringify({ server: "teamrun", message: "Allow the teamrun MCP server to run tool \"teamrun_check_provider\"?", tool: "Check a provider",
      arguments: { provider_id: "a1" } }), JSON.stringify(listener.asks[4]?.payload));
    Assert.areEqual("{\"action\":\"accept\",\"content\":{},\"_meta\":null}", JSON.stringify(answers[8]?.result));
  }

  @TestMethod
  public async marksOnlyTheItemThePersonDeclinedNotOneCodexDeclinesBecauseTheReplyStoppedWhileItsApprovalWaited(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const ask = listener.onApprovalRequested.bind(listener);
    listener.onApprovalRequested = (approval, signal): Promise<string> =>
      approval.kind === ApprovalKind.FileChange ? Promise.reject(new Error("The reply was stopped.")) : ask(approval, signal);
    listener.decisions.push("decline");

    const result = await adapter.runTurn(host.createRequest("declines"), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([["cmd-d", true], ["fc-s", false]]),
      JSON.stringify(listener.details.filter(t => t.kind !== DetailKind.Text).map(t => [t.providerItemId, JSON.stringify(t.payload).includes("\"denied\":true")])));
  }

  @TestMethod
  public async reportsListenerRefusalsAsDeclinedRequests(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.decisionFailure = new Error("cancelled by the user");

    const result = await adapter.runTurn(host.createRequest("approve"), listener, new AbortController().signal);
    await adapter.shutdown();

    const answers = JSON.parse(String(listener.texts.at(-1))) as { error: { message: string } | null }[];
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("cancelled by the user", answers[0]?.error?.message);
  }

  @TestMethod
  public async interruptsACompactionStoppedBeforeItsTurnStarted(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_HOLD_COMPACT: "1" });
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    const request = (resume: string, compacts: boolean): TurnRequest => new TurnRequest(null, host.directory.path, "role-payload context",
      new RequestedSettings("codex", null, null), resume, [], null, null, {}, compacts);
    try {
      const running = adapter.runTurn(request("resumable", true), listener, controller.signal);
      await Wait.untilOrSettled(() => listener.starts.length === 1, running);
      controller.abort();
      await adapter.listModels(null);
      const result = await running;
      const next = new RecordingTurnListener();
      await adapter.runTurn(request("resumable", false), next, new AbortController().signal);
      const counted = new RecordingTurnListener();
      await adapter.runTurn(host.createRequest("interrupts"), counted, new AbortController().signal);

      Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
      Assert.areEqual("turn-1", result.nativeTurnId);
      Assert.areEqual("[]", JSON.stringify(JSON.parse(next.details.find(t => t.kind === DetailKind.Text)!.text).archives));
      Assert.areEqual("1", counted.details.find(t => t.kind === DetailKind.Text)?.text);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsOnAbort(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_HOLD_TURN_START: "1" });
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("hold"), listener, controller.signal);
    await Wait.untilOrSettled(() => listener.starts.length === 1, running);
    controller.abort();
    await adapter.listModels(null);
    const result = await running;
    const counted = new RecordingTurnListener();
    await adapter.runTurn(host.createRequest("interrupts"), counted, new AbortController().signal);
    const preAborted = await adapter.runTurn(host.createRequest("hold"), new RecordingTurnListener(), AbortSignal.abort());
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isNull(result.error);
    Assert.areEqual("1", counted.details.find(t => t.kind === DetailKind.Text)?.text);
    Assert.areEqual(TurnOutcome.Interrupted, preAborted.outcome);
  }

  @TestMethod
  public async interruptsOnlyATitleTurnStoppedWhileAReplyRunsOnTheSameAppServer(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const replying = new AbortController();
    const reply = adapter.runTurn(host.createRequest("hold"), listener, replying.signal);
    await Wait.untilOrSettled(() => listener.details.length === 1, reply);
    let replyEnded = false;
    void reply.then(() => { replyEnded = true; });
    const asked = host.createRequest("hold");
    const titleListener = new RecordingTurnListener();
    const titling = new AbortController();

    const title = adapter.runTurn(new TurnRequest(null, asked.workingDirectory, asked.prompt, asked.requested, null, [], null, null, {}, false, null, [], null,
      () => false, SharedMcpValues.none, null, true), titleListener, titling.signal);
    await Wait.untilOrSettled(() => titleListener.details.length === 1, title);
    titling.abort();
    const titled = await title;
    const servers = host.programs.started.length;
    const accepted = new RecordingTurnListener();
    await adapter.runTurn(host.createRequest("acceptedInterrupts"), accepted, new AbortController().signal);
    const endedByTitle = replyEnded;
    replying.abort();
    const result = await reply;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Interrupted, titled.outcome);
    Assert.areEqual(JSON.stringify([{ threadId: titled.nativeSessionId, turnId: titled.nativeTurnId }]), accepted.details.find(t => t.kind === DetailKind.Text)?.text);
    Assert.isFalse(endedByTitle);
    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.areEqual(1, servers);
  }

  @TestMethod
  public async givesUpAfterTheInterruptGrace(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_INTERRUPT: "fail" }, host.command, host.refusedInterruptTimings);
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("hold"), listener, controller.signal);
    await Wait.untilOrSettled(() => listener.details.length === 1, running);
    controller.abort();
    const result = await running;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
  }

  @TestMethod
  public async failsWhenTheServerDiesOrRefuses(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_ACCOUNT: "error" });
    const listener = new RecordingTurnListener();

    const exited = await adapter.runTurn(host.createRequest("exit"), listener, new AbortController().signal);
    await Wait.untilOrSettled(() => adapter.clientCount === 0, host.programs.endedAt(1));
    const refusedThread = await adapter.runTurn(host.createRequest("complete", null, null, "explode"), new RecordingTurnListener(), new AbortController().signal);
    const refusedTurn = await adapter.runTurn(host.createRequest("reject"), new RecordingTurnListener(), new AbortController().signal);
    const failedNoError = await adapter.runTurn(host.createRequest("failNoError"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Failed, exited.outcome);
    Assert.areEqual("The Codex app-server exited during the turn.", exited.error);
    Assert.isFalse(listener.texts.some(t => t.includes("account")));
    Assert.areEqual(TurnOutcome.Failed, refusedThread.outcome);
    Assert.areEqual("thread/start: thread refused (code -32000)", refusedThread.error);
    Assert.areEqual("9.9.9", refusedThread.observed.harnessVersion);
    Assert.areEqual(TurnOutcome.Failed, refusedTurn.outcome);
    Assert.areEqual("turn/start: turn refused (code -32000)", refusedTurn.error);
    Assert.areEqual("The turn ended with status \"failed\".", failedNoError.error);
  }

  @TestMethod
  public async failsATurnWhoseCodexWasUpdatedWhileInUseAndKeepsOtherStartFailures(): Promise<void> {
    using host = new CodexTestHost();
    const updated = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_START: "mismatch" });
    const exiting = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_INIT: "exit" });
    const reinstall = "Codex CLI was updated while in use, so it can't start. Quit TeamRun and every other app using Codex, reinstall Codex CLI, then retry.";
    try {
      const mismatched = await updated.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
      const listing = await updated.listModels(null).then(() => null, (error: unknown) => error instanceof Error ? error.message : null);
      const checked = await updated.checkSignIn(host.createProvider());
      const exited = await exiting.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(TurnOutcome.Failed, mismatched.outcome);
      Assert.areEqual(reinstall, mismatched.error);
      Assert.areEqual(reinstall, listing);
      Assert.areEqual(reinstall, checked.error);
      Assert.areEqual(TurnOutcome.Failed, exited.outcome);
      Assert.areEqual("The Codex app-server exited (code 3, signal null)", exited.error);
    }
    finally { await Promise.all([updated.shutdown(), exiting.shutdown()]); }
  }

  @TestMethod
  public async startsANewAppServerForATurnOnceTheCodexCliVersionChanges(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile });
    const unversioned = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_USER_AGENT: "codex-cli (fake)" });
    const run = (on: CodexAdapter): Promise<TurnResult> => on.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    try {
      const first = await run(adapter);
      await run(adapter);
      const same = await run(adapter);
      const unchangedReads = host.versionReader.reads;
      host.idleTimer.advance(host.timings.idleLimit);
      host.installCodex(versionFile, "1.1.0");
      const updated = await run(adapter);
      const updatedReads = host.versionReader.reads;
      await host.programs.endedAt(1);
      const clients = adapter.clientCount;
      host.installCodex(versionFile, "not a version");
      const unreadable = await run(adapter);
      host.installCodex(versionFile, "1.2.0");
      await run(unversioned);
      host.installCodex(versionFile, "1.3.0");
      const unknown = await run(unversioned);

      Assert.areEqual("1.0.0", first.observed.harnessVersion);
      Assert.areEqual("1.0.0", same.observed.harnessVersion);
      Assert.areEqual("1.1.0", updated.observed.harnessVersion);
      Assert.areEqual(0, unchangedReads);
      Assert.areEqual(1, updatedReads);
      Assert.areEqual(1, clients);
      Assert.areEqual("1.1.0", unreadable.observed.harnessVersion);
      Assert.areEqual(TurnOutcome.Completed, unknown.outcome);
      Assert.areEqual(3, host.programs.started.length);
      Assert.areEqual(1, host.programs.ended.length);
    }
    finally { await Promise.all([adapter.shutdown(), unversioned.shutdown()]); }
  }

  @TestMethod
  public async letsATurnEndOnTheOldAppServerAfterTheCodexCliVersionChangesAndThenStopsIt(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile });
    const controller = new AbortController();
    const held = new RecordingTurnListener();
    try {
      const holding = adapter.runTurn(host.createRequest("hold"), held, controller.signal);
      await Wait.untilOrSettled(() => held.starts.length === 1, holding);
      host.installCodex(versionFile, "1.1.0");
      const updated = await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
      const during = adapter.clientCount;
      const stoppedDuring = host.programs.ended.length;
      controller.abort();
      const stopped = await holding;
      host.idleTimer.advance(host.timings.idleLimit);
      await host.programs.endedAt(1);
      const after = adapter.clientCount;
      const stoppedAfter = host.programs.ended.length;

      Assert.areEqual("1.1.0", updated.observed.harnessVersion);
      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.areEqual("1.0.0", stopped.observed.harnessVersion);
      Assert.areEqual(2, during);
      Assert.areEqual(0, stoppedDuring);
      Assert.areEqual(1, stoppedAfter);
      Assert.areEqual(1, after);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async stopsAnOldAppServerStillRunningATurnAtShutdown(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile });
    const held = new RecordingTurnListener();
    const controller = new AbortController();
    const holding = adapter.runTurn(host.createRequest("hold"), held, controller.signal);
    await Wait.untilOrSettled(() => held.starts.length === 1, holding);
    host.installCodex(versionFile, "1.1.0");
    await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();
    const ended = host.programs.ended.length;
    const clients = adapter.clientCount;
    controller.abort();
    const stopped = await holding;

    Assert.areEqual(2, ended);
    Assert.areEqual(0, clients);
    Assert.areEqual("1.0.0", stopped.observed.harnessVersion);
  }

  @TestMethod
  public async keepsAnOldAppServerUntilAListingOnItEndsAndChecksASignInOnTheCurrentOne(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_MODEL_LIST: "hold" });
    const provider = host.createProvider();
    const run = (): Promise<TurnResult> => adapter.runTurn(host.createRequest("complete", provider), new RecordingTurnListener(), new AbortController().signal);
    try {
      await run();
      host.idleTimer.advance(host.timings.idleLimit);
      writeFileSync(host.directory.resolve("profile", "model-list-armed"), "");
      const listing = adapter.listModels(provider);
      await Wait.untilOrSettled(() => existsSync(host.directory.resolve("profile", "model-list")), listing);
      host.installCodex(versionFile, "1.1.0");
      const updated = await run();
      const stoppedDuring = host.programs.ended.length;
      writeFileSync(host.directory.resolve("profile", "model-list-release"), "");
      const listed = await listing;
      await host.programs.endedAt(1);
      const stoppedAfter = host.programs.ended.length;
      host.installCodex(versionFile, "1.2.0");
      const checked = await adapter.checkSignIn(provider);

      Assert.areEqual("1.1.0", updated.observed.harnessVersion);
      Assert.areEqual(0, stoppedDuring);
      Assert.areEqual(1, stoppedAfter);
      Assert.areEqual("gpt-5.6-sol", listed.models.map(t => t.id).join(","));
      Assert.areEqual("1.2.0", checked.harnessVersion);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async readsTheVersionAgainOnceTheVersionTimeoutPassesAfterAReadFails(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const timer = new ManualTimer();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile }, host.command, host.timings, timer);
    const run = (): Promise<TurnResult> => adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    try {
      await run();
      host.installCodex(versionFile, "not yet");
      const failedRead = await run();
      writeFileSync(versionFile, "1.1.0");
      timer.advance(host.timings.versionTimeout - 1);
      const held = await run();
      const heldReads = host.versionReader.reads;
      timer.advance(1);
      const reread = await run();

      Assert.areEqual("1.0.0", failedRead.observed.harnessVersion);
      Assert.areEqual("1.0.0", held.observed.harnessVersion);
      Assert.areEqual(1, heldReads);
      Assert.areEqual("1.1.0", reread.observed.harnessVersion);
      Assert.areEqual(2, host.versionReader.reads);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsAnOldAppServerUntilASignInOnItEnds(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_ACCOUNT: "none",
      TEAMRUN_FAKE_CODEX_LOGIN: "hold" });
    const provider = host.createProvider();
    const controller = new AbortController();
    try {
      await adapter.checkSignIn(provider);
      const signing = adapter.signIn(provider, controller.signal, { openLink: (): void => undefined })
        .then(() => null, (error: unknown) => error instanceof Error ? error.message : null);
      await Wait.untilOrSettled(() => existsSync(host.directory.resolve("profile", "login-started")), signing);
      host.installCodex(versionFile, "1.1.0");
      const updated = await adapter.runTurn(host.createRequest("complete", provider), new RecordingTurnListener(), new AbortController().signal);
      const stoppedDuring = host.programs.ended.length;
      controller.abort();
      const ended = await signing;
      await host.programs.endedAt(1);
      const stoppedAfter = host.programs.ended.length;

      Assert.areEqual("1.1.0", updated.observed.harnessVersion);
      Assert.areEqual(0, stoppedDuring);
      Assert.areEqual(1, stoppedAfter);
      Assert.areEqual("The Codex sign-in was cancelled.", ended);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsAnOldAppServerUntilAForkOnItEnds(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_FORK: "hold" });
    const provider = host.createProvider();
    try {
      await adapter.checkSignIn(provider);
      const forking = adapter.forkSession(new ForkRequest(provider, host.directory.path, "resumable", "turn-7", new RequestedSettings("codex", null, null)));
      await Wait.untilOrSettled(() => existsSync(host.directory.resolve("profile", "fork")), forking);
      host.installCodex(versionFile, "1.1.0");
      const updated = await adapter.runTurn(host.createRequest("complete", provider), new RecordingTurnListener(), new AbortController().signal);
      const stoppedDuring = host.programs.ended.length;
      writeFileSync(host.directory.resolve("profile", "fork-release"), "");
      const forked = await forking;
      await host.programs.endedAt(1);
      const stoppedAfter = host.programs.ended.length;

      Assert.areEqual("1.1.0", updated.observed.harnessVersion);
      Assert.areEqual(0, stoppedDuring);
      Assert.areEqual(1, stoppedAfter);
      Assert.areEqual("fork-held", forked.nativeSessionId);
      Assert.areEqual(provider.id, forked.providerId);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsASignInAbortedWhileItWaitsForTheVersionReadAtOnceAndStartsNoAppServerAfterTheRead(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const release = host.directory.resolve("version-release");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_VERSION_RELEASE: release,
      TEAMRUN_FAKE_CODEX_ACCOUNT: "none" });
    const provider = host.createProvider();
    const controller = new AbortController();
    try {
      await adapter.checkSignIn(provider);
      host.installCodex(versionFile, "1.1.0");
      const signing = adapter.signIn(provider, controller.signal, { openLink: (): void => undefined })
        .then(() => null, (error: unknown) => error instanceof Error ? error.message : null);
      await Wait.untilOrSettled(() => host.versionReader.reads === 1, signing);
      controller.abort();
      const ended = await signing;
      const readsEndedFirst = host.versionReader.ended;
      writeFileSync(`${release}-1`, "");
      await host.versionReader.endedAt(1);
      await host.programs.endedAt(1);

      Assert.areEqual("The Codex sign-in was cancelled.", ended);
      Assert.areEqual(0, readsEndedFirst);
      Assert.areEqual(1, host.versionReader.reads);
      Assert.areEqual(1, host.programs.started.length);
      Assert.areEqual(0, adapter.clientCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async startsNoAppServerWhenAVersionReadEndsAfterShutdown(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const release = host.directory.resolve("version-release");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_VERSION_RELEASE: release });
    const provider = host.createProvider();
    const messageOf = (error: unknown): string | null => error instanceof Error ? error.message : null;
    try {
      await adapter.runTurn(host.createRequest("complete", provider), new RecordingTurnListener(), new AbortController().signal);
      host.installCodex(versionFile, "1.1.0");
      const turning = adapter.runTurn(host.createRequest("complete", provider), new RecordingTurnListener(), new AbortController().signal);
      const listing = adapter.listModels(provider).then(() => null, messageOf);
      const signing = adapter.signIn(provider, new AbortController().signal, { openLink: (): void => undefined }).then(() => null, messageOf);
      await Wait.untilOrSettled(() => host.versionReader.reads === 1, turning);
      await adapter.shutdown();
      writeFileSync(`${release}-1`, "");
      await host.versionReader.endedAt(1);
      const ended = await turning;

      Assert.areEqual(TurnOutcome.Failed, ended.outcome);
      Assert.areEqual("Codex was stopped because TeamRun is closing.", ended.error);
      Assert.areEqual("Codex was stopped because TeamRun is closing.", await listing);
      Assert.areEqual("Codex was stopped because TeamRun is closing.", await signing);
      Assert.areEqual(1, host.versionReader.reads);
      Assert.areEqual(1, host.programs.started.length);
      Assert.areEqual(0, adapter.clientCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async endsATurnStoppedWhileItWaitsForTheVersionReadAtOnce(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const release = host.directory.resolve("version-release");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_VERSION_RELEASE: release });
    const controller = new AbortController();
    try {
      await adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
      host.idleTimer.advance(host.timings.idleLimit);
      host.installCodex(versionFile, "1.1.0");
      const stopping = adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), controller.signal);
      await Wait.untilOrSettled(() => host.versionReader.reads === 1, stopping);
      controller.abort();
      const stopped = await stopping;
      const readsEndedFirst = host.versionReader.ended;
      writeFileSync(`${release}-1`, "");
      await host.versionReader.endedAt(1);
      await host.programs.endedAt(1);

      Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
      Assert.areEqual(0, readsEndedFirst);
      Assert.areEqual(1, host.programs.started.length);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async keepsTheNewAppServerWhenAnEarlierVersionCheckEndsAfterIt(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const release = host.directory.resolve("version-release");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile, TEAMRUN_FAKE_CODEX_VERSION_RELEASE: release });
    const run = (): Promise<TurnResult> => adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    try {
      await run();
      host.idleTimer.advance(host.timings.idleLimit);
      host.installCodex(versionFile, "1.1.0");
      const first = run();
      await Wait.untilOrSettled(() => existsSync(`${release}-1.started`), first);
      host.installCodex(versionFile, "1.2.0");
      const second = run();
      await Wait.untilOrSettled(() => existsSync(`${release}-2.started`), second);
      writeFileSync(`${release}-2`, "");
      const secondTurn = await second;
      const endedBeforeTheFirst = host.versionReader.ended;
      writeFileSync(`${release}-1`, "");
      const firstTurn = await first;

      Assert.areEqual(1, endedBeforeTheFirst);
      Assert.areEqual(2, host.versionReader.ended);
      Assert.areEqual("1.2.0,1.2.0", [firstTurn, secondTurn].map(t => t.observed.harnessVersion).join(","));
      Assert.areEqual(2, host.versionReader.reads);
      Assert.areEqual(2, host.programs.started.length);
      Assert.areEqual(1, adapter.clientCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async startsOneNewAppServerForTwoTurnsAtOnceAfterTheCodexCliVersionChanges(): Promise<void> {
    using host = new CodexTestHost();
    const versionFile = host.directory.resolve("codex-version");
    host.installCodex(versionFile, "1.0.0");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_VERSION_FILE: versionFile });
    const run = (): Promise<TurnResult> => adapter.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    try {
      await run();
      host.idleTimer.advance(host.timings.idleLimit);
      host.installCodex(versionFile, "1.1.0");
      const turns = await Promise.all([run(), run()]);
      await host.programs.endedAt(1);

      Assert.areEqual("1.1.0,1.1.0", turns.map(t => t.observed.harnessVersion).join(","));
      Assert.areEqual(1, host.versionReader.reads);
      Assert.areEqual(2, host.programs.started.length);
      Assert.areEqual(1, adapter.clientCount);
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async rejectsUnavailableExecutablesAndUnsupportedModelEffortAndRunsATurnAskingNeitherEffortNorSpeedWhenTheModelsCantBeRead(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const missing = host.createAdapter(host.environment, null);
    const unspawnable = host.createAdapter(host.environment, new ProcessCommand("teamrun-no-such-executable", []));
    const unlisted = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: "{}" });
    const unlistedListener = new RecordingTurnListener();

    const badEffort = await adapter.runTurn(host.createRequest("complete", null, null, null, "extreme"), new RecordingTurnListener(), new AbortController().signal);
    const notFound = await missing.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    const failedStart = await unspawnable.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    const listing = Assert.throwsAsync(() => unspawnable.listModels(null), Error);
    await unspawnable.shutdown();
    await listing;
    const unreadModels = await unlisted.runTurn(host.createRequest("complete", null, null, null, "high"), unlistedListener, new AbortController().signal);
    const unreadPlain = await unlisted.runTurn(host.createRequest("complete"), new RecordingTurnListener(), new AbortController().signal);
    await Promise.all([adapter.shutdown(), unlisted.shutdown()]);

    Assert.areEqual(TurnOutcome.Failed, badEffort.outcome);
    Assert.areEqual("The effort \"extreme\" is not one Sol accepts.", badEffort.error);
    Assert.areEqual(0, adapter.clientCount);
    Assert.areEqual(TurnOutcome.Failed, notFound.outcome);
    Assert.isTrue(notFound.error?.includes("Codex CLI was not found") ?? false);
    Assert.areEqual(TurnOutcome.Failed, failedStart.outcome);
    Assert.isTrue(failedStart.error?.includes("ENOENT") ?? false);
    Assert.areEqual(0, unspawnable.clientCount);
    Assert.areEqual(TurnOutcome.Failed, unreadModels.outcome);
    Assert.areEqual(0, unlistedListener.starts.length);
    Assert.areEqual(TurnOutcome.Completed, unreadPlain.outcome);
  }

  @TestMethod
  public async showsTheAppServerAmongTheRunningProgramsDuringAndAfterATurnUntilShutdown(): Promise<void> {
    using host = new CodexTestHost();
    const starter = new RunningProgramsStarter();
    const adapter = new CodexAdapter(host.command, host.environment, host.clientInfo, host.programs.wrap(starter), host.timings, host.versionReader);
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    try {
      const run = adapter.runTurn(host.createRequest("hold"), listener, controller.signal);
      await Wait.untilOrSettled(() => listener.starts.length === 1, run);
      const during = starter.ofKind("codex").length;
      controller.abort();
      const result = await run;
      const after = starter.ofKind("codex").length;

      Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
      Assert.areEqual(1, during);
      Assert.areEqual(1, after);
    }
    finally {
      controller.abort();
      await adapter.shutdown();
    }
    await starter.allExited();
    Assert.areEqual(0, starter.running.length);
  }

  @TestMethod
  public async reportsEachTurnsTokensAndContextAndTheProvidersRateLimits(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const restarted = host.createAdapter();
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const afterRestart = new RecordingTurnListener();
    const usage = (listener: RecordingTurnListener): string => listener.usages.map(t => `${t.inputTokens} ${t.outputTokens} ${t.costUsd} ${t.context?.usedTokens}/${t.context?.windowTokens}`).join(",");
    try {
      const started = await adapter.runTurn(host.createRequest("usage"), first, new AbortController().signal);
      await adapter.runTurn(host.createRequest("usage", null, started.nativeSessionId), second, new AbortController().signal);
      await restarted.runTurn(host.createRequest("usage", null, "resumable"), afterRestart, new AbortController().signal);

      Assert.areEqual("1000 100 null 5000/200000,1000 100 null 5000/200000", usage(first));
      Assert.areEqual("1000 100 null 5900/200000,1000 100 null 5900/200000", usage(second));
      Assert.areEqual("null null null 5000/200000,null null null 5000/200000", usage(afterRestart));
      Assert.areEqual("FiveHour 30 null", first.planUsages.map(t => t.map(w => `${w.name} ${w.usedPercent} ${w.resetsAt}`).join(";")).join(","));
    }
    finally { await Promise.all([adapter.shutdown(), restarted.shutdown()]); }
  }

  @TestMethod
  public async readsThePlanUseFromTheRateLimitsAndNothingWhenCodexCannotSayOrNamesNone(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const refusing = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_RATE_LIMITS: "fail" });
    const silent = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_RATE_LIMITS: "none" });
    try {
      await adapter.runTurn(host.createRequest("usage"), new RecordingTurnListener(), new AbortController().signal);
      const usage = await adapter.readPlanUsage(null);

      Assert.areEqual("FiveHour 25 2026-10-22T08:00:00.000Z,Weekly 60 null", (usage?.windows ?? []).map(t => `${t.name} ${t.usedPercent} ${t.resetsAt}`).join(","));
      Assert.isNull(usage?.plan);
      Assert.isNull(await refusing.readPlanUsage(null));
      Assert.isNull(await silent.readPlanUsage(null));
      Assert.isNull(await host.createAdapter(host.environment, null).readPlanUsage(null));
    }
    finally { await Promise.all([adapter.shutdown(), refusing.shutdown(), silent.shutdown()]); }
  }

  @TestMethod
  public async sendsASlashWordItDoesntKnowAsAPrompt(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const asked = host.createRequest("/tmp is full, clean it up", host.createProvider());

    try {
      const turn = await adapter.runTurn(new TurnRequest(asked.provider, asked.workingDirectory, asked.prompt, asked.requested, asked.resumeNativeSessionId, [], null, null, {},
        false, null, [], null, () => false, SharedMcpValues.none, null, false, "/tmp is full, clean it up"), listener, new AbortController().signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, 1]), JSON.stringify([turn.outcome, listener.starts.length]));
      Assert.isFalse(listener.details.some(t => t.text.startsWith("Codex can't run")), JSON.stringify(listener.details));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData("/diff src", "/diff")
  @TestData("/prompts:fix the bug", "/prompts:fix")
  public async answersASlashCommandWithWhyItCantRunItBeforeStartingCodex(command: string, shown: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const asked = host.createRequest(command, host.createProvider(), "thread-1");

    try {
      const turn = await adapter.runTurn(new TurnRequest(asked.provider, asked.workingDirectory, asked.prompt, asked.requested, asked.resumeNativeSessionId, [], null, null, {},
        false, null, [], null, () => false, SharedMcpValues.none, null, false, command), listener, new AbortController().signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, "thread-1", 0, 0]),
        JSON.stringify([turn.outcome, turn.nativeSessionId, host.programs.started.length, listener.starts.length]));
      Assert.areEqual(JSON.stringify([[DetailKind.Note, `Codex can't run ${shown}: ${Resources.codexListedCommandsAbility}.`]]),
        JSON.stringify(listener.details.map(t => [t.kind, t.text])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData("/review", null, "Codex reviews current changes.")
  @TestData("/review  the parser's error paths ", "the parser's error paths", "Codex reviews the parser's error paths.")
  public async runsReviewAsTheTurnOnTheUncommittedChangesOrWithTheTextAsItsInstructions(command: string, instructions: string | null, note: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    try {
      const turn = await adapter.runTurn(CodexAdapterTests.commandRequest(host, command, null), listener, new AbortController().signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, "thread-1", 1]), JSON.stringify([turn.outcome, turn.nativeSessionId, listener.starts.length]));
      const target = Object.isNull(instructions) ? { type: "uncommittedChanges" } : { type: "custom", instructions };
      Assert.areEqual(JSON.stringify([[DetailKind.Note, note], [DetailKind.Text, JSON.stringify({ target, delivery: null })]]),
        JSON.stringify(listener.details.map(t => [t.kind, t.text])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async runsReviewOnTheChatsThreadAndFailsWithCodexsRefusal(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const refusing = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_REVIEW: "refuse" });
    const run = (target: CodexAdapter, command: string, resume: string | null): Promise<TurnResult> =>
      target.runTurn(CodexAdapterTests.commandRequest(host, command, resume), new RecordingTurnListener(), new AbortController().signal);

    try {
      const first = await adapter.runTurn(host.createRequest("role-payload"), new RecordingTurnListener(), new AbortController().signal);
      const reviewed = await run(adapter, "/review", first.nativeSessionId);
      const refused = await run(refusing, "/review", null);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, first.nativeSessionId]), JSON.stringify([reviewed.outcome, reviewed.nativeSessionId]));
      Assert.areEqual(TurnOutcome.Failed, refused.outcome);
      Assert.isTrue(refused.error?.includes("review refused") === true, String(refused.error));
    }
    finally {
      await adapter.shutdown();
      await refusing.shutdown();
    }
  }

  @TestMethod
  public async forksTheChatsThreadWithoutStartingATurnAndTheChatGoesOnInTheFork(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    try {
      const forked = await adapter.runTurn(CodexAdapterTests.commandRequest(host, "/fork", "resumable"), listener, new AbortController().signal);
      const missing = await adapter.runTurn(CodexAdapterTests.commandRequest(host, "/fork", "missing"), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, "fork-resumable", 0]), JSON.stringify([forked.outcome, forked.nativeSessionId, listener.starts.length]));
      Assert.areEqual(JSON.stringify([[DetailKind.Note, Resources.codexForked]]), JSON.stringify(listener.details.map(t => [t.kind, t.text])));
      Assert.areEqual(JSON.stringify([TurnOutcome.Failed, null]), JSON.stringify([missing.outcome, missing.nativeSessionId]));
      Assert.isTrue(missing.error?.includes("thread not found") === true, String(missing.error));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async renamesAndArchivesTheChatsThreadAndTheNextMessageTakesItOutOfTheArchive(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const notes: string[] = [];
    const run = async (prompt: string, resume: string | null, command: string | null = null): Promise<TurnResult & { readonly echo: string | null }> => {
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(Object.isNull(command) ? host.createRequest(prompt, null, resume) : CodexAdapterTests.commandRequest(host, command, resume),
        listener, new AbortController().signal);
      notes.push(...listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text));
      return Object.assign(turn, { echo: listener.details.find(t => t.kind === DetailKind.Text)?.text ?? null });
    };

    try {
      const first = await run("role-payload", null);
      const thread = String(first.nativeSessionId);
      const renamed = await run("", thread, "/rename  Parser fixes ");
      const archived = await run("", thread, "/archive");
      const next = await run("role-payload", thread);
      const echo = JSON.parse(String(next.echo)) as { readonly names: readonly string[][]; readonly archives: readonly string[] };

      Assert.areEqual(JSON.stringify([thread, thread, thread]), JSON.stringify([renamed.nativeSessionId, archived.nativeSessionId, next.nativeSessionId]));
      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed, TurnOutcome.Completed]),
        JSON.stringify([renamed.outcome, archived.outcome, next.outcome]));
      Assert.areEqual(JSON.stringify([Resources.formatCodexRenamed("Parser fixes"), Resources.codexArchived]), JSON.stringify(notes));
      Assert.areEqual(JSON.stringify([[[thread, "Parser fixes"]], [thread]]), JSON.stringify([echo.names, echo.archives]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async renamesAnArchivedThreadByUnarchivingItAndFailsWithCodexsAnswerForOneItDoesntHave(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const notes: string[] = [];
    const run = async (resume: string, command: string | null): Promise<TurnResult & { readonly echo: string | null }> => {
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(Object.isNull(command) ? host.createRequest("role-payload", null, resume) : CodexAdapterTests.commandRequest(host, command, resume),
        listener, new AbortController().signal);
      notes.push(...listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text));
      return Object.assign(turn, { echo: listener.details.find(t => t.kind === DetailKind.Text)?.text ?? null });
    };

    try {
      const first = await adapter.runTurn(host.createRequest("role-payload"), new RecordingTurnListener(), new AbortController().signal);
      const thread = String(first.nativeSessionId);
      await run(thread, "/archive");
      const renamed = await run(thread, "/rename Parser fixes");
      const missing = await run("missing", "/rename Parser fixes");
      const next = await run(thread, null);
      const echo = JSON.parse(String(next.echo)) as { readonly names: readonly string[][]; readonly nameTries: readonly string[] };

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, thread]), JSON.stringify([renamed.outcome, renamed.nativeSessionId]));
      Assert.areEqual(JSON.stringify([Resources.codexArchived, Resources.formatCodexRenamed("Parser fixes")]), JSON.stringify(notes));
      Assert.areEqual(JSON.stringify([[[thread, "Parser fixes"]], [thread, thread, "missing"]]), JSON.stringify([echo.names, echo.nameTries]));
      Assert.areEqual(TurnOutcome.Failed, missing.outcome);
      Assert.isTrue(missing.error?.includes("thread not found: missing") === true, String(missing.error));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async failsARenameCodexRefusesAfterUnarchivingAndTheNextMessageResumesTheThread(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_NAME: "refuseAfterUnarchive" });

    try {
      const first = await adapter.runTurn(host.createRequest("role-payload"), new RecordingTurnListener(), new AbortController().signal);
      const thread = String(first.nativeSessionId);
      await adapter.runTurn(CodexAdapterTests.commandRequest(host, "/archive", thread), new RecordingTurnListener(), new AbortController().signal);
      const renamed = await adapter.runTurn(CodexAdapterTests.commandRequest(host, "/rename Parser fixes", thread), new RecordingTurnListener(),
        new AbortController().signal);
      const listener = new RecordingTurnListener();
      const next = await adapter.runTurn(host.createRequest("role-payload", null, thread), listener, new AbortController().signal);
      const echo = JSON.parse(String(listener.details.find(t => t.kind === DetailKind.Text)?.text)) as
        { readonly names: readonly string[][]; readonly nameTries: readonly string[]; readonly unarchives: readonly string[] };

      Assert.areEqual(TurnOutcome.Failed, renamed.outcome);
      Assert.isTrue(renamed.error?.includes("rename refused after unarchive") === true, String(renamed.error));
      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, thread]), JSON.stringify([next.outcome, next.nativeSessionId]));
      Assert.areEqual(JSON.stringify([[], [thread, thread], [thread]]), JSON.stringify([echo.names, echo.nameTries, echo.unarchives]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async failsARenameCodexRefusesForAnotherReasonWithoutUnarchiving(): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_NAME: "refuse" });

    try {
      const first = await adapter.runTurn(host.createRequest("role-payload"), new RecordingTurnListener(), new AbortController().signal);
      const renamed = await adapter.runTurn(CodexAdapterTests.commandRequest(host, "/rename Parser fixes", first.nativeSessionId), new RecordingTurnListener(),
        new AbortController().signal);
      const listener = new RecordingTurnListener();
      await adapter.runTurn(host.createRequest("role-payload", null, first.nativeSessionId), listener, new AbortController().signal);
      const echo = JSON.parse(String(listener.details.find(t => t.kind === DetailKind.Text)?.text)) as { readonly nameTries: readonly string[] };

      Assert.areEqual(TurnOutcome.Failed, renamed.outcome);
      Assert.isTrue(renamed.error?.includes("rename refused") === true, String(renamed.error));
      Assert.areEqual(JSON.stringify([String(first.nativeSessionId)]), JSON.stringify(echo.nameTries));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  @TestData("/fork", null, "Codex can't run /fork yet: this chat has no Codex session until its first reply.")
  @TestData("/archive", null, "Codex can't run /archive yet: this chat has no Codex session until its first reply.")
  @TestData("/rename Parser fixes", null, "Codex can't run /rename yet: this chat has no Codex session until its first reply.")
  @TestData("/rename ", "thread-1", "Codex can't run /rename without a name: write it after the command, such as /rename Parser fixes.")
  public async answersAThreadCommandWithoutASessionOrARenameWithoutANameBeforeStartingCodex(command: string, resume: string | null, note: string): Promise<void> {
    using host = new CodexTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    try {
      const turn = await adapter.runTurn(CodexAdapterTests.commandRequest(host, command, resume), listener, new AbortController().signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, resume, 0, 0]),
        JSON.stringify([turn.outcome, turn.nativeSessionId, host.programs.started.length, listener.starts.length]));
      Assert.areEqual(JSON.stringify([[DetailKind.Note, note]]), JSON.stringify(listener.details.map(t => [t.kind, t.text])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    using host = new CodexTestHost();
    const provider = host.createProvider();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CODEX_MODELS: JSON.stringify({ data: CodexModelListRecording.rows, nextCursor: null }) });
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => new TurnRequest(provider, host.directory.path, CodexAdapterTests.scenarioOf(prompt),
      new RequestedSettings("codex", null, null), resume, attachments), host.directory.path);

    try {
      await AbilityChecks.runAsync(adapter.descriptor, {
        ...AbilityChecks.surface(adapter, provider, () => adapter.listModels(provider)),
        ...turns.probes({ [ProviderAbility.Questions]: "subAgentAsks", [ProviderAbility.PlanChecklist]: "plan", [ProviderAbility.ReplyUsage]: "usage",
          [ProviderAbility.SubAgentRows]: "subAgent", [ProviderAbility.BackgroundCommands]: "background", [ProviderAbility.GeneratedImages]: TurnAbilityProbes.plain,
          [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "hold" }),
        [ProviderAbility.Images]: () => turns.sendsAsync("images", "image.png", "image/png", t => t.texts.some(u => u.includes(`"type":"${Resources.localImageInputType}"`))),
        [ProviderAbility.Fork]: () => AbilityChecks.refusalOf(() => adapter.forkSession(new ForkRequest(provider, host.directory.path, "resumable", "turn-7",
          new RequestedSettings("codex", null, null)))),
        [ProviderAbility.BackgroundCommands]: async () => {
          const { listener } = await turns.turnAsync("background");
          await Wait.until(() => listener.taskStarts.length > 0, "Codex's background command started no task.");
          return true;
        },
        ...turns.subAgents("backgroundWithSubAgent"),
        ...turns.command("/diff"),
        [ProviderAbility.BuiltInCommands]: async () => {
          const listener = new RecordingTurnListener();
          const turn = await adapter.runTurn(CodexAdapterTests.commandRequest(host, "/fork", "resumable"), listener, new AbortController().signal);
          return turn.nativeSessionId === "fork-resumable" || (turn.error ?? listener.details.map(t => t.text).join(" "));
        },
        [ProviderAbility.StopSubAgent]: CodexAdapterTests.stopWaitsForTheWindow,
        [ProviderAbility.ApprovedTools]: async () => (await turns.approvedTurnAsync("echo")).listener.texts.some(t => t.includes(TurnAbilityProbes.approvedTool)
          && t.includes(Resources.codexToolsApprovalMode))
      });
    }
    finally {
      await adapter.shutdown();
    }
  }

  private static commandRequest(host: CodexTestHost, command: string, resume: string | null): TurnRequest {
    return new TurnRequest(null, host.directory.path, command, new RequestedSettings("codex", null, null), resume, [], null, null, {}, false, null, [], null, () => false,
      SharedMcpValues.none, null, false, command);
  }

  private static scenarioOf(prompt: string): string {
    const word = /^\S*/u.exec(prompt)?.[0] ?? String.empty;
    const scenarios = new Map([[TurnAbilityProbes.plain, "complete"], ["images", "attachments"], ["files", "attachments"]]);
    return `${scenarios.get(word) ?? word} ${prompt.slice(word.length)}`;
  }

  private static toolRequest(host: CodexTestHost, prompt: string, threadId: string | null, endpoint: RecordingMcpEndpoint, compacts: boolean = false): TurnRequest {
    return new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("codex", null, null), threadId, [], null, null, {}, compacts,
      new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [], endpoint));
  }

  private static async heldSenderOf(host: CodexTestHost, environment: Readonly<Record<string, string>>, routes: boolean,
    log: RecordingLog): Promise<[string | null, readonly string[], RecordingTurnListener]> {
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const listener = new RecordingTurnListener();
    const later = new RecordingTurnListener();
    const adopted: string[] = [];
    try {
      const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "background", new RequestedSettings("codex", null, null), null, [], null, null,
        environment), listener, new AbortController().signal);
      await Wait.until(() => listener.taskStarts.length === 1, "The listener did not see a task start.");
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("codex", null, null), result.nativeSessionId, [], null,
        null, SenderEnvironment.of("t2"), false, null, [], null, t => adopted.push(t) > 0 && routes), later, new AbortController().signal);
      await listener.taskStarts[0]?.stop();
    }
    finally { await adapter.shutdown(); }
    return [CodexAdapterTests.senderToken(later), adopted, later];
  }

  private static teamRunServerOf(echoed: string): JsonReader {
    return JsonReader.parse(echoed).readObject("thread").readObject("config").readObject("mcp_servers").readObject("teamrun");
  }

  private static senderToken(listener: RecordingTurnListener): string | null {
    const echoed = listener.details.find(t => t.kind === DetailKind.Text && t.text.startsWith("{"));
    return ((JSON.parse(echoed!.text).thread.config ?? {}) as Record<string, string>)["shell_environment_policy.set.TEAMRUN_SENDER_TOKEN"] ?? null;
  }
}
