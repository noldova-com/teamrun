/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  type ITimer, Resources as CoreResources, McpEndpoint, SessionTokens, SharedMcpFailureKind, SharedMcpRefusal, SharedMcpValues, TimeoutException, TurnOutcome, TurnRequest, type TurnResult,
  TurnTools
} from "@noldova/teamrun.core";
import { AuthStatus, MessageAttachment, Provider, ProviderMode, ReplyAction, RequestedSettings, SenderEnvironment, SharedMcpHeader, SharedMcpServerDefinition,
  SharedMcpTransport }
  from "@noldova/teamrun.protocol";
import {
  type AcpAdapter, AcpMcpTool, AcpModelMember, AcpPermissionSwitch, CommandRunner, CursorPlanReader, GrokUsageReader, NodeProcessStarter, ProcessTree, ProviderTimings,
  Resources, SettingUnavailableException, SharedMcpLaunch
} from "@noldova/teamrun.providers";
import { ElapsedDelayTimer } from "../../fixtures/elapsed-delay-timer.fixture.js";
import { FailureKeepingAcpAdapter } from "../../fixtures/failure-keeping-acp-adapter.fixture.js";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { HeldDelayTimer } from "../../fixtures/held-delay-timer.fixture.js";
import { LimitWaits } from "../../fixtures/limit-waits.fixture.js";
import { MemoryAcpModelStore } from "../../fixtures/memory-acp-model-store.fixture.js";
import { RecordedMcpServers } from "../../fixtures/recorded-mcp-servers.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { TestAcpAgent } from "../../fixtures/test-acp-agent.fixture.js";
import { TitleAsks } from "../../fixtures/title-asks.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { WatchingProcessStarter } from "../../fixtures/watching-process-starter.fixture.js";

const model = { id: "model", name: "Model", category: "model", type: "select", currentValue: "fake-a",
  options: [{ value: "fake-a", name: "Fake A" }, { value: "fake-b", name: "Fake B" }] };
const effort = { id: "effort", name: "Thinking", category: "thought_level", type: "select", currentValue: "medium",
  options: [{ value: "low" }, { value: "medium" }, { value: "high" }] };
const plan = { id: "plan", name: "Plan", type: "select", currentValue: "off", options: [{ value: "off" }] };
const automatic = { id: "auto", name: "Auto", type: "boolean", currentValue: true };
const resumable = { agentCapabilities: { loadSession: true, promptCapabilities: { image: true }, sessionCapabilities: { resume: {} } } };

