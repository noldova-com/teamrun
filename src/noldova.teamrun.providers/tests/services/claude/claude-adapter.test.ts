/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, realpathSync, truncateSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

import type { AccountInfo, ApiKeySource, EffortLevel, ModelInfo, SDKAssistantMessage, SDKResultMessage, SDKSystemMessage } from "@anthropic-ai/claude-agent-sdk";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import {
  Resources as CoreResources, ForkRequest, SessionCarry, SessionTokens, SharedMcpFailureKind, SharedMcpValues, TimeoutException, TitleTurn,
  TurnOutcome, TurnRequest, TurnTools, WakeTurn
} from "@noldova/teamrun.core";
import { AuthStatus, DetailKind, MessageAttachment, type OwnMcpServer, type Provider, ProviderAbility, ReplyPlan, type ReplyUsage, RequestedSettings, Resources as ProtocolResources,
  SharedMcpHeader, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";
import { AgentSdkQueryFactory, ClaudeAdapter, InvalidOperationException, ProcessCommand, ProviderAbilityTable, ProviderStoppedException, ProviderTimings, Resources, SharedMcpLaunch,
  ToolsUnavailableException } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { ClaudeModelListRecording } from "../../fixtures/claude-model-list.recording.js";
import { ClaudeTestHost } from "../../fixtures/claude-test-host.fixture.js";
import { FakeClaudeQuery } from "../../fixtures/fake-claude-query.fixture.js";
import { FailureStep } from "../../fixtures/failure-step.fixture.js";
import { GateStep } from "../../fixtures/gate-step.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingMcpEndpoint } from "../../fixtures/recording-mcp-endpoint.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { RunningProgramsStarter } from "../../fixtures/running-programs-starter.fixture.js";
import { SdkMessages } from "../../fixtures/sdk-messages.fixture.js";
import { StampedStep } from "../../fixtures/stamped-step.fixture.js";
import { ToolAskStep } from "../../fixtures/tool-ask-step.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { WaitForCloseStep } from "../../fixtures/wait-for-close-step.fixture.js";
import { WaitForInputStep } from "../../fixtures/wait-for-input-step.fixture.js";
import { WaitForInterruptStep } from "../../fixtures/wait-for-interrupt-step.fixture.js";

@TestClass
export class ClaudeAdapterTests {
  @TestMethod
  public async offKeepsThePersonsServersAndConnectorsOutOfTheTurnAndOnPassesThePersonsServersAndAsksForTheirTools(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const off = host.createProvider();
    mkdirSync(off.profileDir, { recursive: true });
    writeFileSync(join(off.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" }, teamrun: { url: "http://127.0.0.1/mcp" }, broken: "text", list: [] } }));
    const denied = new ToolAskStep("mcp__docs__read", {}, "tu-off");
    const offQuery = new FakeClaudeQuery([SdkMessages.init("s-off", "none", null, []), denied, SdkMessages.success("s-off", "done")]);
    host.factory.next = offQuery;
    await adapter.runTurn(host.createRequest("Off", off), new RecordingTurnListener(), new AbortController().signal);
    const offOptions = host.factory.lastOptions;
    const offServers = JSON.stringify(offQuery.servers);

    const asked = new ToolAskStep("mcp__docs__read", {}, "tu-on");
    const connector = new ToolAskStep("mcp__claude_ai_Files__list", {}, "tu-connector");
    const onQuery = new FakeClaudeQuery([SdkMessages.init("s-on", "none", null, []), asked, connector, SdkMessages.success("s-on", "done")]);
    host.factory.next = onQuery;
    const listener = new RecordingTurnListener();
    await adapter.runTurn(host.createRequest("On", off.withOwnMcpServers(true)), listener, new AbortController().signal);
    const onOptions = host.factory.lastOptions;
    await adapter.shutdown();

    Assert.isTrue(offOptions?.strictMcpConfig ?? false);
    Assert.areEqual("mcp__*", offOptions?.disallowedTools?.join(","));
    Assert.areEqual("[]", offServers);
    Assert.areEqual(JSON.stringify({ behavior: "deny", message: Resources.claudeOtherMcpToolDenied }), JSON.stringify(denied.result));
    Assert.isFalse(onOptions?.strictMcpConfig ?? true);
    Assert.areEqual("user", onOptions?.settingSources?.join(","));
    Assert.areEqual(0, onOptions?.disallowedTools?.length);
    Assert.areEqual("{}", JSON.stringify(onOptions?.mcpServers));
    Assert.areEqual(JSON.stringify([{ docs: { command: "docs", env: { TEAMRUN_SENDER_TOKEN: "" } } }]), JSON.stringify(onQuery.servers));
    Assert.areEqual(JSON.stringify(["mcp__docs__read", "mcp__claude_ai_Files__list"]), JSON.stringify(listener.asks.map(t => t.nativeKind)));
  }

  @TestMethod
  public async withTheSwitchOnStartsClaudeWithoutTheSenderTokenAndSetsItForTheFirstTurnsShell(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider();
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" } } }));
    const request = (own: boolean): TurnRequest => new TurnRequest(provider.withOwnMcpServers(own), host.directory.path, "Hi", new RequestedSettings("claude", null, null),
      null, [], null, null, { [ProtocolResources.senderTokenVariable]: "sender-1" });
    const offQuery = new FakeClaudeQuery([SdkMessages.init("s-off", "none", null, []), SdkMessages.success("s-off", "done")]);
    host.factory.next = offQuery;
    await adapter.runTurn(request(false), new RecordingTurnListener(), new AbortController().signal);
    const offToken = host.factory.lastOptions?.env?.[ProtocolResources.senderTokenVariable];
    const onQuery = new FakeClaudeQuery([SdkMessages.init("s-on", "none", null, []), SdkMessages.success("s-on", "done")]);
    host.factory.next = onQuery;

    const result = await adapter.runTurn(request(true), new RecordingTurnListener(), new AbortController().signal);
    const onEnvironment = host.factory.lastOptions?.env ?? {};
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("sender-1|[]", `${offToken}|${JSON.stringify(offQuery.flagSettings)}`);
    Assert.isFalse(Object.hasOwn(onEnvironment, ProtocolResources.senderTokenVariable));
    Assert.areEqual(JSON.stringify([{ env: { [ProtocolResources.senderTokenVariable]: "sender-1" } }]), JSON.stringify(onQuery.flagSettings));
    Assert.areEqual(JSON.stringify([{ docs: { command: "docs", env: { TEAMRUN_SENDER_TOKEN: "" } } }]), JSON.stringify(onQuery.servers));
  }

  @TestMethod
  public async endsAChatTurnOnTheUsageLimitWithItsResetWhenClaudeRejectsTheAccountWhileItReplies(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-limit", "none", null, []),
      SdkMessages.assistant("66666666-6666-6666-6666-666666666666", [SdkMessages.text("Working")], "claude-opus-5"),
      SdkMessages.rateLimit("s-limit", "rejected", 1_800_000_000, "rejected"),
      SdkMessages.limited("77777777-7777-7777-7777-777777777777", "You've hit your limit"), SdkMessages.success("s-limit", "You've hit your limit")]);

    const result = await adapter.runTurn(new TurnRequest(host.createProvider(), host.directory.path, "Hi", new RequestedSettings("claude", null, null), null),
      new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual(Resources.formatUsageLimitReached(Resources.claudeDisplayName), result.error);
    Assert.areEqual(new Date(1_800_000_000_000).toISOString(), result.limit?.resetsAt);
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async endsAWakeClaudeStartsItselfOnTheUsageLimitWhenTheRejectionComesBeforeOrAfterTheWakesFirstMessage(early: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const rejected = SdkMessages.rateLimit("s-woken", "rejected", 1_800_000_000, "rejected");
    const first = SdkMessages.assistant("55555555-5555-5555-5555-555555555555", [SdkMessages.text("Checking")], "claude-opus-5");
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-woken", "none", null, []),
      SdkMessages.taskStarted("s-woken", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-woken", "Started")),
      SdkMessages.taskNotification("s-woken", "server", "completed", host.directory.resolve("missing.output")),
      ...early ? [rejected, first] : [first, rejected],
      SdkMessages.limited("44444444-4444-4444-4444-444444444444", "You've hit your limit"),
      SdkMessages.success("s-woken", "You've hit your limit"),
      new WaitForCloseStep()
    ]);
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({ TEAMRUN_SENDER_TOKEN: "wake-token" });
    await listener.wakeTurn.useToolsAsync(ClaudeAdapterTests.toolsOf(new RecordingMcpEndpoint(tokens, "wake")));
    const woken = listener.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    await adapter.runTurn(ClaudeAdapterTests.senderRequest(host, "Start", null, new RecordingMcpEndpoint(tokens, "turn"), "turn-token"), listener,
      new AbortController().signal);
    tokens.close("turn");
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Failed, reply.outcome);
    Assert.areEqual(new Date(1_800_000_000_000).toISOString(), reply.limit?.resetsAt);
  }

  @TestMethod
  public async withTheSwitchOnNotesTheTurnWhenClaudeRefusesTheFirstTurnsSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    const query = new FakeClaudeQuery([SdkMessages.init("s-refused", "none", null, []), SdkMessages.success("s-refused", "done")]);
    query.flagSettingsFailure = new Error("settings closed");
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(new TurnRequest(provider, host.directory.path, "Hi", new RequestedSettings("claude", null, null), null, [], null, null,
      { [ProtocolResources.senderTokenVariable]: "sender-1" }), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isFalse(Object.hasOwn(host.factory.lastOptions?.env ?? {}, ProtocolResources.senderTokenVariable));
    Assert.isTrue(listener.texts.some(t => t.startsWith(Resources.formatClaudeSenderRefused("")) && t.includes("settings closed")), JSON.stringify(listener.texts));
  }

  @TestMethod
  public async withTheSwitchOnWaitsForTheServersClaudeStartsItselfBeforeSettingTheFirstTurnsSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" } } }));
    const query = new FakeClaudeQuery([SdkMessages.init("s-slow", "none", null, []), SdkMessages.success("s-slow", "done")]);
    query.serverStatuses = [{ name: "docs", status: "pending" }, { name: "slow", status: "pending" }];
    query.laterServerStatuses.push([{ name: "docs", status: "pending" }, { name: "slow", status: "connected" }]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(new TurnRequest(provider, host.directory.path, "Hi", new RequestedSettings("claude", null, null), null, [], null, null,
      { [ProtocolResources.senderTokenVariable]: "sender-1" }), listener, new AbortController().signal);
    await Wait.until(() => host.timer.begun === 1, "The timer did not begin a wait.");
    const whilePending = JSON.stringify([query.flagSettings, query.inputs.length]);
    host.timer.advance(Resources.claudeServerSettleInterval);
    const result = await running;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("[[],0]", whilePending);
    Assert.areEqual(2, query.serverStatusReads);
    Assert.areEqual(JSON.stringify([{ env: { [ProtocolResources.senderTokenVariable]: "sender-1" } }]), JSON.stringify(query.flagSettings));
    Assert.isFalse(listener.texts.includes(Resources.claudeSenderLeftOut));
  }

  @TestMethod
  public async withTheSwitchOnLeavesTheSenderTokenOutAndNotesTheTurnWhenAServerClaudeStartsItselfStillStartsAfterTheWait(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    const query = new FakeClaudeQuery([SdkMessages.init("s-stuck", "none", null, []), SdkMessages.success("s-stuck", "done")]);
    query.serverStatuses = [{ name: "stuck", status: "pending" }];
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const reads = Resources.claudeServerSettleTimeout / Resources.claudeServerSettleInterval + 1;

    const running = adapter.runTurn(new TurnRequest(provider, host.directory.path, "Hi", new RequestedSettings("claude", null, null), null, [], null, null,
      { [ProtocolResources.senderTokenVariable]: "sender-1" }), listener, new AbortController().signal);
    for (let delay = 1; delay < reads; delay += 1) {
      await Wait.until(() => host.timer.begun === delay, "The timer did not begin the next wait.");
      host.timer.advance(Resources.claudeServerSettleInterval);
    }
    const result = await running;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(reads, query.serverStatusReads);
    Assert.areEqual(JSON.stringify([{ env: { [ProtocolResources.senderTokenVariable]: "" } }]), JSON.stringify(query.flagSettings));
    Assert.isTrue(listener.texts.includes(Resources.claudeSenderLeftOut), JSON.stringify(listener.texts));
  }

  @TestMethod
  public async withTheSwitchOnLeavesTheSenderTokenOutAndNotesTheTurnWhenTheStateOfClaudesServersCannotBeRead(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const provider = host.createProvider().withOwnMcpServers(true);
    const query = new FakeClaudeQuery([SdkMessages.init("s-unread", "none", null, []), SdkMessages.success("s-unread", "done")]);
    query.serverStatusFailure = new Error("status closed");
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(new TurnRequest(provider, host.directory.path, "Hi", new RequestedSettings("claude", null, null), null, [], null, null,
      { [ProtocolResources.senderTokenVariable]: "sender-1" }), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([{ env: { [ProtocolResources.senderTokenVariable]: "" } }]), JSON.stringify(query.flagSettings));
    Assert.isTrue(listener.texts.includes(Resources.claudeSenderLeftOut), JSON.stringify(listener.texts));
    Assert.isTrue(log.lines.some(t => t.includes("status closed")), JSON.stringify(log.lines));
  }

  @TestMethod
  public async withTheSwitchOnWaitsForTheServersClaudeStartsItselfBeforeEachLaterTurnsSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-later", "none", null, []),
      SdkMessages.taskStarted("s-later", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-later", "First")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-later", "Second")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const request = (prompt: string, resume: string | null, token: string): TurnRequest => new TurnRequest(provider, host.directory.path, prompt,
      new RequestedSettings("claude", null, null), resume, [], null, null, { [ProtocolResources.senderTokenVariable]: token });

    try {
      await adapter.runTurn(request("First", null, "token-one"), new RecordingTurnListener(), new AbortController().signal);
      query.serverStatuses = [{ name: "late", status: "pending" }];
      query.laterServerStatuses.push([{ name: "late", status: "connected" }]);
      const next = adapter.runTurn(request("Second", "s-later", "token-two"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => host.timer.begun === 1, "The timer did not begin a wait.");
      const whilePending = query.flagSettings.length;
      host.timer.advance(Resources.claudeServerSettleInterval);

      Assert.areEqual(TurnOutcome.Completed, (await next).outcome);
      Assert.areEqual(1, host.factory.queries.length);
      Assert.areEqual(1, whilePending);
      Assert.areEqual(JSON.stringify(["token-one", "token-two"]), JSON.stringify(query.flagSettings.map(t => t.env?.[ProtocolResources.senderTokenVariable])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async withTheSwitchOnWaitsUntilClaudeListsTheProjectsMcpJsonServersBeforeSettingTheFirstTurnsSenderTokenSkippingThoseTurnedOff(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    mkdirSync(provider.profileDir, { recursive: true });
    const work = join(host.directory.path, "sub");
    mkdirSync(work, { recursive: true });
    writeFileSync(join(host.directory.path, ".mcp.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" }, off: { command: "off" } } }));
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ projects: {
      [realpathSync(host.directory.path).replaceAll("\\", "/")]: { disabledMcpjsonServers: ["off"] } } }));
    const query = new FakeClaudeQuery([SdkMessages.init("s-listed", "none", null, []), SdkMessages.success("s-listed", "done")]);
    query.laterServerStatuses.push([{ name: "docs", status: "pending" }], [{ name: "docs", status: "connected" }]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(new TurnRequest(provider, work, "Hi", new RequestedSettings("claude", null, null), null, [], null, null,
      { [ProtocolResources.senderTokenVariable]: "sender-1" }), listener, new AbortController().signal);
    await Wait.until(() => host.timer.begun === 1, "The timer did not begin a wait while Claude listed no server.");
    const unlisted = query.flagSettings.length;
    host.timer.advance(Resources.claudeServerSettleInterval);
    await Wait.until(() => host.timer.begun === 2, "The timer did not begin a wait while the server was pending.");
    const pending = query.flagSettings.length;
    host.timer.advance(Resources.claudeServerSettleInterval);
    const result = await running;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("0,0,3", [unlisted, pending, query.serverStatusReads].join(","));
    Assert.areEqual(JSON.stringify([{ env: { [ProtocolResources.senderTokenVariable]: "sender-1" } }]), JSON.stringify(query.flagSettings));
    Assert.isFalse(listener.texts.includes(Resources.claudeSenderLeftOut));
  }

  @TestMethod
  public async withTheSwitchOnLogsAnUnreadableMcpJsonAndSetsTheFirstTurnsSenderTokenOnceNoListedServerIsPending(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const provider = host.createProvider().withOwnMcpServers(true);
    writeFileSync(join(host.directory.path, ".mcp.json"), "{ not json");
    const query = new FakeClaudeQuery([SdkMessages.init("s-unread", "none", null, []), SdkMessages.success("s-unread", "done")]);
    host.factory.next = query;

    const result = await adapter.runTurn(new TurnRequest(provider, host.directory.path, "Hi", new RequestedSettings("claude", null, null), null, [], null, null,
      { [ProtocolResources.senderTokenVariable]: "sender-1" }), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("1,0", [query.serverStatusReads, host.timer.begun].join(","));
    Assert.areEqual(JSON.stringify([{ env: { [ProtocolResources.senderTokenVariable]: "sender-1" } }]), JSON.stringify(query.flagSettings));
    Assert.isTrue(log.lines.some(t => t.startsWith(Resources.formatClaudeProjectServersUnread(String.empty))), JSON.stringify(log.lines));
  }

  @TestMethod
  public async withTheSwitchOnLogsAnMcpJsonItCantOpenOrThatIsTooLargeNamingTheFile(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const provider = host.createProvider().withOwnMcpServers(true);
    const [folder, large] = [host.directory.resolve("folder"), host.directory.resolve("large")];
    mkdirSync(join(folder, ".mcp.json"), { recursive: true });
    mkdirSync(large, { recursive: true });
    writeFileSync(join(large, ".mcp.json"), "{}");
    truncateSync(join(large, ".mcp.json"), Resources.maximumConfigurationBytes + 1);
    const outcomes: TurnOutcome[] = [];
    for (const [index, directory] of [folder, large].entries()) {
      host.factory.next = new FakeClaudeQuery([SdkMessages.init(`s-file-${index}`, "none", null, []), SdkMessages.success(`s-file-${index}`, "done")]);
      outcomes.push((await adapter.runTurn(new TurnRequest(provider, directory, "Hi", new RequestedSettings("claude", null, null), null, [], null, null,
        { [ProtocolResources.senderTokenVariable]: "sender-1" }), new RecordingTurnListener(), new AbortController().signal)).outcome);
    }
    await adapter.shutdown();

    Assert.areEqual([TurnOutcome.Completed, TurnOutcome.Completed].join(","), outcomes.join(","));
    for (const error of [Resources.formatOwnMcpConfigUnreadable(join(realpathSync(folder), ".mcp.json")), Resources.formatOwnMcpConfigTooLarge(join(realpathSync(large), ".mcp.json"))])
      Assert.isTrue(log.lines.some(t => t.startsWith(Resources.formatClaudeProjectServersUnread(error))), JSON.stringify(log.lines));
  }

  @TestMethod
  public async withTheSwitchOnWaitsUntilClaudeListsEachServerItsInitNamedBeforeALaterTurnsSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-named", "none", null, [{ name: "plugin", status: "pending" }]),
      SdkMessages.taskStarted("s-named", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-named", "First")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-named", "Second")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const request = (prompt: string, resume: string | null, token: string): TurnRequest => new TurnRequest(provider, host.directory.path, prompt,
      new RequestedSettings("claude", null, null), resume, [], null, null, { [ProtocolResources.senderTokenVariable]: token });

    try {
      await adapter.runTurn(request("First", null, "token-one"), new RecordingTurnListener(), new AbortController().signal);
      query.laterServerStatuses.push([{ name: "plugin", status: "connected" }]);
      const next = adapter.runTurn(request("Second", "s-named", "token-two"), new RecordingTurnListener(), new AbortController().signal);
      await Wait.until(() => host.timer.begun === 1, "The timer did not begin a wait while Claude listed no server.");
      const whileUnlisted = query.flagSettings.length;
      host.timer.advance(Resources.claudeServerSettleInterval);

      Assert.areEqual(TurnOutcome.Completed, (await next).outcome);
      Assert.areEqual(1, host.factory.queries.length);
      Assert.areEqual(1, whileUnlisted);
      Assert.areEqual(JSON.stringify(["token-one", "token-two"]), JSON.stringify(query.flagSettings.map(t => t.env?.[ProtocolResources.senderTokenVariable])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async aSwitchChangeStartsANewChatAndTeamRunsOwnEntriesWinOverTheSameName(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider();
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { search: { command: "mine" }, docs: { command: "docs" } } }));
    const shared = new SharedMcpServerDefinition("search", SharedMcpTransport.Http, null, [], [], "https://search.example/mcp", [], null);
    const first = new FakeClaudeQuery([SdkMessages.init("s-a", "none", null, []), SdkMessages.taskStarted("s-a", "server", undefined, true, "npm start"),
      SdkMessages.success("s-a", "done"), new WaitForCloseStep()]);
    const second = new FakeClaudeQuery([SdkMessages.init("s-a", "none", null, []), SdkMessages.success("s-a", "done")]);
    host.factory.next = first;
    host.factory.queued.push(second);
    const request = host.createRequest("First", provider);

    await adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal);
    await adapter.runTurn(new TurnRequest(provider.withOwnMcpServers(true), request.workingDirectory, "Second", request.requested, "s-a", [], null, null, {}, false, null, [shared]),
      new RecordingTurnListener(), new AbortController().signal);
    await Wait.until(() => first.closeCount === 1, "The first query was not closed.");
    await adapter.shutdown();

    Assert.areEqual(2, host.factory.queries.length);
    Assert.areEqual(JSON.stringify(["docs", "search"]), JSON.stringify(Object.keys(second.servers[0] ?? {}).sort()));
    Assert.areEqual("https://search.example/mcp", (second.servers[0]?.["search"] as { url?: string } | undefined)?.url);
  }

  @TestMethod
  public async expandsVariablesInThePersonsServersFromClaudesEnvironmentAndWithholdsTheSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: {
      tool: { command: "${LIVE_VALUE}/run", args: ["--key=${LIVE_VALUE}", "${LIVE_MISSING:-fallback}", "${LIVE_MISSING}", "${TEAMRUN_SENDER_TOKEN}"], env: { KEY: "${LIVE_VALUE}" }, note: "${LIVE_VALUE}" },
      site: { type: "http", url: "https://${LIVE_VALUE}.example/mcp", headers: { Authorization: "Bearer ${LIVE_VALUE}" } },
      bare: { command: "bare", args: [1] }
    } }));
    const query = new FakeClaudeQuery([SdkMessages.init("s-vars", "none", null, []), SdkMessages.success("s-vars", "done")]);
    host.factory.next = query;
    const request = host.createRequest("Variables", provider);

    await adapter.runTurn(new TurnRequest(provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null,
      { LIVE_VALUE: "value", TEAMRUN_SENDER_TOKEN: "sender" }, false, null), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([{
      tool: { command: "value/run", args: ["--key=value", "fallback", "${LIVE_MISSING}", "${TEAMRUN_SENDER_TOKEN}"], env: { KEY: "value", TEAMRUN_SENDER_TOKEN: "" }, note: "${LIVE_VALUE}" },
      site: { type: "http", url: "https://value.example/mcp", headers: { Authorization: "Bearer value" } },
      bare: { command: "bare", args: [1], env: { TEAMRUN_SENDER_TOKEN: "" } }
    }]), JSON.stringify(query.servers));
  }

  @TestMethod
  public async passesTheLocalServersOfTheTurnsRepositoryOverThePersonsAndListsEveryProjectsOnce(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    const folder = (...parts: string[]): string => {
      const path = join(host.directory.path, ...parts);
      mkdirSync(path, { recursive: true });
      return path;
    };
    const repository = folder("repo");
    const pointed = folder("repo", ".git", "worktrees", "tree");
    const worktree = folder("tree");
    const barePointed = folder("bare", "worktrees", "tree");
    const bareWorktree = folder("bareTree");
    const submodule = folder("module");
    const odd = folder("odd");
    const plain = folder("plain");
    const empty = folder("empty");
    writeFileSync(join(pointed, "commondir"), "../..\n");
    writeFileSync(join(worktree, ".git"), `gitdir: ${realpathSync(pointed)}\n`);
    writeFileSync(join(barePointed, "commondir"), "../..\n");
    writeFileSync(join(bareWorktree, ".git"), `gitdir: ${realpathSync(barePointed)}\n`);
    writeFileSync(join(submodule, ".git"), "gitdir: ../repo/.git/modules/module\n");
    writeFileSync(join(odd, ".git"), "no pointer\n");
    const keyOf = (path: string): string => realpathSync(path).replaceAll("\\", "/");
    const local = (name: string): { mcpServers: Record<string, { args: string[] }> } => ({ mcpServers: { [name]: { args: ["local"] } } });
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({
      mcpServers: { both: { args: ["user"] }, person: { args: ["user"] } },
      projects: {
        [keyOf(repository)]: { mcpServers: { both: { args: ["local"] }, inRepository: { args: ["local"] }, teamrun: { args: ["local"] } } },
        [keyOf(bareWorktree)]: local("inBare"),
        [keyOf(submodule)]: local("inModule"),
        [keyOf(odd)]: local("inOdd"),
        [keyOf(plain)]: local("inPlain"),
        [keyOf(empty)]: {},
        elsewhere: "text"
      }
    }));
    const serversIn = async (workingDirectory: string): Promise<string> => {
      const query = new FakeClaudeQuery([SdkMessages.init("s-local", "none", null, []), SdkMessages.success("s-local", "done")]);
      host.factory.next = query;
      const request = host.createRequest("Local", provider);
      await adapter.runTurn(new TurnRequest(provider, workingDirectory, request.prompt, request.requested, null), new RecordingTurnListener(), new AbortController().signal);
      return Object.entries(query.servers[0] ?? {}).map(([name, server]) => `${name}:${String((server as { args?: string[] }).args?.[0])}`).join();
    };

    const inRepository = "both:local,person:user,inRepository:local";
    Assert.areEqual(inRepository, await serversIn(repository));
    Assert.areEqual(inRepository, await serversIn(folder("repo", "sub")));
    Assert.areEqual(inRepository, await serversIn(worktree));
    Assert.areEqual("both:user,person:user,inBare:local", await serversIn(bareWorktree));
    Assert.areEqual("both:user,person:user,inModule:local", await serversIn(submodule));
    Assert.areEqual("both:user,person:user,inOdd:local", await serversIn(odd));
    Assert.areEqual("both:user,person:user,inPlain:local", await serversIn(plain));
    Assert.areEqual("both:user,person:user", await serversIn(empty));
    Assert.areEqual("both,person,inRepository,inBare,inModule,inOdd,inPlain", (await adapter.listOwnMcpServers(provider)).map(t => t.name).join());
    await adapter.shutdown();
  }

  @TestMethod
  public async loadsTheProjectAndLocalSettingsOnlyInAFolderClaudesOwnTrustStoreMarksTrusted(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const provider = host.createProvider();
    mkdirSync(provider.profileDir, { recursive: true });
    const keyOf = (folder: string): string => realpathSync(folder).replaceAll("\\", "/");
    const sources = async (config: string | null): Promise<string> => {
      if (!Object.isNull(config))
        writeFileSync(join(provider.profileDir, ".claude.json"), config);
      host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-trust", "none", null, []), SdkMessages.success("s-trust", "done")]);
      await adapter.runTurn(host.createRequest("Hi", provider), new RecordingTurnListener(), new AbortController().signal);
      return host.factory.lastOptions?.settingSources?.join(",") ?? "none";
    };

    const missing = await sources(null);
    const trusted = await sources(JSON.stringify({ projects: { [keyOf(host.directory.path)]: { hasTrustDialogAccepted: true } } }));
    const parent = await sources(JSON.stringify({ projects: { [keyOf(join(host.directory.path, ".."))]: { hasTrustDialogAccepted: true } } }));
    const declined = await sources(JSON.stringify({ projects: { [keyOf(host.directory.path)]: { hasTrustDialogAccepted: false } } }));
    const other = await sources(JSON.stringify({ projects: { [keyOf(provider.profileDir)]: { hasTrustDialogAccepted: true } } }));
    const unreadable = await sources("{ not json");
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify(["user", "user,project,local", "user,project,local", "user", "user", "user"]),
      JSON.stringify([missing, trusted, parent, declined, other, unreadable]));
    Assert.areEqual(1, log.lines.filter(t => t.startsWith("Claude's folder trust wasn't read")).length);
  }

  @TestMethod
  public async keepsClaudesReasonForASharedServerThatWonAnOwnServersName(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const provider = host.createProvider().withOwnMcpServers(true);
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { search: { command: "mine" } } }));
    const shared = new SharedMcpServerDefinition("search", SharedMcpTransport.Http, null, [], [], "https://search.example/mcp", [], null);
    const query = new FakeClaudeQuery([SdkMessages.init("s-won", "none", null, []), SdkMessages.success("s-won", "done")]);
    query.serversErrors = { search: "refused" };
    host.factory.next = query;
    const request = host.createRequest("Shared", provider);

    await adapter.runTurn(new TurnRequest(provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, null, [shared]),
      new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.isTrue(log.lines.includes(Resources.formatClaudeServerNotSet("search", "refused")));
  }

  @TestMethod
  public async thePersonsServerSettingsReachNoLogAndNoFailureWhenClaudeRefusesThem(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const provider = host.createProvider().withOwnMcpServers(true);
    const token = "own-server-token-value";
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { docs: { command: "docs", env: { KEY: token } } } }));
    const refused = new FakeClaudeQuery([SdkMessages.init("s-no", "none", null, []), SdkMessages.success("s-no", "done")]);
    refused.serversErrors = { docs: `bad settings: ${token}` };
    host.factory.next = refused;

    const kept = await adapter.runTurn(host.createRequest("Refused", provider), new RecordingTurnListener(), new AbortController().signal);
    const failing = new FakeClaudeQuery([SdkMessages.init("s-throw", "none", null, []), SdkMessages.success("s-throw", "done")]);
    failing.serversFailure = new Error(`bad settings: ${token}`);
    host.factory.next = failing;
    const failed = await Assert.throwsAsync(() => adapter.runTurn(host.createRequest("Failing", provider), new RecordingTurnListener(), new AbortController().signal), ToolsUnavailableException);
    writeFileSync(join(provider.profileDir, ".claude.json"), `{ "mcpServers": { "docs": { "env": { "KEY": "${token}" } } }, not json`);
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-bad", "none", null, []), SdkMessages.success("s-bad", "done")]);
    await adapter.runTurn(host.createRequest("Unreadable", provider), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, kept.outcome);
    Assert.areEqual(Resources.claudeOwnServersNotSet, failed.message);
    Assert.isTrue(log.lines.includes(Resources.formatClaudeOwnServerNotSet("docs")));
    Assert.isFalse(log.lines.some(t => t.includes(token)));
    Assert.isFalse(JSON.stringify(host.factory.optionsList).includes(token));
  }

  @TestMethod
  public async aTurnWithTheSwitchOnStartsWithoutThePersonsServersWhenTheirFileCannotBeReadAndLogsIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const provider = host.createProvider().withOwnMcpServers(true);
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), "{ not json");
    const query = new FakeClaudeQuery([SdkMessages.init("s-bad", "none", null, []), SdkMessages.success("s-bad", "done")]);
    host.factory.next = query;

    const result = await adapter.runTurn(host.createRequest("Bad", provider), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("[]", JSON.stringify(query.servers));
    Assert.isFalse(host.factory.lastOptions?.strictMcpConfig ?? true);
    Assert.isTrue(log.lines.some(t => t.startsWith("Claude's own MCP servers weren't read")));
  }

  @TestMethod
  public async aTurnWithTheSwitchOnStartsWithoutThePersonsServersWhenItsFolderIsGoneAndLogsIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);
    const provider = host.createProvider().withOwnMcpServers(true);
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" } } }));
    const query = new FakeClaudeQuery([SdkMessages.init("s-gone", "none", null, []), SdkMessages.success("s-gone", "done")]);
    host.factory.next = query;
    const request = host.createRequest("Gone", provider);

    const result = await adapter.runTurn(new TurnRequest(provider, join(host.directory.path, "gone"), request.prompt, request.requested, null),
      new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("[]", JSON.stringify(query.servers));
    Assert.isTrue(log.lines.some(t => t.startsWith("Claude's own MCP servers weren't read")));
  }

  @TestMethod
  public saysItsTurnsTakeTeamRunsTools(): void {
    using host = new ClaudeTestHost();

    Assert.isTrue(host.createAdapter().takesTeamRunTools);
  }

  @TestMethod
  public async leavesThePersonsOwnServersOutOfATitleSession(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider().withOwnMcpServers(true);
    mkdirSync(provider.profileDir, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" } } }));
    const query = new FakeClaudeQuery([SdkMessages.init("s-own-title", "none", null, []), SdkMessages.success("s-own-title", "The title")]);
    host.factory.next = query;
    const request = host.createRequest("Name this chat", provider);

    await TitleTurn.ask(adapter, new TurnRequest(provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, null, [], null,
      undefined, SharedMcpValues.none, null, true), new AbortController().signal);
    await adapter.shutdown();
    const options = host.factory.lastOptions;
    Assert.isDefined(options);

    Assert.areEqual(0, query.servers.length);
    Assert.isTrue(options.strictMcpConfig ?? false);
    Assert.areEqual("mcp__*", options.disallowedTools?.join(","));
  }

  @TestMethod
  public async leavesThePersonsMemoryToClaudeCodeInAChatTurnAndTurnsItOffForATitleSessionWithNoToolToSaveToIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const profile = host.directory.resolve(".claude");
    const adapter = host.createAdapter({ ...host.environment, CLAUDE_CODE_DISABLE_AUTO_MEMORY: undefined });
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-1", "none", null, []), SdkMessages.success("s-1", "done")]);
    await adapter.runTurn(host.createRequest("Remember tabs", host.createProvider("acc-1", ".claude")), new RecordingTurnListener(), new AbortController().signal);
    const options = host.factory.lastOptions;
    const chat = [options?.env?.["CLAUDE_CODE_DISABLE_AUTO_MEMORY"] ?? null, options?.env?.["CLAUDE_CONFIG_DIR"] ?? null, options?.settingSources?.join(",") ?? null,
      options?.disallowedTools?.join(",") ?? null];
    await adapter.shutdown();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-title", "none", null, []), SdkMessages.success("s-title", "The title")]);
    const request = host.createRequest("Name this chat");

    await TitleTurn.ask(adapter, new TurnRequest(null, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, null, [], null,
      () => false, SharedMcpValues.none, null, true), new AbortController().signal);
    const title = host.factory.lastOptions;
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([null, profile, "user", "mcp__*"]), JSON.stringify(chat));
    Assert.areEqual("[]", JSON.stringify(title?.tools));
    Assert.areEqual("1", title?.env?.["CLAUDE_CODE_DISABLE_AUTO_MEMORY"]);
  }

  @TestMethod
  public async asksForATitleWithNoToolsInASessionItKeepsNowhereAndClosesIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-title", "none", null, []), SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.text("The title")], "claude-opus-5"),
      SdkMessages.success("s-title", "The title")]);
    host.factory.next = query;
    const request = host.createRequest("Name this chat");

    const answer = await TitleTurn.ask(adapter, new TurnRequest(null, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, null, [], null,
      () => false, SharedMcpValues.none, null, true), new AbortController().signal);
    const options = host.factory.lastOptions;
    Assert.isDefined(options);

    Assert.areEqual("The title", answer);
    Assert.areEqual("[]", JSON.stringify(options.tools));
    Assert.isFalse(options.persistSession ?? true);
    Assert.areEqual(1, options.maxTurns);
    Assert.areEqual(String.empty, options.systemPrompt);
    Assert.areEqual("[]", JSON.stringify(options.settingSources));
    Assert.areEqual("{}", JSON.stringify(options.mcpServers));
    while (query.closeCount === 0)
      await new Promise(resolve => setImmediate(resolve));
    await adapter.shutdown();

    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-chat", "none", null, []), SdkMessages.success("s-chat", "done")]);
    await adapter.runTurn(host.createRequest("A chat's turn"), new RecordingTurnListener(), new AbortController().signal);
    const usual = host.factory.lastOptions;
    await adapter.shutdown();
    Assert.isDefined(usual);
    Assert.isUndefined(usual.tools);
    Assert.isUndefined(usual.persistSession);
  }

  @TestMethod
  public async servesTeamRunsToolsAtTheEndpointWithTheChatsOwnTokenAndAllowsAReadOnlyOneWithoutAskingAndRefusesOtherMcpTools(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const tokens = new SessionTokens();
    const endpoint = new RecordingMcpEndpoint(tokens, "session-1", "member-token");
    const tools = new TurnTools({
      listToolsAsync: () => Promise.resolve([{ name: "teamrun_list_chats", annotations: { readOnlyHint: true } }]), callToolAsync: () => Promise.resolve({})
    }, [], endpoint);
    const own = new ToolAskStep("mcp__teamrun__teamrun_list_chats", { project_id: "p1" }, "tu-own");
    const other = new ToolAskStep("mcp__elsewhere__run", {}, "tu-other");
    const query = new FakeClaudeQuery([SdkMessages.init("s-tools", "none", null, []), own, other, SdkMessages.success("s-tools", "done")]);
    host.factory.next = query;
    const request = host.createRequest("List the chats");

    await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, tools),
      listener, new AbortController().signal);
    const options = host.factory.lastOptions;
    await adapter.shutdown();

    Assert.isDefined(options);
    const token = endpoint.lastIssued;
    Assert.areEqual(1, endpoint.issued.length);
    Assert.areEqual(JSON.stringify([{ teamrun: { type: "http", url: "http://127.0.0.1:4711/mcp", headers: { Authorization: `Bearer ${token}` }, timeout: 420000 } }]),
      JSON.stringify(query.servers));
    Assert.isTrue(token.length > 0);
    Assert.isNull(tokens.find(token));
    Assert.areEqual("{}", JSON.stringify(options.mcpServers));
    Assert.areEqual(0, options.disallowedTools?.length);
    Assert.areEqual(JSON.stringify({ behavior: "allow", updatedInput: { project_id: "p1" } }), JSON.stringify(own.result));
    Assert.areEqual(JSON.stringify({ behavior: "deny", message: "TeamRun lets Claude use only TeamRun's own MCP tools and the shared servers turned on for it." }),
      JSON.stringify(other.result));
    Assert.areEqual(0, listener.asks.length);
    Assert.isFalse([JSON.stringify(options), JSON.stringify(listener)].some(t => t.includes(token) || t.includes("member-token")));
  }

  @TestMethod
  public async runsATeamRunToolTheChatApprovedWithoutACardAndAsksForOneItHasNotApprovedThatRunsOnceAllowed(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow");
    const tools = new TurnTools({
      listToolsAsync: () => Promise.resolve([{ name: "teamrun_delete_chat" }, { name: "teamrun_rename_chat", annotations: { readOnlyHint: false } }]),
      callToolAsync: () => Promise.resolve({})
    }, ["teamrun_delete_chat"], new RecordingMcpEndpoint(new SessionTokens(), "session-1", "member-token"));
    const approved = new ToolAskStep("mcp__teamrun__teamrun_delete_chat", { chat_id: "c1" }, "tu-approved");
    const unapproved = new ToolAskStep("mcp__teamrun__teamrun_rename_chat", { chat_id: "c1", title: "Plans" }, "tu-unapproved");
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-approved", "none", null, []), approved, unapproved, SdkMessages.success("s-approved", "done")]);
    const request = host.createRequest("Tidy the chats");

    await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, tools),
      listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify({ behavior: "allow", updatedInput: { chat_id: "c1" } }), JSON.stringify(approved.result));
    Assert.areEqual(JSON.stringify(["mcp__teamrun__teamrun_rename_chat"]), JSON.stringify(listener.asks.map(t => t.nativeKind)));
    Assert.isTrue(JSON.stringify(unapproved.result).startsWith("{\"behavior\":\"allow\""));
  }

  @TestMethod
  public async asksForATeamRunToolWhenItsListCannotBeRead(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.decisions.push("deny");
    const tools = new TurnTools({ listToolsAsync: () => Promise.reject(new Error("The tools are not listed.")), callToolAsync: () => Promise.resolve({}) },
      [], new RecordingMcpEndpoint(new SessionTokens(), "session-1", "member-token"));
    const asked = new ToolAskStep("mcp__teamrun__teamrun_list_chats", {}, "tu-unlisted");
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-unlisted", "none", null, []), asked, SdkMessages.success("s-unlisted", "done")]);
    const request = host.createRequest("List the chats");

    await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, tools),
      listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(1, listener.asks.length);
    Assert.isTrue(JSON.stringify(asked.result).startsWith("{\"behavior\":\"deny\""));
  }

  @TestMethod
  public async failsTheTurnAndClosesTheChatAndRevokesItsTokenWhenClaudeRefusesItsServers(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const endpoint = new RecordingMcpEndpoint(tokens, "session-1", "member-token");
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [], endpoint);
    const query = new FakeClaudeQuery([SdkMessages.init("s-refused", "none", null, []), SdkMessages.success("s-refused", "done")]);
    query.serversFailure = new Error("The servers weren't set.");
    host.factory.next = query;
    const request = host.createRequest("List the chats");

    await Assert.throwsAsync(() => adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null,
      {}, false, tools), new RecordingTurnListener(), new AbortController().signal), Error);

    const [token] = endpoint.issued;
    Assert.areEqual(1, endpoint.issued.length);
    Assert.isDefined(token);
    Assert.isNull(tokens.find(token));
    Assert.areEqual(1, query.closeCount);
    Assert.areEqual(0, query.inputs.length);
  }

  @TestMethod
  public async adoptsTheChatsKeptTokenIntoTheNextTurnOnTheOpenQueryAndRevokesItWhenTheChatCloses(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const first = new RecordingMcpEndpoint(tokens, "turn-1");
    const second = new RecordingMcpEndpoint(tokens, "turn-2");
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-kept", "none", null, []),
      SdkMessages.taskStarted("s-kept", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-kept", "Started")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-kept", "Second")),
      new WaitForCloseStep()
    ]);

    await adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "Start", null, first), new RecordingTurnListener(), new AbortController().signal);
    tokens.close("turn-1");
    const next = await adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "Next", "s-kept", second), new RecordingTurnListener(), new AbortController().signal);
    const during = tokens.find(first.lastIssued);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, next.outcome);
    Assert.areEqual(1, host.factory.queries.length);
    Assert.areEqual("1,0", [first.issued.length, second.issued.length].join(","));
    Assert.areEqual("turn-2", during);
    Assert.isNull(tokens.find(first.lastIssued));
  }

  @TestMethod
  public async keepsTheSenderTokenOutOfAServedChatsEnvironmentAndItsNextTurnsSoServersClaudeStartsItselfNeverGetIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-kept", "none", null, []),
      SdkMessages.taskStarted("s-kept", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-kept", "Started")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-kept", "Second")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;

    await adapter.runTurn(ClaudeAdapterTests.senderRequest(host, "Start", null, new RecordingMcpEndpoint(tokens, "turn-1"), "first-token"), new RecordingTurnListener(),
      new AbortController().signal);
    tokens.close("turn-1");
    const next = await adapter.runTurn(ClaudeAdapterTests.senderRequest(host, "Next", "s-kept", new RecordingMcpEndpoint(tokens, "turn-2"), "second-token"),
      new RecordingTurnListener(), new AbortController().signal);
    const environment = host.factory.lastOptions?.env;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, next.outcome);
    Assert.areEqual(1, host.factory.queries.length);
    Assert.areEqual("undefined,t1", [String(environment?.["TEAMRUN_SENDER_TOKEN"]), environment?.["TEAMRUN_TEST_VARIABLE"]].join(","));
    Assert.isTrue(query.flagSettings.length > 0);
    Assert.isFalse(JSON.stringify(query.flagSettings).includes("TEAMRUN_SENDER_TOKEN"));
  }

  @TestMethod
  public async keepsAWakesSenderTokenOutOfAServedChat(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-woken", "none", null, []),
      SdkMessages.taskStarted("s-woken", "server", undefined, true, "npm start"),
      SdkMessages.taskStarted("s-woken", "watcher", undefined, true, "npm run watch"),
      new StampedStep(SdkMessages.success("s-woken", "Started")),
      SdkMessages.taskNotification("s-woken", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      SdkMessages.success("s-woken", "Stopped"),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({ TEAMRUN_SENDER_TOKEN: "wake-token" });
    await listener.wakeTurn.useToolsAsync(ClaudeAdapterTests.toolsOf(new RecordingMcpEndpoint(tokens, "wake")));
    const woken = listener.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    await adapter.runTurn(ClaudeAdapterTests.senderRequest(host, "Start", null, new RecordingMcpEndpoint(tokens, "turn"), "turn-token"), listener,
      new AbortController().signal);
    tokens.close("turn");
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual(JSON.stringify([{ env: {} }]), JSON.stringify(query.flagSettings));
  }

  @TestMethod
  public async opensANewQueryForTheChatsNextTurnWhenTheServedToolsChangedSinceTheOpenQueryListedThem(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const served = ["terminal_run"];
    const toolsOf = (session: string): TurnTools => new TurnTools({ listToolsAsync: () => Promise.resolve(served.map(t => ({ name: t }))),
      callToolAsync: () => Promise.resolve({}) }, [], new RecordingMcpEndpoint(tokens, session));
    const request = (prompt: string, resume: string | null, session: string): TurnRequest => new TurnRequest(null, host.directory.path, prompt,
      new RequestedSettings("claude", null, null), resume, [], null, null, {}, false, toolsOf(session));
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-kept", "none", null, []),
      SdkMessages.taskStarted("s-kept", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-kept", "Started")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-kept", "Second")),
      new WaitForCloseStep()
    ]);
    host.factory.queued.push(new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-kept", "none", null, []),
      new StampedStep(SdkMessages.success("s-kept", "Changed")), new WaitForCloseStep()]));

    await adapter.runTurn(request("Start", null, "turn-1"), new RecordingTurnListener(), new AbortController().signal);
    tokens.close("turn-1");
    const next = new RecordingTurnListener();
    await adapter.runTurn(request("Next", "s-kept", "turn-2"), next, new AbortController().signal);
    const kept = host.factory.queries.length;
    tokens.close("turn-2");
    served.push("computer_click");
    const listener = new RecordingTurnListener();
    const changed = await adapter.runTurn(request("Changed", "s-kept", "turn-3"), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, 1, 2]), JSON.stringify([changed.outcome, kept, host.factory.queries.length]));
    Assert.areEqual(JSON.stringify(["", Resources.claudeChatEndedForToolsChange]),
      JSON.stringify([next, listener].map(t => t.details.filter(u => u.kind === DetailKind.Note).map(u => u.text).join("|"))));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async opensANewQueryForTheChatsNextTurnWhenOnlyOneOfItsTurnsServesToolsAndTheirListCannotBeRead(toolsFirst: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const tools = new TurnTools({ listToolsAsync: () => Promise.reject(new Error("The tools are not listed.")), callToolAsync: () => Promise.resolve({}) },
      [], new RecordingMcpEndpoint(new SessionTokens(), "turn-1"));
    const request = (prompt: string, resume: string | null, served: TurnTools | null): TurnRequest => new TurnRequest(null, host.directory.path, prompt,
      new RequestedSettings("claude", null, null), resume, [], null, null, {}, false, served);
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-kept", "none", null, []),
      SdkMessages.taskStarted("s-kept", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-kept", "Started")),
      new WaitForCloseStep()
    ]);
    host.factory.queued.push(new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-kept", "none", null, []),
      new StampedStep(SdkMessages.success("s-kept", "Next")), new WaitForCloseStep()]));

    await adapter.runTurn(request("Start", null, toolsFirst ? tools : null), new RecordingTurnListener(), new AbortController().signal);
    const next = await adapter.runTurn(request("Next", "s-kept", toolsFirst ? null : tools), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, 2]), JSON.stringify([next.outcome, host.factory.queries.length]));
  }

  @TestMethod
  public async adoptsTheChatsKeptTokenIntoTheToolSessionOfAWakeReply(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const turn = new RecordingMcpEndpoint(tokens, "turn");
    const wake = new RecordingMcpEndpoint(tokens, "wake");
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-woken", "none", null, []),
      SdkMessages.taskStarted("s-woken", "server", undefined, true, "npm start"),
      SdkMessages.taskStarted("s-woken", "watcher", undefined, true, "npm run watch"),
      new StampedStep(SdkMessages.success("s-woken", "Started")),
      SdkMessages.taskNotification("s-woken", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      SdkMessages.success("s-woken", "Stopped"),
      new WaitForCloseStep()
    ]);
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    await listener.wakeTurn.useToolsAsync(ClaudeAdapterTests.toolsOf(wake));
    const woken = listener.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    await adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "Start", null, turn), listener, new AbortController().signal);
    tokens.close("turn");
    const reply = await woken;
    const during = tokens.find(turn.lastIssued);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual("1,0", [turn.issued.length, wake.issued.length].join(","));
    Assert.areEqual("wake", during);
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async saysTeamRunsToolsAreUnavailableInAWakeWhoseTokenIsRefusedAndResumesTheNextTurnOnANewChat(expired: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    let now = 0;
    const tokens = new SessionTokens(() => now);
    const turn = new RecordingMcpEndpoint(tokens, "turn");
    const wake = new RecordingMcpEndpoint(tokens, "wake", expired ? "c1/t1" : "c1/t2");
    const next = new RecordingMcpEndpoint(tokens, "next");
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-refused", "none", null, []),
      SdkMessages.taskStarted("s-refused", "server", undefined, true, "npm start"),
      SdkMessages.taskStarted("s-refused", "watcher", undefined, true, "npm run watch"),
      new StampedStep(SdkMessages.success("s-refused", "Started")),
      SdkMessages.taskNotification("s-refused", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.text("The server stopped")], "claude-opus-5"),
      SdkMessages.success("s-refused", "Stopped"),
      new WaitForCloseStep()
    ]);
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-refused", "none", null, []), SdkMessages.success("s-refused", "Again")]));
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({});
    const follower = new RecordingTurnListener();
    const woken = listener.wakeTurn.follow(follower, new AbortController().signal);

    await adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "Start", null, turn), listener, new AbortController().signal);
    if (expired)
      now = CoreResources.sessionTokenLifetime;
    await listener.wakeTurn.useToolsAsync(ClaudeAdapterTests.toolsOf(wake));
    const reply = await woken;
    const again = new RecordingTurnListener();
    const result = await adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "Again", "s-refused", next), again, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual(Resources.claudeWakeToolsRefused, follower.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
    Assert.areEqual(JSON.stringify([Resources.formatClaudeWakeTokenRefused("s-refused")]), JSON.stringify(log.lines));
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(2, host.factory.queries.length);
    Assert.areEqual("s-refused", host.factory.optionsList[1]?.resume);
    Assert.areEqual(1, next.issued.length);
    Assert.areEqual(Resources.claudeChatEndedForTools, again.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
  }

  @TestMethod
  public async resumesTheSessionOnANewQueryWithANewTokenWhenTheOpenChatsTokenHasExpired(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    let now = 0;
    const tokens = new SessionTokens(() => now);
    const first = new RecordingMcpEndpoint(tokens, "turn-1");
    const second = new RecordingMcpEndpoint(tokens, "turn-2");
    const open = new FakeClaudeQuery([
      SdkMessages.init("s-expired", "none", null, []),
      SdkMessages.taskStarted("s-expired", "server", undefined, true, "npm start"),
      SdkMessages.success("s-expired", "Started"),
      new WaitForCloseStep()
    ]);
    host.factory.next = open;
    host.factory.queued.push(new FakeClaudeQuery([
      SdkMessages.init("s-expired", "none", null, []),
      SdkMessages.taskStarted("s-expired", "watcher", undefined, true, "npm run watch"),
      SdkMessages.success("s-expired", "Again"),
      new WaitForCloseStep()
    ]));

    await adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "Start", null, first), new RecordingTurnListener(), new AbortController().signal);
    now = CoreResources.sessionTokenLifetime;
    const again = new RecordingTurnListener();
    const result = await adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "Again", "s-expired", second), again, new AbortController().signal);
    await Wait.until(() => open.closeCount === 1, "The open query was not closed.");
    const live = tokens.find(second.lastIssued);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(2, host.factory.queries.length);
    Assert.areEqual("s-expired", host.factory.optionsList[1]?.resume);
    Assert.areEqual("1,1", [first.issued.length, second.issued.length].join(","));
    Assert.areEqual("turn-2", live);
    Assert.areEqual("server", open.stoppedTasks.join(","));
    Assert.areEqual(Resources.claudeChatEndedForTools, again.details.filter(t => t.kind === DetailKind.Note).map(t => t.text).join("|"));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async resumesTheSessionOnANewQueryWhenTheNextTurnGainsOrLosesTeamRunsTools(gains: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const endpoint = new RecordingMcpEndpoint(new SessionTokens(), "turn");
    const open = new FakeClaudeQuery([
      SdkMessages.init("s-tools-change", "none", null, []),
      SdkMessages.taskStarted("s-tools-change", "server", undefined, true, "npm start"),
      SdkMessages.success("s-tools-change", "Started"),
      new WaitForCloseStep()
    ]);
    host.factory.next = open;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-tools-change", "none", null, []), SdkMessages.success("s-tools-change", "Again")]));
    const request = (prompt: string, resume: string | null, tools: boolean): TurnRequest =>
      tools ? ClaudeAdapterTests.toolRequest(host, prompt, resume, endpoint) : host.createRequest(prompt, null, resume);

    await adapter.runTurn(request("Start", null, !gains), new RecordingTurnListener(), new AbortController().signal);
    const result = await adapter.runTurn(request("Again", "s-tools-change", gains), new RecordingTurnListener(), new AbortController().signal);
    await Wait.until(() => open.closeCount === 1, "The open query was not closed.");
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(2, host.factory.queries.length);
    Assert.areEqual("s-tools-change", host.factory.optionsList[1]?.resume);
    Assert.areEqual(1, endpoint.issued.length);
  }

  @TestMethod
  public async failsTheTurnNamingWhyWhenTeamRunsToolEndpointIsntServing(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-unserved", "none", null, []), SdkMessages.success("s-unserved", "done")]);

    const error = await Assert.throwsAsync(() => adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "List the chats", null, null), new RecordingTurnListener(),
      new AbortController().signal), ToolsUnavailableException);
    await adapter.shutdown();

    Assert.areEqual(Resources.formatToolsNotServed("Claude Code"), error.message);
    Assert.areEqual(0, host.factory.queries.length);
  }

  @TestMethod
  public async logsEachServerClaudeCouldntSet(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const query = new FakeClaudeQuery([SdkMessages.init("s-errors", "none", null, []), SdkMessages.success("s-errors", "done")]);
    query.serversErrors = { [ProtocolResources.mcpServerName]: "connection refused" };
    host.factory.next = query;

    const result = await adapter.runTurn(ClaudeAdapterTests.toolRequest(host, "List the chats", null, new RecordingMcpEndpoint()), new RecordingTurnListener(),
      new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([Resources.formatClaudeServerNotSet(ProtocolResources.mcpServerName, "connection refused")]), JSON.stringify(log.lines));
  }

  @TestMethod
  public async givesAStdioSharedServerItsSetVariablesValuesAndAnHttpOneReferencesForClaudeToReadAndAsksThePersonBeforeItsToolsRun(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow");
    const shared = new ToolAskStep("mcp__search__find", { query: "docs" }, "tu-shared");
    const other = new ToolAskStep("mcp__elsewhere__run", {}, "tu-other");
    const nested = new ToolAskStep("mcp__teamrun__x__find", {}, "tu-nested");
    const query = new FakeClaudeQuery([SdkMessages.init("s-shared", "none", null, []), shared, other, nested, SdkMessages.success("s-shared", "done")]);
    host.factory.next = query;
    const request = host.createRequest("Search");

    await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, { SEARCH_KEY: "s1" }, false,
      null, ClaudeAdapterTests.sharedServers()), listener, new AbortController().signal);
    const options = host.factory.lastOptions!;
    await adapter.shutdown();

    const launch = new SharedMcpLaunch();
    Assert.areEqual(JSON.stringify([{
      search: { type: "stdio", command: launch.program, args: [launch.script, "--variables", "SEARCH_KEY,SEARCH_REGION", "--", "npx", "-y", "search-server"],
        env: { SEARCH_KEY: "s1", ELECTRON_RUN_AS_NODE: "1" } },
      docs: { type: "http", url: "https://docs.example/mcp", headers: { "X-Team": "${DOCS_TEAM}", Authorization: "Bearer ${DOCS_TOKEN}" } }
    }]), JSON.stringify(query.servers));
    Assert.areEqual("{}", JSON.stringify(options.mcpServers));
    Assert.areEqual(0, options.disallowedTools?.length);
    Assert.areEqual(JSON.stringify(["mcp__search__find", "mcp__teamrun__x__find"]), JSON.stringify(listener.asks.map(t => t.nativeKind)));
    Assert.areEqual("allow", (shared.result as { behavior: string }).behavior);
    Assert.areEqual("deny", (other.result as { behavior: string }).behavior);
  }

  @TestMethod
  public async givesAStdioSharedServerTheValueSetSinceTeamRunStarted(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-current", "none", null, []), SdkMessages.success("s-current", "done")]);
    host.factory.next = query;
    host.starter.current = { SEARCH_KEY: "set-later" };
    const request = host.createRequest("Search");

    await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false,
      null, ClaudeAdapterTests.sharedServers().slice(0, 1)), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    Assert.isUndefined(host.environment["SEARCH_KEY"]);
    const launch = new SharedMcpLaunch();
    Assert.areEqual(JSON.stringify([{ search: { type: "stdio", command: launch.program,
      args: [launch.script, "--variables", "SEARCH_KEY,SEARCH_REGION", "--", "npx", "-y", "search-server"], env: { SEARCH_KEY: "set-later", ELECTRON_RUN_AS_NODE: "1" } } }]),
      JSON.stringify(query.servers));
  }

  @TestMethod
  public async reportsEachSharedServerClaudeCouldntConnectToOrThatNeedsASignInWithoutClaudesErrorText(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const query = new FakeClaudeQuery([SdkMessages.init("s-failed", "none", null, []), gate, SdkMessages.success("s-failed", "done")]);
    query.serversErrors = { docs: "401 for Bearer token-value" };
    query.serverStatuses = [{ name: "search", status: "needs-auth" }, { name: "docs", status: "failed", error: "401 for Bearer token-value" },
      { name: "elsewhere", status: "failed" }, { name: ProtocolResources.mcpServerName, status: "connected" }];
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const provider = host.createProvider();
    const request = host.createRequest("Search", provider);

    const running = adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {},
      false, null, ClaudeAdapterTests.sharedServers()), listener, new AbortController().signal);
    await Wait.until(() => listener.sharedFailures.length === 2, "The listener did not see 2 shared server failures.");
    gate.open();
    const result = await running;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(1, query.serverStatusReads);
    Assert.areEqual(JSON.stringify([[provider.id, provider.label, "docs", SharedMcpFailureKind.Connection], [provider.id, provider.label, "search",
      SharedMcpFailureKind.SignIn]]), JSON.stringify(listener.sharedFailures.map(t => [t.providerId, t.providerLabel, t.server, t.kind])));
    Assert.isFalse(JSON.stringify([listener.details, listener.sharedFailures]).includes("token-value"));
  }

  @TestMethod
  public async sendsThePromptWhileASharedServerIsStillConnectingAndReadsItsStateAgainForAtMostItsSettleTimeout(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const gate = new GateStep();
    const query = new FakeClaudeQuery([SdkMessages.init("s-pending", "none", null, []), gate, SdkMessages.success("s-pending", "done")]);
    query.serverStatuses = [{ name: "search", status: "pending" }, { name: "docs", status: "pending" }];
    query.laterServerStatuses.push([{ name: "search", status: "pending" }, { name: "docs", status: "failed", error: "401 for Bearer token-value" }]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const request = host.createRequest("Search");
    const reads = Resources.claudeServerSettleTimeout / Resources.claudeServerSettleInterval + 1;

    const running = adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {},
      false, null, ClaudeAdapterTests.sharedServers()), listener, new AbortController().signal);
    await Wait.until(() => query.inputs.length === 1, "The query got no input.");
    await Wait.until(() => host.timer.begun === 1, "The timer did not begin a wait.");
    const whilePending = [query.serverStatusReads, host.timer.pending, listener.sharedFailures.length];
    for (let delay = 1; delay < reads; delay += 1) {
      await Wait.until(() => host.timer.begun === delay, "The timer did not begin the next wait.");
      host.timer.advance(Resources.claudeServerSettleInterval);
    }
    await Wait.until(() => log.lines.length === 1, "The log did not get its line.");
    gate.open();
    const result = await running;
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([1, 1, 0]), JSON.stringify(whilePending));
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(reads, query.serverStatusReads);
    Assert.areEqual(JSON.stringify([[adapter.descriptor.id, adapter.descriptor.displayName, "docs", SharedMcpFailureKind.Connection]]),
      JSON.stringify(listener.sharedFailures.map(t => [t.providerId, t.providerLabel, t.server, t.kind])));
    Assert.areEqual(JSON.stringify([Resources.formatClaudeServerStillPending("search", Resources.claudeServerSettleTimeout)]), JSON.stringify(log.lines));
    Assert.isFalse(JSON.stringify([listener.details, listener.sharedFailures, log.lines]).includes("token-value"));
  }

  @TestMethod
  public async logsEachSharedServerStillConnectingWhenTheTurnEndsAndNotesNothingFromAStateReadThatAnswersLater(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const query = new FakeClaudeQuery([SdkMessages.init("s-ended", "none", null, []), SdkMessages.success("s-ended", "done")]);
    const read = new GateStep();
    query.serversErrors = { docs: "refused" };
    query.serverStatusGate = read;
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const request = host.createRequest("Search");

    const result = await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null,
      {}, false, null, ClaudeAdapterTests.sharedServers()), listener, new AbortController().signal);
    const atEnd = [query.serverStatusReads, query.serverStatusAnswers, host.timer.pending, listener.sharedFailures.length, log.lines.length];
    query.serverStatuses = [{ name: "search", status: "failed" }];
    read.open();
    await Wait.until(() => query.serverStatusAnswers === 1, "The query did not answer the server status.");
    host.timer.advance(Resources.claudeServerSettleTimeout);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([1, 0, 0, 1, 2]), JSON.stringify(atEnd));
    Assert.areEqual(1, query.serverStatusReads);
    Assert.areEqual(JSON.stringify([[adapter.descriptor.id, adapter.descriptor.displayName, "docs", SharedMcpFailureKind.Connection]]),
      JSON.stringify(listener.sharedFailures.map(t => [t.providerId, t.providerLabel, t.server, t.kind])));
    Assert.areEqual(JSON.stringify([Resources.formatClaudeServerNotSet("docs", "refused"), Resources.formatClaudeServerPendingAtTurnEnd("search")]),
      JSON.stringify(log.lines));
  }

  @TestMethod
  public async logsEachSharedServerStillConnectingWhenTheTurnEndsWhileItWaitsToReadTheirStatesAgain(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const gate = new GateStep();
    const query = new FakeClaudeQuery([SdkMessages.init("s-waiting", "none", null, []), gate, SdkMessages.success("s-waiting", "done")]);
    query.serverStatuses = [{ name: "search", status: "pending" }, { name: "docs", status: "pending" }];
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const request = host.createRequest("Search");

    const running = adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {},
      false, null, ClaudeAdapterTests.sharedServers()), listener, new AbortController().signal);
    await Wait.until(() => host.timer.begun === 1, "The timer did not begin a wait.");
    gate.open();
    const result = await running;
    const left = host.timer.pending;
    host.timer.advance(Resources.claudeServerSettleTimeout);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([0, 1, 0]), JSON.stringify([left, query.serverStatusReads, listener.sharedFailures.length]));
    Assert.areEqual(JSON.stringify([Resources.formatClaudeServerPendingAtTurnEnd("search"), Resources.formatClaudeServerPendingAtTurnEnd("docs")]),
      JSON.stringify(log.lines));
  }

  @TestMethod
  public async logsWhyItStoppedReadingClaudesServerStatesWhenNotingAFailureThrowsAndStillCompletesTheTurn(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const query = new FakeClaudeQuery([SdkMessages.init("s-thrown", "none", null, []), SdkMessages.success("s-thrown", "done")]);
    query.serversErrors = { docs: "refused" };
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    listener.sharedFailureError = new Error("the note wasn't kept");
    const request = host.createRequest("Search");

    const result = await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null,
      {}, false, null, ClaudeAdapterTests.sharedServers()), listener, new AbortController().signal);
    await Wait.until(() => log.lines.length === 2, "The log did not get both lines.");
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(0, query.serverStatusReads);
    Assert.areEqual(JSON.stringify([Resources.formatClaudeServerNotSet("docs", "refused"), Resources.formatClaudeServerSettleFailed("the note wasn't kept")]),
      JSON.stringify(log.lines));
  }

  @TestMethod
  public async reportsASharedServerClaudeCouldntSetAndLogsWhyItsStatesWerentReadWhenClaudeDoesntSay(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const gate = new GateStep();
    const query = new FakeClaudeQuery([SdkMessages.init("s-unread", "none", null, []), gate, SdkMessages.success("s-unread", "done")]);
    query.serversErrors = { docs: "refused" };
    query.serverStatusFailure = new Error("the query closed");
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const request = host.createRequest("Search");

    const running = adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {},
      false, null, ClaudeAdapterTests.sharedServers()), listener, new AbortController().signal);
    await Wait.until(() => listener.sharedFailures.length === 1, "The listener did not see a shared server failure.");
    await Wait.until(() => log.lines.length === 2, "The log did not get 2 lines.");
    gate.open();
    await running;
    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([[adapter.descriptor.id, adapter.descriptor.displayName, "docs", SharedMcpFailureKind.Connection]]),
      JSON.stringify(listener.sharedFailures.map(t => [t.providerId, t.providerLabel, t.server, t.kind])));
    Assert.areEqual(JSON.stringify([Resources.formatClaudeServerNotSet("docs", "refused"), Resources.formatClaudeServerStatusUnread("the query closed")]),
      JSON.stringify(log.lines));
  }

  @TestMethod
  public async takesASharedServerUnlessItNamesAVariableThatHoldsClaudesOwnCredentials(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const server = (variable: string): SharedMcpServerDefinition => new SharedMcpServerDefinition("search", SharedMcpTransport.Http, null, [], [],
      "https://search.example/mcp", [new SharedMcpHeader("X-Key", variable)], null);

    Assert.isNull(adapter.sharedServerUnavailable(server("SEARCH_KEY")));
    Assert.isNull(adapter.sharedServerUnavailable(server("ANTHROPIC_BEDROCK_BASE_URL")));
    Assert.areEqual(JSON.stringify({ reason: "TeamRun keeps ANTHROPIC_API_KEY out of Claude Code's environment.", short: "ANTHROPIC_API_KEY kept from it" }),
      JSON.stringify(adapter.sharedServerUnavailable(server("ANTHROPIC_API_KEY"))));
  }

  @TestMethod
  public async takesNoSharedServerThatNamesTheSenderToken(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY", "TEAMRUN_SENDER_TOKEN"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "teamrun_sender_token");

    Assert.areEqual(JSON.stringify(["TEAMRUN_SENDER_TOKEN", "teamrun_sender_token"].map(t => `TeamRun keeps ${t}, TeamRun's own sender token, from the MCP servers it `
      + "passes Claude Code.")), JSON.stringify([adapter.sharedServerUnavailable(stdio)?.reason, adapter.sharedServerUnavailable(http)?.reason]));
  }

  @TestMethod
  public async takesSavedSecretsForAStdioSharedServerOnly(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const [stdio, http] = ClaudeAdapterTests.sharedServers();

    Assert.isNull(adapter.savedSecretsUnavailable(stdio!));
    Assert.areEqual(JSON.stringify({ reason: Resources.formatSavedSecretsStdioOnly(adapter.descriptor.displayName), short: "saved secrets reach its stdio servers only" }),
      JSON.stringify(adapter.savedSecretsUnavailable(http!)));
  }

  @TestMethod
  public async givesAStdioSharedServerItsSavedValueOverClaudesInputAndKeepsItOutOfTheCommandLineAFailedStartAndTheLog(): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, log);
    const value = "saved-value-7f3c9a1e";
    const values = new SharedMcpValues(new Map([["search", new Map([["SEARCH_KEY", value]])]]));
    const started = new FakeClaudeQuery([SdkMessages.init("s-saved", "none", null, []), SdkMessages.success("s-saved", "done")]);
    const refused = new FakeClaudeQuery([SdkMessages.init("s-refused", "none", null, []), SdkMessages.success("s-refused", "done")]);
    refused.serversFailure = new Error("The servers weren't set.");
    host.factory.next = started;
    host.factory.queued.push(refused);
    host.starter.current = { SEARCH_KEY: "from-the-environment", SEARCH_REGION: "eu" };
    const request = host.createRequest("Search");
    const turn = (): TurnRequest => new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false,
      null, ClaudeAdapterTests.sharedServers().slice(0, 1), null, undefined, values);
    const listener = new RecordingTurnListener();

    await adapter.runTurn(turn(), listener, new AbortController().signal);
    await adapter.shutdown();
    const failure = await Assert.throwsAsync(() => adapter.runTurn(turn(), listener, new AbortController().signal), Error);
    await adapter.shutdown();

    const launch = new SharedMcpLaunch();
    Assert.areEqual(JSON.stringify([{ search: { type: "stdio", command: launch.program,
      args: [launch.script, "--variables", "SEARCH_KEY,SEARCH_REGION", "--", "npx", "-y", "search-server"],
      env: { SEARCH_KEY: value, SEARCH_REGION: "eu", ELECTRON_RUN_AS_NODE: "1" } } }]), JSON.stringify(started.servers));
    Assert.isFalse([JSON.stringify(host.factory.optionsList), JSON.stringify(listener), String(failure), failure.stack ?? "", JSON.stringify(log.lines),
      JSON.stringify(turn()), JSON.stringify(host.environment)].some(t => t.includes(value)));
  }

  @TestMethod
  public async suppliesAndClearsTheTeammateRoleInSystemInstructions(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter(undefined, undefined, undefined, host.directory.resolve("home"));
    try {
      for (const role of ["Review carefully", null]) {
        host.factory.next = new FakeClaudeQuery([SdkMessages.init("role-session", "none", null, []), SdkMessages.success("role-session", "ok")]);
        const listener = new RecordingTurnListener();
        const request = host.createRequest("task", null, "role-session");
        await adapter.runTurn(new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested,
          request.resumeNativeSessionId, [], role), listener, new AbortController().signal);
        const prompt = host.factory.lastOptions?.systemPrompt;
        Assert.areEqual(role ?? undefined, typeof prompt === "object" && !Array.isArray(prompt) && prompt.type === "preset" ? prompt.append : undefined);
        Assert.areEqual(role === null ? null : "Instructions", listener.starts[0]?.roleApplied);
      }
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async offersEachRecordedModelTheLevelsClaudeCodeListsForItAndNoneWhereItListsNone(): Promise<void> {
    using host = new ClaudeTestHost();
    host.factory.next.models = [...ClaudeModelListRecording.models];

    const models = (await host.createAdapter().listModels(host.createProvider())).models;

    Assert.areEqual("default:low,medium,high,xhigh,max:true|claude-haiku-4-5-20251001:null:false|claude-opus-4-6:low,medium,high,max:false",
      models.map(t => [t.id, t.effortLevels?.join(",") ?? "null", t.isDefault].join(":")).join("|"));
    Assert.areEqual("Default (recommended)|Haiku 4.5|Opus 4.6", models.map(t => t.displayName).join("|"));
  }

  @TestMethod
  public async namesEachModelWithTheVersionClaudeCodeReportsAndTheDefaultAfterTheModelItResolvesTo(): Promise<void> {
    using host = new ClaudeTestHost();
    host.factory.next.models = [
      { value: "default", displayName: "Default (recommended)", description: "Opus 5.5 · Most capable", resolvedModel: "claude-opus-5-5" },
      { value: "opus", displayName: "Opus", description: "Opus 5.5 · Most capable for complex work", resolvedModel: "claude-opus-5-5" },
      { value: "sonnet", displayName: "Sonnet", description: "Everyday tasks", resolvedModel: "claude-sonnet-5-5" },
      { value: "haiku", displayName: "Haiku", description: "", resolvedModel: "claude-haiku-4-20251001" },
      { value: "claude-opus-4-6", displayName: "Opus 4.6", description: "Opus 4.6 · Earlier", resolvedModel: "claude-opus-4-6" },
      { value: "custom", displayName: "Custom", description: "Custom 2x faster", resolvedModel: "acme-custom" },
      { value: "other", displayName: "Other", description: "Other", resolvedModel: "claude-sonnet-5-5" },
      { value: "fable", displayName: "Fable", description: "Fable" }
    ];

    const models = (await host.createAdapter().listModels(host.createProvider())).models;

    Assert.areEqual("default:Opus 5.5|opus:Opus 5.5|sonnet:Sonnet 5.5|haiku:Haiku 4|claude-opus-4-6:Opus 4.6|custom:Custom|other:Other|fable:Fable",
      models.map(t => `${t.id}:${t.displayName}`).join("|"));
  }

  @TestMethod
  public async namesADefaultNoOtherRowSharesByTheModelItResolvesToAndOneItCantReadByClaudeCodesName(): Promise<void> {
    using host = new ClaudeTestHost();
    host.factory.next.models = [{ value: "default", displayName: "Default (recommended)", description: "", resolvedModel: "claude-fable-5-1" }];
    const resolved = (await host.createAdapter().listModels(host.createProvider())).models.map(t => t.displayName);
    host.factory.next.models = [{ value: "default", displayName: "Default (recommended)", description: "", resolvedModel: "future-model" }];

    const unread = (await host.createAdapter().listModels(host.createProvider())).models.map(t => t.displayName);

    Assert.areEqual("Fable 5.1|Default (recommended)", [...resolved, ...unread].join("|"));
  }

  @TestMethod
  public async namesAModelWithANoteByItsFamilyVersionAndNoteAndReadsAContextSuffixOnTheModelItResolvesTo(): Promise<void> {
    using host = new ClaudeTestHost();
    host.factory.next.models = [
      { value: "default", displayName: "Default (recommended)", description: "Opus 5 with 1M context · Best for everyday, complex tasks", resolvedModel: "claude-opus-5[1m]" },
      { value: "opus[1m]", displayName: "Opus (1M context)", description: "Opus 5 with 1M context · Best for everyday, complex tasks", resolvedModel: "claude-opus-5[1m]" },
      { value: "claude-fable-5-1[1m]", displayName: "Fable", description: "Fable 5.1 · Most capable for your hardest and longest-running tasks", resolvedModel: "claude-fable-5-1" },
      { value: "sonnet", displayName: "Sonnet", description: "Sonnet 5 · Efficient for routine tasks", resolvedModel: "claude-sonnet-5" },
      { value: "haiku", displayName: "Haiku", description: "Haiku 4.5 · Fastest for quick answers", resolvedModel: "claude-haiku-4-5-20251001" },
      { value: "sonnet[1m]", displayName: "Sonnet (1M context)", description: "", resolvedModel: "claude-sonnet-5[1m]" }
    ];

    const models = (await host.createAdapter().listModels(host.createProvider())).models;

    Assert.areEqual("default:Opus 5 (1M context)|opus[1m]:Opus 5 (1M context)|claude-fable-5-1[1m]:Fable 5.1|sonnet:Sonnet 5|haiku:Haiku 4.5"
      + "|sonnet[1m]:Sonnet 5 (1M context)", models.map(t => `${t.id}:${t.displayName}`).join("|"));
  }

  @TestMethod
  public async offersEachModelTheLevelsClaudeCodesRowListsInTheirOrder(): Promise<void> {
    using host = new ClaudeTestHost();
    host.factory.next.models = [
      { value: "default", displayName: "Default", description: "Recommended", resolvedModel: "claude-opus-5-5", supportsEffort: true,
        supportedEffortLevels: ["low", "medium", "high", "xhigh", "max"] },
      { value: "sonnet", displayName: "Sonnet", description: "Everyday", resolvedModel: "claude-sonnet-5-5", supportsEffort: true,
        supportedEffortLevels: ["low", "medium", "high", "xhigh"] },
      { value: "older", displayName: "Older", description: "Earlier", resolvedModel: "claude-older", supportsEffort: true, supportedEffortLevels: ["low", "medium", "high"] },
      { value: "haiku", displayName: "Haiku", description: "Fastest", resolvedModel: "claude-haiku-5-5" }
    ];

    const models = (await host.createAdapter().listModels(host.createProvider())).models;

    Assert.areEqual("low,medium,high,xhigh,max|low,medium,high,xhigh|low,medium,high|null", models.map(t => t.effortLevels?.join(",") ?? "null").join("|"));
    Assert.isTrue(models.every(t => Object.keys(t.effortNames).length === 0 && Object.isNull(t.defaultEffort)));
  }

  @TestMethod
  public async discoversModelsWithoutSendingAPromptAndClosesTheQuery(): Promise<void> {
    using host = new ClaudeTestHost();
    const query = host.factory.next;
    query.models = [
      { value: "default", displayName: "Default", description: "Current", resolvedModel: "future-model", supportedEffortLevels: ["high"] },
      { value: "small", displayName: "Small", description: "No effort", supportsEffort: false },
      { value: "unknown", displayName: "Unknown", description: "Legacy" },
      { value: "effortful", displayName: "Effortful", description: "Every level", supportsEffort: true }
    ];
    const adapter = host.createAdapter();
    const list = await adapter.listModels(host.createProvider());
    const models = list.models;
    Assert.isNull(list.signedIn);
    Assert.areEqual("future-model", models[0]?.resolvedModel);
    Assert.isTrue(models[0]?.isDefault ?? false);
    Assert.areEqual("high", models[0]?.effortLevels?.join(","));
    Assert.areEqual(0, models[1]?.effortLevels?.length);
    Assert.isNull(models[2]?.effortLevels);
    Assert.isNull(models[3]?.effortLevels);
    Assert.isTrue(models.every(t => Object.isNull(t.defaultEffort)));
    Assert.isFalse(host.factory.lastOptions?.persistSession ?? true);
    Assert.areEqual("{}", JSON.stringify(host.factory.lastOptions?.mcpServers));
    Assert.areEqual("[]", JSON.stringify(host.factory.lastOptions?.tools));
    Assert.areEqual("[]|true|[]", `${JSON.stringify(host.factory.lastOptions?.settingSources)}|${host.factory.lastOptions?.strictMcpConfig}|${JSON.stringify(host.factory.lastOptions?.plugins)}`);
    Assert.areEqual(1, query.closeCount);
    Assert.areEqual(0, adapter.activeRunCount);
    Assert.areEqual("claude acc-1", host.factory.origins.map(t => `${t.kind} ${t.providerId}`).join(","));
    const prompt = host.factory.prompts[0];
    Assert.isDefined(prompt);
    Assert.isFalse(typeof prompt === "string");
    if (typeof prompt !== "string") {
      let messages = 0;
      for await (const _message of prompt)
        messages++;
      Assert.areEqual(0, messages);
    }
    host.factory.next.modelsFailure = new Error("Discovery refused");
    await Assert.throwsAsync(() => adapter.listModels(null), Error);
    await Assert.throwsAsync(() => host.createAdapter(host.environment, null).listModels(null), Error);
    host.factory.next.modelsHang = true;
    const hanging = new ClaudeAdapter(host.command, host.environment, "test", host.factory, host.runner, host.versionReader,
      new ProviderTimings(5000, 5000, 5000, 1, 1000, 300, 500, 500, 200, 1, 20));
    const error = await Assert.throwsAsync(() => hanging.listModels(null), TimeoutException);
    Assert.areEqual(Resources.modelDiscoveryTimedOut, error.message);
    Assert.areEqual(0, hanging.activeRunCount);
  }

  @TestMethod
  public async stopsAModelListThatIsStillRunningWhenItShutsDown(): Promise<void> {
    using host = new ClaudeTestHost();
    const query = new FakeClaudeQuery([]);
    query.modelsHang = true;
    host.factory.next = query;
    const adapter = new ClaudeAdapter(host.command, host.environment, "test", host.factory, host.runner, host.versionReader,
      new ProviderTimings(5000, 5000, 5000, 200, 1000, 300, 500, 500, 200, 1, 20));
    const listing = Assert.throwsAsync(() => adapter.listModels(null), Error);
    await Wait.until(() => adapter.activeRunCount === 1, "The adapter did not have an active run.");

    await adapter.shutdown();

    Assert.areEqual(1, query.interruptCount);
    Assert.isTrue(query.options?.abortController?.signal.aborted ?? false);
    await listing;
    Assert.areEqual(0, adapter.activeRunCount);
  }

  @TestMethod
  public async readsWhetherItsAccountAnswerSaysItIsSignedIn(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const cases: readonly (readonly [AccountInfo, boolean | null])[] = [
      [{ tokenSource: "none", apiProvider: "firstParty" }, false],
      [{ tokenSource: "none", apiKeySource: "none" }, false],
      [{ tokenSource: "claude.ai", apiProvider: "firstParty" }, true],
      [{ tokenSource: "none", apiKeySource: "ANTHROPIC_API_KEY" }, true],
      [{ tokenSource: "none", apiProvider: "bedrock" }, null],
      [{ email: "a@b.c" }, null]
    ];
    const read: (boolean | null)[] = [];

    for (const [account] of cases) {
      host.factory.next.accountInfoResult = account;
      read.push((await adapter.listModels(null)).signedIn);
    }
    host.factory.next.accountInfoFailure = new Error("Account refused");
    const refused = await adapter.listModels(null);
    host.factory.next.accountInfoHang = true;
    const slow = await new ClaudeAdapter(host.command, host.environment, "test", host.factory, host.runner, host.versionReader,
      new ProviderTimings(5000, 5000, 5000, 1, 1000, 300, 500, 500, 200, 1, 20)).listModels(null);

    Assert.areEqual(JSON.stringify(cases.map(t => t[1])), JSON.stringify(read));
    Assert.isNull(refused.signedIn);
    Assert.areEqual("fable,opus,sonnet,haiku", refused.models.map(t => t.id).join(","));
    Assert.isNull(slow.signedIn);
    Assert.areEqual("fable,opus,sonnet,haiku", slow.models.map(t => t.id).join(","));
    Assert.areEqual(0, adapter.activeRunCount);
  }
  @TestMethod
  public async startsItsProgramsForTheProviderTheyServe(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider();

    await adapter.checkSignIn(provider);
    await adapter.runTurn(host.createRequest("Hello", provider), new RecordingTurnListener(), new AbortController().signal);
    await adapter.runTurn(host.createRequest("Hello"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual("claude acc-1,claude acc-1", host.starter.started.map(t => `${t.origin?.kind} ${t.origin?.providerId}`).join(","));
    Assert.areEqual("claude acc-1,claude null", host.factory.origins.map(t => `${t.kind} ${t.providerId}`).join(","));
  }

  @TestMethod
  public async showsClaudeCodeAmongTheRunningProgramsWhileATurnRunsAndNotAfter(): Promise<void> {
    using host = new ClaudeTestHost();
    const starter = new RunningProgramsStarter();
    const adapter = new ClaudeAdapter(new ProcessCommand(ClaudeTestHost.FAKE_CLAUDE_PATH, []), { ...process.env, TEAMRUN_FAKE_CLAUDE_TURN: "hold" },
      "0.0.1-test", new AgentSdkQueryFactory(starter), host.runner, host.versionReader, host.timings);
    const controller = new AbortController();

    const run = adapter.runTurn(host.createRequest("Hello"), new RecordingTurnListener(), controller.signal);
    try {
      await Wait.until(() => starter.ofKind("claude").length === 1, "The starter did not start Claude.");
    }
    finally {
      controller.abort();
      await run;
    }

    Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
    await Wait.until(() => starter.running.length === 0, "A started process still ran.");
  }

  @TestMethod
  public async passesNativeImagesThroughTheStructuredInputFactory(): Promise<void> {
    using host = new ClaudeTestHost();
    const path = host.directory.resolve("image.png");
    writeFileSync(path, "image bytes");
    await host.createAdapter().runTurn(new TurnRequest(null, host.directory.path, "Inspect", new RequestedSettings("claude", null, null), null,
      [new MessageAttachment("image.png", "image/png", 11, path)]), new RecordingTurnListener(), new AbortController().signal);
    const messages = host.factory.queries[0]?.inputs ?? [];
    Assert.areEqual(1, messages.length);
    Assert.isTrue(JSON.stringify(messages).includes(Buffer.from("image bytes").toString("base64")));
  }
  @TestMethod
  public async describesItselfAndListsModels(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();

    Assert.areEqual("claude", adapter.descriptor.id);
    Assert.isTrue(adapter.descriptor.abilities === ProviderAbilityTable.claude);
    Assert.areEqual("Claude Code", adapter.descriptor.displayName);
    Assert.areEqual("fable,opus,sonnet,haiku", (await adapter.listModels(null)).models.map(t => t.id).join(","));
    Assert.isTrue(adapter.descriptor.supportsResume);
    Assert.isTrue(adapter.descriptor.supportsFork);
    const forked = await adapter.forkSession(new ForkRequest(host.createProvider(), host.directory.path, "session-1", "turn-1", new RequestedSettings("claude", null, null)));
    Assert.areEqual(JSON.stringify(["claude", "acc-1", "session-1", "turn-1"]), JSON.stringify([forked.kind, forked.providerId, forked.nativeSessionId, forked.resumeAt]));
    Assert.isNull((await adapter.forkSession(new ForkRequest(null, host.directory.path, "session-1", "turn-1", new RequestedSettings("claude", null, null)))).providerId);
    Assert.isFalse(adapter.descriptor.supportsSignIn);
    Assert.areEqual("true:null", [adapter.descriptor.supportsSignOut, adapter.descriptor.signOutCommand ?? "null"].join(":"));
    Assert.areEqual(JSON.stringify({ variable: "CLAUDE_CONFIG_DIR", signInCommand: "claude auth login", usualFolder: "/work/claude-home", toolCommand: null, signInVariables: {}, signInValues: {}, personFolders: [] }),
      JSON.stringify(host.createAdapter({ ...host.environment, CLAUDE_CONFIG_DIR: "/work/claude-home" }).descriptor.profile?.toJson()));
    Assert.areEqual(join(homedir(), ".claude"), host.createAdapter({ ...host.environment, CLAUDE_CONFIG_DIR: "" }).descriptor.profile?.usualFolder);
    Assert.areEqual([join(homedir(), ".claude"), "/work/claude-home"].join(),
      host.createAdapter({ ...host.environment, CLAUDE_CONFIG_DIR: "/work/claude-home" }).profileSearch.folders.join());
    Assert.areEqual(".claude.json,settings.json,projects,history.jsonl,statsig,todos", adapter.profileSearch.entries.join());
    Assert.isNull(adapter.descriptor.ownMcpServersUnavailable);
    Assert.areEqual(Resources.claudeOwnMcpServersNote, adapter.descriptor.ownMcpServersNote);
    Assert.areEqual("your Claude account's connectors", adapter.descriptor.ownMcpServersShortNote);
    Assert.areEqual("true:true:false", [adapter.descriptor.reportsLimits, adapter.descriptor.carriesSessions, adapter.descriptor.sessionsChecked].join(":"));
    await Assert.throwsAsync(() => adapter.signIn(host.createProvider(), new AbortController().signal), InvalidOperationException);
  }

  @TestMethod
  public async listsTheServersItsConfigurationNamesWithoutTeamRunsOwnAsConfiguredAndNoneWithoutTheFile(): Promise<void> {
    using host = new ClaudeTestHost();
    const provider = host.createProvider();
    const native = host.directory.resolve("native");
    mkdirSync(provider.profileDir, { recursive: true });
    mkdirSync(native, { recursive: true });
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" }, teamrun: { url: "http://127.0.0.1/mcp" }, notes: {} } }));
    writeFileSync(join(native, ".claude.json"), JSON.stringify({ mcpServers: { linear: { url: "https://example.com/mcp" } } }));
    const adapter = host.createAdapter({ ...host.environment, CLAUDE_CONFIG_DIR: native });
    const listed = (servers: readonly OwnMcpServer[]): string => servers.map(t => `${t.name} ${t.state}`).join(",");

    Assert.areEqual("docs Configured,notes Configured", listed(await adapter.listOwnMcpServers(provider)));
    Assert.areEqual("linear Configured", listed(await adapter.listOwnMcpServers(null)));
    Assert.areEqual("", listed(await adapter.listOwnMcpServers(host.createProvider("acc-2", "missing"))));
    writeFileSync(join(provider.profileDir, ".claude.json"), JSON.stringify({ theme: "dark" }));
    Assert.areEqual("", listed(await adapter.listOwnMcpServers(provider)));
  }

  @TestMethod
  public async readsASessionsCompactionSummaryFromTheProvidersProfileOrTheDefaultOne(): Promise<void> {
    using host = new ClaudeTestHost();
    const provider = host.createProvider();
    const native = host.directory.resolve("native");
    const write = (folder: string, text: string): void => {
      mkdirSync(join(folder, "projects", "D--work"), { recursive: true });
      writeFileSync(join(folder, "projects", "D--work", "s-1.jsonl"), JSON.stringify({ type: "user", isCompactSummary: true, message: { role: "user", content: text } }));
    };
    write(provider.profileDir, "Profile summary");
    write(native, "Default summary");
    const adapter = host.createAdapter({ ...host.environment, CLAUDE_CONFIG_DIR: native });

    const read = [await adapter.readCompaction(provider, "s-1"), await adapter.readCompaction(null, "s-1")];

    Assert.areEqual("Profile summary|Default summary", read.join("|"));
  }

  @TestMethod
  public async carriesASessionsFileIntoTheOtherAccountsProfileReplacingAnEarlierCopy(): Promise<void> {
    using host = new ClaudeTestHost();
    const from = host.createProvider("acc-1", "work");
    const to = host.createProvider("acc-2", "spare");
    const file = join("projects", "D--work", "s-1.jsonl");
    mkdirSync(join(from.profileDir, "projects", "D--work"), { recursive: true });
    writeFileSync(join(from.profileDir, file), "{\"type\":\"user\"}\n{\"type\":\"assistant\"}\n");
    mkdirSync(join(to.profileDir, "projects", "D--work"), { recursive: true });
    writeFileSync(join(to.profileDir, file), "{\"type\":\"user\"}\n");
    const adapter = host.createAdapter();

    const carried = await adapter.carrySession(from, to, "s-1");

    Assert.areEqual(SessionCarry.Carried, carried);
    Assert.areEqual(readFileSync(join(from.profileDir, file), "utf8"), readFileSync(join(to.profileDir, file), "utf8"));
  }

  @TestMethod
  public async carriesNoCompactedSessionUntilClaudesCheckOfOnePasses(): Promise<void> {
    using host = new ClaudeTestHost();
    const from = host.createProvider("acc-1", "work");
    const to = host.createProvider("acc-2", "spare");
    mkdirSync(join(from.profileDir, "projects", "D--work"), { recursive: true });
    writeFileSync(join(from.profileDir, "projects", "D--work", "s-1.jsonl"), "{\"type\":\"user\",\"isCompactSummary\":true}\n{\"type\":\"assistant\"}\n");
    const adapter = host.createAdapter();

    const carried = await adapter.carrySession(from, to, "s-1");

    Assert.areEqual(SessionCarry.Refused, carried);
    Assert.areEqual(false, existsSync(join(to.profileDir, "projects")));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async carriesNoSessionWhoseFileIsMissingAndLogsAProfileItCantRead(hasProjects: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const from = host.createProvider("acc-1", "work");
    const to = host.createProvider("acc-2", "spare");
    if (hasProjects)
      mkdirSync(join(from.profileDir, "projects", "D--work"), { recursive: true });
    const log = new RecordingLog();
    const adapter = host.createAdapter(host.environment, host.command, host.timings, undefined, log);

    const carried = await adapter.carrySession(from, to, "s-1");

    Assert.areEqual(SessionCarry.Unread, carried);
    Assert.areEqual(false, existsSync(join(to.profileDir, "projects")));
    Assert.areEqual(hasProjects ? 0 : 1, log.lines.filter(t => t.startsWith(Resources.formatSessionNotCarried("Claude Code", "s-1", ""))).length);
  }

  @TestMethod
  public async closesAnIdleChatOnTheSessionBeforeCarryingItSoAMoveBackOpensTheCopy(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const from = host.createProvider("acc-1", "work");
    const to = host.createProvider("acc-2", "spare");
    const query = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-1", "none", null, []),
      new StampedStep(SdkMessages.success("s-1", "Done")),
      new WaitForCloseStep()
    ]);
    host.factory.next = query;
    let carried: SessionCarry | null = null;
    let closes = -1;
    try {
      await adapter.runTurn(host.createRequest("Start", from), new RecordingTurnListener(), new AbortController().signal);
      mkdirSync(join(from.profileDir, "projects", "D--work"), { recursive: true });
      writeFileSync(join(from.profileDir, "projects", "D--work", "s-1.jsonl"), "{\"type\":\"user\"}\n");
      const open = query.closeCount;
      carried = await adapter.carrySession(from, to, "s-1");
      closes = query.closeCount - open;
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(SessionCarry.Carried, carried);
    Assert.areEqual(1, closes);
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async carriesNoSessionWhoseChatAwaitsOrRunsAWakeTurnAfterItsTaskEnded(waking: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const t = host.timings;
    const adapter = host.createAdapter(host.environment, host.command, new ProviderTimings(t.versionTimeout, t.signInCheckTimeout, t.initializeTimeout,
      t.requestTimeout, t.interruptTimeout, t.interruptGrace, t.stopGrace, t.killWait, t.abortGrace, t.streamInterval, t.resumeRetryDelay, 60_000));
    const to = host.createProvider("acc-2", "spare");
    const wake = new GateStep();
    const reply = new GateStep();
    host.factory.next = new FakeClaudeQuery([
      SdkMessages.init("s-9", "none", null, []),
      SdkMessages.taskStarted("s-9", "tests", undefined, true, "npm test"),
      SdkMessages.success("s-9", "Started"),
      SdkMessages.taskNotification("s-9", "tests", "completed", host.directory.resolve("missing.output")),
      wake,
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("The tests passed")], "claude-opus-5"),
      reply,
      SdkMessages.success("s-9", "Done"),
      new WaitForCloseStep()
    ]);
    const first = new RecordingTurnListener();
    const woken = new RecordingTurnListener();
    first.wakeTurn = new WakeTurn({});
    const following = first.wakeTurn.follow(woken, new AbortController().signal);
    let carried: SessionCarry | null = null;
    try {
      await adapter.runTurn(host.createRequest("Test"), first, new AbortController().signal);
      await Wait.until(() => first.taskEnds.length === 1, "The first listener did not see a task end.");
      if (waking) {
        wake.open();
        await Wait.until(() => woken.texts.length === 1, "The wake turn did not start.");
      }
      carried = await adapter.carrySession(null, to, "s-9");
      wake.open();
      reply.open();
      await following;
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(SessionCarry.Held, carried);
    Assert.areEqual(false, existsSync(join(to.profileDir, "projects")));
  }

  @TestMethod
  public async carriesNoSessionWhileItsChatStillRunsATask(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const to = host.createProvider("acc-2", "spare");
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-1", "none", null, []),
      SdkMessages.taskStarted("s-1", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-1", "Started")),
      new WaitForCloseStep()
    ]);
    let carried: SessionCarry | null = null;
    try {
      await adapter.runTurn(host.createRequest("Start"), new RecordingTurnListener(), new AbortController().signal);
      carried = await adapter.carrySession(null, to, "s-1");
    }
    finally { await adapter.shutdown(); }

    Assert.areEqual(SessionCarry.Held, carried);
    Assert.areEqual(false, existsSync(join(to.profileDir, "projects")));
  }

  @TestMethod
  public async listsTheDefaultProfilesServersFromTheHomeFolderWhenItsVariableIsUnsetOrBlank(): Promise<void> {
    using host = new ClaudeTestHost();
    const home = host.directory.resolve("home");
    mkdirSync(home, { recursive: true });
    writeFileSync(join(home, ".claude.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" }, teamrun: {} } }));
    const read = async (environment: NodeJS.ProcessEnv): Promise<string> =>
      (await host.createAdapter(environment, host.command, host.timings, home).listOwnMcpServers(null)).map(t => t.name).join(",");

    Assert.areEqual("docs", await read({ ...host.environment, CLAUDE_CONFIG_DIR: undefined }));
    Assert.areEqual("docs", await read({ ...host.environment, CLAUDE_CONFIG_DIR: " " }));
    Assert.areEqual("", await read({ ...host.environment, CLAUDE_CONFIG_DIR: host.directory.resolve("named") }));
    Assert.areEqual(join(home, ".claude"), host.createAdapter({ ...host.environment, CLAUDE_CONFIG_DIR: undefined }, host.command, host.timings, home).descriptor.profile?.usualFolder);
  }

  @TestMethod
  public async failsItsListNamingTheFileWhenItsConfigurationCantBeRead(): Promise<void> {
    using host = new ClaudeTestHost();
    const provider = host.createProvider();
    const file = join(provider.profileDir, ".claude.json");
    const adapter = host.createAdapter();
    mkdirSync(provider.profileDir, { recursive: true });

    writeFileSync(file, "{ not json");
    const malformed = await Assert.throwsAsync(() => adapter.listOwnMcpServers(provider), Error);
    writeFileSync(file, JSON.stringify({ mcpServers: ["docs"] }));
    const notAnObject = await Assert.throwsAsync(() => adapter.listOwnMcpServers(provider), Error);
    const folder = host.createProvider("acc-2", "folder");
    mkdirSync(join(folder.profileDir, ".claude.json"), { recursive: true });
    const unreadable = await Assert.throwsAsync(() => adapter.listOwnMcpServers(folder), Error);
    writeFileSync(file, JSON.stringify({ mcpServers: { docs: {} } }).padEnd(Resources.maximumConfigurationBytes, " "));
    const atTheCap = await adapter.listOwnMcpServers(provider);
    truncateSync(file, Resources.maximumConfigurationBytes + 1);
    const tooLarge = await Assert.throwsAsync(() => adapter.listOwnMcpServers(provider), Error);

    Assert.areEqual(Resources.formatOwnMcpConfigUnreadable(file), malformed.message);
    Assert.areEqual(malformed.message, notAnObject.message);
    Assert.areEqual(Resources.formatOwnMcpConfigUnreadable(join(folder.profileDir, ".claude.json")), unreadable.message);
    Assert.areEqual("docs", atTheCap.map(t => t.name).join(","));
    Assert.areEqual(Resources.formatOwnMcpConfigTooLarge(file), tooLarge.message);
  }

  @TestMethod
  public async signsOutWithClaudesOwnLogoutForTheProvidersProfileAndSaysWhyWhenItFails(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const refused = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CLAUDE_LOGOUT: "fail" });
    const silent = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CLAUDE_LOGOUT: "silent" });
    const hanging = new ClaudeAdapter(host.command, { ...host.environment, TEAMRUN_FAKE_CLAUDE_HANG: "1" }, "0.0.1-test",
      host.factory, host.runner, host.versionReader, new ProviderTimings(5000, 100, 1, 1, 1, 1, 1, 1, 1, 1, 20));
    const missing = host.createAdapter(host.environment, null);
    const provider = host.createProvider("acc-1", "claude-profile");

    await adapter.signOut(provider);
    const started = host.starter.started.at(-1);
    const profile = host.starter.environments.at(-1)?.["CLAUDE_CONFIG_DIR"];
    const failures = await Promise.all([refused, silent, hanging, missing].map(t => t.signOut(provider).then(() => "resolved",
      (error: unknown) => error instanceof Error ? error.message : "not an Error")));

    Assert.areEqual("auth logout", started?.arguments.slice(-2).join(" "));
    Assert.areEqual("claude acc-1", `${started?.origin?.kind} ${started?.origin?.providerId}`);
    Assert.areEqual(host.directory.resolve("claude-profile"), profile);
    Assert.areEqual(JSON.stringify(["Claude Code didn't sign out: Not signed in to this profile.", "Claude Code didn't sign out.",
      "Claude Code didn't finish signing out within 0.1 s.", Resources.claudeNotFound]), JSON.stringify(failures));
  }

  @TestMethod
  public async checksSignInWithACleanedEnvironment(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter({
      ...host.environment, TEAMRUN_FAKE_CLAUDE_OUTPUT: "env", ANTHROPIC_API_KEY: "secret", CLAUDE_CODE_USE_BEDROCK: "routed"
    });
    const missing = host.createAdapter(host.environment, null);
    const unspawnable = host.createAdapter(host.environment, new ProcessCommand("teamrun-no-such-executable", []));
    const hanging = new ClaudeAdapter(host.command, { ...host.environment, TEAMRUN_FAKE_CLAUDE_HANG: "1" }, "0.0.1-test",
      host.factory, host.runner, host.versionReader, new ProviderTimings(5000, 100, 1, 1, 1, 1, 1, 1, 1, 1, 20));
    const provider = host.createProvider("acc-1", "claude-profile");

    const signedIn = await adapter.checkSignIn(provider);
    const notFound = await missing.checkSignIn(provider);
    const failed = await unspawnable.checkSignIn(provider);
    const timedOut = await hanging.checkSignIn(provider);

    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual(host.directory.resolve("claude-profile"), signedIn.identity?.email);
    Assert.areEqual("no-key", signedIn.identity?.organization);
    Assert.areEqual("teamrun/0.0.1-test", signedIn.identity?.plan);
    Assert.areEqual("routed", signedIn.identity?.authMethod);
    Assert.areEqual("9.9.9", signedIn.harnessVersion);
    Assert.isTrue(existsSync(host.directory.resolve("claude-profile")));
    Assert.areEqual(AuthStatus.Error, notFound.authStatus);
    Assert.isTrue(notFound.error?.includes("Claude Code executable was not found") ?? false);
    Assert.areEqual(AuthStatus.Error, failed.authStatus);
    Assert.isNull(failed.harnessVersion);
    Assert.isTrue(failed.error?.includes("ENOENT") ?? false);
    Assert.areEqual(AuthStatus.Error, timedOut.authStatus);
    Assert.areEqual("Unexpected output from the sign-in check: ", timedOut.error);
  }

  @TestMethod
  public async checksAFoundFolderWithNonessentialTrafficOffWhichOpenedNoConnectionWhereWithoutItAuthStatusOpenedOneAndShowsOnlySignedInOrOut(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CLAUDE_OUTPUT: "traffic" });
    const provider = host.createProvider("acc-1", "claude-profile");

    const found = await adapter.checkFoundSignIn(provider);
    const added = await adapter.checkSignIn(provider);

    Assert.areEqual(`${AuthStatus.LoggedIn} null 9.9.9`, `${found.authStatus} ${found.identity?.email ?? null} ${found.harnessVersion}`);
    Assert.areEqual(AuthStatus.LoggedOut, added.authStatus);
  }

  @TestMethod
  public async passesThePersonsOwnClaudeSettingsToAChatTurnButNotToATitleSession(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter({ ...host.environment, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", CLAUDE_CODE_MAX_OUTPUT_TOKENS: "9000",
      CLAUDE_CODE_OAUTH_TOKEN: "secret" });
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-1", "none", null, []), SdkMessages.success("s-1", "done")]);
    await adapter.runTurn(host.createRequest("Remember tabs", host.createProvider()), new RecordingTurnListener(), new AbortController().signal);
    const chat = host.factory.lastOptions?.env;
    await adapter.shutdown();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-title", "none", null, []), SdkMessages.success("s-title", "The title")]);
    const request = host.createRequest("Name this chat");

    await TitleTurn.ask(adapter, new TurnRequest(null, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, null, [], null,
      () => false, SharedMcpValues.none, null, true), new AbortController().signal);
    const title = host.factory.lastOptions?.env;
    await adapter.shutdown();

    Assert.areEqual("1|9000|none", [chat?.["CLAUDE_CODE_DISABLE_AUTO_MEMORY"], chat?.["CLAUDE_CODE_MAX_OUTPUT_TOKENS"], chat?.["CLAUDE_CODE_OAUTH_TOKEN"] ?? "none"].join("|"));
    Assert.areEqual("none|none", [title?.["CLAUDE_CODE_MAX_OUTPUT_TOKENS"] ?? "none", title?.["CLAUDE_CODE_OAUTH_TOKEN"] ?? "none"].join("|"));
  }

  @TestMethod
  public async runsATurnWithIsolatedOptions(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter({ ...host.environment, ANTHROPIC_API_KEY: "secret" });
    const provider = host.createProvider("acc-2", "turn-profile");
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow", "deny");
    const query = new FakeClaudeQuery([
      SdkMessages.init("s-1", "none", "high", []),
      new ToolAskStep("Bash", { command: "npm test" }),
      new ToolAskStep("WebFetch", { url: "https://example.com" }, "tu-web"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-web", "Denied by the TeamRun user.", true)]),
      SdkMessages.success("s-1", "done")
    ]);
    host.factory.next = query;
    writeFileSync(host.directory.resolve("CLAUDE.md"), "Rules.\n");

    const result = await adapter.runTurn(host.createRequest("Fix the bug", provider, "s-1", "opus", "high"), listener, new AbortController().signal);

    const options = host.factory.lastOptions;
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("s-1", result.nativeSessionId);
    Assert.areEqual("Fix the bug", host.factory.promptTexts.join(","));
    Assert.areEqual(host.directory.path, options?.cwd);
    Assert.areEqual(host.directory.resolve("turn-profile"), options?.env?.["CLAUDE_CONFIG_DIR"]);
    Assert.isUndefined(options?.env?.["ANTHROPIC_API_KEY"]);
    Assert.isUndefined(options?.env?.["CLAUDE_CODE_DISABLE_AUTO_MEMORY"]);
    Assert.areEqual(process.execPath, options?.pathToClaudeCodeExecutable);
    Assert.areEqual("user", options?.settingSources?.join(","));
    Assert.isTrue(options?.strictMcpConfig ?? false);
    Assert.areEqual("{}", JSON.stringify(options?.mcpServers));
    Assert.areEqual("acceptEdits", options?.permissionMode);
    Assert.areEqual("mcp__*", options?.disallowedTools?.join(","));
    Assert.areEqual("opus", options?.model);
    Assert.areEqual("high", options?.effort);
    Assert.areEqual("s-1", options?.resume);
    Assert.areEqual(JSON.stringify({ type: "preset", preset: "claude_code" }), JSON.stringify(options?.systemPrompt));
    Assert.areEqual(400, options?.maxTurns);
    Assert.areEqual(JSON.stringify({ "thinking-display": "summarized" }), JSON.stringify(options?.extraArgs));
    Assert.isTrue(existsSync(host.directory.resolve("turn-profile")));
    Assert.areEqual("allow", (query.steps[1] as ToolAskStep).result?.behavior);
    Assert.areEqual("deny", (query.steps[2] as ToolAskStep).result?.behavior);
    Assert.areEqual("{\"toolUseId\":\"tu-web\",\"isError\":true,\"denied\":true}", JSON.stringify(listener.details.at(-1)?.payload));
    Assert.areEqual("s-1:1,s-1:2", listener.asks.map(t => t.providerRequestId).join(","));
    Assert.areEqual(2, listener.signals.length);
    Assert.isTrue((query.steps[1] as ToolAskStep).controller.signal === listener.signals[0]);
    Assert.isTrue((query.steps[2] as ToolAskStep).controller.signal === listener.signals[1]);
    await Wait.until(() => query.closeCount > 0, "The isolated query was not closed.");
    Assert.areEqual(1, query.closeCount);
    Assert.areEqual(0, adapter.activeRunCount);
  }

  @TestMethod
  public async setsTheTeammatesChatAndTeammateInTheAgentsEnvironment(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-3", "none", null, []), SdkMessages.success("s-3", "ok")]);
    const base = host.createRequest("Hi");

    await adapter.runTurn(new TurnRequest(base.provider, base.workingDirectory, base.prompt, base.requested, null, [], null, null,
      { TEAMRUN_SENDER_TOKEN: "c1", TEAMRUN_TEST_VARIABLE: "t1" }), new RecordingTurnListener(), new AbortController().signal);

    const environment = host.factory.lastOptions?.env;
    Assert.areEqual("c1,t1", [environment?.["TEAMRUN_SENDER_TOKEN"], environment?.["TEAMRUN_TEST_VARIABLE"]].join(","));
    Assert.areEqual(host.environment["PATH"], environment?.["PATH"]);
  }

  @TestMethod
  public async leavesOptionalSettingsOutWhenNotRequested(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter(undefined, undefined, undefined, host.directory.resolve("home"));
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-2", "none", null, []), SdkMessages.success("s-2", "ok")]);

    const result = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    const options = host.factory.lastOptions;
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isUndefined(options?.model);
    Assert.isUndefined(options?.effort);
    Assert.isUndefined(options?.resume);
    Assert.isUndefined(options?.env?.["CLAUDE_CONFIG_DIR"]);
    Assert.areEqual(JSON.stringify({ type: "preset", preset: "claude_code" }), JSON.stringify(options?.systemPrompt));
  }

  @TestMethod
  public async failsWithoutStartingWhenTheRequestCannotBeServed(): Promise<void> {
    using host = new ClaudeTestHost();
    const missing = host.createAdapter(host.environment, null);
    const adapter = host.createAdapter();

    const notFound = await missing.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, notFound.outcome);
    Assert.isTrue(notFound.error?.includes("Claude Code executable was not found") ?? false);
    Assert.areEqual(0, host.factory.queries.length);
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-4", "none", null, []), SdkMessages.success("s-4", "ok")]);
    const anyEffort = await adapter.runTurn(host.createRequest("Hi", null, null, null, "ultra"), new RecordingTurnListener(), new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, anyEffort.outcome);
    Assert.areEqual("ultra", host.factory.lastOptions?.effort);
  }

  @TestMethod
  public async offersStandardAndFastWhereAModelSupportsFastModeAsksForFastOnlyWhenChosenAndReportsWhetherItServed(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([]);
    host.factory.next.models = [
      { value: "opus", displayName: "Opus", description: "Fast", supportsFastMode: true },
      { value: "sonnet", displayName: "Sonnet", description: "Standard only", supportsFastMode: false },
      { value: "haiku", displayName: "Haiku", description: "Unknown" }
    ];
    const run = async (speed: string | null, init: Partial<SDKSystemMessage>, result: Partial<SDKResultMessage>): Promise<RecordingTurnListener> => {
      host.factory.next = new FakeClaudeQuery([{ ...SdkMessages.init("s-7", "none", null, []), ...init } as SDKSystemMessage,
        { ...SdkMessages.success("s-7", "ok"), ...result } as SDKResultMessage]);
      host.factory.next.settingsResult = { applied: { effort: "high" } };
      const listener = new RecordingTurnListener();
      await adapter.runTurn(host.createRequest("Hi", null, null, "opus", null, speed), listener, new AbortController().signal);
      return listener;
    };
    const speeds = (listener: RecordingTurnListener): string => [listener.observations[0], listener.observations.at(-1)]
      .map(t => `${String(t?.speed)}/${String(t?.speedUnavailable)}`).join(",");

    const listed = (await adapter.listModels(null)).models;
    Assert.areEqual("standard:Standard+fast:Fast||", listed.map(t => t.speeds.map(u => `${u.id}:${String(u.name)}`).join("+")).join("|"));
    Assert.areEqual("standard|null|null", listed.map(t => String(t.defaultSpeed)).join("|"));
    const served = await run("fast", { fast_mode_state: "on" }, { fast_mode_state: "cooldown" });
    Assert.areEqual(JSON.stringify({ fastMode: true }), JSON.stringify(host.factory.lastOptions?.settings));
    Assert.areEqual("fast/null,null/cooldown", speeds(served));
    const refused = await run("fast", { fast_mode_state: "off", fast_mode_disabled_reason: "extra_usage_disabled" }, {});
    Assert.areEqual("null/extra_usage_disabled,null/extra_usage_disabled", speeds(refused));
    await run(null, {}, {});
    Assert.areEqual(JSON.stringify({ fastMode: false }), JSON.stringify(host.factory.lastOptions?.settings));
    await run("standard", {}, {});
    Assert.areEqual(JSON.stringify({ fastMode: false }), JSON.stringify(host.factory.lastOptions?.settings));
  }

  @TestMethod
  public async listsItsModesAtAcceptEditsAndRunsATurnInTheChosenOneButNoUnlistedOne(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([]);
    host.factory.next.models = [{ value: "opus", displayName: "Opus", description: "Standard only", supportsFastMode: false }];
    const run = async (mode: string | null, speed: string | null = null): Promise<string> => {
      host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-9", "none", null, []) as SDKSystemMessage, SdkMessages.success("s-9", "ok") as SDKResultMessage]);
      await adapter.runTurn(host.createRequest("Hi", null, null, "opus", null, speed, mode), new RecordingTurnListener(), new AbortController().signal);
      return `${String(host.factory.lastOptions?.permissionMode)}:${String(host.factory.lastOptions?.allowDangerouslySkipPermissions)}`;
    };

    const list = await adapter.listModels(null);

    Assert.areEqual("auto:Auto:false:false|default:Manual:false:false|acceptEdits:Accept edits:false:false|plan:Plan:false:true|bypassPermissions:Bypass permissions:true:false",
      list.modes.map(t => `${t.id}:${t.name}:${String(t.unrestricted)}:${String(t.readOnly)}`).join("|"));
    Assert.areEqual("acceptEdits", list.defaultMode);
    Assert.areEqual(list.modes.map(t => t.id).join(","), adapter.modes.map(t => t.id).join(","));
    Assert.areEqual("acceptEdits", adapter.defaultMode);
    Assert.areEqual("plan", adapter.explorerMode);
    Assert.areEqual("acceptEdits:false|plan:false|auto:false|default:false|bypassPermissions:true|acceptEdits:false|plan:false",
      [await run(null), await run("plan"), await run("auto"), await run("default"), await run("bypassPermissions"), await run("unknown"),
        await run("plan", "fast")].join("|"));
  }

  @TestMethod
  public async opensAnotherQueryOnTheSessionWhenItsModeChanges(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-mode", "none", null, []), SdkMessages.success("s-mode", "Edited.")]);
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-mode", "none", null, []), SdkMessages.success("s-mode", "Planned.")]));
    const request = (prompt: string, mode: string, resume: string | null): TurnRequest =>
      new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("claude", null, null, null, mode), resume, [], null, null);

    const first = await adapter.runTurn(request("Edit", "acceptEdits", null), new RecordingTurnListener(), new AbortController().signal);
    await adapter.runTurn(request("Plan", "plan", first.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual("acceptEdits,plan", host.factory.optionsList.map(t => t.permissionMode).join(","));
    Assert.areEqual("s-mode", host.factory.optionsList[1]?.resume);
  }

  @TestMethod
  public async startsAPlanFirstTurnInPlanAndSwitchesItToTheChosenModeOnlyOnceThePersonApprovedItsPlanAndItRan(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    listener.decisions.push("deny", "allow", "allow", "allow");
    const exit = (id: string, uuid: SDKAssistantMessage["uuid"], plan: string): SDKAssistantMessage =>
      SdkMessages.assistant(uuid, [SdkMessages.toolUse(id, "ExitPlanMode", { plan })], "claude-opus-5");
    const refused = new ToolAskStep("ExitPlanMode", { plan: "# Move it later" }, "tu-1");
    const approved = new ToolAskStep("ExitPlanMode", { plan: "# Move the cache" }, "tu-2");
    const edit = new ToolAskStep("Edit", { file_path: "cache.ts" }, "tu-3");
    const chosen = new ToolAskStep("ExitPlanMode", { plan: "# Plan again" }, "tu-4");
    const planning = new FakeClaudeQuery([SdkMessages.init("s-plan", "none", null, []),
      exit("tu-1", "11111111-1111-1111-1111-111111111111", "# Move it later"), refused,
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "Denied by the TeamRun user.", true)]),
      exit("tu-2", "33333333-3333-3333-3333-333333333333", "# Move the cache"), approved,
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "User has approved your plan.")]),
      edit, SdkMessages.success("s-plan", "Done.")]);
    const planned = new FakeClaudeQuery([SdkMessages.init("s-plan", "none", null, []), exit("tu-4", "55555555-5555-5555-5555-555555555555", "# Plan again"), chosen,
      SdkMessages.user("66666666-6666-6666-6666-666666666666", [SdkMessages.toolResult("tu-4", "User has approved your plan.")]), SdkMessages.success("s-plan", "Planned.")]);
    host.factory.next = planning;
    host.factory.queued.push(planned);
    const request = (mode: string, planFirst: boolean, resume: string | null): TurnRequest =>
      new TurnRequest(null, host.directory.path, "Plan", new RequestedSettings("claude", null, null, null, mode, planFirst), resume, [], null, null);
    const updates = (step: ToolAskStep): string => JSON.stringify((step.result as { updatedPermissions?: unknown }).updatedPermissions ?? null);

    const first = await adapter.runTurn(request("bypassPermissions", true, null), listener, new AbortController().signal);
    await adapter.runTurn(request("plan", false, first.nativeSessionId), listener, new AbortController().signal);

    Assert.areEqual("plan:true,plan:false", host.factory.optionsList.map(t => `${String(t.permissionMode)}:${String(t.allowDangerouslySkipPermissions)}`).join(","));
    Assert.areEqual("plan", adapter.planMode);
    Assert.areEqual("bypassPermissions|", `${planning.permissionModes.join(",")}|${planned.permissionModes.join(",")}`);
    Assert.areEqual("deny:null,allow:null,allow:null,allow:null", [refused, approved, edit, chosen]
      .map(t => `${(t.result as { behavior: string }).behavior}:${updates(t)}`).join(","));
    Assert.areEqual("Move the cache,Plan again", listener.details.filter(t => t.kind === DetailKind.Plan && ReplyPlan.fromJson(t.payload).approved)
      .map(t => ReplyPlan.fromJson(t.payload).title).join(","));
  }

  @TestMethod
  public async opensANewQueryInPlanForAPlanFirstTurnOnASessionWhoseQueryLeftPlanAndReusesOneThatStayedInPlan(): Promise<void> {
    const run = async (decision: string): Promise<string> => {
      using host = new ClaudeTestHost();
      const adapter = host.createAdapter();
      const listener = new RecordingTurnListener();
      listener.decisions.push(decision);
      const result = decision === "allow" ? SdkMessages.toolResult("tu-1", "User has approved your plan.") : SdkMessages.toolResult("tu-1", "Denied.", true);
      const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-warm", "none", null, []),
        SdkMessages.taskStarted("s-warm", "server", undefined, true, "npm start"),
        SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Tidy" })], "claude-opus-5"),
        new ToolAskStep("ExitPlanMode", { plan: "# Tidy" }, "tu-1"), SdkMessages.user("22222222-2222-2222-2222-222222222222", [result]),
        new StampedStep(SdkMessages.success("s-warm", "Planned")), new WaitForInputStep(), new StampedStep(SdkMessages.success("s-warm", "Again")),
        new WaitForCloseStep()]);
      host.factory.next = warm;
      host.factory.queued.push(new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-warm", "none", null, []),
        new StampedStep(SdkMessages.success("s-warm", "Again")), new WaitForCloseStep()]));
      const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "Plan",
        new RequestedSettings("claude", null, null, null, "bypassPermissions", true), resume, [], null, null);

      await adapter.runTurn(request(null), listener, new AbortController().signal);
      const next = await adapter.runTurn(request("s-warm"), listener, new AbortController().signal);
      await adapter.shutdown();
      return [next.outcome, host.factory.queries.length, warm.permissionModes.join(","), host.factory.optionsList.map(t => String(t.permissionMode)).join(",")].join(":");
    };

    Assert.areEqual(`${TurnOutcome.Completed}:2:bypassPermissions:plan,plan`, await run("allow"));
    Assert.areEqual(`${TurnOutcome.Completed}:1::plan`, await run("deny"));
  }

  @TestMethod
  public async returnsAQueryThatLeftPlanToPlanBeforeAWakeWhoseMemberPlansFirstAgainRunsAndLeavesItOnceThatPlanIsApproved(): Promise<void> {
    const run = async (planFirst: boolean): Promise<string> => {
      using host = new ClaudeTestHost();
      const adapter = host.createAdapter();
      const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-wake", "none", null, []),
        SdkMessages.taskStarted("s-wake", "server", undefined, true, "npm start"),
        SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Tidy" })], "claude-opus-5"),
        new ToolAskStep("ExitPlanMode", { plan: "# Tidy" }, "tu-1"),
        SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "User has approved your plan.")]),
        new StampedStep(SdkMessages.success("s-wake", "Planned")),
        SdkMessages.taskNotification("s-wake", "server", "completed", host.directory.resolve("missing.output")),
        SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("tu-2", "ExitPlanMode", { plan: "# Restart" })], "claude-opus-5"),
        new ToolAskStep("ExitPlanMode", { plan: "# Restart" }, "tu-2"),
        SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "User has approved your plan.")]),
        SdkMessages.success("s-wake", "Restarted"), new WaitForCloseStep()]);
      host.factory.next = warm;
      const listener = new RecordingTurnListener();
      listener.decisions.push("allow");
      listener.wakeTurn = new WakeTurn({}, planFirst);
      const follower = new RecordingTurnListener();
      follower.decisions.push("allow");
      let asked = String.empty;
      const decide = follower.onApprovalRequested.bind(follower);
      follower.onApprovalRequested = (ask, signal) => {
        asked = warm.permissionModes.join(",");
        return decide(ask, signal);
      };
      const woken = listener.wakeTurn.follow(follower, new AbortController().signal);

      await adapter.runTurn(new TurnRequest(null, host.directory.path, "Plan", new RequestedSettings("claude", null, null, null, "acceptEdits", true), null, [],
        null, null), listener, new AbortController().signal);
      const reply = await woken;
      await adapter.shutdown();
      return [reply.outcome, asked, warm.permissionModes.join(",")].join(":");
    };

    Assert.areEqual(`${TurnOutcome.Completed}:acceptEdits,plan:acceptEdits,plan,acceptEdits`, await run(true));
    Assert.areEqual(`${TurnOutcome.Completed}:acceptEdits:acceptEdits`, await run(false));
  }

  @TestMethod
  public async putsAQueryThatNeverPlannedInPlanBeforeAWakeWhoseMemberHadPlanFirstTurnedOnRunsAndLeavesItOnceThatPlanIsApproved(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-never", "none", null, []),
      SdkMessages.taskStarted("s-never", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-never", "Started")),
      SdkMessages.taskNotification("s-never", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Restart" })], "claude-opus-5"),
      new ToolAskStep("ExitPlanMode", { plan: "# Restart" }, "tu-1"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "User has approved your plan.")]),
      SdkMessages.success("s-never", "Restarted"), new WaitForCloseStep()]);
    host.factory.next = warm;
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({}, true);
    const follower = new RecordingTurnListener();
    follower.decisions.push("allow");
    let asked = String.empty;
    const decide = follower.onApprovalRequested.bind(follower);
    follower.onApprovalRequested = (ask, signal) => {
      asked = warm.permissionModes.join(",");
      return decide(ask, signal);
    };
    const woken = listener.wakeTurn.follow(follower, new AbortController().signal);

    await adapter.runTurn(new TurnRequest(null, host.directory.path, "Start", new RequestedSettings("claude", null, null, null, "acceptEdits", false), null, [],
      null, null), listener, new AbortController().signal);
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual("acceptEdits", String(host.factory.lastOptions?.permissionMode));
    Assert.areEqual("plan|plan,acceptEdits", `${asked}|${warm.permissionModes.join(",")}`);
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async stopsAWakeWhoseMemberPlansFirstWhenClaudeRefusesToReturnToPlanOrDoesntAnswerInTime(unanswered: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter(undefined, undefined, new ProviderTimings(5000, 5000, 5000, 50, 1000, 300, 500, 500, 200, 1, 20, 50, 40));
    const gate = new GateStep();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-refused", "none", null, []),
      SdkMessages.taskStarted("s-refused", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-refused", "Started")), gate,
      SdkMessages.taskNotification("s-refused", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Restarting")], "claude-opus-5"),
      new WaitForInterruptStep(), SdkMessages.failure("s-refused", "error_during_execution", ["interrupted"]), new WaitForCloseStep()]);
    host.factory.next = warm;
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({}, true);
    const follower = new RecordingTurnListener();
    const woken = listener.wakeTurn.follow(follower, new AbortController().signal);

    await adapter.runTurn(new TurnRequest(null, host.directory.path, "Start", new RequestedSettings("claude", null, null, null, "acceptEdits", false), null, [],
      null, null), listener, new AbortController().signal);
    if (unanswered)
      warm.permissionModeHangs.add("plan");
    else
      warm.permissionModeFailures.set("plan", new Error("Mode refused"));
    gate.open();
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Interrupted, reply.outcome);
    Assert.areEqual(0, warm.permissionModes.length);
    Assert.areEqual(JSON.stringify([Resources.formatClaudeWakePlanModeRefused(unanswered ? Resources.formatClaudeModeSwitchTimedOut("plan", 50) : "Mode refused")]),
      JSON.stringify(follower.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
  }

  @TestMethod
  public async returnsAnOpenQueryOfANamedSessionToPlanAtOnceSoAWakeWhoseFirstActIsAnEditClaudeAllowsWithoutAskingRunsInPlan(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-push", "none", null, []),
      SdkMessages.taskStarted("s-push", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-push", "Started")), gate,
      SdkMessages.taskNotification("s-push", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "Edit", { file_path: "server.ts" })], "claude-opus-5"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "Edited")]),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("tu-2", "ExitPlanMode", { plan: "# Restart" })], "claude-opus-5"),
      new ToolAskStep("ExitPlanMode", { plan: "# Restart" }, "tu-2"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "User has approved your plan.")]),
      SdkMessages.success("s-push", "Restarted"), new WaitForCloseStep()]);
    host.factory.next = warm;
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({}, true);
    const follower = new RecordingTurnListener();
    follower.decisions.push("allow");
    const woken = listener.wakeTurn.follow(follower, new AbortController().signal);

    await adapter.runTurn(new TurnRequest(null, host.directory.path, "Start", new RequestedSettings("claude", null, null, null, "acceptEdits", false), null, [],
      null, null), listener, new AbortController().signal);
    await adapter.plansFirst(["s-other"]);
    const untouched = warm.permissionModes.join(",");
    await adapter.plansFirst(["s-push"]);
    const before = warm.permissionModes.join(",");
    gate.open();
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual("|plan|plan,acceptEdits", [untouched, before, warm.permissionModes.join(",")].join("|"));
    Assert.areEqual("ExitPlanMode", follower.asks.map(t => t.nativeKind).join(","));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async logsAnOpenQueryThatStaysOutOfPlanWhenItsSessionPlansFirstAgainAndReturnsItThereWhenItWakes(unanswered: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, new ProviderTimings(5000, 5000, 5000, 50, 1000, 300, 500, 500, 200, 1, 20, 50, 40), undefined, log);
    const gate = new GateStep();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-kept", "none", null, []),
      SdkMessages.taskStarted("s-kept", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-kept", "Started")), gate,
      SdkMessages.taskNotification("s-kept", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Planning")], "claude-opus-5"),
      SdkMessages.success("s-kept", "Planned"), new WaitForCloseStep()]);
    host.factory.next = warm;
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({}, true);
    const woken = listener.wakeTurn.follow(new RecordingTurnListener(), new AbortController().signal);

    await adapter.runTurn(new TurnRequest(null, host.directory.path, "Start", new RequestedSettings("claude", null, null, null, "acceptEdits", false), null, [],
      null, null), listener, new AbortController().signal);
    if (unanswered)
      warm.permissionModeHangs.add("plan");
    else
      warm.permissionModeFailures.set("plan", new Error("Mode refused"));
    await adapter.plansFirst(["s-kept"]);
    warm.permissionModeHangs.clear();
    warm.permissionModeFailures.clear();
    gate.open();
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual("plan", warm.permissionModes.join(","));
    Assert.areEqual(JSON.stringify([Resources.formatClaudePlanModeNotReturned("s-kept", unanswered ? Resources.formatClaudeModeSwitchTimedOut("plan", 50) : "Mode refused")]),
      JSON.stringify(log.lines));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async switchesAQueryReturnedToPlanBackBeforeAWakeOnceItsMemberNoLongerPlansFirstOrNotesThatItStays(refused: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const gate = new GateStep();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-back", "none", null, []),
      SdkMessages.taskStarted("s-back", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-back", "Started")), gate,
      SdkMessages.taskNotification("s-back", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("Restarted")], "claude-opus-5"),
      SdkMessages.success("s-back", "Restarted"), new WaitForCloseStep()]);
    host.factory.next = warm;
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({}, false);
    const follower = new RecordingTurnListener();
    const woken = listener.wakeTurn.follow(follower, new AbortController().signal);

    await adapter.runTurn(new TurnRequest(null, host.directory.path, "Start", new RequestedSettings("claude", null, null, null, "acceptEdits", false), null, [],
      null, null), listener, new AbortController().signal);
    await adapter.plansFirst(["s-back"]);
    if (refused)
      warm.permissionModeFailures.set("acceptEdits", new Error("Mode refused"));
    gate.open();
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual(refused ? "plan" : "plan,acceptEdits", warm.permissionModes.join(","));
    Assert.areEqual(JSON.stringify(refused ? [Resources.formatClaudePlanModeStayed("Mode refused")] : []),
      JSON.stringify(follower.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async switchesAQueryReturnedToPlanBackBeforeThePersonsNextMessageThatDoesntPlanFirstOrNotesThatItStays(refused: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-next", "none", null, []),
      SdkMessages.taskStarted("s-next", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-next", "Started")), new WaitForInputStep(), new StampedStep(SdkMessages.success("s-next", "Again")),
      new WaitForCloseStep()]);
    host.factory.next = warm;
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "Go on",
      new RequestedSettings("claude", null, null, null, "acceptEdits", false), resume, [], null, null);
    const next = new RecordingTurnListener();

    await adapter.runTurn(request(null), new RecordingTurnListener(), new AbortController().signal);
    await adapter.plansFirst(["s-next"]);
    if (refused)
      warm.permissionModeFailures.set("acceptEdits", new Error("Mode refused"));
    const reply = await adapter.runTurn(request("s-next"), next, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual(1, host.factory.queries.length);
    Assert.areEqual(refused ? "|plan" : "|plan,acceptEdits", warm.modesAtInputs.join("|"));
    Assert.areEqual(refused ? "plan" : "plan,acceptEdits", warm.permissionModes.join(","));
    Assert.areEqual(JSON.stringify(refused ? [Resources.formatClaudePlanModeStayed("Mode refused")] : []),
      JSON.stringify(next.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public async sendsPlanAgainOnceItsChatPlansFirstAfterASwitchBackClaudeDidntAnswerInTimeSinceItMayStillLandAndLeavesPlanForTheModeItLeft(pushed: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter(undefined, undefined, new ProviderTimings(5000, 5000, 5000, 50, 1000, 300, 500, 500, 200, 1, 20, 50, 40));
    const gate = new GateStep();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-unsure", "none", null, []),
      SdkMessages.taskStarted("s-unsure", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-unsure", "Started")), new WaitForInputStep(), new StampedStep(SdkMessages.success("s-unsure", "Again")), gate,
      SdkMessages.taskNotification("s-unsure", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Restart" })], "claude-opus-5"),
      new ToolAskStep("ExitPlanMode", { plan: "# Restart" }, "tu-1"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "User has approved your plan.")]),
      SdkMessages.success("s-unsure", "Restarted"), new WaitForCloseStep()]);
    host.factory.next = warm;
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "Go on",
      new RequestedSettings("claude", null, null, null, "acceptEdits", false), resume, [], null, null);
    const next = new RecordingTurnListener();
    next.wakeTurn = new WakeTurn({}, true);
    const follower = new RecordingTurnListener();
    follower.decisions.push("allow");
    const woken = next.wakeTurn.follow(follower, new AbortController().signal);

    await adapter.runTurn(request(null), new RecordingTurnListener(), new AbortController().signal);
    await adapter.plansFirst(["s-unsure"]);
    warm.permissionModeHangs.add("acceptEdits");
    await adapter.runTurn(request("s-unsure"), next, new AbortController().signal);
    warm.permissionModeHangs.clear();
    if (pushed)
      await adapter.plansFirst(["s-unsure"]);
    const resent = warm.permissionModes.join(",");
    gate.open();
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual(`${pushed ? "plan,plan" : "plan"}|plan,plan,acceptEdits`, `${resent}|${warm.permissionModes.join(",")}`);
    Assert.areEqual(JSON.stringify([Resources.formatClaudePlanModeStayed(Resources.formatClaudeModeSwitchTimedOut("acceptEdits", 50))]),
      JSON.stringify(next.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
    Assert.areEqual("ExitPlanMode", follower.asks.map(t => t.nativeKind).join(","));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async sendsTheModeOfThePersonsNextMessageThatDoesntPlanFirstOnAQueryWhosePushToPlanClaudeDidntAnswerInTimeOrNotesThatItMayStillPlan(refused: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(undefined, undefined, new ProviderTimings(5000, 5000, 5000, 50, 1000, 300, 500, 500, 200, 1, 20, 50, 40), undefined, log);
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-late", "none", null, []),
      SdkMessages.taskStarted("s-late", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-late", "Started")), new WaitForInputStep(), new StampedStep(SdkMessages.success("s-late", "Again")),
      new WaitForCloseStep()]);
    host.factory.next = warm;
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "Go on",
      new RequestedSettings("claude", null, null, null, "acceptEdits", false), resume, [], null, null);
    const next = new RecordingTurnListener();

    await adapter.runTurn(request(null), new RecordingTurnListener(), new AbortController().signal);
    warm.permissionModeHangs.add("plan");
    await adapter.plansFirst(["s-late"]);
    warm.permissionModeHangs.clear();
    if (refused)
      warm.permissionModeFailures.set("acceptEdits", new Error("Mode refused"));
    const reply = await adapter.runTurn(request("s-late"), next, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual(1, host.factory.queries.length);
    Assert.areEqual(JSON.stringify([Resources.formatClaudePlanModeNotReturned("s-late", Resources.formatClaudeModeSwitchTimedOut("plan", 50))]), JSON.stringify(log.lines));
    Assert.areEqual(refused ? "|" : "|acceptEdits", warm.modesAtInputs.join("|"));
    Assert.areEqual(JSON.stringify(refused ? [Resources.formatClaudePlanModeStayed("Mode refused")] : []),
      JSON.stringify(next.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async switchesAQueryWhoseApprovedPlanClaudeDidntLeaveToTheRequestedModeBeforeAWakeThatDoesntPlanFirst(refused: boolean): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter(undefined, undefined, new ProviderTimings(5000, 5000, 5000, 50, 1000, 300, 500, 500, 200, 1, 20, 50, 40));
    const gate = new GateStep();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-kept", "none", null, []),
      SdkMessages.taskStarted("s-kept", "server", undefined, true, "npm start"),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Serve" })], "claude-opus-5"),
      new ToolAskStep("ExitPlanMode", { plan: "# Serve" }, "tu-1"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "User has approved your plan.")]),
      new StampedStep(SdkMessages.success("s-kept", "Planned")), gate,
      SdkMessages.taskNotification("s-kept", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.text("Restarted")], "claude-opus-5"),
      SdkMessages.success("s-kept", "Restarted"), new WaitForCloseStep()]);
    host.factory.next = warm;
    const listener = new RecordingTurnListener();
    listener.decisions.push("allow");
    listener.wakeTurn = new WakeTurn({}, false);
    const follower = new RecordingTurnListener();
    const woken = listener.wakeTurn.follow(follower, new AbortController().signal);
    if (refused)
      warm.permissionModeFailures.set("acceptEdits", new Error("Mode refused"));
    else
      warm.permissionModeHangs.add("acceptEdits");

    await adapter.runTurn(new TurnRequest(null, host.directory.path, "Plan", new RequestedSettings("claude", null, null, null, "acceptEdits", true), null, [],
      null, null), listener, new AbortController().signal);
    const kept = warm.permissionModes.join(",");
    warm.permissionModeHangs.clear();
    warm.permissionModeFailures.clear();
    gate.open();
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual("|acceptEdits", `${kept}|${warm.permissionModes.join(",")}`);
    Assert.areEqual(JSON.stringify([Resources.formatClaudePlanModeKept(refused ? "Mode refused" : Resources.formatClaudePlanModeTimedOut(50))]),
      JSON.stringify(listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
    Assert.areEqual(0, follower.details.filter(t => t.kind === DetailKind.Note).length);
  }

  @TestMethod
  public async notesThatClaudeKeptPlanModeForAnApprovedPlanFirstWakeOnceTheChatsRequestTimePasses(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter(undefined, undefined, new ProviderTimings(5000, 5000, 5000, 50, 1000, 300, 500, 500, 200, 1, 20, 50, 40));
    const gate = new GateStep();
    const warm = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-slow", "none", null, []),
      SdkMessages.taskStarted("s-slow", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-slow", "Started")), gate,
      SdkMessages.taskNotification("s-slow", "server", "completed", host.directory.resolve("missing.output")),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Restart" })], "claude-opus-5"),
      new ToolAskStep("ExitPlanMode", { plan: "# Restart" }, "tu-1"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "User has approved your plan.")]),
      SdkMessages.success("s-slow", "Restarted"), new WaitForCloseStep()]);
    warm.permissionModeHangs.add("acceptEdits");
    host.factory.next = warm;
    const listener = new RecordingTurnListener();
    listener.wakeTurn = new WakeTurn({}, true);
    const follower = new RecordingTurnListener();
    follower.decisions.push("allow");
    const woken = listener.wakeTurn.follow(follower, new AbortController().signal);

    await adapter.runTurn(new TurnRequest(null, host.directory.path, "Start", new RequestedSettings("claude", null, null, null, "acceptEdits", false), null, [],
      null, null), listener, new AbortController().signal);
    gate.open();
    const reply = await woken;
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, reply.outcome);
    Assert.areEqual("plan", warm.permissionModes.join(","));
    Assert.areEqual(JSON.stringify([Resources.formatClaudePlanModeKept(Resources.formatClaudePlanModeTimedOut(50))]),
      JSON.stringify(follower.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
  }

  @TestMethod
  public async keepsPlanModeAndApprovesNothingForAnExitPlanModeSuccessThePersonWasntAskedAboutAsInBypass(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const query = new FakeClaudeQuery([SdkMessages.init("s-bypass", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "ExitPlanMode", { plan: "# Skip asking" })], "claude-opus-5"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "User has approved your plan.")]),
      SdkMessages.success("s-bypass", "Done.")]);
    host.factory.next = query;

    await adapter.runTurn(new TurnRequest(null, host.directory.path, "Plan", new RequestedSettings("claude", null, null, null, "bypassPermissions", true), null, [],
      null, null), listener, new AbortController().signal);

    Assert.areEqual("plan:true", `${String(host.factory.lastOptions?.permissionMode)}:${String(host.factory.lastOptions?.allowDangerouslySkipPermissions)}`);
    Assert.areEqual(0, listener.asks.length);
    Assert.areEqual(0, query.permissionModes.length);
    Assert.areEqual("Skip asking:false", listener.details.filter(t => t.kind === DetailKind.Plan)
      .map(t => `${ReplyPlan.fromJson(t.payload).title}:${ReplyPlan.fromJson(t.payload).approved}`).join(","));
  }

  @TestMethod
  public async sendsASpeedOnlyForAListedModelThatListsItListingTheModelsFirstWhenItHasnt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const listing = new FakeClaudeQuery([]);
    listing.models = [
      { value: "opus", displayName: "Opus", description: "Fast", supportsFastMode: true },
      { value: "sonnet", displayName: "Sonnet", description: "Standard only", supportsFastMode: false }
    ];
    const turn = (): FakeClaudeQuery => new FakeClaudeQuery([SdkMessages.init("s-8", "none", null, []) as SDKSystemMessage, SdkMessages.success("s-8", "ok") as SDKResultMessage]);
    host.factory.next = listing;
    host.factory.queued.push(turn(), turn(), turn());
    const run = async (model: string): Promise<string> => {
      await adapter.runTurn(host.createRequest("Hi", null, null, model, null, "fast"), new RecordingTurnListener(), new AbortController().signal);
      return JSON.stringify(host.factory.lastOptions?.settings);
    };

    Assert.areEqual(JSON.stringify({ fastMode: false }), await run("sonnet"));
    Assert.areEqual(JSON.stringify({ fastMode: true }), await run("opus"));
    Assert.areEqual(JSON.stringify({ fastMode: false }), await run("unlisted"));
    Assert.areEqual(4, host.factory.queries.length);
  }

  @TestMethod
  public async dropsTheChosenSpeedWhenListingTheProvidersModelsAtTheTurnFails(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const listing = new FakeClaudeQuery([]);
    listing.modelsFailure = new Error("listing failed");
    host.factory.next = listing;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-9", "none", null, []) as SDKSystemMessage, SdkMessages.success("s-9", "ok") as SDKResultMessage]));

    const result = await adapter.runTurn(host.createRequest("Hi", host.createProvider(), null, "opus", null, "fast"), new RecordingTurnListener(),
      new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify({ fastMode: false }), JSON.stringify(host.factory.lastOptions?.settings));
  }

  @TestMethod
  public async endsATurnAsStoppedWhenStopComesBeforeOrDuringTheListingOfModelsForItsSpeed(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter(host.environment, host.command, new ProviderTimings(5000, 5000, 5000, 200, 1000, 300, 500, 500, 200, 1, 20, 50, 40));
    const listing = new FakeClaudeQuery([]);
    listing.modelsHang = true;
    host.factory.next = listing;
    const stop = new AbortController();

    const during = adapter.runTurn(host.createRequest("Hi", null, null, "opus", null, "fast"), new RecordingTurnListener(), stop.signal);
    stop.abort();
    const results = [await during, await adapter.runTurn(host.createRequest("Hi", null, null, "opus", null, "fast"), new RecordingTurnListener(), stop.signal)];

    Assert.areEqual("Interrupted,Interrupted", results.map(t => t.outcome).join(","));
    Assert.areEqual("null,null", results.map(t => String(t.error)).join(","));
    Assert.areEqual("1,1", [host.factory.queries.length, adapter.activeRunCount].join(","));
    await Wait.until(() => adapter.activeRunCount === 0, "The adapter still had an active run.");
  }

  @TestMethod
  public async listsAsAModelsDefaultTheEffortItsSessionReportedWhenNoneWasSentFromItsInitOrElseItsAppliedSettings(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider();
    const models: ModelInfo[] = [
      { value: "sonnet", displayName: "Sonnet", description: "Alias", resolvedModel: "claude-sonnet-5", supportedEffortLevels: ["low", "medium", "high"] },
      { value: "opus", displayName: "Opus", description: "Other", supportedEffortLevels: ["low", "medium", "high"] },
      { value: "plain", displayName: "Plain", description: "Same model, levels unlisted", resolvedModel: "claude-sonnet-5" }
    ];
    const list = async (owner: Provider | null): Promise<readonly string[]> => {
      host.factory.next = new FakeClaudeQuery([]);
      host.factory.next.models = models;
      return (await adapter.listModels(owner)).models.map(t => String(t.defaultEffort));
    };
    const run = async (effort: string | null, reported: EffortLevel | null, applied: unknown = undefined): Promise<void> => {
      host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-5", "none", reported, []), SdkMessages.success("s-5", "ok")]);
      host.factory.next.settingsResult = { applied: { effort: applied } };
      await adapter.runTurn(host.createRequest("Hi", provider, null, null, effort), new RecordingTurnListener(), new AbortController().signal);
    };

    Assert.areEqual("null,null,null", (await list(provider)).join(","));
    await run("high", "high");
    Assert.areEqual("null,null,null", (await list(provider)).join(","));
    await run(null, "medium");
    Assert.areEqual("medium,null,null", (await list(provider)).join(","));
    Assert.areEqual("null,null,null", (await list(null)).join(","));
    await run("low", "low");
    await run(null, null);
    Assert.areEqual("medium,null,null", (await list(provider)).join(","));
    await run(null, "max");
    Assert.areEqual("null,null,null", (await list(provider)).join(","));
    await run(null, null, "low");
    Assert.areEqual("low,null,null", (await list(provider)).join(","));
    await run(null, "high", "low");
    Assert.areEqual("high,null,null", (await list(provider)).join(","));
  }

  @TestMethod
  public async reportsStreamFailuresWithTheStderrTail(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-3", "none", null, []), new FailureStep(new Error("stream broke"))]);
    query.stderrLines.push("first line\n", "second line\n");
    query.closeFailure = new Error("already closed");
    host.factory.next = query;

    const result = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual("stream broke\n[stderr]\nfirst line\nsecond line\n", result.error);
    Assert.areEqual("s-3", result.nativeSessionId);
  }

  @TestMethod
  public async finishesEachOfClaudesEventsBeforeHandlingTheNextWhileItsDetailIsHeld(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-held", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.text("One")], "claude-opus-5"),
      SdkMessages.assistant("22222222-2222-2222-2222-222222222222", [SdkMessages.text("Two")], "claude-opus-5"),
      SdkMessages.success("s-held", "Two")]);
    const listener = new RecordingTurnListener();
    const release = Promise.withResolvers<void>();
    listener.heldDetail = release.promise;

    try {
      const running = adapter.runTurn(host.createRequest("Hi"), listener, new AbortController().signal);
      await Wait.until(() => listener.details.length > 0, "Claude's first detail did not reach the listener.");
      const held = [listener.texts.join(), listener.finishedDetails.length];
      release.resolve();
      const result = await running;

      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      Assert.areEqual(JSON.stringify(["One", 0]), JSON.stringify(held));
      Assert.areEqual("One,Two", listener.texts.join());
      Assert.areEqual("One,Two", listener.finishedDetails.map(t => t.text).join());
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async interruptsOnAbortKeepingTheTextWrittenAndTreatsLaterFailuresAsInterruptionsWithoutANote(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-4", "none", null, []),
      SdkMessages.assistant("44444444-4444-4444-4444-444444444444", [SdkMessages.text("Here is half an answer")], "claude-opus-5"), new WaitForInterruptStep(),
      SdkMessages.failure("s-4", "error_during_execution", ["[ede_diagnostic] killed"])]);
    host.factory.next = query;
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("Hi"), listener, controller.signal);
    await Wait.until(() => listener.details.some(t => t.kind === DetailKind.Text), "The listener did not see a text detail.");
    controller.abort();
    const result = await running;

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isNull(result.error);
    Assert.areEqual(1, query.interruptCount);
    Assert.areEqual("Here is half an answer", listener.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join(""));
    Assert.areEqual(0, listener.details.filter(t => t.kind === DetailKind.Note).length);
  }

  @TestMethod
  public async abortsTheProcessWhenTheInterruptIsRefused(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-6", "none", null, []), new WaitForInterruptStep(), SdkMessages.success("s-6", "never")]);
    query.interruptFailure = new Error("no interrupt");
    host.factory.next = query;

    const result = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), AbortSignal.abort());

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isTrue(query.options?.abortController?.signal.aborted ?? false);
    Assert.areEqual(0, query.interruptCount);
  }

  @TestMethod
  public async startsNoQueryForAListOrATurnWhoseEnvironmentIsStillBeingReadWhenItShutsDown(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const read = Promise.withResolvers<void>();
    host.starter.reading = read.promise;
    const listing = Assert.throwsAsync(() => adapter.listModels(null), ProviderStoppedException);
    const running = Assert.throwsAsync(() => adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal), ProviderStoppedException);
    await Wait.until(() => host.starter.reads >= 2, "The starter did not read Claude's output twice.");

    await adapter.shutdown();
    read.resolve();

    Assert.areEqual(Resources.formatStoppedForShutdown("Claude Code"), (await listing).message);
    Assert.areEqual(Resources.formatStoppedForShutdown("Claude Code"), (await running).message);
    Assert.areEqual(0, host.factory.queries.length);
    Assert.areEqual(0, adapter.activeRunCount);
  }

  @TestMethod
  public async startsNoQueryForATurnStillListingTheModelsForItsSpeedWhenItShutsDown(): Promise<void> {
    using host = new ClaudeTestHost();
    const query = new FakeClaudeQuery([]);
    query.modelsHang = true;
    host.factory.next = query;
    const adapter = new ClaudeAdapter(host.command, host.environment, "test", host.factory, host.runner, host.versionReader,
      new ProviderTimings(5000, 5000, 5000, 200, 1000, 300, 500, 500, 200, 1, 20));
    const running = Assert.throwsAsync(() => adapter.runTurn(host.createRequest("Hi", null, null, "opus", null, "fast"), new RecordingTurnListener(),
      new AbortController().signal), Error);
    await Wait.until(() => adapter.activeRunCount === 1, "The adapter did not have an active run.");

    await adapter.shutdown();

    Assert.areEqual(Resources.formatStoppedForShutdown("Claude Code"), (await running).message);
    Assert.areEqual(1, host.factory.queries.length);
    Assert.areEqual(0, adapter.activeRunCount);
  }

  @TestMethod
  public async shutsDownActiveRuns(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([SdkMessages.init("s-5", "none", null, []), new WaitForInterruptStep(), SdkMessages.success("s-5", "late")]);
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.createRequest("Hi"), listener, new AbortController().signal);
    await Wait.until(() => adapter.activeRunCount === 1, "The adapter did not have an active run.");
    await adapter.shutdown();
    const result = await running;

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(1, query.interruptCount);
    Assert.areEqual(0, adapter.activeRunCount);
  }

  @TestMethod
  public async sendsCompactAsThePromptToAResumedSessionAndSaysThereIsNothingToCompactWhenTheResumeFails(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "Continue", new RequestedSettings("claude", null, null), resume, [],
      null, "full transcript", {}, true);
    const missing = new FakeClaudeQuery([new FailureStep(new Error("Claude Code process exited with code 1"))]);
    missing.stderrLines.push("No conversation found with session ID: gone");
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-1", "none", null, []), SdkMessages.compactBoundary("s-1", "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"), SdkMessages.success("s-1", "ok")]);
    host.factory.queued.push(missing);
    const listener = new RecordingTurnListener();

    const compacted = await adapter.runTurn(request("s-1"), listener, new AbortController().signal);
    const lost = new RecordingTurnListener();
    const restarted = await adapter.runTurn(request("gone"), lost, new AbortController().signal);
    const unresumed = new RecordingTurnListener();
    const sessionless = await adapter.runTurn(request(null), unresumed, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, compacted.outcome);
    Assert.isTrue(listener.texts.includes("Claude Code compacted its context."));
    Assert.areEqual(TurnOutcome.Completed, restarted.outcome);
    Assert.isNull(restarted.nativeSessionId);
    Assert.isTrue(lost.texts.includes("There's no session to compact."));
    Assert.areEqual(TurnOutcome.Completed, sessionless.outcome);
    Assert.isNull(sessionless.nativeSessionId);
    Assert.areEqual(JSON.stringify(["There's no session to compact."]), JSON.stringify(unresumed.texts));
    Assert.areEqual("/compact,/compact", host.factory.promptTexts.join(","));
  }

  @TestMethod
  public async keepsASessionsPlanWhenAnEffortChangeOpensAnotherQueryOnItSoAnEarlierTaskStillUpdates(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const created = SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "Task #1 created successfully: Fix the bug")]);
    created.tool_use_result = { task: { id: "1", subject: "Fix the bug" } };
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-plan", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "TaskCreate", { subject: "Fix the bug" })], "claude-opus-5"),
      created, SdkMessages.success("s-plan", "Planned.")]);
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-plan", "none", null, []),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("tu-2", "TaskUpdate", { taskId: "1", status: "completed" })], "claude-opus-5"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "Updated task #1 status")]),
      SdkMessages.success("s-plan", "Done.")]));
    const request = (prompt: string, effort: string, resume: string | null): TurnRequest =>
      new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("claude", null, effort), resume, [], null, null);

    const first = await adapter.runTurn(request("Plan", "low", null), new RecordingTurnListener(), new AbortController().signal);
    const listener = new RecordingTurnListener();
    await adapter.runTurn(request("Continue", "high", first.nativeSessionId), listener, new AbortController().signal);

    Assert.areEqual("low,high", host.factory.optionsList.map(t => t.effort).join(","));
    Assert.areEqual("Fix the bug:Completed", listener.details.filter(t => t.kind === DetailKind.Plan)
      .map(t => ReplyPlan.fromJson(t.payload).steps.map(u => `${u.text}:${u.status}`).join()).join("|"));
  }

  @TestMethod
  public async keepsOnlyTheMostRecentlyUsedSessionsPlansSoOneLongUnusedNoLongerUpdatesItsEarlierTasks(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const created = SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-1", "Task #1 created successfully: Fix the bug")]);
    created.tool_use_result = { task: { id: "1", subject: "Fix the bug" } };
    const update = (session: string): FakeClaudeQuery => new FakeClaudeQuery([SdkMessages.init(session, "none", null, []),
      SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("tu-2", "TaskUpdate", { taskId: "1", status: "completed" })], "claude-opus-5"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("tu-2", "Updated task #1 status")]), SdkMessages.success(session, "Done.")]);
    const plan = (session: string): FakeClaudeQuery => new FakeClaudeQuery([SdkMessages.init(session, "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-1", "TaskCreate", { subject: "Fix the bug" })], "claude-opus-5"),
      created, SdkMessages.success(session, "Planned.")]);
    const run = async (resume: string | null, effort: string): Promise<number> => {
      const listener = new RecordingTurnListener();
      await adapter.runTurn(new TurnRequest(null, host.directory.path, "Go", new RequestedSettings("claude", null, effort), resume, [], null, null), listener,
        new AbortController().signal);
      return listener.details.filter(t => t.kind === DetailKind.Plan).length;
    };

    host.factory.next = plan("s-old");
    host.factory.queued.push(plan("s-dropped"), new FakeClaudeQuery([SdkMessages.init("s-old", "none", null, []), SdkMessages.success("s-old", "ok")]));
    for (let index = 1; index < Resources.maximumClaudePlans; index++)
      host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init(`s-${index}`, "none", null, []), SdkMessages.success(`s-${index}`, "ok")]));
    host.factory.queued.push(update("s-old"), update("s-dropped"));
    await run(null, "low");
    await run(null, "low");
    await run("s-old", "medium");
    for (let index = 1; index < Resources.maximumClaudePlans; index++)
      await run(null, "low");

    Assert.areEqual("1,0", [await run("s-old", "high"), await run("s-dropped", "high")].join(","));
  }

  @TestMethod
  public async startsAFreshSessionWithoutForkingWhenTheForkCannotResume(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.failure("gone", "error_during_execution", ["No message found with message.uuid of: entry-1"])]);
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("fresh", "none", null, []), SdkMessages.success("fresh", "ok")]));
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(ClaudeAdapterTests.resumeRequest(host, "gone", "full transcript", "entry-1"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("fresh", result.nativeSessionId);
    Assert.areEqual(JSON.stringify(["gone", "entry-1", true]),
      JSON.stringify([host.factory.optionsList[0]?.resume, host.factory.optionsList[0]?.resumeSessionAt, host.factory.optionsList[0]?.forkSession]));
    Assert.areEqual(JSON.stringify([null, null, null]),
      JSON.stringify([host.factory.optionsList[1]?.resume ?? null, host.factory.optionsList[1]?.resumeSessionAt ?? null, host.factory.optionsList[1]?.forkSession ?? null]));
    Assert.areEqual("Continue,full transcript", host.factory.promptTexts.join(","));
    Assert.isTrue(listener.texts[0]?.startsWith("The native session could not be resumed, so a fresh one was started") ?? false);
    Assert.areEqual(JSON.stringify({ source: "resume" }), JSON.stringify(listener.details[0]?.payload));
  }

  @TestMethod
  public async startsAFreshSessionOnTheFreshPromptWhenTheResumeFailsAndResumesItNext(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const missing = new FakeClaudeQuery([new FailureStep(new Error("Claude Code process exited with code 1"))]);
    missing.stderrLines.push("No conversation found with session ID: gone");
    host.factory.next = missing;
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("fresh", "none", null, []), SdkMessages.success("fresh", "ok")]),
      new FakeClaudeQuery([SdkMessages.failure("lost", "error_during_execution", ["No conversation found with session ID: lost"])]),
      new FakeClaudeQuery([SdkMessages.init("fresh", "none", null, []), SdkMessages.success("fresh", "ok")]),
      new FakeClaudeQuery([SdkMessages.init("fresh", "none", null, []), SdkMessages.success("fresh", "again")]));
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(ClaudeAdapterTests.resumeRequest(host, "gone"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("fresh", result.nativeSessionId);
    Assert.isFalse(listener.starts[0]?.resumedNativeSession ?? true);
    Assert.areEqual(1, listener.starts.length);
    Assert.isTrue(listener.texts[0]?.startsWith("The native session could not be resumed, so a fresh one was started: Claude Code process exited with code 1") ?? false);
    Assert.isTrue(listener.texts[0]?.includes("No conversation found with session ID: gone") ?? false);
    Assert.areEqual("gone", host.factory.optionsList[0]?.resume);
    Assert.isUndefined(host.factory.optionsList[1]?.resume);
    Assert.areEqual("Continue,full transcript", host.factory.promptTexts.join(","));

    const reported = new RecordingTurnListener();
    Assert.areEqual(TurnOutcome.Completed, (await adapter.runTurn(ClaudeAdapterTests.resumeRequest(host, "lost"), reported, new AbortController().signal)).outcome);
    Assert.areEqual("The native session could not be resumed, so a fresh one was started: error_during_execution: No conversation found with session ID: lost",
      reported.texts[0]);

    const next = new RecordingTurnListener();
    const resumed = await adapter.runTurn(ClaudeAdapterTests.resumeRequest(host, result.nativeSessionId!), next, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
    Assert.isTrue(next.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual("fresh", host.factory.optionsList.at(-1)?.resume);
    Assert.areEqual("Continue", host.factory.promptTexts.at(-1));
    Assert.areEqual(0, next.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual(5, host.factory.queries.length);
  }

  @TestMethod
  public async reportsTheFreshSessionsFailureAfterAFailedResume(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([new FailureStep(new Error("not found"))]);
    host.factory.queued.push(new FakeClaudeQuery([new FailureStep(new Error("still down"))]));
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(ClaudeAdapterTests.resumeRequest(host, "gone", null), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual("still down", result.error);
    Assert.areEqual("The native session could not be resumed, so a fresh one was started: not found", listener.texts[0]);
    Assert.areEqual(2, host.factory.queries.length);
    Assert.areEqual("Continue,Continue", host.factory.promptTexts.join(","));
  }

  @TestMethod
  public async keepsTheResumedSessionsFailureOnceClaudeStartedIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("kept", "none", null, []), new FailureStep(new Error("boom"))]);
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(ClaudeAdapterTests.resumeRequest(host, "kept"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual("boom", result.error);
    Assert.isTrue(listener.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(0, listener.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual(1, host.factory.queries.length);
  }

  @TestMethod
  public async startsNoFreshSessionWhenAFailedResumeWasInterruptedOrStopped(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([new FailureStep(new Error("not found"))]);
    const interrupted = await adapter.runTurn(ClaudeAdapterTests.resumeRequest(host, "gone"), new RecordingTurnListener(), AbortSignal.abort());
    Assert.areEqual(TurnOutcome.Interrupted, interrupted.outcome);
    Assert.areEqual(1, host.factory.queries.length);

    host.factory.next = new FakeClaudeQuery([new WaitForInterruptStep(), new FailureStep(new Error("stopped"))]);
    const running = adapter.runTurn(ClaudeAdapterTests.resumeRequest(host, "gone"), new RecordingTurnListener(), new AbortController().signal);
    await Wait.until(() => adapter.activeRunCount === 1, "The adapter did not have an active run.");
    await adapter.shutdown();
    const stopped = await running;
    Assert.areEqual(TurnOutcome.Failed, stopped.outcome);
    Assert.areEqual(2, host.factory.queries.length);
    Assert.areEqual(0, adapter.activeRunCount);
  }

  @TestMethod
  public async listsEachModelsContextWindowsUpToTheWindowItsLastResultReportedOnTheProviderAndUpTo1MUnreportedBeforeOne(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider();
    const list = async (owner: Provider | null): Promise<string> => {
      host.factory.next = new FakeClaudeQuery([]);
      host.factory.next.models = [
        { value: "sonnet", displayName: "Sonnet", description: "Alias", resolvedModel: "claude-sonnet-5" },
        { value: "opus", displayName: "Opus", description: "Other" }
      ];
      return (await adapter.listModels(owner)).models.map(t => Object.isNull(t.contextWindows) ? "none"
        : `${t.contextWindows.presets.join("+")}:${t.contextWindows.minimum}-${t.contextWindows.maximum}:${t.contextWindows.reported}`).join("|");
    };
    const run = async (window: number): Promise<void> => {
      host.factory.next = ClaudeAdapterTests.usageQuery("s-windows", "user", { "claude-sonnet-5": window });
      await adapter.runTurn(host.createRequest("Hi", provider), new RecordingTurnListener(), new AbortController().signal);
    };
    const all = "200000+400000+1000000:100000-1000000:false";

    const before = await list(provider);
    await run(200_000);
    const reported = [await list(provider), await list(null)];
    await run(0);
    const kept = await list(provider);
    await run(150_000);
    const custom = await list(provider);
    await run(50_000);
    const tooSmall = await list(provider);
    await run(2_000_000);

    Assert.areEqual(`${all}|${all}`, before);
    Assert.areEqual(`200000:100000-200000:true|${all},${all}|${all}`, reported.join(","));
    Assert.areEqual(`200000:100000-200000:true|${all}`, kept);
    Assert.areEqual(`:100000-150000:true|${all}`, custom);
    Assert.areEqual(`none|${all}`, tooSmall);
    Assert.areEqual(`200000+400000+1000000:100000-1000000:true|${all}`, await list(provider));
  }

  @TestMethod
  @TestData(400_000, 400_000, 1)
  @TestData(400_000, null, 2)
  @TestData(null, 150_000, 2)
  public async sendsAChosenContextWindowAsTheAutoCompactWindowAndResumesTheSessionOnANewQueryWhenItChanges(first: number | null, second: number | null,
    queries: number): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([
      new WaitForInputStep(),
      SdkMessages.init("s-window", "none", null, []),
      SdkMessages.taskStarted("s-window", "server", undefined, true, "npm start"),
      new StampedStep(SdkMessages.success("s-window", "Started")),
      new WaitForInputStep(),
      new StampedStep(SdkMessages.success("s-window", "Again")),
      new WaitForCloseStep()
    ]);
    host.factory.queued.push(new FakeClaudeQuery([SdkMessages.init("s-window", "none", null, []), SdkMessages.success("s-window", "Again")]));
    const settings = (window: number | null): string => JSON.stringify({ fastMode: false, ...Object.isNull(window) ? {} : { autoCompactWindow: window } });

    await adapter.runTurn(host.createRequest("Start", null, null, null, null, null, null, first), new RecordingTurnListener(), new AbortController().signal);
    const result = await adapter.runTurn(host.createRequest("Again", null, "s-window", null, null, null, null, second), new RecordingTurnListener(),
      new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(queries, host.factory.queries.length);
    Assert.areEqual([first, second].slice(0, queries).map(settings).join(","), host.factory.optionsList.map(t => JSON.stringify(t.settings)).join(","));
    Assert.areEqual(queries === 2 ? "s-window" : "none", host.factory.optionsList[1]?.resume ?? "none");
  }

  @TestMethod
  public async reportsAChosenContextWindowSmallerThanClaudesAsTheContextsWindow(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const run = async (window: number | null): Promise<string> => {
      const query = ClaudeAdapterTests.usageQuery("s-chosen");
      query.contextUsageResult = { totalTokens: 45_000, maxTokens: 400_000, isAutoCompactEnabled: true, autoCompactThreshold: 380_000 };
      host.factory.next = query;
      const listener = new RecordingTurnListener();
      await adapter.runTurn(host.createRequest("Hi", null, null, null, null, null, null, window), listener, new AbortController().signal);
      return listener.usages.map(t => ClaudeAdapterTests.formatUsage(t).split(" ").at(-1)).join(",");
    };

    Assert.areEqual("45000/200000/200000|45000/400000/380000|45000/400000/380000", [await run(200_000), await run(1_000_000), await run(null)].join("|"));
  }

  @TestMethod
  public async reportsTheReplysTokensCacheCountsCostAndContextAndTheProvidersPlanUse(): Promise<void> {
    using host = new ClaudeTestHost();
    const query = ClaudeAdapterTests.usageQuery("s-usage");
    query.contextUsageResult = { totalTokens: 45_000, maxTokens: 200_000, isAutoCompactEnabled: true, autoCompactThreshold: 167_000 };
    query.planUsageResult = { rate_limits_available: true, rate_limits: { five_hour: { utilization: 20, resets_at: "2026-10-22T15:00:00Z" }, seven_day: { utilization: 55 } } };
    host.factory.next = query;
    host.factory.queued.push(ClaudeAdapterTests.usageQuery("s-subscribed", "none"));
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const subscribed = new RecordingTurnListener();

    const result = await adapter.runTurn(host.createRequest("Hi"), listener, new AbortController().signal);
    await adapter.runTurn(host.createRequest("Hi"), subscribed, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("450 20 0.42 300 50 null 45000/200000/167000", listener.usages.map(ClaudeAdapterTests.formatUsage).join(","));
    Assert.areEqual("450 20 null 300 50 null none", subscribed.usages.map(ClaudeAdapterTests.formatUsage).join(","));
    Assert.areEqual("summary", query.contextUsageDetail);
    Assert.areEqual("FiveHour 20 2026-10-22T15:00:00.000Z;Weekly 55 null",
      listener.planUsages.map(t => t.map(w => `${w.name} ${w.usedPercent} ${w.resetsAt}`).join(";")).join(","));
  }

  @TestMethod
  public async leavesTheContextAndPlanUseBlankWhenClaudeFailsOrHangsOnThem(): Promise<void> {
    using host = new ClaudeTestHost();
    const failing = ClaudeAdapterTests.usageQuery("s-failing");
    failing.contextUsageFailure = new Error("Context unavailable");
    failing.planUsageFailure = new Error("Usage unavailable");
    const hanging = ClaudeAdapterTests.usageQuery("s-hanging");
    hanging.contextUsageHang = true;
    hanging.planUsageHang = true;
    host.factory.next = failing;
    host.factory.queued.push(hanging);
    const adapter = new ClaudeAdapter(host.command, host.environment, "test", host.factory, host.runner, host.versionReader,
      new ProviderTimings(5000, 5000, 5000, 50, 1000, 300, 500, 500, 200, 1, 20));
    const failed = new RecordingTurnListener();
    const hung = new RecordingTurnListener();

    const failedResult = await adapter.runTurn(host.createRequest("Hi"), failed, new AbortController().signal);
    const hungResult = await adapter.runTurn(host.createRequest("Hi"), hung, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, failedResult.outcome);
    Assert.areEqual(TurnOutcome.Completed, hungResult.outcome);
    Assert.areEqual("450 20 0.42 300 50 null none", failed.usages.map(ClaudeAdapterTests.formatUsage).join(","));
    Assert.areEqual("450 20 0.42 300 50 null none", hung.usages.map(ClaudeAdapterTests.formatUsage).join(","));
    Assert.areEqual(0, failed.planUsages.length + hung.planUsages.length);
  }

  @TestMethod
  public async reportsTheContextAloneWhenTheResultHasNoTokensOrCostAndNothingWhenNeitherComes(): Promise<void> {
    using host = new ClaudeTestHost();
    const bare = (sessionId: string): FakeClaudeQuery => new FakeClaudeQuery([SdkMessages.init(sessionId, "none", null, []),
      { ...SdkMessages.success(sessionId, "ok"), total_cost_usd: null, modelUsage: {} } as unknown as SDKResultMessage]);
    const withContext = bare("s-context");
    withContext.contextUsageResult = { totalTokens: 9_000, maxTokens: 200_000, isAutoCompactEnabled: false };
    const without = bare("s-none");
    without.contextUsageFailure = new Error("Context unavailable");
    host.factory.next = withContext;
    host.factory.queued.push(without);
    const adapter = host.createAdapter();
    const context = new RecordingTurnListener();
    const neither = new RecordingTurnListener();

    await adapter.runTurn(host.createRequest("Hi"), context, new AbortController().signal);
    await adapter.runTurn(host.createRequest("Hi"), neither, new AbortController().signal);

    Assert.areEqual("null null null null null null 9000/200000/null", context.usages.map(ClaudeAdapterTests.formatUsage).join(","));
    Assert.areEqual(0, neither.usages.length);
  }

  @TestMethod
  public async readsThePlanUseThroughAControlQueryAndNothingWhenItCannot(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next.planUsageResult = { rate_limits_available: false };
    const none = await adapter.readPlanUsage(null);
    host.factory.next.planUsageResult = { rate_limits: { seven_day_opus: { utilization: 70, resets_at: "2026-10-27T00:00:00Z" } } };
    const opus = await adapter.readPlanUsage(null);
    const read = host.factory.queries.at(-1);
    host.factory.next.planUsageResult = {};
    const unnamed = await adapter.readPlanUsage(null);
    host.factory.next.planUsageFailure = new Error("Usage unavailable");
    const failed = await adapter.readPlanUsage(null);
    host.factory.next.planUsageHang = true;
    const hanging = new ClaudeAdapter(host.command, host.environment, "test", host.factory, host.runner, host.versionReader,
      new ProviderTimings(5000, 5000, 5000, 1, 1000, 300, 500, 500, 200, 1, 20));

    Assert.areEqual(0, none?.windows.length);
    Assert.areEqual("WeeklyOpus 70 2026-10-27T00:00:00.000Z", (opus?.windows ?? []).map(t => `${t.name} ${t.usedPercent} ${t.resetsAt}`).join(","));
    Assert.isNull(opus?.plan);
    Assert.areEqual(1, read?.closeCount);
    Assert.isNull(unnamed);
    Assert.isNull(failed);
    Assert.isNull(await hanging.readPlanUsage(null));
    Assert.isNull(await host.createAdapter(host.environment, null).readPlanUsage(null));
    Assert.areEqual(0, adapter.activeRunCount + hanging.activeRunCount);
  }

  @TestMethod
  public async answersACommandItDoesntListWithTheCommandsItListsBeforeAnythingRuns(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-1", "none", null, []), SdkMessages.success("s-1", "done")]);
    query.commands = [{ name: "deploy", description: "Deploy", argumentHint: "", aliases: ["ship"] }, { name: "compact", description: "Compact", argumentHint: "" }];
    host.factory.next = query;
    const listener = new RecordingTurnListener();

    try {
      const turn = await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: /review src", "s-1", "/review src"), listener, new AbortController().signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, "s-1", 1, 1, 0]),
        JSON.stringify([turn.outcome, turn.nativeSessionId, query.commandReads, query.closeCount, query.inputs.length]));
      Assert.areEqual(JSON.stringify([[DetailKind.Note, "Claude Code didn't list /review, so TeamRun didn't send it. It lists /deploy, /ship, /compact."]]),
        JSON.stringify(listener.details.map(t => [t.kind, t.text])));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async answersACommandWithNoCommandsListedWhenClaudeCodeCantListThem(): Promise<void> {
    const run = async (failure: Error | null): Promise<string> => {
      using host = new ClaudeTestHost();
      const adapter = new ClaudeAdapter(host.command, host.environment, "test", host.factory, host.runner, host.versionReader,
        new ProviderTimings(5000, 5000, 5000, 1, 1000, 300, 500, 500, 200, 1, 20));
      const query = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-1", "none", null, []), SdkMessages.success("s-1", "done")]);
      query.commandsFailure = failure;
      query.commandsHang = Object.isNull(failure);
      host.factory.next = query;
      const listener = new RecordingTurnListener();
      try {
        const turn = await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: /review", null, "/review"), listener, new AbortController().signal);
        return JSON.stringify([turn.outcome, turn.nativeSessionId, query.inputs.length, listener.details.map(t => t.text)]);
      }
      finally { await adapter.shutdown(); }
    };

    const expected = JSON.stringify([TurnOutcome.Completed, null, 0, ["Claude Code listed no commands, so TeamRun didn't send /review."]]);
    Assert.areEqual(expected, await run(new Error("Not supported")));
    Assert.areEqual(expected, await run(null));
  }

  @TestMethod
  public async sendsNothingWhenACommandIsStoppedWhileItsListIsRead(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-1", "none", null, []), SdkMessages.success("s-1", "done")]);
    query.commandsHang = true;
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const controller = new AbortController();

    try {
      const running = adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: /review", null, "/review"), listener, controller.signal);
      await Wait.until(() => query.commandReads === 1, "Claude Code's commands were not read.");
      controller.abort();
      const turn = await running;

      Assert.areEqual(JSON.stringify([TurnOutcome.Interrupted, null, 0, 1, 0]),
        JSON.stringify([turn.outcome, turn.nativeSessionId, query.inputs.length, query.closeCount, listener.details.length]));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async answersAListedCommandWithFilesWithoutSendingIt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-1", "none", null, []), SdkMessages.success("s-1", "done")]);
    query.commands = [{ name: "review", description: "Review", argumentHint: "" }];
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const notes = new MessageAttachment("notes.txt", "text/plain", 5, join(host.directory.path, "notes.txt"));

    try {
      const turn = await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "/review", "s-1", "/review", null, [notes]), listener, new AbortController().signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, "s-1", 0]), JSON.stringify([turn.outcome, turn.nativeSessionId, query.inputs.length]));
      Assert.areEqual(JSON.stringify(["TeamRun passes /review on to Claude Code only as a message of its own, without files, so it didn't send it."]),
        JSON.stringify(listener.details.map(t => t.text)));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async sendsAWrappedSlashWordItDoesntKnowAsAPrompt(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    host.factory.next = new FakeClaudeQuery([SdkMessages.init("s-1", "none", null, []), SdkMessages.success("s-1", "done")]);
    const listener = new RecordingTurnListener();

    try {
      const turn = await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: /tmp is full, clean it up", "s-1", "/tmp is full, clean it up"), listener,
        new AbortController().signal);

      Assert.areEqual(TurnOutcome.Completed, turn.outcome);
      Assert.areEqual(JSON.stringify(["Ada wrote: /tmp is full, clean it up"]), JSON.stringify(host.factory.promptTexts));
      Assert.isFalse(listener.details.some(t => t.kind === DetailKind.Note), JSON.stringify(listener.details));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async sendsAListedCommandAloneInANewChatThenTheChatSoFarWithItsNextMessage(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-1", "none", null, []), new StampedStep(SdkMessages.success("s-1", "Reviewed")),
      new WaitForInputStep(), new StampedStep(SdkMessages.success("s-1", "Thanks")), new WaitForInputStep(), new StampedStep(SdkMessages.success("s-1", "Again")),
      new WaitForCloseStep()]);
    query.commands = [{ name: "review", description: "Review", argumentHint: "<files>" }];
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const signal = new AbortController().signal;

    try {
      await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Chat so far: hello\n\nAda wrote: /review src", null, "/review src"), listener, signal);
      await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: thanks", "s-1", null, "Chat so far: hello, /review src\n\nAda wrote: thanks"), listener,
        signal);
      const last = await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: again", "s-1", null, "Chat so far: everything\n\nAda wrote: again"),
        listener, signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, 1, 1]), JSON.stringify([last.outcome, host.factory.queries.length, query.commandReads]));
      Assert.areEqual(JSON.stringify(["/review src", "Chat so far: hello, /review src\n\nAda wrote: thanks", "Ada wrote: again"]),
        JSON.stringify(host.factory.promptTexts));
      Assert.isFalse(listener.details.some(t => t.kind === DetailKind.Note), JSON.stringify(listener.details));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async sendsTheNextMessagesOwnPromptAfterACommandWhenItHasNoChatSoFar(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-1", "none", null, []), new StampedStep(SdkMessages.success("s-1", "Reviewed")),
      new WaitForInputStep(), new StampedStep(SdkMessages.success("s-1", "Thanks")), new WaitForCloseStep()]);
    query.commands = [{ name: "review", description: "Review", argumentHint: "" }];
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const signal = new AbortController().signal;

    try {
      await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "/review", null, "/review"), listener, signal);
      await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "thanks", "s-1", null), listener, signal);

      Assert.areEqual(JSON.stringify(["/review", "thanks"]), JSON.stringify(host.factory.promptTexts));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async checksACommandAgainstTheListTheSessionLastGave(): Promise<void> {
    using host = new ClaudeTestHost();
    const adapter = host.createAdapter();
    const query = new FakeClaudeQuery([new WaitForInputStep(), { ...SdkMessages.init("s-1", "none", null, []), slash_commands: ["review"] },
      SdkMessages.commandsChanged("s-1", [{ name: "deploy", description: "Deploy", argumentHint: "" }]), new StampedStep(SdkMessages.success("s-1", "Hello")),
      new WaitForInputStep(), new StampedStep(SdkMessages.success("s-1", "Deployed")), new WaitForCloseStep()]);
    query.commands = [{ name: "review", description: "Review", argumentHint: "" }];
    host.factory.next = query;
    const listener = new RecordingTurnListener();
    const signal = new AbortController().signal;

    try {
      await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "hello", null, null), listener, signal);
      const review = await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: /review", "s-1", "/review"), listener, signal);
      const deploy = await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: /deploy now", "s-1", "/deploy now"), listener, signal);

      Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed, 0]), JSON.stringify([review.outcome, deploy.outcome, query.commandReads]));
      Assert.areEqual(JSON.stringify(["hello", "/deploy now"]), JSON.stringify(host.factory.promptTexts));
      Assert.areEqual(JSON.stringify(["Claude Code didn't list /review, so TeamRun didn't send it. It lists /deploy."]),
        JSON.stringify(listener.details.filter(t => t.kind === DetailKind.Note).map(t => t.text)));
    }
    finally { await adapter.shutdown(); }
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    using host = new ClaudeTestHost();
    using usage = new ClaudeTestHost();
    using permission = new ClaudeTestHost();
    using question = new ClaudeTestHost();
    using plan = new ClaudeTestHost();
    using background = new ClaudeTestHost();
    using subAgent = new ClaudeTestHost();
    using tools = new ClaudeTestHost();
    const provider = host.createProvider();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_CLAUDE_OUTPUT: JSON.stringify({ loggedIn: true, email: "monalisa@example.com" }) });
    host.factory.repeat = () => ClaudeAdapterTests.abilityQuery();
    usage.factory.next = ClaudeAdapterTests.usageQuery("s-usage");
    permission.factory.next = new FakeClaudeQuery([SdkMessages.init("s-permission", "none", null, []), new ToolAskStep("Bash", { command: "npm test" }),
      SdkMessages.success("s-permission", "done")]);
    question.factory.next = new FakeClaudeQuery([SdkMessages.init("s-question", "none", null, []), new ToolAskStep("AskUserQuestion", { questions: [{ question: "Which platform?",
      header: "Platform", options: [{ label: "Desktop app", description: "The window" }, { label: "Web", description: "A browser" }], multiSelect: false }] }, "tu-q"),
      SdkMessages.success("s-question", "done")]);
    plan.factory.next = new FakeClaudeQuery([SdkMessages.init("s-plan", "none", null, []),
      SdkMessages.assistant("11111111-1111-1111-1111-111111111111", [SdkMessages.toolUse("tu-plan", "TodoWrite",
        { todos: [{ content: "Read the code", status: "in_progress", activeForm: "Reading the code" }] })], "claude-opus-5"),
      SdkMessages.user("22222222-2222-2222-2222-222222222222", [SdkMessages.toolResult("tu-plan", "ok")]), SdkMessages.success("s-plan", "Planned.")]);
    background.factory.next = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-background", "none", null, []),
      SdkMessages.taskStarted("s-background", "server", undefined, true, "npm start"), new StampedStep(SdkMessages.success("s-background", "Started")), new WaitForCloseStep()]);
    subAgent.factory.next = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-agent", "none", null, []),
      new StampedStep(SdkMessages.assistant("33333333-3333-3333-3333-333333333333", [SdkMessages.toolUse("toolu_agent", "Agent",
        { description: "Run sleep 20", subagent_type: "general-purpose", prompt: "Run sleep 20", run_in_background: true })], "claude-opus-5")),
      SdkMessages.taskStarted("s-agent", "agent-task", "toolu_agent", true, "Run sleep 20", "local_agent"),
      SdkMessages.user("44444444-4444-4444-4444-444444444444", [SdkMessages.toolResult("toolu_agent", [SdkMessages.textParam("Async agent launched successfully.")])], null,
        { isAsync: true, status: "async_launched", agentId: "agent-task", description: "Run sleep 20", resolvedModel: "claude-opus-5" }),
      new StampedStep(SdkMessages.success("s-agent", "Launched")), new WaitForCloseStep()]);
    const approved = new ToolAskStep(`mcp__teamrun__${TurnAbilityProbes.approvedTool}`, {}, "tu-approved");
    tools.factory.next = new FakeClaudeQuery([SdkMessages.init("s-tools", "none", null, []), approved, SdkMessages.success("s-tools", "done")]);
    const scenarios = new Map([["usage", usage.createAdapter()], ["permission", permission.createAdapter()], ["question", question.createAdapter()],
      ["plan", plan.createAdapter()], ["background", background.createAdapter()], ["subAgent", subAgent.createAdapter()], ["tools", tools.createAdapter()]]);
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => new TurnRequest(provider, host.directory.path, prompt,
      new RequestedSettings("claude", null, null), resume, attachments), host.directory.path, prompt => scenarios.get(prompt) ?? adapter);

    try {
      await AbilityChecks.runAsync(adapter.descriptor, {
        ...AbilityChecks.surface(adapter, provider, () => adapter.listModels(provider)),
        ...turns.probes({ [ProviderAbility.Questions]: "question", [ProviderAbility.PlanChecklist]: "plan", [ProviderAbility.ReplyUsage]: "usage",
          [ProviderAbility.SubAgentRows]: "subAgent", [ProviderAbility.BackgroundCommands]: "background", [ProviderAbility.GeneratedImages]: TurnAbilityProbes.plain,
          [ProviderAbility.PermissionCards]: "permission", [ProviderAbility.SteerTurn]: TurnAbilityProbes.plain }),
        [ProviderAbility.Images]: () => turns.sendsAsync("images", "image.png", "image/png",
          () => host.factory.queries.some(t => t.inputs.some(u => typeof u.message.content !== "string" && u.message.content.some(v => v.type === "image")))),
        [ProviderAbility.Files]: () => turns.sendsAsync("files", "notes.txt", "text/plain", () => host.factory.promptTexts.some(t => t.includes("notes.txt"))),
        ...turns.subAgents("subAgent"),
        [ProviderAbility.ListedCommands]: async () => {
          const listener = new RecordingTurnListener();
          const turn = await adapter.runTurn(ClaudeAdapterTests.commandRequest(host, "Ada wrote: /review", null, "/review"), listener, new AbortController().signal);
          return listener.details.find(t => t.kind === DetailKind.Note)?.text ?? (turn.outcome === TurnOutcome.Completed && host.factory.promptTexts.includes("/review"));
        },
        [ProviderAbility.ApprovedTools]: async () => {
          const { turn, listener } = await turns.approvedTurnAsync("tools");
          return turn.outcome === TurnOutcome.Completed && listener.asks.length === 0 && approved.result?.behavior === "allow";
        }
      });
    }
    finally {
      await Promise.all([adapter, ...scenarios.values()].map(t => t.shutdown()));
    }
  }

  private static commandRequest(host: ClaudeTestHost, prompt: string, resume: string | null, command: string | null, freshPrompt: string | null = null,
    attachments: readonly MessageAttachment[] = []): TurnRequest {
    return new TurnRequest(host.createProvider(), host.directory.path, prompt, new RequestedSettings("claude", null, null), resume, attachments, null, freshPrompt, {}, false,
      null, [], null, () => false, SharedMcpValues.none, null, false, command);
  }

  private static abilityQuery(): FakeClaudeQuery {
    const query = new FakeClaudeQuery([new WaitForInputStep(), SdkMessages.init("s-ability", "none", null, []),
      new StampedStep(SdkMessages.assistant("55555555-5555-5555-5555-555555555555", [SdkMessages.text("Hello")], "claude-opus-5")),
      new StampedStep(SdkMessages.success("s-ability", "Hello"))]);
    query.models = [{ value: "opus", displayName: "Opus", description: "Fast", supportedEffortLevels: ["low", "medium", "high"], supportsFastMode: true }];
    query.commands = [{ name: "review", description: "Review", argumentHint: "" }];
    query.planUsageResult = { rate_limits_available: true, rate_limits: { five_hour: { utilization: 20, resets_at: "2026-10-22T15:00:00Z" }, seven_day: { utilization: 55 } } };
    return query;
  }

  private static usageQuery(sessionId: string, apiKeySource: ApiKeySource = "user", windows: Readonly<Record<string, number>> = { "claude-opus": 200_000 }):
    FakeClaudeQuery {
    const result = { ...SdkMessages.success(sessionId, "ok"), total_cost_usd: 0.42, modelUsage: Object.fromEntries(Object.entries(windows).map(([model, contextWindow]) => [
      model, { inputTokens: 100, outputTokens: 20, cacheReadInputTokens: 300, cacheCreationInputTokens: 50, webSearchRequests: 0, costUSD: 0.42, contextWindow,
        maxOutputTokens: 32_000 }]))
    } as unknown as SDKResultMessage;
    return new FakeClaudeQuery([SdkMessages.init(sessionId, apiKeySource, null, []), result]);
  }

  private static formatUsage(usage: ReplyUsage): string {
    const context = usage.context === null ? "none" : `${usage.context.usedTokens}/${usage.context.windowTokens}/${usage.context.compactAtTokens}`;
    return `${usage.inputTokens} ${usage.outputTokens} ${usage.costUsd} ${usage.cacheReadTokens} ${usage.cacheWriteTokens} ${usage.reasoningTokens} ${context}`;
  }

  private static resumeRequest(host: ClaudeTestHost, resume: string, freshPrompt: string | null = "full transcript", resumeAt: string | null = null): TurnRequest {
    return new TurnRequest(null, host.directory.path, "Continue", new RequestedSettings("claude", null, null), resume, [], null, freshPrompt, {}, false, null, [], resumeAt);
  }

  private static senderRequest(host: ClaudeTestHost, prompt: string, resume: string | null, endpoint: RecordingMcpEndpoint, token: string): TurnRequest {
    const request = host.createRequest(prompt, null, resume);
    return new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, resume, [], null, null,
      { TEAMRUN_SENDER_TOKEN: token, TEAMRUN_TEST_VARIABLE: "t1" }, false, ClaudeAdapterTests.toolsOf(endpoint));
  }

  private static toolRequest(host: ClaudeTestHost, prompt: string, resume: string | null, endpoint: RecordingMcpEndpoint | null): TurnRequest {
    const request = host.createRequest(prompt, null, resume);
    return new TurnRequest(request.provider, request.workingDirectory, request.prompt, request.requested, resume, [], null, null, {}, false,
      ClaudeAdapterTests.toolsOf(endpoint));
  }

  private static toolsOf(endpoint: RecordingMcpEndpoint | null): TurnTools {
    return new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [], endpoint);
  }

  private static sharedServers(): SharedMcpServerDefinition[] {
    return [
      new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", ["-y", "search-server"], ["SEARCH_KEY", "SEARCH_REGION"], null, [], null),
      new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [new SharedMcpHeader("X-Team", "DOCS_TEAM")], "DOCS_TOKEN")
    ];
  }

  @TestMethod
  public async signsInThroughTheCopyItsTurnsRunAheadOfThePersonsShellPathAndNamesNoCopyForACommandOutsideAFolderWithClaude(): Promise<void> {
    using host = new ClaudeTestHost();
    const copy = host.directory.resolve("providers", "claude");
    mkdirSync(copy, { recursive: true });
    writeFileSync(join(copy, "claude"), "");
    host.starter.current = { PATH: "/person/bin" };

    const command = await host.createAdapter(host.environment, new ProcessCommand(join(copy, "claude"), [])).readSignInCommand(host.createProvider());

    Assert.areEqual(JSON.stringify({ command: "claude auth login", environment: { PATH: [copy, "/person/bin"].join(delimiter) } }), JSON.stringify(command?.toJson()));
    Assert.isNull(await host.createAdapter(host.environment, new ProcessCommand(host.directory.resolve("node"), [join(copy, "cli.js")])).readSignInCommand(host.createProvider()));
    Assert.isNull(await host.createAdapter(host.environment, null).readSignInCommand(host.createProvider()));
    Assert.areEqual(0, host.starter.started.length);
  }
}