@TestClass
export class AcpAdapterTests {
  private static readonly http: object = { agentCapabilities: { mcpCapabilities: { http: true } } };
  private static readonly sharedServers: readonly SharedMcpServerDefinition[] = [
    new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", ["-y", "search-server"], ["TEAMRUN_TEST_SHARED_KEY", "TEAMRUN_TEST_SHARED_UNSET"],
      null, [], null),
    new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp",
      [new SharedMcpHeader("X-Team", "TEAMRUN_TEST_SHARED_TEAM")], "TEAMRUN_TEST_SHARED_TOKEN"),
    new SharedMcpServerDefinition("wiki", SharedMcpTransport.Http, null, [], [], "https://wiki.example/mcp", [], null)
  ];

  @TestMethod
  public async answersThatTheAgentListedNoCommandsAfterItsWaitAndStopsWaitingWhenTheTurnIsStopped(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, host.environment, host.directory.path);
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "Task: /review", host.request("unused").requested, resume, [], null,
      null, {}, false, null, [], null, () => false, SharedMcpValues.none, null, false, "/review");
    const listener = new RecordingTurnListener();
    const held = new HeldDelayTimer(Resources.acpCommandsWait);
    const stopped = new AbortController();

    const unlisted = await host.createAcpAdapter(agent, undefined, undefined, null, new ElapsedDelayTimer(Resources.acpCommandsWait)).runTurn(request(null), listener,
      new AbortController().signal);
    const stopping = host.createAcpAdapter(agent, undefined, undefined, null, held).runTurn(request("earlier"), new RecordingTurnListener(), stopped.signal);
    await Wait.until(() => held.requested.includes(Resources.acpCommandsWait), "The adapter did not wait for the agent's commands.");
    stopped.abort();
    const interrupted = await stopping;

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, null, [Resources.formatCommandUnlisted("Fake ACP", "/review", [])]]),
      JSON.stringify([unlisted.outcome, unlisted.nativeSessionId, listener.texts]));
    Assert.areEqual("Fake ACP listed no commands, so TeamRun didn't send /review.", Resources.formatCommandUnlisted("Fake ACP", "/review", []));
    Assert.areEqual(JSON.stringify([TurnOutcome.Interrupted, "earlier"]), JSON.stringify([interrupted.outcome, interrupted.nativeSessionId]));
  }

  @TestMethod
  public async keepsTheCommandsAProcessHeldForBackgroundWorkListsOutOfALaterTurnThatLoadsItsSession(): Promise<void> {
    await using host = new GrokTestHost();
    const environment = { ...host.environment, TEAMRUN_FAKE_ACP_COMMANDS: "review", TEAMRUN_FAKE_ACP_LOAD_COMMANDS: "none", TEAMRUN_FAKE_ACP_LATE_COMMANDS: "deploy" };
    const tree = new ProcessTree(process.platform, new CommandRunner(new NodeProcessStarter(host.terminator)), process.env, Resources.processListTimeout, host.timer,
      host.timings.stopGrace);
    const adapter = host.createAdapter(environment, host.command, host.terminator, host.timings, new NodeProcessStarter(host.terminator), tree,
      new ElapsedDelayTimer(Resources.acpCommandsWait));
    const listener = new RecordingTurnListener();
    const background = await adapter.runTurn(host.request("background"), new RecordingTurnListener(), new AbortController().signal);
    const asked = host.request("unused");

    const result = await adapter.runTurn(new TurnRequest(null, asked.workingDirectory, "Task: /deploy", asked.requested, background.nativeSessionId, [], null, null, {},
      false, null, [], null, () => false, SharedMcpValues.none, null, false, "/deploy"), listener, new AbortController().signal);

    Assert.isTrue(existsSync(host.directory.resolve("person", "late-sent.txt")));
    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, [Resources.formatCommandUnlisted(adapter.descriptor.displayName, "/deploy", [])]]),
      JSON.stringify([result.outcome, listener.texts]));
  }

  @TestMethod
  public async readsAResumedSessionsCommandsFromWhatTheAgentListsOnItsLoadNotFromAnEarlierTurn(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_COMMANDS: "review", TEAMRUN_FAKE_ACP_LOAD_COMMANDS: "none" },
      host.directory.path);
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "Task: /review", host.request("unused").requested, resume, [], null,
      null, {}, false, null, [], null, () => false, SharedMcpValues.none, null, false, "/review");
    const adapter = host.createAcpAdapter(agent, undefined, undefined, null, new ElapsedDelayTimer(Resources.acpCommandsWait));
    const listener = new RecordingTurnListener();

    const opened = await adapter.runTurn(request(null), listener, new AbortController().signal);
    const loaded = await adapter.runTurn(request(opened.nativeSessionId), listener, new AbortController().signal);

    Assert.areEqual(JSON.stringify([[TurnOutcome.Completed, "grok-session"], [TurnOutcome.Completed, "grok-session"]]),
      JSON.stringify([opened, loaded].map(t => [t.outcome, t.nativeSessionId])));
    Assert.areEqual(JSON.stringify(["/review", Resources.formatCommandUnlisted("Fake ACP", "/review", [])]), JSON.stringify(listener.texts));
  }

  @TestMethod
  public async asksForATitleWithNoServersOutsideAChatTurnAndKeepsTheAnswersText(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, host.environment, host.directory.path);
    const answer = await TitleAsks.askAsync(host.createAcpAdapter(agent), AcpAdapterTests.isolated(host, "titled"));
    Assert.areEqual("The answered title", answer);
    Assert.areEqual("[]", readFileSync(host.directory.resolve("mcp-servers.txt"), "utf8").trimEnd());
    Assert.areEqual("[false]", JSON.stringify(agent.launchChatTurns));
    Assert.areEqual("[true]", JSON.stringify(agent.launchTitleSessions));
  }

  @TestMethod
  public async runsAnIsolatedTurnInTheAgentsIsolatedModeAndNoneWhereTheProviderRefusesOne(): Promise<void> {
    await using host = new GrokTestHost();
    const session = { currentModeId: "plan", availableModes: [{ id: "ask", name: "ask" }, { id: "plan", name: "plan" }] };
    const agent = new TestAcpAgent(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(session) }, host.directory.path);
    agent.modes = [new ProviderMode("ask", "Ask", null, false), new ProviderMode("plan", "Plan", null, false)];
    agent.defaultMode = "plan";
    const adapter = host.createAcpAdapter(agent);
    const listener = new RecordingTurnListener();

    const turn = await adapter.askIsolated?.(AcpAdapterTests.isolated(host, "methods"), listener, new AbortController().signal);
    Object.assign(agent, { hasNoIsolatedAsk: () => true });
    const refused = await adapter.askIsolated?.(AcpAdapterTests.isolated(host, "methods"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(`${TurnOutcome.Completed}:mode=ask`, `${turn?.outcome}:${AcpAdapterTests.echo(listener).sets.join(",")}`);
    Assert.isNull(refused);
  }

  @TestMethod
  public async refusesWhatATitleSessionAsksAndFindsNoTitleInAFailedOne(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const refused = await TitleAsks.askAsync(adapter, AcpAdapterTests.isolated(host, "approve"));
    Assert.isTrue(refused?.includes("\"no\"") ?? false, refused ?? "no answer");
    Assert.isNull(await TitleAsks.askAsync(adapter, AcpAdapterTests.isolated(host, "reject")));
  }

  @TestMethod
  public async leavesOutTheHomeInstructionsOfATitleSession(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, host.environment, host.directory.path);
    const request = host.request("role-payload");
    Object.assign(agent, { readHomeInstructions: (_environment: NodeJS.ProcessEnv, folder: string | null) =>
      `The person's home instructions for ${folder === request.workingDirectory ? "the turn's folder" : "another folder"}` });
    const adapter = host.createAcpAdapter(agent);
    const plain = new RecordingTurnListener();
    await adapter.runTurn(request, plain, new AbortController().signal);
    Assert.isTrue(plain.texts.join().includes("home instructions for the turn's folder"));
    Assert.isFalse((await TitleAsks.askAsync(adapter, AcpAdapterTests.isolated(host, "role-payload")))?.includes("home instructions") ?? true);
  }

  @TestMethod
  public async leavesOutATitleThatOnlyRepeatsWhatTheTurnSentAsCopilotsDoes(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const request = host.request("echoed");
    await host.createAdapter().runTurn(new TurnRequest(null, request.workingDirectory, request.prompt, request.requested, null, [], "A role\nof two lines"), listener, new AbortController().signal);
    Assert.areEqual(JSON.stringify(["The agent's title"]), JSON.stringify(listener.titles));
  }

  @TestMethod
  public async reportsAnAgentsOwnTitleAndNoEmptyOne(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    await host.createAdapter().runTurn(host.request("titled"), listener, new AbortController().signal);
    Assert.areEqual(JSON.stringify(["The agent's title"]), JSON.stringify(listener.titles));
  }

  @TestMethod
  public async setsTheRequestedModelAndEffortThroughConfigOptionsAndResumesWithoutReplay(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [model, effort, plan, automatic], resumable);
    const listener = new RecordingTurnListener();
    const first = await adapter.runTurn(host.request("methods", null, "fake-b", "high"), listener, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, first.outcome);
    Assert.areEqual("fake-b", first.observed.model);
    Assert.areEqual("high", first.observed.effort);
    const sent = AcpAdapterTests.echo(listener);
    Assert.areEqual("initialize,authenticate,session/new,session/set_config_option,session/set_config_option,session/prompt", sent.methods.join(","));
    Assert.areEqual(JSON.stringify({ methodId: "cached_token" }), JSON.stringify(sent.authenticated));
    Assert.isFalse(JsonReader.parse(listener.texts.find(t => t.startsWith("{\"methods\"")) ?? "").readBoolean("metaSent"));
    const again = new RecordingTurnListener();
    const resumed = await adapter.runTurn(host.request("methods", "old-session"), again, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
    Assert.areEqual("old-session", resumed.nativeSessionId);
    Assert.isTrue(again.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual("fake-a", resumed.observed.model);
    Assert.areEqual("medium", resumed.observed.effort);
    Assert.areEqual("initialize,authenticate,session/resume,session/prompt", AcpAdapterTests.echo(again).methods.join(","));
    Assert.isFalse(again.texts.some(t => t.includes("replayed history")));
    const unchanged = await adapter.runTurn(host.request("methods", null, "fake-a", "medium"), new RecordingTurnListener(), new AbortController().signal);
    Assert.areEqual("fake-a", unchanged.observed.model);
    Assert.areEqual("medium", unchanged.observed.effort);
  }

  @TestMethod
  public async keepsTheSessionsProcessForTheIdleLimitForTheChatsNextTurnAndLoadsTheSessionInANewProcessOnceItCloses(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [], resumable, {}, host.idleTimer);
    const first = await AcpAdapterTests.run(adapter, host.request("methods"));
    await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit]), "The session was not kept for the idle limit.");
    host.idleTimer.advance(host.timings.idleLimit - 1);
    const kept = new RecordingTurnListener();
    const second = await adapter.runTurn(host.request("methods", first.nativeSessionId), kept, new AbortController().signal);
    await Wait.until(() => LimitWaits.are(host.idleTimer, [host.timings.idleLimit]), "The session was not kept for the idle limit after its next turn.");
    const before = [host.programs.started.length, host.programs.ended.length];
    host.idleTimer.advance(host.timings.idleLimit);
    await Wait.until(() => host.programs.ended.length === 1, "The idle session's process did not end.");
    const reopened = new RecordingTurnListener();
    const third = await adapter.runTurn(host.request("methods", first.nativeSessionId), reopened, new AbortController().signal);

    Assert.areEqual(1_800_000, host.timings.idleLimit);
    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, first.nativeSessionId, TurnOutcome.Completed, first.nativeSessionId]),
      JSON.stringify([second.outcome, second.nativeSessionId, third.outcome, third.nativeSessionId]));
    Assert.areEqual(JSON.stringify([1, 0]), JSON.stringify(before));
    const methods = AcpAdapterTests.echo(kept).methods;
    Assert.areEqual(JSON.stringify([1, 2, 0]), JSON.stringify(["initialize", "session/prompt", "session/resume"].map(t => methods.filter(u => u === t).length)));
    Assert.isTrue(kept.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual("initialize,authenticate,session/resume,session/prompt", AcpAdapterTests.echo(reopened).methods.join(","));
    Assert.areEqual(2, host.programs.started.length);
  }

  @TestMethod
  public async takesTheKeptSessionForATurnWithToolsAndASenderAdoptingItsTokensAndStartsANewProcessWhenTheLaunchDiffers(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [], { agentCapabilities: { loadSession: true, mcpCapabilities: { http: true } } }, {}, host.idleTimer);
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [],
      new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
    const adopted: string[] = [];
    const request = (resume: string | null, environment: Readonly<Record<string, string>>): TurnRequest => new TurnRequest(null, host.directory.path, "methods",
      new RequestedSettings("grok", null, null), resume, [], null, null, environment, false, tools, [], null, t => {
        adopted.push(t);
        return true;
      });
    const first = await AcpAdapterTests.run(adapter, request(null, SenderEnvironment.of("sender-1")));
    const opened = [host.programs.started.length, host.programs.ended.length];
    const second = await AcpAdapterTests.run(adapter, request(first.nativeSessionId, SenderEnvironment.of("sender-2")));
    const kept = [host.programs.started.length, host.programs.ended.length];
    const third = await AcpAdapterTests.run(adapter, request(first.nativeSessionId, { ...SenderEnvironment.of("sender-3"), TEAMRUN_TEST_OTHER: "1" }));
    await host.programs.endedAt(kept[1]! + 1);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed, TurnOutcome.Completed]), JSON.stringify([first, second, third].map(t => t.outcome)));
    Assert.areEqual(JSON.stringify([opened, ["sender-1"]]), JSON.stringify([kept, adopted]));
    Assert.areEqual(kept[0]! + 1, host.programs.started.length);
  }

  @TestMethod
  public async startsANewProcessForTheChatsNextTurnWhenTheServedToolsChangedSinceTheKeptSessionListedThem(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [], { agentCapabilities: { loadSession: true, mcpCapabilities: { http: true } } }, {}, host.idleTimer);
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const served = ["terminal_run"];
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve(served.map(t => ({ name: t }))), callToolAsync: () => Promise.resolve({}) }, [],
      new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "methods", new RequestedSettings("grok", null, null), resume,
      [], null, null, {}, false, tools);
    const first = await AcpAdapterTests.run(adapter, request(null));
    const opened = host.programs.started.length;
    await AcpAdapterTests.run(adapter, request(first.nativeSessionId));
    const kept = host.programs.started.length - opened;
    served.push("computer_click");
    const changed = await AcpAdapterTests.run(adapter, request(first.nativeSessionId));

    Assert.areEqual(TurnOutcome.Completed, changed.outcome);
    Assert.areEqual(JSON.stringify([0, 1]), JSON.stringify([kept, host.programs.started.length - opened]));
  }

  @TestMethod
  public async takesTheKeptSessionOnlyWhileItsProviderRunsTheSameChosenServer(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [], { agentCapabilities: { loadSession: true } }, {}, host.idleTimer);
    const request = (binaryPath: string | null, resume: string | null): TurnRequest => new TurnRequest(new Provider("a1", "grok", "Work",
      host.directory.resolve("profile"), AuthStatus.LoggedIn, null, null, null, null, "2026-09-09T00:00:00.000Z", true, false, binaryPath), host.directory.path,
      "methods", new RequestedSettings("grok", null, null), resume);
    const first = await AcpAdapterTests.run(adapter, request("/opt/agy/one", null));
    const same = await AcpAdapterTests.run(adapter, request("/opt/agy/one", first.nativeSessionId));
    const kept = host.programs.started.length;
    const moved = await AcpAdapterTests.run(adapter, request("/opt/agy/two", first.nativeSessionId));
    await host.programs.endedAt(1);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed, TurnOutcome.Completed]), JSON.stringify([first, same, moved].map(t => t.outcome)));
    Assert.areEqual(1, kept);
    Assert.areEqual(2, host.programs.started.length);
  }

  @TestMethod
  public async takesAGroupedAnswersGroupAsAModelWithItsChoicesAsLevelsAndLogsTheOptionsOnce(): Promise<void> {
    await using host = new GrokTestHost();
    const grouped = { id: "model", name: "Model", category: "model", type: "select", currentValue: "flash-high", options: [
      { group: "flash", name: "Flash", options: [{ value: "flash-low", name: "Low" }, { value: "flash-high", name: "High" }] },
      { group: "bare", options: [{ value: "bare-one", name: "One" }] },
      { value: "solo", name: "Solo" }] };
    const log = new RecordingLog();
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [grouped, effort, plan], resumable), host.directory.path);
    agent.turnModels = new MemoryAcpModelStore();
    const adapter = host.createAcpAdapter(agent, undefined, undefined, log);
    const listener = new RecordingTurnListener();
    const turn = await adapter.runTurn(host.request("methods", null, "flash", "flash-low"), listener, new AbortController().signal);

    const listed = (await adapter.listModels(null)).models;
    Assert.areEqual("flash:Flash:flash-low,flash-high:null:flash-high:true|bare-one:One:low,medium,high:medium:null:false|solo:Solo:low,medium,high:medium:null:false",
      listed.map(t => [t.id, t.displayName, t.effortLevels?.join(","), String(t.defaultEffort), String(t.configuredEffort), String(t.isDefault)].join(":")).join("|"));
    Assert.areEqual("flash/flash-low", `${String(turn.observed.model)}/${String(turn.observed.effort)}`);
    Assert.areEqual("initialize,authenticate,session/new,session/set_config_option,session/prompt", AcpAdapterTests.echo(listener).methods.join(","));
    const lines = log.lines.filter(t => t.includes("the session's model options"));
    Assert.areEqual(1, lines.length);
    Assert.isTrue(lines[0]!.includes('"group":"flash","groupName":"Flash"') && lines[0]!.includes('"group":"bare","groupName":null')
      && lines[0]!.includes('"category":"thought_level"') && !lines[0]!.includes("Plan"));
  }

  @TestMethod
  public async takesTheEffortAsALevelOfTheRequestedFamilyAndObservesTheFamilyAsTheModel(): Promise<void> {
    await using host = new GrokTestHost();
    const family = { id: "model", name: "Model", category: "model", type: "select", currentValue: "flash-high", options: [
      { value: "flash-low", name: "Flash (Low)" }, { value: "flash-high", name: "Flash (High)" }, { value: "solo", name: "Solo" }] };
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [family, effort], resumable), host.directory.path);
    agent.members = new Map([["flash-low", new AcpModelMember("flash", "Flash", "Low")], ["flash-high", new AcpModelMember("flash", "Flash", "High")]]);
    const adapter = host.createAcpAdapter(agent);
    const listener = new RecordingTurnListener();

    const low = await adapter.runTurn(host.request("methods", null, "flash", "flash-low"), listener, new AbortController().signal);
    const current = await AcpAdapterTests.run(adapter, host.request("complete"));

    Assert.areEqual("flash/flash-low", `${String(low.observed.model)}/${String(low.observed.effort)}`);
    Assert.areEqual("initialize,authenticate,session/new,session/set_config_option,session/prompt", AcpAdapterTests.echo(listener).methods.join(","));
    Assert.areEqual("flash/flash-high", `${String(current.observed.model)}/${String(current.observed.effort)}`);
  }

  @TestMethod
  public async runsTheLevelTheListingShowsOnAResumedSessionLeftOnAnotherWhenNoLevelIsChosen(): Promise<void> {
    await using host = new GrokTestHost();
    const family = { id: "model", name: "Model", category: "model", type: "select", currentValue: "flash-high", options: [
      { value: "flash-low", name: "Flash (Low)" }, { value: "flash-high", name: "Flash (High)" }] };
    const agent = new TestAcpAgent(host.command, { ...AcpAdapterTests.environment(host, [family, effort], resumable), TEAMRUN_FAKE_ACP_KEEP_OPTIONS: "1" },
      host.directory.path);
    agent.members = new Map([["flash-low", new AcpModelMember("flash", "Flash", "Low")], ["flash-high", new AcpModelMember("flash", "Flash", "High")]]);
    agent.turnModels = new MemoryAcpModelStore();
    const adapter = host.createAcpAdapter(agent);
    const resumed = new RecordingTurnListener();

    const low = await AcpAdapterTests.run(adapter, host.request("complete", null, "flash", "flash-low"));
    const shown = (await adapter.listModels(null)).models.find(t => t.id === "flash")?.configuredEffort;
    const next = await adapter.runTurn(host.request("methods", low.nativeSessionId, "flash"), resumed, new AbortController().signal);

    Assert.areEqual("flash-low|flash-high", `${String(low.observed.effort)}|${String(shown)}`);
    Assert.areEqual(TurnOutcome.Completed, next.outcome, next.error ?? "");
    const echoed = AcpAdapterTests.echo(resumed);
    Assert.areEqual("true|model=flash-high", `${echoed.methods.includes("session/resume")}|${echoed.sets.join(",")}`);
    Assert.areEqual("flash/flash-high", `${String(next.observed.model)}/${String(next.observed.effort)}`);
  }

  @TestMethod
  public async setsTheDefaultModeWhenTheSessionStartsInAnotherAndListsTheModesSignedOut(): Promise<void> {
    await using host = new GrokTestHost();
    const option = { id: "mode", name: "Mode", category: "mode", type: "select", currentValue: "plan", options: [{ value: "ask" }, { value: "plan" }] };
    const modes = [new ProviderMode("ask", "Ask", null, false), new ProviderMode("plan", "Plan", null, false)];
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model, option], resumable), host.directory.path);
    agent.modes = modes;
    agent.defaultMode = "ask";
    const signedOut = new TestAcpAgent(host.command, host.environment, host.directory.path, true, true, false);
    signedOut.modes = modes;
    signedOut.defaultMode = "ask";
    const listener = new RecordingTurnListener();

    const turn = await host.createAcpAdapter(agent).runTurn(host.request("methods"), listener, new AbortController().signal);
    const listed = await host.createAcpAdapter(signedOut).listModels(null);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual("mode=ask", AcpAdapterTests.echo(listener).sets.join(","));
    Assert.areEqual(false, listed.signedIn);
    Assert.areEqual("ask,plan", listed.modes.map(t => t.id).join(","));
    Assert.areEqual("ask", listed.defaultMode);
    Assert.isFalse(listed.defaultTakesListedEfforts);
  }

  @TestMethod
  public async runsAModeItsSessionDoesntListOnlyWhenTheAgentsSessionTakesUnlistedModes(): Promise<void> {
    await using host = new GrokTestHost();
    const run = async (takesUnlistedModes: boolean): Promise<[RecordingTurnListener, string]> => {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model], resumable), host.directory.path);
      agent.modes = [new ProviderMode("ask", "Ask", null, false), new ProviderMode("plan", "Plan", null, false, true)];
      agent.defaultMode = "ask";
      agent.planMode = "plan";
      agent.takesUnlistedModes = takesUnlistedModes;
      const asked = host.request("methods", null, null, null, null, "ask");
      const listener = new RecordingTurnListener();
      const turn = await host.createAcpAdapter(agent).runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, new AbortController().signal);
      return [listener, `${turn.outcome}:${String(turn.error)}`];
    };

    const [taken, takenTurn] = await run(true);
    const [refused, refusedTurn] = await run(false);

    Assert.areEqual(`${TurnOutcome.Completed}:null`, takenTurn);
    Assert.areEqual("mode=plan", AcpAdapterTests.echo(taken).sets.join(","));
    Assert.areEqual(`${TurnOutcome.Failed}:${Resources.formatModeUnavailable("Fake ACP", "Plan")}`, refusedTurn);
    Assert.isFalse(refused.texts.some(t => t.startsWith("{\"methods\"")));
  }

  @TestMethod
  public async failsATurnWhoseModeItsSessionDoesntListWithASettingUnavailableException(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model], resumable), host.directory.path);
    agent.modes = [new ProviderMode("ask", "Ask", null, false), new ProviderMode("plan", "Plan", null, false, true)];
    agent.defaultMode = "ask";
    agent.planMode = "plan";
    agent.takesUnlistedModes = false;
    const adapter = new FailureKeepingAcpAdapter(agent, host.info, host.programs.wrap(host.starter), host.timings, host.timer, null, null, undefined,
      host.elapsedIdleTimer);
    const asked = host.request("methods", null, null, null, null, "ask");

    try {
      const turn = await adapter.runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual(`${TurnOutcome.Failed}:${Resources.formatModeUnavailable("Fake ACP", "Plan")}`, `${turn.outcome}:${String(turn.error)}`);
      Assert.areEqual(1, adapter.failures.length);
      Assert.isInstanceOf(adapter.failures[0], SettingUnavailableException);
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async runsAPlanFirstTurnInTheAgentsPlanModeAndAsAskedWhenTheAgentHasNone(): Promise<void> {
    await using host = new GrokTestHost();
    const option = { id: "mode", name: "Mode", category: "mode", type: "select", currentValue: "ask", options: [{ value: "ask" }, { value: "plan" }] };
    const run = async (planMode: string | null): Promise<string> => {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model, option], resumable), host.directory.path);
      agent.modes = [new ProviderMode("ask", "Ask", null, false), new ProviderMode("plan", "Plan", null, false, true)];
      agent.defaultMode = "ask";
      agent.planMode = planMode;
      const adapter = host.createAcpAdapter(agent);
      const asked = host.request("methods", null, null, null, null, "ask");
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, new AbortController().signal);
      return `${String(adapter.planMode)}:${turn.outcome}:${AcpAdapterTests.echo(listener).sets.join(",")}`;
    };

    Assert.areEqual(JSON.stringify([`plan:${TurnOutcome.Completed}:mode=plan`, `null:${TurnOutcome.Completed}:`]), JSON.stringify([await run("plan"), await run(null)]));
  }

  @TestMethod
  public async leavesAnApprovedPlanForTheDefaultSessionModeWhenTheTurnAskedForTheLaunchModeThePermissionSwitchsModeOrThePlanModeAndSaysWhenItCant(): Promise<void> {
    await using host = new GrokTestHost();
    const run = async (mode: string, current: string = "ask", environment: NodeJS.ProcessEnv = {}, switched: boolean = false): Promise<string> => {
      const session = { currentModeId: current, availableModes: [{ id: "ask", name: "Ask" }, { id: "plan", name: "Plan" }] };
      const agent = new TestAcpAgent(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(session), ...environment }, host.directory.path);
      agent.modes = [new ProviderMode("ask", "Ask", null, false), new ProviderMode("plan", "Plan", null, false, true), new ProviderMode("always", "Always", null, true)];
      agent.defaultMode = "ask";
      agent.launchMode = switched ? null : "always";
      agent.permissionSwitch = switched ? new AcpPermissionSwitch("allow_all", "always", "on", "off") : null;
      agent.planMode = "plan";
      agent.plans = new CursorPlanReader();
      const listener = new RecordingTurnListener();
      listener.decisions.push(Resources.acpApprovePlanOption);
      const asked = host.request("cursor-plan", null, null, null, null, mode);
      await host.createAcpAdapter(agent).runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, new AbortController().signal);
      const text = listener.texts.find(t => t.startsWith("{\"result\""));
      Assert.isDefined(text);
      const echoed = JsonReader.parse(text);
      const note = listener.details.find(t => t.text.startsWith(Resources.formatPlanModeKept("Fake ACP", "")))?.text ?? "";
      return `${echoed.readObject("result").readObject("outcome").readString("outcome")}:${echoed.readStringArray("sets").join(",")}:${String(note.includes("Mode refused"))}`;
    };

    Assert.areEqual(JSON.stringify(["accepted:mode=plan,mode=ask:false", "accepted:mode=plan,mode=ask:false", "accepted::true", "accepted:mode=plan,mode=ask:false"]),
      JSON.stringify([await run("always"), await run("plan"), await run("always", "plan", { TEAMRUN_FAKE_ACP_SET_MODE: "fail" }), await run("always", "ask", {}, true)]));
  }

  @TestMethod
  public async switchesASessionLeftInAnUnrestrictedModeToTheDefaultOrFailsBeforeItsPrompt(): Promise<void> {
    await using host = new GrokTestHost();
    const results: string[] = [];
    for (const available of [["ask", "yolo"], ["yolo"]])
      results.push(await AcpAdapterTests.runInMode(host, available, "ask", null));

    Assert.areEqual(`${TurnOutcome.Completed}:mode=ask:|${TurnOutcome.Failed}:no prompt:${Resources.formatUnrestrictedMode("Fake ACP", "YOLO")}`, results.join("|"));
  }

  @TestMethod
  public async runsATurnInAChosenUnrestrictedMode(): Promise<void> {
    await using host = new GrokTestHost();

    const switched = await AcpAdapterTests.runInMode(host, ["ask", "yolo"], "ask", "yolo", "ask");
    const kept = await AcpAdapterTests.runInMode(host, ["ask", "yolo"], "ask", "yolo");

    Assert.areEqual(`${TurnOutcome.Completed}:mode=yolo:|${TurnOutcome.Completed}::`, [switched, kept].join("|"));
  }

  @TestMethod
  public async runsATurnInTheAgentsLaunchModeInTheDefaultSessionModeWhetherTheSessionIsLeftInAnUnrestrictedOneOrNot(): Promise<void> {
    await using host = new GrokTestHost();
    const results: string[] = [];
    for (const current of ["yolo", "ask"]) {
      const session = { currentModeId: current, availableModes: [{ id: "ask", name: "Ask" }, { id: "yolo", name: "YOLO" }] };
      const agent = new TestAcpAgent(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(session) }, host.directory.path);
      agent.modes = [new ProviderMode("ask", "Ask", null, false), new ProviderMode("yolo", "YOLO", null, true), new ProviderMode("always", "Always", null, true)];
      agent.defaultMode = "ask";
      agent.launchMode = "always";
      const listener = new RecordingTurnListener();
      const turn = await host.createAcpAdapter(agent).runTurn(host.request("methods", null, null, null, null, "always"), listener, new AbortController().signal);
      results.push(`${turn.outcome}:${AcpAdapterTests.echo(listener).sets.join(",")}:${turn.error ?? ""}`);
    }

    Assert.areEqual(`${TurnOutcome.Completed}:mode=ask:|${TurnOutcome.Completed}::`, results.join("|"));
  }

  @TestMethod
  public async failsBeforeItsPromptInAnUnrestrictedModeWhenNeitherTheAskedModeNorTheDefaultIsListed(): Promise<void> {
    await using host = new GrokTestHost();

    const turn = await AcpAdapterTests.runInMode(host, ["ask", "yolo"], "missing", "unlisted");

    Assert.areEqual(`${TurnOutcome.Failed}:no prompt:${Resources.formatUnrestrictedMode("Fake ACP", "YOLO")}`, turn);
  }

  @TestMethod
  public async hasNoProfileSearchForAnAgentWithout(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [model], resumable);

    Assert.isUndefined(adapter.profileSearch);
  }

  @TestMethod
  public async keepsTheValueItSetWhenTheAnswerListsNoOptions(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [model, effort], resumable, { TEAMRUN_FAKE_ACP_SET_ANSWER: "null" });
    const result = await AcpAdapterTests.run(adapter, host.request("complete", null, "fake-b", "low"));
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("fake-b", result.observed.model);
    Assert.areEqual("low", result.observed.effort);
  }

  @TestMethod
  public async startsANewSessionWhenTheResumeIsRefusedAndFailsTheTurnWhenAnOptionIsRefused(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const fresh = await AcpAdapterTests.adapter(host, [model], resumable).runTurn(host.request("methods", "missing"), listener, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, fresh.outcome);
    Assert.areEqual("grok-session", fresh.nativeSessionId);
    Assert.isFalse(listener.starts[0]?.resumedNativeSession ?? true);
    Assert.areEqual("initialize,authenticate,session/resume,session/new,session/prompt", AcpAdapterTests.echo(listener).methods.join(","));
    Assert.isTrue(listener.texts.some(t => t.includes("could not be resumed") && t.includes("Session not found")));
    Assert.areEqual(JSON.stringify({ source: "resume" }), JSON.stringify(listener.details.find(t => t.text.includes("could not be resumed"))?.payload));
    const refused = AcpAdapterTests.adapter(host, [model], resumable, { TEAMRUN_FAKE_ACP_SET_ANSWER: "fail" });
    AcpAdapterTests.failed(await AcpAdapterTests.run(refused, host.request("complete", null, "fake-b")), "Option refused");
  }

  @TestMethod
  public async failsBeforeThePromptWhenTheSessionOffersNeitherTheModelNorTheEffort(): Promise<void> {
    await using host = new GrokTestHost();
    const full = AcpAdapterTests.adapter(host, [model, effort], resumable);
    const unoffered = await AcpAdapterTests.run(full, host.request("complete", null, "fake-z"));
    AcpAdapterTests.failed(unoffered, "Fake ACP doesn't offer the model fake-z. Open the teammate or the composer's model menu, refresh the models, and choose one.");
    Assert.areEqual(ReplyAction.ChooseModel, unoffered.action);
    const effortless = await AcpAdapterTests.run(full, host.request("complete", null, "fake-b", "extreme"));
    AcpAdapterTests.failed(effortless, "The effort \"extreme\" is not one Fake B accepts.");
    Assert.isNull(effortless.action);
    const effortOnly = AcpAdapterTests.adapter(host, [effort], resumable);
    AcpAdapterTests.failed(await AcpAdapterTests.run(effortOnly, host.request("complete", null, "fake-a")), "Fake ACP doesn't offer the model fake-a.");
    AcpAdapterTests.failed(await AcpAdapterTests.run(effortOnly, host.request("complete", null, null, "extreme")), "The effort \"extreme\" is not one Fake ACP accepts.");
    const plain = await AcpAdapterTests.run(effortOnly, host.request("complete"));
    Assert.areEqual(TurnOutcome.Completed, plain.outcome);
    Assert.isNull(plain.observed.model);
    Assert.areEqual("medium", plain.observed.effort);
    const modelOnly = AcpAdapterTests.adapter(host, [model], resumable);
    AcpAdapterTests.failed(await AcpAdapterTests.run(modelOnly, host.request("complete", null, null, "low")), "The effort \"low\" is not one Fake A accepts.");
    const none = await AcpAdapterTests.run(modelOnly, host.request("complete"));
    Assert.areEqual("fake-a", none.observed.model);
    Assert.isNull(none.observed.effort);
  }

  @TestMethod
  public async sendsImagesInlineAndOtherFilesAsResourceLinks(): Promise<void> {
    await using host = new GrokTestHost();
    const image = host.directory.resolve("image.png");
    const notes = host.directory.resolve("notes.txt");
    writeFileSync(image, "fixture-image");
    writeFileSync(notes, "fixture-notes");
    const request = new TurnRequest(null, host.directory.path, "files", new RequestedSettings("fake-acp", null, null), null,
      [new MessageAttachment("image.png", "image/png", 13, image), new MessageAttachment("notes.txt", "text/plain", 13, notes)]);
    for (const links of [true, false]) {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model], resumable), host.directory.path, true, links);
      const listener = new RecordingTurnListener();
      Assert.areEqual(TurnOutcome.Completed, (await host.createAcpAdapter(agent).runTurn(request, listener, new AbortController().signal)).outcome);
      const parts = JSON.parse(listener.texts.find(t => t.startsWith("[{"))!) as Record<string, unknown>[];
      Assert.areEqual(links ? "text,image,resource_link" : "text,image", parts.map(t => t["type"]).join(","));
      Assert.areEqual(Buffer.from("fixture-image").toString("base64"), parts[1]?.["data"]);
      Assert.areEqual(links ? JSON.stringify({ type: "resource_link", uri: pathToFileURL(notes).href, name: "notes.txt", mimeType: "text/plain", size: 13 })
        : undefined, Object.isUndefined(parts[2]) ? undefined : JSON.stringify(parts[2]));
    }
  }

  @TestMethod
  public async takesImagesAndResumesOnlyAsTheAgentAdvertisesAndPrefers(): Promise<void> {
    await using host = new GrokTestHost();
    const image = host.directory.resolve("image.png");
    writeFileSync(image, "fixture-image");
    const pictured = new TurnRequest(null, host.directory.path, "images", new RequestedSettings("fake-acp", null, null), null,
      [new MessageAttachment("image.png", "image/png", 13, image)]);
    const leftOut = JSON.stringify(CoreResources.formatImagesLeftOut("images", [JSON.stringify("image.png")])).slice(1, -1);
    const cases: [object, boolean][] = [
      [{}, true],
      [{ agentCapabilities: null }, true],
      [{ agentCapabilities: {} }, true],
      [{ agentCapabilities: { promptCapabilities: null, sessionCapabilities: null } }, true],
      [{ agentCapabilities: { promptCapabilities: { image: false }, sessionCapabilities: {} } }, true],
      [{ agentCapabilities: { promptCapabilities: {}, sessionCapabilities: { resume: null } } }, true],
      [{ agentCapabilities: { sessionCapabilities: { resume: {} } } }, false]
    ];
    for (const [capabilities, prefers] of cases) {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model], capabilities), host.directory.path, prefers);
      const adapter = host.createAcpAdapter(agent);
      const omitted = new RecordingTurnListener();
      Assert.areEqual(TurnOutcome.Completed, (await adapter.runTurn(pictured, omitted, new AbortController().signal)).outcome, JSON.stringify(capabilities));
      Assert.isTrue(omitted.details.some(t => t.text.includes(leftOut)), JSON.stringify(capabilities));
      Assert.isFalse(omitted.details.some(t => t.text.includes(Buffer.from("fixture-image").toString("base64"))), JSON.stringify(capabilities));
      const listener = new RecordingTurnListener();
      await adapter.runTurn(host.request("methods", "old-session"), listener, new AbortController().signal);
      Assert.areEqual("initialize,authenticate,session/load,session/prompt", AcpAdapterTests.echo(listener).methods.join(","), JSON.stringify(capabilities));
    }
  }

  @TestMethod
  public async keepsAFailedImageToolAsItsOwnFailedStepForAnAgentWithNoImageReader(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    const adapter = host.createAcpAdapter(new TestAcpAgent(host.command, host.environment, host.directory.path));

    const result = await adapter.runTurn(host.request("failed image"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    const failed = listener.details.filter(t => t.providerItemId?.endsWith("-tool-i2") ?? false).at(-1);
    Assert.areEqual("imagine: a square", failed?.text);
    Assert.areEqual("failed", (failed?.payload as Record<string, unknown>)["status"]);
    Assert.isFalse(listener.details.some(t => (t.payload as Record<string, unknown> | null)?.["itemType"] === "imageGeneration"));
  }

  @TestMethod
  public async runsATeamRunToolMarkedReadOnlyWithoutAskingOnlyForAnAgentThatNamesItAndAsksForEveryOtherCall(): Promise<void> {
    await using host = new GrokTestHost();
    const environment = AcpAdapterTests.environment(host, [], { agentCapabilities: { mcpCapabilities: { http: true } } });
    const naming = new TestAcpAgent(host.command, environment, host.directory.path);
    naming.mcpToolOf = tool => AcpMcpTool.of(tool.toJson()["server"], tool.toJson()["tool"]);
    const named = host.createAcpAdapter(naming);
    const unnamed = host.createAcpAdapter(new TestAcpAgent(host.command, environment, host.directory.path));
    const listener = new RecordingTurnListener();
    listener.defaultDecision = "no";
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([{ name: "teamrun_list_chats", annotations: { readOnlyHint: true } },
      { name: "teamrun_check_provider", annotations: { readOnlyHint: false } }, { name: "teamrun_list_projects", annotations: {} }, { name: "teamrun_rename_chat" },
      { name: "teamrun_list_files", annotations: [] }, { name: "teamrun_read_note", annotations: { readOnlyHint: "true" } }]),
    callToolAsync: () => Promise.resolve({}) }, [], new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
    tools.markListed();
    const cases: readonly (readonly [AcpAdapter, string, TurnTools | null])[] = [[named, "teamrun_list_chats", tools], [named, "teamrun_check_provider", tools],
      [named, "teamrun_list_projects", tools], [named, "teamrun_rename_chat", tools], [named, "teamrun_list_files", tools], [named, "teamrun_read_note", tools],
      [named, "teamrun_list_chats", null], [unnamed, "teamrun_list_chats", tools]];

    const outcomes: string[] = [];
    for (const [adapter, tool, turnTools] of cases)
      outcomes.push((await adapter.runTurn(new TurnRequest(null, host.directory.path, `use tool ${JSON.stringify({ title: tool, server: "teamrun", tool })}`,
        new RequestedSettings("grok", null, null), null, [], null, null, {}, false, turnTools), listener, new AbortController().signal)).outcome);

    Assert.areEqual(Array(8).fill(TurnOutcome.Completed).join(","), outcomes.join(","));
    Assert.areEqual(7, listener.asks.length);
    Assert.areEqual(1, listener.texts.filter(t => t.includes(`"optionId":"yes"`)).length);
    Assert.areEqual(7, listener.texts.filter(t => t.includes(`"optionId":"no"`)).length);
  }

  @TestMethod
  public async completesOnlyOnTheStopReasonsItsAgentAccepts(): Promise<void> {
    await using host = new GrokTestHost();
    Assert.areEqual(TurnOutcome.Completed, (await AcpAdapterTests.run(host.createAdapter(), host.request("refuse"))).outcome);
    AcpAdapterTests.failed(await AcpAdapterTests.run(AcpAdapterTests.adapter(host, [model], resumable), host.request("refuse")), "Fake ACP stopped: refusal.");
  }

  @TestMethod
  public async sendsTheAgentsSignInMetaWithATurnAndListsNoModelsWithoutAuthenticateWhenInitializeNamesNone(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    await host.createAdapter().runTurn(host.request("methods"), listener, new AbortController().signal);
    Assert.areEqual(JSON.stringify({ methodId: "cached_token", _meta: { headless: true } }), JSON.stringify(AcpAdapterTests.echo(listener).authenticated));
    const listed = await AcpAdapterTests.adapter(host, [model], resumable, { TEAMRUN_FAKE_ACP_REQUIRE_AUTH: "1", TEAMRUN_FAKE_ACP_SIGNIN_HANG: "1" }).listModels(null);
    Assert.areEqual(0, listed.models.length);
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual(false, listed.awaitsTurn);
    Assert.isFalse(existsSync(host.directory.resolve("auth-browser.txt")));
    const signedOut = await AcpAdapterTests.adapter(host, [model], resumable, { TEAMRUN_FAKE_ACP_INIT: "loggedOut", GROK_HOME: host.directory.path }).listModels(null);
    Assert.areEqual(0, signedOut.models.length);
    Assert.areEqual(false, signedOut.signedIn);
  }

  @TestMethod
  public async listsNoModelsAndSignedInFromASessionForAnAgentItDoesntAuthenticateWhateverSignInItOffers(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut", GROK_HOME: host.directory.path }, host.directory.path);
    agent.authenticates = false;

    const listed = await host.createAcpAdapter(agent).listModels(null);

    Assert.areEqual(0, listed.models.length);
    Assert.areEqual(true, listed.signedIn);
  }

  @TestMethod
  public async takesAListOfOnlyItsFallbackModelsAsNotYetLoadedForAnAgentWithNoModelList(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_MODELS: "grok-4.6,grok-4.5",
      TEAMRUN_FAKE_ACP_LISTED_MODELS: "grok-4.7,grok-4.6,grok-4.5", GROK_HOME: host.directory.path }, host.directory.path);
    agent.readsModels = true;
    agent.fallbackModels = ["grok-4.6", "grok-4.5"];

    const listed = await host.createAcpAdapter(agent).listModels(null);

    Assert.areEqual(0, listed.models.length);
    Assert.isTrue(listed.empty);
  }

  @TestMethod
  public async reportsOnlyTheContextItsAgentSendsAndAnEmptyPlanUseWhenTheAgentHasNoUsageReader(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [model], resumable);
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.request("usage"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("30000/200000/null", listener.usages.map(t => `${t.context?.usedTokens}/${t.context?.windowTokens}/${t.context?.compactAtTokens}`).join(","));
    Assert.areEqual("null null null", listener.usages.map(t => `${t.inputTokens} ${t.outputTokens} ${t.costUsd}`).join(","));
    Assert.areEqual(0, (await adapter.readPlanUsage(null))?.windows.length);
    Assert.isFalse(existsSync(host.directory.resolve("usage-requests.txt")));
  }

  @TestMethod
  public async reportsTheCostOfANewSessionsTurnAndNoCostForALoadedSessionsTurn(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [model], resumable);
    const turn = async (resume: string | null): Promise<string> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(host.request("cost", resume), listener, new AbortController().signal);
      return `${result.outcome} ${result.error} ${listener.usages.map(t => String(t.costUsd)).join(",")}`;
    };

    const first = await turn(null);
    const loaded = await turn("grok-session");

    Assert.areEqual("Completed null 0.25|Completed null null", [first, loaded].join("|"));
  }

  @TestMethod
  public async refusesEveryCallToAnAgentVersionItDoesntWorkWith(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = AcpAdapterTests.adapter(host, [model], { ...resumable, agentInfo: { name: "Fake ACP", version: "0.0.0" } });
    AcpAdapterTests.failed(await AcpAdapterTests.run(adapter, host.request("complete")), "Fake ACP 0.0.0 isn't supported.");
    await Assert.throwsAsync(() => adapter.listModels(null), Error);
    const provider = new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null,
      "2026-09-09T00:00:00.000Z");
    const check = await adapter.checkSignIn(provider);
    Assert.areEqual(AuthStatus.Error, check.authStatus);
    Assert.areEqual("Fake ACP 0.0.0 isn't supported.", check.error);
    const supported = AcpAdapterTests.adapter(host, [model], { ...resumable, agentInfo: { name: "Fake ACP", version: "1.0.0" } });
    Assert.areEqual(TurnOutcome.Completed, (await AcpAdapterTests.run(supported, host.request("complete"))).outcome);
  }

  @TestMethod
  public async readiesANewProfileThroughItsAgentAndLeavesItAloneForAnAgentWithoutTheHook(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null,
      "2026-09-09T00:00:00.000Z");
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model], resumable), host.directory.path);
    const adapter = host.createAcpAdapter(agent);
    const prepared: string[] = [];

    adapter.prepareProfile(provider);
    agent.prepareProfile = t => { prepared.push(t.profileDir); };
    adapter.prepareProfile(provider);

    Assert.areEqual(host.directory.resolve("profile"), prepared.join(","));
  }

  @TestMethod
  public async checksListsAndRunsNothingAndSignsInThroughTheServerWhenTheAgentKnowsTheAccountIsSignedOut(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, { ...AcpAdapterTests.environment(host, [model], resumable), TEAMRUN_FAKE_ACP_SIGNIN_FAIL: "1" },
      host.directory.path, true, true, false);
    const adapter = host.createAcpAdapter(agent);
    const provider = new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null,
      "2026-09-09T00:00:00.000Z");
    const check = await adapter.checkSignIn(provider);

    Assert.areEqual(AuthStatus.LoggedOut, check.authStatus);
    Assert.areEqual(`Sign in to Fake ACP at ${provider.profileDir}.`, check.error);
    Assert.areEqual(0, agent.launches);
    const listed = await adapter.listModels(provider);
    Assert.areEqual(0, listed.models.length);
    Assert.areEqual(false, listed.signedIn);
    Assert.areEqual(0, agent.launches);
    const refused = await Assert.throwsAsync(() => adapter.signIn(provider, new AbortController().signal), Error);
    Assert.isTrue(refused.message.includes("Authentication refused"), refused.message);
    Assert.areEqual(1, agent.launches);
    const started = host.programs.started.length;
    const turn = await AcpAdapterTests.run(adapter, new TurnRequest(provider, host.directory.path, "complete", new RequestedSettings("fake-acp", null, null), null));
    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.areEqual(`Sign in to Fake ACP at ${provider.profileDir}.`, turn.error);
    Assert.areEqual(started, host.programs.started.length);
    Assert.areEqual(JSON.stringify([null, host.directory.path]), JSON.stringify(agent.launchFolders));
    Assert.areEqual("[false,true]", JSON.stringify(agent.launchChatTurns));
    Assert.areEqual("[false,false]", JSON.stringify(agent.launchTitleSessions));
  }

  @TestMethod
  public async signsOutWithTheAgentsOwnRequestAfterInitializeTryingEachFormAndRefusesAnAgentThatSignsOutOnlyInItsTerminal(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model], resumable), host.directory.path);
    const failing = new TestAcpAgent(host.command, { ...AcpAdapterTests.environment(host, [model], resumable), TEAMRUN_FAKE_ACP_LOGOUT: "fail" }, host.directory.path);
    const terminalOnly = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model], resumable), host.directory.path);
    terminalOnly.signOut = null;
    const plain = new TestAcpAgent(host.command, { ...AcpAdapterTests.environment(host, [model], resumable), TEAMRUN_FAKE_ACP_LOGOUT: "plain" },
      host.directory.path);
    const unanswered = new TestAcpAgent(host.command, { ...AcpAdapterTests.environment(host, [model], resumable), TEAMRUN_FAKE_ACP_LOGOUT: "unknown" },
      host.directory.path);
    const provider = new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.LoggedIn, null, null, null, null,
      "2026-09-09T00:00:00.000Z");

    await host.createAcpAdapter(agent).signOut(provider);
    const received = JSON.parse(readFileSync(host.directory.resolve("logout.txt"), "utf8")) as { readonly params: object; readonly methods: readonly string[] };
    const refused = await Assert.throwsAsync(() => host.createAcpAdapter(failing).signOut(provider), Error);
    const unsupported = await Assert.throwsAsync(() => host.createAcpAdapter(terminalOnly).signOut(provider), Error);
    const unknown = await Assert.throwsAsync(() => host.createAcpAdapter(unanswered).signOut(provider), Error);
    await host.createAcpAdapter(plain).signOut(provider);
    const plainly = JSON.parse(readFileSync(host.directory.resolve("logout.txt"), "utf8")) as { readonly methods: readonly string[] };

    Assert.areEqual(JSON.stringify({}), JSON.stringify(received.params));
    Assert.areEqual("initialize,_x.ai/auth/logout", [received.methods.at(0), received.methods.at(-1)].join(","));
    Assert.isTrue(refused.message.includes("Logout refused"), refused.message);
    Assert.areEqual(Resources.signOutNotSupported, unsupported.message);
    Assert.areEqual("_x.ai/auth/logout,x.ai/auth/logout", plainly.methods.slice(-2).join(","));
    Assert.areEqual("Fake ACP answers neither sign-out request TeamRun knows, _x.ai/auth/logout or x.ai/auth/logout. Update Fake ACP, then sign out again.",
      unknown.message);
    Assert.areEqual("1,1,0,1,1", [agent.launches, failing.launches, terminalOnly.launches, plain.launches, unanswered.launches].join(","));
  }

  @TestMethod
  public async logsOutWithAcpsOwnLogoutWhenOfferedAfterStoppingOnlyTheProvidersOwnTurns(): Promise<void> {
    await using host = new GrokTestHost();
    const offered = { agentCapabilities: { ...resumable.agentCapabilities, auth: { logout: {} } } };
    const agent = AcpAdapterTests.loggingOut(host, offered);
    const adapter = host.createAcpAdapter(agent);
    const provider = new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.LoggedIn, null, null, null, null,
      "2026-09-09T00:00:00.000Z");
    const other = new Provider("a2", "fake-acp", "Home", host.directory.resolve("home"), AuthStatus.LoggedIn, null, null, null, null,
      "2026-09-09T00:00:00.000Z");
    const own = new RecordingTurnListener();
    const others = new RecordingTurnListener();
    const controller = new AbortController();

    const running = adapter.runTurn(new TurnRequest(provider, host.directory.path, "cancel", new RequestedSettings("fake-acp", null, null), null), own,
      new AbortController().signal);
    const kept = adapter.runTurn(new TurnRequest(other, host.directory.path, "cancel", new RequestedSettings("fake-acp", null, null), null), others,
      controller.signal);
    await Wait.until(() => own.texts.includes("working"), "The own listener did not see 'working'.");
    await Wait.until(() => others.texts.includes("working"), "The others listener did not see 'working'.");
    await adapter.signOut(provider);
    const stopped = await running;
    const received = JSON.parse(readFileSync(host.directory.resolve("logout.txt"), "utf8")) as { readonly params: object; readonly methods: readonly string[] };
    controller.abort();

    Assert.areEqual(`${TurnOutcome.Failed} ${Resources.formatTurnStoppedForSignOut("Fake ACP")}`, `${stopped.outcome} ${stopped.error}`);
    Assert.areEqual(TurnOutcome.Interrupted, (await kept).outcome);
    Assert.areEqual("initialize,logout", received.methods.join(","));
    Assert.areEqual(JSON.stringify({}), JSON.stringify(received.params));
    Assert.areEqual(3, agent.launches);
  }

  @TestMethod
  public async failsAnAcpLogoutTheAgentDoesntOfferNamingItsVersionAndOneThatFailsOrRunsOutOfTime(): Promise<void> {
    await using host = new GrokTestHost();
    const offered = { agentCapabilities: { ...resumable.agentCapabilities, auth: { logout: {} } } };
    const provider = new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.LoggedIn, null, null, null, null,
      "2026-09-09T00:00:00.000Z");
    const signOut = (capabilities: object, extra: NodeJS.ProcessEnv = {}, timings: ProviderTimings = host.hangingSignInTimings): Promise<Error> =>
      Assert.throwsAsync(() => host.createAcpAdapter(AcpAdapterTests.loggingOut(host, capabilities, extra), undefined, timings).signOut(provider), Error);

    const versioned = await signOut({ ...resumable, agentInfo: { name: "fake", version: "2.0.0" } });
    const unnamed = await signOut({ agentCapabilities: { ...resumable.agentCapabilities, auth: null } });
    const empty = await signOut({ agentCapabilities: { ...resumable.agentCapabilities, auth: {} } });
    const cleared = await signOut({ agentCapabilities: { ...resumable.agentCapabilities, auth: { logout: null } } });
    const refused = await signOut(offered, { TEAMRUN_FAKE_ACP_LOGOUT: "fail" });
    const hung = await signOut(offered, { TEAMRUN_FAKE_ACP_LOGOUT: "hang" });
    const unstarted = await signOut(offered, { TEAMRUN_FAKE_ACP_INIT: "hang" }, new ProviderTimings(2000, 500, 250, 2000, 100, 100, 100, 5000, 100, 1, 10));

    Assert.areEqual("Fake ACP 2.0.0 doesn't support signing out: its ACP server doesn't offer ACP's logout.", versioned.message);
    Assert.areEqual("This Fake ACP version doesn't support signing out: its ACP server doesn't offer ACP's logout.", unnamed.message);
    Assert.areEqual(unnamed.message, empty.message);
    Assert.areEqual(unnamed.message, cleared.message);
    Assert.isTrue(refused.message.includes("Logout refused"), refused.message);
    Assert.areEqual("Fake ACP didn't finish signing out within 0.5 s.", hung.message);
    Assert.areEqual("Fake ACP didn't finish signing out within 0.25 s.", unstarted.message);
    Assert.isInstanceOf(hung, TimeoutException);
    Assert.isInstanceOf(unstarted, TimeoutException);
    Assert.isFalse(refused instanceof TimeoutException);
    Assert.isFalse(existsSync(host.directory.resolve("logout.txt")));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async keepsAStoppedTurnFromReopeningItsSessionAndRefusesNewClientsAndPlanReadsDuringTheLogoutUntilTheSignOutEnds(): Promise<void> {
    await using host = new GrokTestHost();
    const offered = { agentCapabilities: { ...resumable.agentCapabilities, auth: { logout: {} } } };
    const agent = AcpAdapterTests.loggingOut(host, offered, { TEAMRUN_FAKE_ACP_LOGOUT: "hold" });
    const adapter = host.createAcpAdapter(agent, undefined, new ProviderTimings(2000, 60_000, 10_000, 2000, 100, 100, 100, 5000, 100, 1, 10));
    const provider = new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.LoggedIn, null, null, null, null,
      "2026-09-09T00:00:00.000Z");
    const request = (resume: string | null): TurnRequest =>
      new TurnRequest(provider, host.directory.path, "complete", new RequestedSettings("fake-acp", null, null), resume);
    const signingOutNow = Resources.formatSigningOut("Fake ACP");

    const loading = AcpAdapterTests.run(adapter, request("hold"));
    await Wait.until(() => existsSync(host.directory.resolve("load-held.txt")), "The fake did not write load-held.txt.");
    const signingOut = adapter.signOut(provider);
    await Wait.until(() => existsSync(host.directory.resolve("logout-held.txt")), "The fake did not write logout-held.txt.");
    const during = await AcpAdapterTests.run(adapter, request(null));
    const checked = await adapter.checkSignIn(provider);
    const listing = await Assert.throwsAsync(() => adapter.listModels(provider), Error);
    agent.usage = new GrokUsageReader();
    const plan = await adapter.readPlanUsage(provider);
    agent.usage = null;
    const reopened = await loading;
    const launched = agent.launches;
    writeFileSync(host.directory.resolve("logout-released.txt"), "");
    await signingOut;
    const after = await AcpAdapterTests.run(adapter, request(null));

    Assert.areEqual(`${TurnOutcome.Failed} ${Resources.formatTurnStoppedForSignOut("Fake ACP")}`, `${reopened.outcome} ${reopened.error}`);
    Assert.areEqual(`${TurnOutcome.Failed} ${signingOutNow}`, `${during.outcome} ${during.error}`);
    Assert.areEqual(`${AuthStatus.Error} ${signingOutNow}`, `${checked.authStatus} ${checked.error}`);
    Assert.areEqual(signingOutNow, listing.message);
    Assert.isNull(plan);
    Assert.areEqual(2, launched);
    Assert.areEqual(TurnOutcome.Completed, after.outcome);
    Assert.areEqual(3, agent.launches);
  }

  @TestMethod
  public async signsInWithTheBasesOwnHomeAndAppDataFoldersInPlaceOfThoseTheAgentLaunchesWith(): Promise<void> {
    await using host = new GrokTestHost();
    const profile = host.directory.resolve("profile");
    const launched = { ...AcpAdapterTests.environment(host, [model], resumable), ...AcpAdapterTests.folders(join(profile, "home")), GROK_HOME: profile };
    const agent = new TestAcpAgent(host.command, launched, host.directory.path, true, true, false);
    agent.baseEnvironment = { ...host.environment, ...AcpAdapterTests.folders(host.directory.resolve("person")) };
    const starter = new WatchingProcessStarter(() => undefined);
    const provider = new Provider("a1", "fake-acp", "Work", profile, AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");

    await host.createAcpAdapter(agent, starter).signIn(provider, new AbortController().signal);

    Assert.areEqual(1, starter.environments.length);
    Assert.areEqual(JSON.stringify(AcpAdapterTests.folders(host.directory.resolve("person"))),
      JSON.stringify(AcpAdapterTests.foldersOf(starter.environments[0]!)));
    Assert.areEqual(profile, starter.environments[0]!["GROK_HOME"]);
  }

  @TestMethod
  public async startsNoAgentForATurnWhoseEnvironmentIsStillBeingReadWhenItShutsDown(): Promise<void> {
    await using host = new GrokTestHost();
    const starter = new WatchingProcessStarter(() => undefined);
    const read = Promise.withResolvers<void>();
    starter.reading = read.promise;
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [model], resumable), host.directory.path);
    const adapter = host.createAcpAdapter(agent, starter);
    const running = AcpAdapterTests.run(adapter, host.request("methods"));
    await Wait.until(() => starter.reads >= 1, "The starter did not read the agent's output.");

    await adapter.shutdown();
    read.resolve();

    AcpAdapterTests.failed(await running, Resources.formatStoppedForShutdown(agent.descriptor.displayName));
    Assert.areEqual(0, starter.started.length);
  }

  @TestMethod
  public async followsNoTasksAndClosesTheAgentAfterTheTurnForAnAgentThatDoesNotReportThemAsGrokDoes(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    const result = await AcpAdapterTests.adapter(host, [model], resumable).runTurn(host.request("background"), listener, new AbortController().signal);
    await host.programs.endedAt(1);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(0, listener.taskStarts.length);
  }

  @TestMethod
  public async takesASharedServerOnlyOverATransportTheAgentIsShownToKeepItsValuesOutOfItsSessionFilesOn(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, host.environment, host.directory.path);
    const adapter = host.createAcpAdapter(agent);
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN");
    const unavailable = (): (SharedMcpRefusal | null)[] => [adapter.sharedServerUnavailable(stdio), adapter.sharedServerUnavailable(http)];

    const none = unavailable();
    agent.sharedServerTransports = [SharedMcpTransport.Http];
    const httpOnly = unavailable();
    agent.sharedServerRefusal = new SharedMcpRefusal("Fake ACP refuses a stdio server.", "refuses stdio");
    const refused = unavailable();
    agent.sharedServerTransports = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];

    const reason = new SharedMcpRefusal("TeamRun passes no shared MCP servers to Fake ACP until a run shows Fake ACP keeps their values out of its session "
      + "files.", "not confirmed yet");
    Assert.areEqual(JSON.stringify([reason, reason]), JSON.stringify(none));
    Assert.areEqual(JSON.stringify([reason, null]), JSON.stringify(httpOnly));
    Assert.areEqual(JSON.stringify([new SharedMcpRefusal("Fake ACP refuses a stdio server.", "refuses stdio"), null]), JSON.stringify(refused));
    Assert.areEqual(JSON.stringify([null, null]), JSON.stringify(unavailable()));
  }

  @TestMethod
  public async leavesOutASharedServerTheAgentRefusesByNameForTheTurnsProviderAndFolderOnceItsTransportIsTaken(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, host.environment, host.directory.path);
    const adapter = host.createAcpAdapter(agent);
    agent.sharedServerTransports = [SharedMcpTransport.Http];
    agent.sharedServerRefusal = new SharedMcpRefusal("Fake ACP refuses a stdio server.");
    agent.ownServerNames = ["search", "docs"];
    const provider = new Provider("a", "grok", "Work", "/profiles/grok", AuthStatus.Unknown, null, null, null, null, "t");
    const search = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [], null, [], null);
    const http = (name: string): SharedMcpServerDefinition => new SharedMcpServerDefinition(name, SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp",
      [], null);

    const unavailable = [adapter.sharedServerUnavailable(search, provider, "/projects/app"), adapter.sharedServerUnavailable(http("docs"), provider, "/projects/app"),
      adapter.sharedServerUnavailable(http("other"), provider, "/projects/app"), adapter.sharedServerUnavailable(http("docs"))];

    Assert.areEqual(JSON.stringify([{ reason: "Fake ACP refuses a stdio server.", short: null },
      { reason: "Fake ACP has its own docs for a in /projects/app.", short: "has its own" }, null,
      { reason: "Fake ACP has its own docs for no provider in no folder.", short: "has its own" }]), JSON.stringify(unavailable));
  }

  @TestMethod
  public async takesNoSharedServerThatNamesTheSenderTokenOverAnyTransport(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, host.environment, host.directory.path);
    agent.sharedServerTransports = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];
    const adapter = host.createAcpAdapter(agent);
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["TEAMRUN_SENDER_TOKEN"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp",
      [new SharedMcpHeader("X-Team", "teamrun_sender_token")], null);
    const bearer = new SharedMcpServerDefinition("tracker", SharedMcpTransport.Http, null, [], [], "https://tracker.example/mcp", [], "Teamrun_Sender_Token");

    Assert.areEqual(JSON.stringify(["TEAMRUN_SENDER_TOKEN", "teamrun_sender_token", "Teamrun_Sender_Token"].map(t => new SharedMcpRefusal(`TeamRun keeps ${t}, `
      + "TeamRun's own sender token, from the MCP servers it passes Fake ACP.", `${t} kept from it`))),
    JSON.stringify([stdio, http, bearer].map(t => adapter.sharedServerUnavailable(t))));
  }

  @TestMethod
  public async givesTheSenderTokensReasonBeforeTheTransportsForAnAgentThatTakesNoSharedServer(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, host.environment, host.directory.path);
    agent.sharedServerTransports = [];
    const adapter = host.createAcpAdapter(agent);
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["TEAMRUN_SENDER_TOKEN"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp",
      [new SharedMcpHeader("X-Team", "TEAMRUN_SENDER_TOKEN")], null);
    const bearer = new SharedMcpServerDefinition("tracker", SharedMcpTransport.Http, null, [], [], "https://tracker.example/mcp", [], "TEAMRUN_SENDER_TOKEN");
    const plain = new SharedMcpServerDefinition("files", SharedMcpTransport.Stdio, "npx", [], ["FILES_KEY"], null, [], null);
    const reason = "TeamRun keeps TEAMRUN_SENDER_TOKEN, TeamRun's own sender token, from the MCP servers it passes Fake ACP.";

    Assert.areEqual(JSON.stringify([reason, reason, reason, Resources.formatSharedMcpUnconfirmed("Fake ACP")]),
      JSON.stringify([stdio, http, bearer, plain].map(t => adapter.sharedServerUnavailable(t)?.reason)));
  }

  @TestMethod
  public async sendsASharedServersCurrentValuesInSessionNewBeforeTeamRunsOwnAndNeverInTheAgentsArgumentsALogOrTheTurnsRecord(): Promise<void> {
    await using host = new GrokTestHost();
    const values = { TEAMRUN_TEST_SHARED_KEY: "key-value-4711", TEAMRUN_TEST_SHARED_TEAM: "team-value-4712", TEAMRUN_TEST_SHARED_TOKEN: "token-value-4713" };
    const starter = { start: host.starter.start.bind(host.starter), readEnvironmentAsync: (own: NodeJS.ProcessEnv) => Promise.resolve({ ...own, ...values }) };
    const log = new RecordingLog();
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], { agentCapabilities: { mcpCapabilities: { http: true } } }),
      host.directory.path);
    agent.sharedServerTransports = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];
    const adapter = host.createAcpAdapter(agent, starter, undefined, log);
    const listener = new RecordingTurnListener();
    const tools = AcpAdapterTests.toolsOf();

    const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "launch", new RequestedSettings("grok", null, null), null, [], null,
      null, {}, false, tools, AcpAdapterTests.sharedServers), listener, new AbortController().signal);

    const sent = readFileSync(host.directory.resolve("mcp-servers.txt"), "utf8").trimEnd();
    const bearer = [...sent.matchAll(/Bearer ([^"]+)"/gu)].at(-1)?.[1] ?? String.empty;
    const launch = new SharedMcpLaunch();
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([
      { name: "search", command: launch.program, args: [launch.script, "--variables", "TEAMRUN_TEST_SHARED_KEY,TEAMRUN_TEST_SHARED_UNSET", "--", "npx", "-y", "search-server"],
        env: [{ name: "TEAMRUN_TEST_SHARED_KEY", value: "key-value-4711" }, { name: "TEAMRUN_TEST_SHARED_UNSET", value: "" }, { name: "ELECTRON_RUN_AS_NODE", value: "1" }] },
      { type: "http", name: "docs", url: "https://docs.example/mcp",
        headers: [{ name: "X-Team", value: "team-value-4712" }, { name: "Authorization", value: "Bearer token-value-4713" }] },
      { type: "http", name: "wiki", url: "https://wiki.example/mcp", headers: [] },
      { type: "http", name: "teamrun", url: "http://127.0.0.1:4711/mcp", headers: [{ name: "Authorization", value: `Bearer ${bearer}` }] }
    ]), sent);
    Assert.areEqual(43, bearer.length);
    const launched = listener.texts.find(t => t.startsWith("{\"args\""))!;
    Assert.isDefined(launched);
    const kept = [JSON.stringify(result), JSON.stringify(listener)];
    for (const value of Object.values(values))
      Assert.isFalse([launched, ...log.lines, ...kept].some(t => t.includes(value)), value);
  }

  @TestMethod
  public async sendsASharedServersSavedValuesInSessionNewOverTheEnvironmentsAndNeverInTheAgentsArgumentsALogOrTheTurnsRecord(): Promise<void> {
    await using host = new GrokTestHost();
    const environment = { TEAMRUN_TEST_SHARED_KEY: "key-value-4711", TEAMRUN_TEST_SHARED_TEAM: "team-value-4712" };
    const saved = { TEAMRUN_TEST_SHARED_KEY: "saved-key-5811", TEAMRUN_TEST_SHARED_TOKEN: "saved-token-5813" };
    const starter = { start: host.starter.start.bind(host.starter), readEnvironmentAsync: (own: NodeJS.ProcessEnv) => Promise.resolve({ ...own, ...environment }) };
    const log = new RecordingLog();
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], { agentCapabilities: { mcpCapabilities: { http: true } } }),
      host.directory.path);
    agent.sharedServerTransports = [SharedMcpTransport.Stdio, SharedMcpTransport.Http];
    const adapter = host.createAcpAdapter(agent, starter, undefined, log);
    const listener = new RecordingTurnListener();
    const values = new SharedMcpValues(new Map([["search", new Map([["TEAMRUN_TEST_SHARED_KEY", saved.TEAMRUN_TEST_SHARED_KEY]])],
      ["docs", new Map([["TEAMRUN_TEST_SHARED_TOKEN", saved.TEAMRUN_TEST_SHARED_TOKEN]])]]));
    const request = new TurnRequest(null, host.directory.path, "launch", new RequestedSettings("grok", null, null), null, [], null, null, {}, false, null,
      AcpAdapterTests.sharedServers.slice(0, 2), null, undefined, values);

    const result = await adapter.runTurn(request, listener, new AbortController().signal);

    const sent = readFileSync(host.directory.resolve("mcp-servers.txt"), "utf8").trimEnd();
    const launch = new SharedMcpLaunch();
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isNull(adapter.savedSecretsUnavailable());
    Assert.areEqual(JSON.stringify([
      { name: "search", command: launch.program, args: [launch.script, "--variables", "TEAMRUN_TEST_SHARED_KEY,TEAMRUN_TEST_SHARED_UNSET", "--", "npx", "-y", "search-server"],
        env: [{ name: "TEAMRUN_TEST_SHARED_KEY", value: "saved-key-5811" }, { name: "TEAMRUN_TEST_SHARED_UNSET", value: "" }, { name: "ELECTRON_RUN_AS_NODE", value: "1" }] },
      { type: "http", name: "docs", url: "https://docs.example/mcp",
        headers: [{ name: "X-Team", value: "team-value-4712" }, { name: "Authorization", value: "Bearer saved-token-5813" }] }
    ]), sent);
    const launched = listener.texts.find(t => t.startsWith("{\"args\""))!;
    Assert.isDefined(launched);
    for (const value of Object.values(saved))
      Assert.isFalse([launched, ...log.lines, JSON.stringify(result), JSON.stringify(listener), JSON.stringify(request)].some(t => t.includes(value)), value);
  }

  @TestMethod
  public async givesAnAgentWhoseCapabilitiesOfferHttpTheEndpointWithEachProcesssOwnTokenAndRevokesItAsTheProcessCloses(): Promise<void> {
    await using host = new GrokTestHost();
    const log = new RecordingLog();
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], { agentCapabilities: { mcpCapabilities: { http: true } } }),
      host.directory.path);
    const adapter = host.createAcpAdapter(agent, undefined, undefined, log);
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) },
      [], new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
    const listener = new RecordingTurnListener();

    const fresh = await adapter.runTurn(new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("grok", null, null), null, [], null, null, {},
      false, tools), listener, new AbortController().signal);
    const resumed = await adapter.runTurn(new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("grok", null, null), fresh.nativeSessionId,
      [], null, null, {}, false, tools), listener, new AbortController().signal);

    const sent = readFileSync(host.directory.resolve("mcp-servers.txt"), "utf8").trimEnd().split("\n");
    const [first, second] = sent.map(t => RecordedMcpServers.bearerOf(t));
    Assert.isDefined(first);
    Assert.isDefined(second);
    Assert.areEqual(TurnOutcome.Completed, fresh.outcome);
    Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
    Assert.areEqual([[{ type: "http", name: "teamrun", url: "http://127.0.0.1:4711/mcp", headers: [{ name: "Authorization", value: `Bearer ${first}` }] }],
      [{ type: "http", name: "teamrun", url: "http://127.0.0.1:4711/mcp", headers: [{ name: "Authorization", value: `Bearer ${second}` }] }]].map(t => JSON.stringify(t)).join("\n"),
      sent.join("\n"));
    Assert.areEqual(43, first.length);
    Assert.areNotEqual(first, second);
    Assert.isNull(tokens.find(first));
    Assert.isNull(tokens.find(second));
    Assert.isFalse([...log.lines, JSON.stringify(listener), JSON.stringify(fresh), JSON.stringify(resumed)].some(t => t.includes(first) || t.includes(second)));
  }

  @TestMethod
  public async failsATurnWithTeamRunsToolsSayingSoWhenTheAgentsCapabilitiesLeaveHttpOutAndRunsOneWithoutThem(): Promise<void> {
    await using host = new GrokTestHost();
    const capabilities = [{}, { agentCapabilities: { mcpCapabilities: { sse: true } } }];

    const results: TurnResult[] = [];
    for (const offered of capabilities) {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], offered), host.directory.path);
      for (const tools of [AcpAdapterTests.toolsOf(), null])
        results.push(await AcpAdapterTests.run(host.createAcpAdapter(agent), new TurnRequest(null, host.directory.path, "complete",
          new RequestedSettings("grok", null, null), null, [], null, null, {}, false, tools)));
    }

    const refused = "Fake ACP can't reach TeamRun's tools: it takes no HTTP MCP servers, and TeamRun serves its tools only over HTTP. "
      + "Update Fake ACP to a version that does.";
    Assert.areEqual(refused, Resources.formatAcpToolsNeedHttp("Fake ACP"));
    Assert.areEqual(JSON.stringify([[TurnOutcome.Failed, refused], [TurnOutcome.Completed, null], [TurnOutcome.Failed, refused], [TurnOutcome.Completed, null]]),
      JSON.stringify(results.map(t => [t.outcome, t.error])));
    Assert.areEqual(["[]", "[]"].join("\n"), readFileSync(host.directory.resolve("mcp-servers.txt"), "utf8").trimEnd());
  }

  @TestMethod
  public async failsATurnWithTeamRunsToolsSayingSoWhileTheEndpointIsntServingAndRunsOneWithoutThem(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], AcpAdapterTests.http), host.directory.path);
    const unserved = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, []);

    const results: TurnResult[] = [];
    for (const tools of [unserved, null])
      results.push(await AcpAdapterTests.run(host.createAcpAdapter(agent), new TurnRequest(null, host.directory.path, "complete",
        new RequestedSettings("grok", null, null), null, [], null, null, {}, false, tools)));

    const refused = "Fake ACP can't reach TeamRun's tools: TeamRun's tool endpoint isn't serving, and the runtime's log says why. Restart TeamRun to try again.";
    Assert.areEqual(refused, Resources.formatToolsNotServed("Fake ACP"));
    Assert.areEqual(JSON.stringify([[TurnOutcome.Failed, refused], [TurnOutcome.Completed, null]]), JSON.stringify(results.map(t => [t.outcome, t.error])));
    Assert.areEqual("[]", readFileSync(host.directory.resolve("mcp-servers.txt"), "utf8").trimEnd());
  }

  @TestMethod
  public async launchesATurnWithTheToolsItsTurnApprovesOneWithoutTeamRunsToolsWithNoneAndASignInCheckWithNull(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], AcpAdapterTests.http), host.directory.path);
    const adapter = host.createAcpAdapter(agent);
    const tools = AcpAdapterTests.toolsOf(["teamrun_create_chat", "terminal_run"]);
    const request = (turnTools: TurnTools | null): TurnRequest => new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("fake-acp", null, null),
      null, [], null, null, {}, false, turnTools);

    const approved = await AcpAdapterTests.run(adapter, request(tools));
    const plain = await AcpAdapterTests.run(adapter, request(null));
    await adapter.checkSignIn(new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null,
      "2026-09-09T00:00:00.000Z"));

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed]), JSON.stringify([approved.outcome, plain.outcome]));
    Assert.areEqual(JSON.stringify([["teamrun_create_chat", "terminal_run"], [], null]), JSON.stringify(agent.launchApprovals));
  }

  @TestMethod
  public async failsATurnThatPassesASharedHttpServerToAnAgentWhoseCapabilitiesLeaveHttpOut(): Promise<void> {
    await using host = new GrokTestHost();
    const capabilities = [{}, { agentCapabilities: {} }, { agentCapabilities: { mcpCapabilities: null } }, { agentCapabilities: { mcpCapabilities: { sse: true } } }];

    for (const offered of capabilities) {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], offered), host.directory.path);
      agent.sharedServerTransports = [SharedMcpTransport.Http];
      const result = await AcpAdapterTests.run(host.createAcpAdapter(agent), new TurnRequest(null, host.directory.path, "complete",
        new RequestedSettings("grok", null, null), null, [], null, null, {}, false, null, [AcpAdapterTests.sharedServers[1]!]));

      AcpAdapterTests.failed(result, "Fake ACP takes no HTTP MCP servers, so TeamRun can't pass it the shared server docs.");
    }
    Assert.isFalse(existsSync(host.directory.resolve("mcp-servers.txt")));
  }

  @TestMethod
  public async namesTheCommandLineInAPromptWhoseToolsTheEndpointDidntListInTime(): Promise<void> {
    await using host = new GrokTestHost();
    const elapsed = new ElapsedDelayTimer(Resources.teamRunToolsWait);
    const held = new HeldDelayTimer(Resources.teamRunToolsWait);
    const roleOf = async (tools: TurnTools, awaits: boolean, timer: ITimer, fallback: string | null): Promise<string> => {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], AcpAdapterTests.http), host.directory.path);
      agent.awaitsTeamRunTools = awaits;
      const adapter = host.createAcpAdapter(agent, host.starter, host.timings, null, timer);
      Assert.isTrue(adapter.takesTeamRunTools);
      const listener = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "role-payload", new RequestedSettings("fake-acp", null, null), null, [], "With the tools", null, {},
        false, tools, [], null, undefined, undefined, fallback), listener, new AbortController().signal);
      return listener.texts.join("\n");
    };
    const listed = AcpAdapterTests.toolsOf();
    listed.markListed();

    const unlisted = await roleOf(AcpAdapterTests.toolsOf(), true, elapsed, "With the command");
    Assert.isTrue(unlisted.includes("With the command") && !unlisted.includes("With the tools"), unlisted);
    const inTime = await roleOf(listed, true, held, "With the command");
    Assert.isTrue(inTime.includes("With the tools") && !inTime.includes("With the command"), inTime);
    const unawaited = await roleOf(AcpAdapterTests.toolsOf(), false, held, "With the command");
    Assert.isTrue(unawaited.includes("With the tools") && !unawaited.includes("With the command"), unawaited);
    Assert.isTrue((await roleOf(AcpAdapterTests.toolsOf(), true, elapsed, null)).includes("With the tools"));
  }

  @TestMethod
  public async notesWhyTeamRunsToolsAreMissingAtTheSessionsAnswerForAnAgentThatListsThemFirstOrWhenTheWaitEndsByTime(): Promise<void> {
    await using host = new GrokTestHost();
    const folders: (string | null)[] = [];
    const run = async (tools: TurnTools, timer: HeldDelayTimer | ElapsedDelayTimer, before: boolean, untrusted: string | null, reading: boolean = true,
      provider: Provider | null = null): Promise<readonly string[]> => {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], AcpAdapterTests.http), host.directory.path);
      agent.awaitsTeamRunTools = true;
      agent.listsToolsBeforeSession = initialized => before && initialized.hasField("authMethods");
      if (reading) {
        agent.readUntrustedFolder = (initialized, environment, workingDirectory) => {
          folders.push(workingDirectory);
          return initialized.hasField("authMethods") && Object.keys(environment).length > 0 ? untrusted : null;
        };
        agent.readMissingTools = initialized => initialized.hasField("authMethods") ? "left out" : null;
      }
      const adapter = host.createAcpAdapter(agent, host.starter, host.timings, null, timer);
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(new TurnRequest(provider, host.directory.path, "methods", new RequestedSettings("fake-acp", null, null), null, [], null, null,
        {}, false, tools), listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, result.outcome, result.error ?? "");
      return listener.sharedFailures.map(t => JSON.stringify([t.providerId, t.providerLabel, t.server, t.kind, t.reason]));
    };
    const listed = (): TurnTools => {
      const tools = AcpAdapterTests.toolsOf();
      tools.markListed();
      return tools;
    };
    const note = (kind: SharedMcpFailureKind, reason: string, id: string = "fake-acp", label: string = "Fake ACP"): string =>
      JSON.stringify([JSON.stringify([id, label, "teamrun", kind, reason])]);
    const untrustedTimer = new HeldDelayTimer(Resources.teamRunToolsWait);
    const unlistedTimer = new HeldDelayTimer(Resources.teamRunToolsWait);
    const listedTimer = new HeldDelayTimer(Resources.teamRunToolsWait);
    const waited = new HeldDelayTimer(Resources.teamRunToolsWait);

    const untrusted = await run(AcpAdapterTests.toolsOf(), untrustedTimer, true, "not trusted");
    const unlisted = await run(AcpAdapterTests.toolsOf(), unlistedTimer, true, null);
    const listedFirst = await run(listed(), listedTimer, true, "not trusted");
    const timedOut = await run(AcpAdapterTests.toolsOf(), new ElapsedDelayTimer(Resources.teamRunToolsWait), false, "not trusted");
    const inTime = await run(listed(), waited, false, null);
    const unread = await run(AcpAdapterTests.toolsOf(), new ElapsedDelayTimer(Resources.teamRunToolsWait), false, null, false);
    const work = await run(AcpAdapterTests.toolsOf(), new ElapsedDelayTimer(Resources.teamRunToolsWait), false, null, true, new Provider("a1", "fake-acp", "Work",
      host.directory.resolve("profile"), AuthStatus.LoggedIn, null, null, null, null, "2026-09-09T00:00:00.000Z"));

    Assert.areEqual(note(SharedMcpFailureKind.Untrusted, "not trusted"), JSON.stringify(untrusted));
    Assert.areEqual(note(SharedMcpFailureKind.Unlisted, "left out"), JSON.stringify(unlisted));
    Assert.areEqual(note(SharedMcpFailureKind.Untrusted, "not trusted"), JSON.stringify(timedOut));
    Assert.areEqual(note(SharedMcpFailureKind.Unlisted, "left out", "a1", "Work"), JSON.stringify(work));
    Assert.areEqual("[]", JSON.stringify([...listedFirst, ...inTime]));
    Assert.areEqual(note(SharedMcpFailureKind.Unlisted, Resources.formatTeamRunToolsTimedOut("Fake ACP", Resources.teamRunToolsWait)), JSON.stringify(unread));
    Assert.areEqual(JSON.stringify([[], [], []]),
      JSON.stringify([untrustedTimer, unlistedTimer, listedTimer].map(t => t.requested.filter(u => u === Resources.teamRunToolsWait))));
    Assert.areEqual(JSON.stringify([Resources.teamRunToolsWait]), JSON.stringify(waited.requested.filter(t => t === Resources.teamRunToolsWait)));
    Assert.areEqual(JSON.stringify(Array<string>(4).fill(host.directory.path)), JSON.stringify(folders));
  }

  @TestMethod
  public async notesTeamRunsToolsMissingWithoutWaitingOnAKeptSessionWhoseOpeningAnswerListedNoneOfThem(): Promise<void> {
    await using host = new GrokTestHost();
    const run = async (before: boolean, listed: boolean, timer: HeldDelayTimer | ElapsedDelayTimer): Promise<readonly (readonly unknown[])[]> => {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], { agentCapabilities: { loadSession: true, mcpCapabilities: { http: true } } }),
        host.directory.path);
      agent.awaitsTeamRunTools = true;
      agent.listsToolsBeforeSession = () => before;
      agent.readMissingTools = () => "left out";
      const adapter = host.createAcpAdapter(agent, host.starter, host.timings, null, timer, host.idleTimer);
      const tokens = new SessionTokens();
      tokens.open("session-1", "c1/t1");
      const turn = async (resume: string | null): Promise<{ readonly row: readonly unknown[]; readonly session: string | null }> => {
        const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [],
          new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
        if (listed)
          tools.markListed();
        const listener = new RecordingTurnListener();
        const waits = timer.requested.length;
        const result = await adapter.runTurn(new TurnRequest(null, host.directory.path, "methods", new RequestedSettings("fake-acp", null, null), resume, [], null, null,
          {}, false, tools), listener, new AbortController().signal);
        return { row: [result.outcome, listener.sharedFailures.map(t => t.kind), timer.requested.slice(waits).filter(t => t === Resources.teamRunToolsWait).length],
          session: result.nativeSessionId };
      };
      const first = await turn(null);
      const started = host.programs.started.length;
      const second = await turn(first.session);
      return [first.row, second.row, [host.programs.started.length - started, second.session === first.session]];
    };

    const unlisted = await run(true, false, new ElapsedDelayTimer(Resources.teamRunToolsWait));
    const listed = await run(true, true, new HeldDelayTimer(Resources.teamRunToolsWait));
    const waiting = await run(false, false, new ElapsedDelayTimer(Resources.teamRunToolsWait));

    const once = [TurnOutcome.Completed, [SharedMcpFailureKind.Unlisted], 0];
    Assert.areEqual(JSON.stringify([once, once, [0, true]]), JSON.stringify(unlisted));
    Assert.areEqual(JSON.stringify([[TurnOutcome.Completed, [], 0], [TurnOutcome.Completed, [], 1], [0, true]]), JSON.stringify(listed));
    Assert.areEqual(JSON.stringify([[TurnOutcome.Completed, [SharedMcpFailureKind.Unlisted], 1], [TurnOutcome.Completed, [SharedMcpFailureKind.Unlisted], 1], [0, true]]),
      JSON.stringify(waiting));
  }

  @TestMethod
  public async sendsThePromptOnceTheEndpointListsTeamRunsToolsForAnAgentThatAwaitsThemOrWhenTheWaitEnds(): Promise<void> {
    await using host = new GrokTestHost();
    const tools = (): TurnTools => AcpAdapterTests.toolsOf();
    const request = (turnTools: TurnTools | null): TurnRequest => new TurnRequest(null, host.directory.path, "methods", new RequestedSettings("fake-acp", null, null),
      null, [], null, null, {}, false, turnTools);
    const adapter = (awaits: boolean, timer: ITimer, log: RecordingLog | null = null): AcpAdapter => {
      const agent = new TestAcpAgent(host.command, AcpAdapterTests.environment(host, [], AcpAdapterTests.http), host.directory.path);
      agent.awaitsTeamRunTools = awaits;
      return host.createAcpAdapter(agent, host.starter, host.timings, log, timer);
    };
    const held = new HeldDelayTimer(Resources.teamRunToolsWait);

    const listener = new RecordingTurnListener();
    const listed = tools();
    let settled = false;
    const log = new RecordingLog();
    const waiting = adapter(true, held, log).runTurn(request(listed), listener, new AbortController().signal).finally(() => { settled = true; });
    await Wait.until(() => held.requested.includes(Resources.teamRunToolsWait), "The adapter did not wait for the TeamRun tools.");
    const settledBeforeListing = settled;
    const promptedBeforeListing = listener.texts.length;
    listed.markListed();
    const afterListing = await waiting;

    const elapsed = new RecordingTurnListener();
    const timedOutLog = new RecordingLog();
    const afterWait = await adapter(true, new ElapsedDelayTimer(Resources.teamRunToolsWait), timedOutLog).runTurn(request(tools()), elapsed,
      new AbortController().signal);
    const unlogged = await adapter(true, new ElapsedDelayTimer(Resources.teamRunToolsWait)).runTurn(request(tools()), new RecordingTurnListener(),
      new AbortController().signal);
    const stopped = new RecordingTurnListener();
    const stopping = new AbortController();
    const stopLog = new RecordingLog();
    const stopRun = adapter(true, held, stopLog).runTurn(request(tools()), stopped, stopping.signal);
    await Wait.until(() => held.requested.filter(t => t === Resources.teamRunToolsWait).length === 2, "The second run did not wait for the TeamRun tools.");
    stopping.abort();
    const afterStop = await stopRun;
    const unawaited = new RecordingTurnListener();
    const notAwaited = await adapter(false, held).runTurn(request(tools()), unawaited, new AbortController().signal);
    const toolless = new RecordingTurnListener();
    const withoutTools = await adapter(true, held).runTurn(request(null), toolless, new AbortController().signal);

    Assert.isFalse(settledBeforeListing);
    Assert.areEqual(0, promptedBeforeListing);
    Assert.areEqual([TurnOutcome.Completed, TurnOutcome.Completed, TurnOutcome.Completed, TurnOutcome.Interrupted, TurnOutcome.Completed, TurnOutcome.Completed].join(","),
      [afterListing, afterWait, unlogged, afterStop, notAwaited, withoutTools].map(t => t.outcome).join(","));
    Assert.areEqual(2, held.requested.filter(t => t === Resources.teamRunToolsWait).length);
    const unlisted = Resources.formatTeamRunToolsUnlisted("fake-acp", Resources.formatTeamRunToolsTimedOut("Fake ACP", Resources.teamRunToolsWait));
    Assert.areEqual("fake-acp: the prompt went without TeamRun's tools: Fake ACP didn't list them within 5 s of starting its session.", unlisted);
    Assert.areEqual(1, timedOutLog.lines.filter(t => t === unlisted).length);
    Assert.isFalse([log, stopLog].some(t => t.lines.includes(unlisted)));
    for (const prompted of [listener, elapsed, unawaited, toolless])
      Assert.areEqual("session/prompt", AcpAdapterTests.echo(prompted).methods.at(-1));
    Assert.isFalse(stopped.texts.some(t => t.startsWith("{\"methods\"")));
  }

  @TestMethod
  public async endsTheToolsWaitAndNotesWhyOnceListingTheToolsFailsOrTheAgentEnds(): Promise<void> {
    await using host = new GrokTestHost();
    const run = async (extra: NodeJS.ProcessEnv, fails: boolean): Promise<readonly unknown[]> => {
      const agent = new TestAcpAgent(host.command, { ...AcpAdapterTests.environment(host, [], AcpAdapterTests.http), ...extra }, host.directory.path);
      agent.awaitsTeamRunTools = true;
      const timer = new HeldDelayTimer(Resources.teamRunToolsWait);
      const log = new RecordingLog();
      const listener = new RecordingTurnListener();
      const tools = AcpAdapterTests.toolsOf();
      const running = host.createAcpAdapter(agent, host.starter, host.timings, log, timer).runTurn(new TurnRequest(null, host.directory.path, "methods",
        new RequestedSettings("fake-acp", null, null), null, [], null, null, {}, false, tools), listener, new AbortController().signal);
      if (fails) {
        await Wait.until(() => timer.requested.includes(Resources.teamRunToolsWait), "The adapter did not wait for the TeamRun tools.");
        tools.markFailed(new Error("The endpoint refused the list."));
      }
      const result = await running;
      return [result.outcome, listener.sharedFailures.map(t => [t.kind, t.reason]), log.lines.filter(t => t.startsWith("fake-acp: the prompt went without"))];
    };

    const failed = await run({}, true);
    const ended = await run({ TEAMRUN_FAKE_ACP_NEW: "exitAfter" }, false);

    const failure = Resources.formatTeamRunToolsFailed("Fake ACP", "The endpoint refused the list.");
    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, [[SharedMcpFailureKind.Unlisted, failure]], [Resources.formatTeamRunToolsUnlisted("fake-acp", failure)]]),
      JSON.stringify(failed));
    const gone = Resources.formatTeamRunToolsAgentEnded("Fake ACP");
    Assert.areEqual(JSON.stringify([[[SharedMcpFailureKind.Unlisted, gone]], [Resources.formatTeamRunToolsUnlisted("fake-acp", gone)]]), JSON.stringify(ended.slice(1)));
  }

  private static toolsOf(approvedTools: readonly string[] = []): TurnTools {
    return new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, approvedTools,
      new McpEndpoint("http://127.0.0.1:4711/mcp", new SessionTokens(), "session-1"));
  }

  private static async runInMode(host: GrokTestHost, available: readonly string[], defaultMode: string, mode: string | null,
    current: string = "yolo"): Promise<string> {
    const session = { currentModeId: current, availableModes: available.map(t => ({ id: t, name: t })) };
    const agent = new TestAcpAgent(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(session) }, host.directory.path);
    agent.modes = [new ProviderMode("ask", "Ask", null, false), new ProviderMode("yolo", "YOLO", null, true)];
    agent.defaultMode = defaultMode;
    const listener = new RecordingTurnListener();
    const turn = await host.createAcpAdapter(agent).runTurn(host.request("methods", null, null, null, null, mode), listener, new AbortController().signal);
    const echoed = listener.texts.some(t => t.startsWith("{\"methods\"")) ? AcpAdapterTests.echo(listener).sets.join(",") : "no prompt";
    return `${turn.outcome}:${echoed}:${turn.error ?? ""}`;
  }

  private static adapter(host: GrokTestHost, options: readonly object[], capabilities: object, extra: NodeJS.ProcessEnv = {},
    idleTimer: ITimer = host.elapsedIdleTimer): AcpAdapter {
    return host.createAcpAdapter(new TestAcpAgent(host.command, { ...AcpAdapterTests.environment(host, options, capabilities), ...extra }, host.directory.path),
      undefined, undefined, null, undefined, idleTimer);
  }

  private static folders(home: string): Record<string, string> {
    return { HOME: home, USERPROFILE: home, APPDATA: join(home, "roaming"), LOCALAPPDATA: join(home, "local"), XDG_CONFIG_HOME: join(home, "config"),
      XDG_DATA_HOME: join(home, "data") };
  }

  private static foldersOf(environment: NodeJS.ProcessEnv): Record<string, string | undefined> {
    return Object.fromEntries(Object.keys(AcpAdapterTests.folders("")).map(t => [t, environment[t]]));
  }

  private static environment(host: GrokTestHost, options: readonly object[], capabilities: object): NodeJS.ProcessEnv {
    return { ...host.environment, TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify(options), TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) };
  }

  private static loggingOut(host: GrokTestHost, capabilities: object, extra: NodeJS.ProcessEnv = {}): TestAcpAgent {
    const agent = new TestAcpAgent(host.command, { ...AcpAdapterTests.environment(host, [model], capabilities), ...extra }, host.directory.path);
    agent.signOut = null;
    agent.logsOut = true;
    return agent;
  }

  @TestMethod
  public async namesNoCopyForTheSignInCommandOfAnAgentThatCantNameTheProgramItStarts(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a1", "fake-acp", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
    const agent = new TestAcpAgent(host.command, host.environment, host.directory.path, true, true, null, "fake-acp login");

    Assert.isNull(await host.createAcpAdapter(agent).readSignInCommand(provider));
  }

  private static isolated(host: GrokTestHost, prompt: string): TurnRequest {
    const request = host.request(prompt);
    return new TurnRequest(null, request.workingDirectory, prompt, request.requested, null, [], null, null, {}, false, null, [], null, () => false, SharedMcpValues.none, null, true);
  }

  private static run(adapter: AcpAdapter, request: TurnRequest): Promise<TurnResult> {
    return adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal);
  }

  private static failed(result: TurnResult, error: string): void {
    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.isTrue(result.error?.includes(error) ?? false, result.error ?? "no error");
  }

  private static echo(listener: RecordingTurnListener): { readonly methods: readonly string[]; readonly authenticated: Record<string, unknown>; readonly sets: readonly string[] } {
    return JSON.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly methods: readonly string[]; readonly authenticated: Record<string, unknown>;
      readonly sets: readonly string[] };
  }
}
