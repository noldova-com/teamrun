/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ForkRequest, McpEndpoint, SessionTokens, SharedMcpValues, TimeoutException, TurnOutcome, TurnRequest, TurnTools } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AuthStatus, DetailKind, type PlanWindow, PlanWindowName, Provider, ProviderAbility, ReplyAction, ReplyPlan, RequestedSettings, SharedMcpServerDefinition, SharedMcpTransport, SubAgent, SubAgentStatus } from "@noldova/teamrun.protocol";
import { AcpRequestException, CopilotAdapter, CopilotAgent, ExecutableNotFoundException, ModelListException, ProviderAbilityTable, ProviderTimings, Resources } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { AcpCommandCheck } from "../../fixtures/acp-command-check.fixture.js";
import { ControlledProcessTerminator } from "../../fixtures/controlled-process-terminator.fixture.js";
import { CopilotTestHost } from "../../fixtures/copilot-test-host.fixture.js";
import { PlanToolRule } from "../../fixtures/plan-tool-rule.fixture.js";
import { RecordedMcpServers } from "../../fixtures/recorded-mcp-servers.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { RunningProgramsStarter } from "../../fixtures/running-programs-starter.fixture.js";
import { SettledProcessTree } from "../../fixtures/settled-process-tree.fixture.js";
import { TitleAsks } from "../../fixtures/title-asks.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class CopilotAdapterTests {
  @TestMethod
  public async passesAListedSlashCommandUnwrappedAndAnswersAnyOtherBeforeSendingIt(): Promise<void> {
    await using host = new CopilotTestHost();
    await AcpCommandCheck.passesOnlyListedCommandsAsync(host.createAdapter(AcpCommandCheck.environment(host.directory.path)), host.request("unused"), host.directory.path);
  }

  private static readonly modelOptions: string = JSON.stringify([{ type: "select", id: "model", name: "Model", category: "model", currentValue: "gpt-b",
    options: [{ value: "gpt-a", name: "GPT A" }, { value: "gpt-b", name: "GPT B" }] }]);

  @TestMethod
  public async tellsCopilotItsBackgroundSubAgentsKeepItsTurnOpenUntilTheyEnd(): Promise<void> {
    await using host = new CopilotTestHost();

    Assert.areEqual("A sub-agent of your own that you start in the background keeps your turn open until it ends, and its result reaches you in that turn, "
      + "so no one can send you a message until then, and stopping your turn ends it.", host.createAdapter().backgroundSubAgentsNote);
  }

  @TestMethod
  public async launchesATitleSessionWithNoToolsAndLeavesCopilotsNoticesOutOfItsAnswer(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const isolated = (prompt: string): TurnRequest => {
      const request = host.request(prompt);
      return new TurnRequest(host.provider, request.workingDirectory, prompt, request.requested, null, [], null, null, {}, false, null, [], null, undefined,
        SharedMcpValues.none, null, true);
    };
    const flags = ["--available-tools=none", "--no-ask-user", "--no-custom-instructions"];

    const launched = JSON.parse(await TitleAsks.answerAsync(adapter, isolated("launch-arguments"))) as readonly string[];
    flags.forEach(t => Assert.isTrue(launched.includes(t), t));
    Assert.areEqual("The title", await TitleAsks.askAsync(adapter, isolated("noticed")));

    const chat = new RecordingTurnListener();
    await adapter.runTurn(host.request("launch-arguments"), chat, new AbortController().signal);
    const usualText = chat.texts.at(-1);
    Assert.isDefined(usualText);
    const usual = JSON.parse(usualText) as readonly string[];
    flags.forEach(t => Assert.isFalse(usual.includes(t), t));
    const noticed = new RecordingTurnListener();
    await adapter.runTurn(host.request("noticed"), noticed, new AbortController().signal);
    Assert.isTrue(noticed.texts.join().includes("Info: Disabled tools"));
  }

  @TestMethod
  public async leavesAChatItsFirstMessagesTitleWithoutATitleSessionWhileThePersonsCopilotHasHooks(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const request = host.request("noticed");
    const isolated = new TurnRequest(host.provider, request.workingDirectory, request.prompt, request.requested, null, [], null, null, {}, false, null, [], null,
      undefined, SharedMcpValues.none, null, true);
    mkdirSync(join(host.provider.profileDir, "hooks"), { recursive: true });

    const without = await TitleAsks.askAsync(adapter, isolated);
    const started = host.programs.started.length;
    writeFileSync(join(host.provider.profileDir, "hooks", "check.json"), JSON.stringify({ version: 1, hooks: { preToolUse: [] } }));
    const withHooks = await TitleAsks.askAsync(adapter, isolated);

    Assert.areEqual("The title", without);
    Assert.isTrue(started > 0);
    Assert.isNull(withHooks);
    Assert.areEqual(started, host.programs.started.length);
  }

  @TestMethod
  public async takesSharedHttpServersAndRefusesStdioOnesSinceCopilotRejectsAStdioServerFromItsClient(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN");

    Assert.areEqual(JSON.stringify({ reason: "GitHub Copilot refuses a stdio MCP server TeamRun passes it, and takes only HTTP ones.", short: "takes HTTP servers only" }),
      JSON.stringify(adapter.sharedServerUnavailable(stdio)));
    Assert.isNull(adapter.sharedServerUnavailable(http));
  }

  @TestMethod
  public async leavesOutASharedServerNamedLikeOneOfCopilotsOwnInItsProfileOrTheTurnsFolderWhetherItsOwnAreTurnedOffOrKept(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const config = join(host.provider.profileDir, "mcp-config.json");
    const folder = host.directory.resolve("project");
    mkdirSync(host.provider.profileDir, { recursive: true });
    mkdirSync(join(folder, ".git"), { recursive: true });
    writeFileSync(config, JSON.stringify({ mcpServers: { github: { url: "https://example.com/mcp" } } }));
    writeFileSync(join(folder, ".mcp.json"), JSON.stringify({ mcpServers: { docs: {} } }));
    const http = (name: string): SharedMcpServerDefinition => new SharedMcpServerDefinition(name, SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp",
      [], null);
    const kept = new Provider("a", "copilot", "Work", host.provider.profileDir, AuthStatus.Unknown, null, null, null, null, "t", true, true);
    const reason = { reason: "GitHub Copilot has an MCP server of its own by this name. TeamRun turns Copilot's own servers off by name, which would turn this one "
      + "off too, and while they're on, both load under one name and which one Copilot uses is unknown.", short: "has its own server by this name" };

    const named = ["github", "docs", "search"].map(t => adapter.sharedServerUnavailable(http(t), host.provider, folder));
    const listed = adapter.sharedServerUnavailable(http("docs"), host.provider, null);
    const keptNamed = ["github", "docs", "search"].map(t => adapter.sharedServerUnavailable(http(t), kept, folder));
    writeFileSync(config, "{");
    const unreadable = adapter.sharedServerUnavailable(http("search"), host.provider, folder);

    Assert.areEqual(JSON.stringify([reason, reason, null, null]), JSON.stringify([...named, listed]));
    Assert.areEqual(JSON.stringify([reason, reason, null]), JSON.stringify(keptNamed));
    Assert.isNull(unreadable);
    Assert.areEqual(Resources.formatCopilotMcpConfigUnreadable(config), Assert.throws(() => new CopilotAgent(host.command, host.environment, host.directory.resolve("work"))
      .launch(host.provider, null, folder), Error).message);
  }

  @TestMethod
  public async listsTheServersInItsProfilesMcpConfig(): Promise<void> {
    await using host = new CopilotTestHost();
    mkdirSync(host.provider.profileDir, { recursive: true });
    writeFileSync(join(host.provider.profileDir, "mcp-config.json"), JSON.stringify({ mcpServers: { github: { url: "https://example.com/mcp" } } }));

    Assert.areEqual(JSON.stringify([{ name: "github", state: "Configured" }]), JSON.stringify((await host.createAdapter().listOwnMcpServers(host.provider))?.map(t => t.toJson())));
  }

  @TestMethod
  public async saysSignedOutWhenANewSessionNeedsSignIn(): Promise<void> {
    await using host = new CopilotTestHost();

    const signedOut = await host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "loggedOut" }).listModels(host.provider);

    Assert.areEqual(0, signedOut.models.length);
    Assert.areEqual(false, signedOut.signedIn);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async listsAModelOptionWithNoEffortLevelsOfItsOwnAndAppliesTheChosenModel(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions });

    const listed = await adapter.listModels(null);
    const chosen = await adapter.runTurn(host.request("complete", null, "gpt-a"), new RecordingTurnListener(), new AbortController().signal);
    const missing = await adapter.runTurn(host.request("complete", null, "gpt-z"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual("gpt-a:GPT A:false,gpt-b:GPT B:true", listed.models.map(t => [t.id, t.displayName, t.isDefault].join(":")).join(","));
    Assert.areEqual(0, listed.models[0]!.effortLevels?.length);
    Assert.areEqual(true, listed.models[0]!.supportsImages);
    Assert.areEqual("gpt-a", chosen.observed.model);
    Assert.areEqual(TurnOutcome.Failed, missing.outcome);
    Assert.areEqual("GitHub Copilot doesn't offer the model gpt-z. Open the teammate or the composer's model menu, refresh the models, and choose one.", missing.error);
    Assert.areEqual(ReplyAction.ChooseModel, missing.action);
    Assert.areEqual(Resources.copilotAgentMode, listed.defaultMode);
    Assert.areEqual(Resources.copilotPlanMode, adapter.planMode);
  }

  @TestMethod
  public async asksCopilotForItsSubAgentStartsAndPutsTheCallsOfTwoStartedTogetherUnderTheirOwnRowsFromTheFirst(): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("sub-agents"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual(JSON.stringify(["copilot-tool-agent-todo:call-todo|copilot-tool-toolu-todo", "copilot-tool-agent-notes:call-notes|copilot-tool-toolu-notes"]),
      JSON.stringify([...new Set(listener.details.filter(t => t.providerItemId?.startsWith("copilot-tool-agent-") === true).map(t => `${t.providerItemId}|${t.parentItemId}`))]));
    const rows = listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
    Assert.areEqual(JSON.stringify([`toolu-notes|${SubAgentStatus.Completed}|1`, `toolu-todo|${SubAgentStatus.Completed}|1`]), JSON.stringify(["toolu-notes", "toolu-todo"]
      .map(id => rows.filter(t => t.toolUseId === id).at(-1)).map(t => `${String(t?.toolUseId)}|${String(t?.status)}|${String(t?.toolUses)}`)));
  }

  @TestMethod
  public async aStopDuringCopilotsHoldInterruptsTheTurnAndEndsItsBackgroundSubAgentsStopped(): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    const rows = (): SubAgent[] => listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
    const last = (id: string): SubAgent | undefined => rows().filter(t => t.toolUseId === id).at(-1);

    const log = new RecordingLog();
    const stuck = (): string[] => log.lines.filter(t => t.startsWith(CopilotAdapterTests.stuckPrefix));

    const run = host.createAdapter({}, host.command, log).runTurn(host.request("background-sub-agents-held"), listener, controller.signal);
    await Wait.until(() => last("toolu-notes")?.isBackground === true, "The notes tool was not in the background.");
    await Wait.until(() => last("toolu-todo")?.isBackground === true, "The todo tool was not in the background.");
    const during = ["toolu-notes", "toolu-todo"].map(t => last(t)?.status);
    controller.abort();
    await Wait.untilOrSettled(() => stuck().length > 0, run);
    Assert.areEqual("", stuck().join("\n"));
    const stopped = await run;

    Assert.areEqual(JSON.stringify([SubAgentStatus.Running, SubAgentStatus.Running]), JSON.stringify(during));
    Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
    Assert.areEqual(JSON.stringify([SubAgentStatus.Stopped, SubAgentStatus.Stopped]), JSON.stringify(["toolu-notes", "toolu-todo"].map(t => last(t)?.status)));
  }

  @TestMethod
  public async logsTheStepAStoppedTurnStillWaitsOnWithItsSubAgentsAtTheStop(): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    const timer = new ManualTimer();
    const log = new RecordingLog();
    const timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 20_000, 100, 5000, 100, 1, 10, Resources.wakeGrace, Resources.taskOutputFollowInterval,
      Resources.accountTimeout, Resources.modelListTimeout, Resources.silenceLimit, Resources.idleLimit, 10_000);
    const rows = (): SubAgent[] => listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
    const last = (id: string): SubAgent | undefined => rows().filter(t => t.toolUseId === id).at(-1);
    const stuck = (): string[] => log.lines.filter(t => t.startsWith(CopilotAdapterTests.stuckPrefix));

    const run = host.createAdapter({ TEAMRUN_FAKE_ACP_IGNORE_CANCEL: "1" }, host.command, log, timings, host.terminator, timer)
      .runTurn(host.request("background-sub-agents-held"), listener, controller.signal);
    await Wait.until(() => last("toolu-todo")?.isBackground === true && last("toolu-notes")?.isBackground === true, "The sub-agents were not in the background.");
    controller.abort();
    const before = stuck();
    timer.advance(timings.stopReportWait);
    await Wait.until(() => stuck().length > 0, "The stopped turn logged nothing.");
    timer.advance(timings.interruptGrace);
    const stopped = await run;

    Assert.areEqual(0, before.length);
    Assert.areEqual(Resources.formatTurnStopStuck("copilot", Resources.turnStepPrompt, ["toolu-notes", "toolu-todo"]
      .map(t => Resources.formatSubAgentState(t, SubAgentStatus.Running, true, false)).join(Resources.listSeparator)), stuck().join("\n"));
    Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
  }

  @TestMethod
  public async logsNothingForAStoppedTurnThatSettlesBeforeTheStopReportWait(): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    const timer = new ManualTimer();
    const log = new RecordingLog();
    const timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 20_000, 100, 5000, 100, 1, 10, Resources.wakeGrace, Resources.taskOutputFollowInterval,
      Resources.accountTimeout, Resources.modelListTimeout, Resources.silenceLimit, Resources.idleLimit, 10_000);
    const rows = (): SubAgent[] => listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
    const last = (id: string): SubAgent | undefined => rows().filter(t => t.toolUseId === id).at(-1);

    const run = host.createAdapter({}, host.command, log, timings, host.terminator, timer)
      .runTurn(host.request("background-sub-agents-held"), listener, controller.signal);
    await Wait.until(() => last("toolu-todo")?.isBackground === true && last("toolu-notes")?.isBackground === true, "The sub-agents were not in the background.");
    controller.abort();
    const stopped = await run;
    const pending = timer.pendingWithin(timings.stopReportWait);
    timer.advance(timings.stopReportWait);

    Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
    Assert.areEqual(0, pending);
    Assert.areEqual("", log.lines.filter(t => t.startsWith(CopilotAdapterTests.stuckPrefix)).join("\n"));
  }

  private static readonly stuckPrefix: string = Resources.formatTurnStopStuck("copilot", "", "").split(";")[0] ?? "";

  @TestMethod
  public async movesEachBackgroundSubAgentsReplyFromTheParentsTextIntoItsOwnRowOnceReadAgentGivesIt(): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("background-sub-agents"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual(JSON.stringify(["Both sub-agents are running. I'm waiting for them to finish.", "", "- The notes agent answered: \"The notes' first line.\"\n"
      + "- The todo agent answered: \"The todo's first line.\"\n\nNeither returned file contents. Each reply reads like a placeholder, so the agents may not have "
      + "read the files. I haven't checked."]), JSON.stringify([...new Map(listener.details.filter(t => t.kind === DetailKind.Text).map(t => [t.providerItemId, t.text])).values()]));
    const rows = listener.details.filter(t => t.kind === DetailKind.SubAgent).map(t => SubAgent.fromJson(t.payload));
    Assert.areEqual(JSON.stringify([["toolu-todo", SubAgentStatus.Completed, true, 1, "The todo's first line.", ["The todo's first line."]],
      ["toolu-notes", SubAgentStatus.Completed, true, 1, "The notes' first line.", ["The notes' first line."]]]), JSON.stringify(["toolu-todo", "toolu-notes"].map(id => {
      const row = rows.filter(t => t.toolUseId === id).at(-1);
      const notes = listener.details.filter(t => t.kind === DetailKind.Note && t.parentItemId === `copilot-tool-${id}` && t.providerItemId?.includes("agent-") === false);
      return [row?.toolUseId, row?.status, row?.isBackground, row?.toolUses, row?.summary, notes.map(t => t.text)];
    })));
  }

  @TestMethod
  public async turnsOffAllowAllWhenASessionStartsWithItOn(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.allowAll(["on", "off"]) });
    const listener = new RecordingTurnListener();

    const turn = await adapter.runTurn(host.request("methods"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual("allow_all=off", (JSON.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly sets: readonly string[] }).sets.join(","));
  }

  @TestMethod
  public async reportsTheToDosItsSqlToolWroteToTheSessionsDatabaseInTheProvidersProfileAsTheReplysPlan(): Promise<void> {
    await using host = new CopilotTestHost();
    const folder = join(host.provider.profileDir, "session-state", "copilot-session");
    mkdirSync(folder, { recursive: true });
    const database = new DatabaseSync(join(folder, "session.db"));
    database.exec("CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT, created_at INTEGER, updated_at INTEGER);"
      + "INSERT INTO todos (id, title, status, created_at) VALUES ('a', 'Read the code', 'done', 1), ('b', 'Fix the bug', 'in_progress', 2)");
    database.close();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("todos", null, null, null, host.provider), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual("Note:Plan the fix|Note:Plan the fix|Plan:Plan, 1 of 2 done",
      listener.details.filter(t => t.text === "Plan the fix" || t.kind === DetailKind.Plan).map(t => `${t.kind}:${t.text}`).join("|"));
    Assert.areEqual("Read the code:Completed,Fix the bug:InProgress",
      ReplyPlan.fromJson(listener.details.find(t => t.kind === DetailKind.Plan)?.payload).steps.map(t => `${t.text}:${t.status}`).join(","));
  }

  @TestMethod
  @TestData("refused", "Option refused")
  @TestData("offMissing", "GitHub Copilot's session is in the mode Allow All, which lifts its restrictions, and it couldn't switch to its default mode, so TeamRun didn't send the prompt.")
  public async failsATurnBeforeItsPromptWhenAllowAllStaysOn(kind: string, error: string): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.allowAll(kind === "refused" ? ["on", "off"] : ["on"]),
      ...kind === "refused" ? { TEAMRUN_FAKE_ACP_SET_ANSWER: "fail" } : {} });
    const listener = new RecordingTurnListener();

    const turn = await adapter.runTurn(host.request("methods"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.isTrue(turn.error?.includes(error) ?? false, turn.error ?? "no error");
    Assert.isFalse(listener.texts.some(t => t.startsWith("{\"methods\"")));
  }

  @TestMethod
  public async listsItsModesAtAgentAndRunsAChosenRestrictedOneThroughItsModeOption(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" });

    const listed = await adapter.listModels(host.provider);
    const sets: string[] = [];
    for (const mode of [Resources.copilotPlanMode, "unlisted", null]) {
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(host.request("methods", null, null, null, null, null, mode), listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, turn.outcome, String(mode));
      sets.push((JSON.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly sets: readonly string[] }).sets.join(","));
    }

    Assert.areEqual([`${Resources.copilotAgentMode}:Agent:false:false`, `${Resources.copilotPlanMode}:Plan:false:true`, `${Resources.copilotAutopilotMode}:Autopilot:true:false`,
      "allow_all:Allow All:true:false"].join(","), listed.modes.map(t => [t.id, t.name, t.unrestricted, t.readOnly].join(":")).join(","));
    Assert.areEqual([Resources.copilotAgentModeDescription, Resources.copilotPlanModeDescription, Resources.copilotAutopilotModeDescription,
      Resources.copilotAllowAllModeDescription].join("|"), listed.modes.map(t => t.description).join("|"));
    Assert.isTrue(Resources.copilotAutopilotModeDescription.endsWith("(experimental)."));
    Assert.areEqual(Resources.copilotAgentMode, listed.defaultMode);
    Assert.areEqual(`mode=${Resources.copilotPlanMode}||`, sets.join("|"));
  }

  @TestMethod
  public async runsAChosenAllowAllThroughItsSwitchInTheDefaultModeOrFailsBeforeItsPromptWithoutTheSwitch(): Promise<void> {
    await using host = new CopilotTestHost();
    const results: string[] = [];
    for (const options of [CopilotAdapterTests.allowAll(["on", "off"], "off"), CopilotAdapterTests.allowAll(["on", "off"]), CopilotAdapterTests.allowAll(null)]) {
      const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: options });
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(host.request("methods", null, null, null, null, null, Resources.copilotAllowAllMode), listener, new AbortController().signal);
      const echoed = listener.texts.find(t => t.startsWith("{\"methods\""));
      results.push(`${turn.outcome}:${Object.isUndefined(echoed) ? "no prompt" : (JSON.parse(echoed) as { readonly sets: readonly string[] }).sets.join(",")}:${turn.error ?? ""}`);
    }

    Assert.areEqual([`${TurnOutcome.Completed}:allow_all=on:`, `${TurnOutcome.Completed}::`,
      `${TurnOutcome.Failed}:no prompt:${Resources.formatModeUnavailable("GitHub Copilot", "Allow All")}`].join("|"), results.join("|"));
  }

  @TestMethod
  public async runsAChosenAutopilotThroughItsModeOptionWithTheAllowAllItTurnsOnOrFailsBeforeItsPromptWhenTheSessionDoesntOfferIt(): Promise<void> {
    await using host = new CopilotTestHost();
    const results: string[] = [];
    for (const options of [CopilotAdapterTests.allowAll(["on", "off"], "off"), CopilotAdapterTests.allowAll(["on", "off"], "off", false)]) {
      const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: options });
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(host.request("methods", null, null, null, null, null, Resources.copilotAutopilotMode), listener, new AbortController().signal);
      const echoed = listener.texts.find(t => t.startsWith("{\"methods\""));
      results.push(`${turn.outcome}:${Object.isUndefined(echoed) ? "no prompt" : (JSON.parse(echoed) as { readonly sets: readonly string[] }).sets.join(",")}:${turn.error ?? ""}`);
    }

    Assert.areEqual([`${TurnOutcome.Completed}:mode=${Resources.copilotAutopilotMode}:`,
      `${TurnOutcome.Failed}:no prompt:${Resources.formatModeUnavailable("GitHub Copilot", "Autopilot")}`].join("|"), results.join("|"));
  }

  @TestMethod
  @TestData("serve")
  @TestData("split")
  @TestData("noConnect")
  public async listsTheModelsCopilotsHeadlessServerOffersForTheProfileAndStopsIt(mode: string): Promise<void> {
    await using host = new CopilotTestHost();

    const listed = await host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: mode }).listModels(host.provider);
    const launch = JSON.parse(readFileSync(host.directory.resolve("work", "headless-launch.json"), "utf8")) as { args: string[]; home: string | null };

    Assert.areEqual("claude-sonnet-4.5|Claude Sonnet 4.5||null|true,gpt-5|GPT-5 ✦|low medium ultra high|medium|false,o-preview|o-preview|null|null|null,bare|bare|none low ultra max|null|null",
      listed.models.map(t => [t.id, t.displayName, t.effortLevels?.join(" ") ?? "null", String(t.defaultEffort), String(t.supportsImages)].join("|")).join(","));
    Assert.isTrue(listed.models.every(t => !t.isDefault && t.description.length === 0));
    Assert.areEqual(true, listed.signedIn);
    Assert.isTrue(listed.defaultTakesListedEfforts);
    Assert.areEqual([...Resources.copilotHeadlessArguments, "--disable-builtin-mcps"].join(" "), launch.args.join(" "));
    Assert.areEqual(host.provider.profileDir, launch.home);
    Assert.areEqual(CopilotAdapterTests.sessionMethods(false), readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8"));
    Assert.areEqual(1, host.programs.started.length);
    Assert.areEqual(1, host.programs.ended.length);
  }

  @TestMethod
  public async turnsOffThePersonsMcpServersAndSendsNoFolderOrPromptWhenListingModels(): Promise<void> {
    await using host = new CopilotTestHost();
    mkdirSync(host.directory.resolve("profile"), { recursive: true });
    writeFileSync(host.directory.resolve("profile", "mcp-config.json"), JSON.stringify({ mcpServers: { github: { command: "github" } } }));

    await host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" }).listModels(host.provider);
    const launch: unknown = JSON.parse(readFileSync(host.directory.resolve("work", "headless-launch.json"), "utf8"));
    const args = typeof launch === "object" && !Object.isNull(launch) && "args" in launch && Array.isArray(launch.args) ? launch.args.join(" ") : null;

    Assert.areEqual([...Resources.copilotHeadlessArguments, "--disable-builtin-mcps", "--disable-mcp-server=github"].join(" "), args);
    Assert.areEqual(CopilotAdapterTests.sessionMethods(false), readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8"));
  }

  @TestMethod
  public async asksTheListToSkipItsCacheOnlyWhenRefreshed(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" });

    await adapter.listModels(host.provider);
    const refreshed = await adapter.listModels(host.provider, true);

    Assert.areEqual(4, refreshed.models.length);
    Assert.areEqual(CopilotAdapterTests.sessionMethods(false) + CopilotAdapterTests.sessionMethods(true), readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8"));
  }

  @TestMethod
  public async readsCopilotFreeAsItsPlanWithNoModelsAndKeepsIt(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "free" }, log);

    const listed = await adapter.listModels(host.provider);
    const again = await adapter.listModels(host.provider);

    Assert.areEqual(0, listed.models.length);
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual(false, listed.empty);
    Assert.areEqual(Resources.copilotFreePlanName, listed.planName);
    Assert.isTrue(again === listed);
    Assert.areEqual(0, log.lines.length);
    Assert.areEqual(CopilotAdapterTests.sessionMethods(false, true), readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8"));
    Assert.areEqual(1, host.programs.started.length);
  }

  @TestMethod
  @TestData("failSession", "connect {}\nauth.getStatus {}\nsession.create {}\n")
  @TestData("failQuota", "")
  public async listsOverAcpAndLogsWhenTheListingSessionOrPlanCantBeRead(mode: string, methods: string): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: mode, TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions }, log);

    const listed = await adapter.listModels(host.provider);

    Assert.areEqual("gpt-a,gpt-b", listed.models.map(t => t.id).join(","));
    Assert.isNull(listed.planName);
    Assert.isTrue(listed.defaultTakesListedEfforts);
    Assert.areEqual(Resources.formatCopilotListingFailed("a", "AcpRequestException"), log.lines.join("\n"));
    Assert.areEqual(methods.length > 0 ? methods : CopilotAdapterTests.sessionMethods(false, true),
      readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8"));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async keepsTheListAndLogsWhenTheListingSessionIsNotDeleted(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "failDelete" }, log);

    const listed = await adapter.listModels(host.provider);

    Assert.areEqual(4, listed.models.length);
    Assert.areEqual(Resources.formatCopilotListingSessionDeleteFailed("AcpRequestException"), log.lines.join("\n"));
    Assert.areEqual(1, host.programs.started.length);
    Assert.areEqual(1, host.programs.ended.length);
  }

  @TestMethod
  public async endsADeleteOfTheListingSessionThatGetsNoAnswerOnlyWhenItsGraceElapsesOnItsTimer(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const timer = new ManualTimer();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "holdDelete" }, host.command, log, host.timings, host.terminator, timer);

    const listing = adapter.listModels(host.provider);
    await Wait.until(() => existsSync(host.directory.resolve("work", "headless-delete-held.txt")), "The fake did not write headless-delete-held.txt.");
    await Wait.delay(host.timings.stopGrace * 3);
    const waited = log.lines.length;
    timer.advance(host.timings.stopGrace);
    const listed = await listing;

    Assert.areEqual(0, waited);
    Assert.areEqual(4, listed.models.length);
    Assert.areEqual(Resources.formatCopilotListingSessionDeleteFailed("TimeoutException"), log.lines.join("\n"));
    Assert.areEqual(1, host.programs.ended.length);
  }

  @TestMethod
  public async aSignedInCheckReadsTheGitHubUserNameFromTheHeadlessServerWithoutASession(): Promise<void> {
    await using host = new CopilotTestHost();
    const methods = host.directory.resolve("work", "headless-methods.txt");

    const signedIn = await host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" }).checkSignIn(host.provider);
    const asked = readFileSync(methods, "utf8");
    const unread = await Promise.all([{ TEAMRUN_FAKE_COPILOT_HEADLESS: "failStatus" }, {}].map(t => host.createAdapter(t).checkSignIn(host.provider)));
    const signedOut = await host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve", TEAMRUN_FAKE_ACP_INIT: "loggedOut" }).checkSignIn(host.provider);

    Assert.areEqual("LoggedIn octo user", [signedIn.authStatus, signedIn.identity?.userName, signedIn.identity?.authMethod].join(" "));
    Assert.areEqual("connect {}\nauth.getStatus {}\n", asked);
    Assert.areEqual("LoggedIn null,LoggedIn null", unread.map(t => [t.authStatus, String(t.identity)].join(" ")).join(","));
    Assert.areEqual("LoggedOut null", [signedOut.authStatus, String(signedOut.identity)].join(" "));
    Assert.areEqual("connect {}\nauth.getStatus {}\n".repeat(2), readFileSync(methods, "utf8"));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async aSignedInCheckGivesUpTheUserNameWhenTheHeadlessServerDoesNotAnswerWithinItsShortTimeout(): Promise<void> {
    await using host = new CopilotTestHost();
    const methods = host.directory.resolve("work", "headless-methods.txt");
    const timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, 100, 5000, 100, 1, 10, Resources.wakeGrace, Resources.taskOutputFollowInterval, 100);
    const checked: string[] = [];
    for (const [mode, held] of [["holdConnect", "connect {}\n"], ["holdStatus", "connect {}\nconnect {}\nauth.getStatus {}\n"]] as const) {
      const timer = new ManualTimer();
      const checking = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: mode }, host.command, null, timings, host.terminator, timer).checkSignIn(host.provider);
      let ended = false;
      void Promise.allSettled([checking]).then(() => { ended = true; });
      await Wait.until(() => existsSync(methods) && readFileSync(methods, "utf8") === held, "Copilot did not get the held requests.");
      await Wait.until(() => timer.pending === 1, "The timer did not hold just one wait.");
      await Wait.delay(timings.accountTimeout * 3);
      const waited = ended;
      timer.advance(timings.accountTimeout);
      const check = await checking;
      checked.push([check.authStatus, String(check.identity), String(waited)].join(" "));
    }

    Assert.areEqual("LoggedIn null false,LoggedIn null false", checked.join(","));
    Assert.areEqual("connect {}\nconnect {}\nauth.getStatus {}\n", readFileSync(methods, "utf8"));
  }

  @TestMethod
  public async saysSignedOutWhenCopilotsHeadlessServerIsNotSignedIn(): Promise<void> {
    await using host = new CopilotTestHost();

    const listed = await host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "signedOut" }).listModels(null);
    const launch = JSON.parse(readFileSync(host.directory.resolve("work", "headless-launch.json"), "utf8")) as { home: string | null };

    Assert.areEqual(0, listed.models.length);
    Assert.areEqual(false, listed.signedIn);
    Assert.isNull(launch.home);
    Assert.areEqual("connect {}\nauth.getStatus {}\n", readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8"));
    Assert.areEqual(1, host.programs.started.length);
    Assert.areEqual(1, host.programs.ended.length);
  }

  @TestMethod
  @TestData("", "AcpConnectionException")
  @TestData("failConnect", "AcpRequestException")
  @TestData("garbled", "AcpConnectionException")
  @TestData("badJson", "JsonException")
  @TestData("outOfShape", "JsonException")
  public async listsOverAcpAndLogsOnceWhenCopilotsHeadlessServerIsMissingOrFails(mode: string, kind: string): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: mode, TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions }, log);

    const listed = await adapter.listModels(host.provider);
    await adapter.listModels(host.provider);

    Assert.areEqual("gpt-a,gpt-b", listed.models.map(t => t.id).join(","));
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual([Resources.formatCopilotListingFailed("a", kind), Resources.formatCopilotListingFailed("a", kind)].join("\n"), log.lines.join("\n"));
    Assert.areEqual(4, host.programs.started.length);
    Assert.areEqual(4, host.programs.ended.length);
  }

  @TestMethod
  @TestData("", "AcpConnectionException")
  @TestData("badJson", "JsonException")
  public async failsTheListingEachTimeWhenCopilotsHeadlessServerFailsAndItsAcpServerListsNoModels(mode: string, kind: string): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: mode }, host.command, log);

    const failed = await Assert.throwsAsync(() => adapter.listModels(host.provider), ModelListException);
    await Assert.throwsAsync(() => adapter.listModels(host.provider), Error);

    Assert.areEqual(Resources.formatCopilotModelsNotListed(kind), failed.message);
    Assert.areEqual([Resources.formatCopilotListingFailedAndAcpListsNone("a", kind), Resources.formatCopilotListingFailedAndAcpListsNone("a", kind)].join("\n"),
      log.lines.join("\n"));
    Assert.areEqual(4, host.programs.started.length);
    Assert.areEqual(4, host.programs.ended.length);
  }

  @TestMethod
  public async failsAListingThatTimesOutWhenItsAcpServerListsNoModels(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const timings = new ProviderTimings(2000, 2000, 60_000, 100, 100, 100, 100, 5000, 100, 1, 10);
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "hold" }, log, timings);

    const failed = await Assert.throwsAsync(() => adapter.listModels(null), ModelListException);

    Assert.areEqual(Resources.formatCopilotModelsNotListed(Resources.copilotListingTimedOut), failed.message);
    Assert.areEqual(Resources.formatCopilotListingFailedAndAcpListsNone(null, Resources.copilotListingTimedOut), log.lines.join("\n"));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async listsOverAcpKeepingNothingWhenCopilotsHeadlessServerAnswersSignedInWithNoModels(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "empty", TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions }, log);

    const listed = await adapter.listModels(host.provider);
    await adapter.listModels(host.provider);

    Assert.areEqual("gpt-a,gpt-b", listed.models.map(t => t.id).join(","));
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual(false, listed.empty);
    Assert.areEqual([Resources.formatCopilotListingFailed("a", Resources.copilotListingEmpty), Resources.formatCopilotListingFailed("a", Resources.copilotListingEmpty)].join("\n"),
      log.lines.join("\n"));
    Assert.areEqual(4, host.programs.started.length);
    Assert.areEqual(4, host.programs.ended.length);
  }

  @TestMethod
  public async marksTheListEmptyAndKeepsNothingWhenNeitherServerListsAModel(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "empty" }, log);

    const listed = await adapter.listModels(host.provider);
    const again = await adapter.listModels(host.provider);

    Assert.areEqual(0, listed.models.length);
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual(true, listed.empty);
    Assert.areEqual(true, again.empty);
    Assert.areEqual(4, listed.modes.length);
    Assert.areEqual(Resources.copilotAgentMode, listed.defaultMode);
    Assert.isTrue(listed.defaultTakesListedEfforts);
    Assert.isFalse(again === listed);
    Assert.areEqual([Resources.formatCopilotListingsEmpty("a"), Resources.formatCopilotListingsEmpty("a")].join("\n"), log.lines.join("\n"));
    Assert.isNull(listed.planName);
    Assert.isTrue(readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8").startsWith(CopilotAdapterTests.sessionMethods(false, true)));
    Assert.areEqual(4, host.programs.started.length);
    Assert.areEqual(4, host.programs.ended.length);
  }

  @TestMethod
  public async saysSignedOutOverAcpAfterAnEmptyAnswerAndLogsTheEmptyList(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "empty", TEAMRUN_FAKE_ACP_INIT: "loggedOut" }, log);

    const listed = await adapter.listModels(host.provider);

    Assert.areEqual(0, listed.models.length);
    Assert.areEqual(false, listed.signedIn);
    Assert.areEqual(false, listed.empty);
    Assert.areEqual(Resources.formatCopilotListingFailed("a", Resources.copilotListingEmpty), log.lines.join("\n"));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async logsBothListingsWhenTheAcpListingFailsAfterAnEmptyAnswer(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "empty", TEAMRUN_FAKE_ACP_NEW: "fail" }, log);

    await Assert.throwsAsync(() => adapter.listModels(host.provider), AcpRequestException);

    Assert.areEqual(Resources.formatCopilotListingsFailed("a", Resources.copilotListingEmpty, "AcpRequestException"), log.lines.join("\n"));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async endsAListingThatHangsAtItsLimitStopsTheServerAndListsOverAcp(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const timings = new ProviderTimings(2000, 2000, 60_000, 100, 100, 100, 100, 5000, 100, 1, 10);
    const adapter = host.createManualAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "hold", TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions }, log, timings);

    const listed = await adapter.listModels(null);

    Assert.isTrue(existsSync(host.directory.resolve("work", "headless-held.txt")));
    Assert.areEqual("gpt-a,gpt-b", listed.models.map(t => t.id).join(","));
    Assert.areEqual(Resources.formatCopilotListingFailed(null, Resources.copilotListingTimedOut), log.lines.join("\n"));
    Assert.isFalse(log.lines[0]!.includes("octo"));
    Assert.areEqual(2, host.programs.started.length);
    Assert.areEqual(2, host.programs.ended.length);
  }

  @TestMethod
  public async sharesAListingStillRunningWithTheNextRequestForTheSameProfile(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const served = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" });
    const missing = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "", TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions }, host.command, log);

    const [first, second] = await Promise.all([served.listModels(host.provider), served.listModels(host.provider)]);
    Assert.isTrue(first === second);
    Assert.areEqual(1, host.programs.started.length);
    const [over, again] = await Promise.all([missing.listModels(host.provider), missing.listModels(host.provider)]);

    Assert.isTrue(over === again);
    Assert.areEqual("gpt-a,gpt-b", over.models.map(t => t.id).join(","));
    Assert.areEqual(Resources.formatCopilotListingFailed("a", "AcpConnectionException"), log.lines.join("\n"));
    Assert.areEqual(3, host.programs.started.length);
    Assert.areEqual(3, host.programs.ended.length);
  }

  @TestMethod
  public async failsListingsThatShareAFailedListingTogetherAndListsAfreshAfter(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "", TEAMRUN_FAKE_ACP_NEW: "fail" }, host.command, log);
    const failure = Resources.formatCopilotListingsFailed("a", "AcpConnectionException", "AcpRequestException");

    const [first, second] = await Promise.allSettled([adapter.listModels(host.provider), adapter.listModels(host.provider)]);
    Assert.areEqual("rejected", first.status);
    Assert.isTrue((first as PromiseRejectedResult).reason === (second as PromiseRejectedResult).reason);
    Assert.areEqual(failure, log.lines.join("\n"));
    const third = await Assert.throwsAsync(() => adapter.listModels(host.provider), AcpRequestException);

    Assert.isFalse(third === (first as PromiseRejectedResult).reason);
    Assert.areEqual([failure, failure].join("\n"), log.lines.join("\n"));
    Assert.areEqual(4, host.programs.started.length);
    Assert.areEqual(4, host.programs.ended.length);
  }

  @TestMethod
  public async startsARefreshOfItsOwnWhileAListingIsRunningAndSharesItAfter(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" });

    const [running, refreshed, joined] = await Promise.all([
      adapter.listModels(host.provider), adapter.listModels(host.provider, true), adapter.listModels(host.provider)]);

    Assert.isFalse(running === refreshed);
    Assert.isTrue(refreshed === joined);
    Assert.areEqual(2, host.programs.started.length);
    Assert.areEqual(2, host.programs.ended.length);
  }

  @TestMethod
  public async keepsARefreshRunningWhenAnOlderListingEndsFirstSoTheNextRequestJoinsIt(): Promise<void> {
    await using host = new CopilotTestHost();
    const timer = new ManualTimer();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "stay" }, host.command, null, host.timings, host.terminator, timer);

    const older = adapter.listModels(host.provider);
    await Wait.until(() => timer.begun === 2, "The timer did not begin 2 waits.");
    await Wait.until(() => timer.pending === 1, "The timer did not hold just one wait.");
    timer.advance(1);
    const refreshed = adapter.listModels(host.provider, true);
    await Wait.until(() => timer.begun === 4, "The timer did not begin 4 waits.");
    await Wait.until(() => timer.pending === 2, "The timer did not hold 2 waits.");
    timer.advance(host.timings.stopGrace - 1);
    await older;
    const joined = adapter.listModels(host.provider);
    let ended = false;
    void Promise.allSettled([refreshed, joined]).then(() => { ended = true; });
    await Wait.until(() => {
      timer.advance(host.timings.stopGrace);
      return ended;
    }, "The refresh and the joined listing did not end.");

    Assert.isTrue(await joined === await refreshed);
    Assert.areEqual(2, host.programs.started.length);
  }

  @TestMethod
  public async keepsNoAnswerFromAListingThatEndsAfterARefreshBegan(): Promise<void> {
    await using host = new CopilotTestHost();
    const timer = new ManualTimer();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "stay>signedOut" }, host.command, null, host.timings, host.terminator, timer);

    const older = adapter.listModels(host.provider);
    await Wait.until(() => timer.begun === 2, "The timer did not begin 2 waits.");
    await Wait.until(() => timer.pending === 1, "The timer did not hold just one wait.");
    const refreshed = await adapter.listModels(host.provider, true);
    timer.advance(host.timings.stopGrace);
    const stale = await older;
    const listed = await adapter.listModels(host.provider);

    Assert.areEqual(true, stale.signedIn);
    Assert.areEqual(false, refreshed.signedIn);
    Assert.areEqual(false, listed.signedIn);
    Assert.areEqual(3, host.programs.started.length);
  }

  @TestMethod
  public async logsBothListingsFailingWhenTheAcpListingFailsToo(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "", TEAMRUN_FAKE_ACP_NEW: "fail" }, host.command, log);

    await Assert.throwsAsync(() => adapter.listModels(host.provider), AcpRequestException);

    Assert.areEqual(Resources.formatCopilotListingsFailed("a", "AcpConnectionException", "AcpRequestException"), log.lines.join("\n"));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async logsAnAcpListingThatTimesOutAfterTheHeadlessServerTimesOutAsATimeout(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const timings = new ProviderTimings(2000, 2000, 100, 2000, 100, 100, 100, 5000, 100, 1, 10);
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "holdConnect", TEAMRUN_FAKE_ACP_INIT: "hang" }, host.command, log, timings);

    const failed = await Assert.throwsAsync(() => adapter.listModels(host.provider), TimeoutException);

    Assert.areEqual(Resources.formatAcpTimeout(Resources.acpInitialize), failed.message);
    Assert.areEqual(Resources.formatCopilotListingsFailed("a", Resources.copilotListingTimedOut, "TimeoutException"), log.lines.join("\n"));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async keepsASignedInListingPerProfileUntilARefresh(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" });

    const first = await adapter.listModels(host.provider);
    const kept = await adapter.listModels(host.provider);
    Assert.isTrue(kept === first);
    Assert.areEqual(1, host.programs.started.length);
    await adapter.listModels(null);
    Assert.areEqual(2, host.programs.started.length);
    const refreshed = await adapter.listModels(host.provider, true);
    Assert.isFalse(refreshed === first);
    Assert.areEqual(3, host.programs.started.length);
    Assert.isTrue(await adapter.listModels(host.provider) === refreshed);
    Assert.areEqual(3, host.programs.started.length);
    Assert.areEqual(3, host.programs.ended.length);
  }

  @TestMethod
  public async listsAgainWhileCopilotIsSignedOut(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "signedOut" });

    await adapter.listModels(host.provider);
    await adapter.listModels(host.provider);

    Assert.areEqual(2, host.programs.started.length);
    Assert.areEqual(2, host.programs.ended.length);
  }

  @TestMethod
  public async keepsTheModelsAndForgetsTheServerWhenStoppingItFails(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const terminator = new ControlledProcessTerminator(process.platform);
    terminator.failures = 1;
    const timer = new ManualTimer();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "stay" }, host.command, log, host.timings, terminator, timer);

    try {
      const listing = adapter.listModels(host.provider);
      await Wait.until(() => timer.begun === 2, "The timer did not begin 2 waits.");
      await Wait.until(() => timer.pending === 1, "The timer did not hold just one wait.");
      timer.advance(host.timings.stopGrace);
      const listed = await listing;
      await adapter.shutdown();

      Assert.areEqual(4, listed.models.length);
      Assert.areEqual(true, listed.signedIn);
      Assert.areEqual(Resources.formatCopilotListingStopFailed("Error"), log.lines.join("\n"));
      Assert.areEqual(1, terminator.calls);
      Assert.areEqual(1, host.programs.started.length);
    }
    finally {
      process.kill(host.programs.started[0]!.processId);
      await Wait.until(() => host.programs.ended.length === 1, "The headless program did not end.");
    }
  }

  @TestMethod
  public async stopsTheHeadlessServerAndFailsTheListingWhenTheAdapterShutsDown(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "hold" });

    const failure = adapter.listModels(null).then(() => null, (error: unknown) => error);
    await Wait.until(() => existsSync(host.directory.resolve("work", "headless-held.txt")), "The fake did not write headless-held.txt.");
    await adapter.shutdown();

    Assert.isInstanceOf(await failure, Error);
    Assert.areEqual(1, host.programs.started.length);
    Assert.areEqual(1, host.programs.ended.length);
  }

  @TestMethod
  @TestData("fail")
  @TestData("crash")
  public async failsAListingAndASignInCheckWhenANewSessionFailsForAnotherReason(failure: string): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_NEW: failure });

    await Assert.throwsAsync(() => adapter.listModels(null), Error);
    const check = await adapter.checkSignIn(host.provider);

    Assert.areEqual(AuthStatus.Error, check.authStatus);
    Assert.areEqual("1.0.100", check.harnessVersion);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async checksTheSignInByOpeningASessionAndSignsInOnlyThroughCopilotLogin(): Promise<void> {
    await using host = new CopilotTestHost();

    const signedIn = await host.createAdapter().checkSignIn(host.provider);
    const signedOut = await host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "loggedOut" }).checkSignIn(host.provider);
    const signIn = await Assert.throwsAsync(() => host.createAdapter().signIn(host.provider, new AbortController().signal), Error);

    Assert.areEqual(AuthStatus.LoggedIn, signedIn.authStatus);
    Assert.areEqual("1.0.100", signedIn.harnessVersion);
    Assert.isNull(signedIn.error);
    Assert.areEqual(AuthStatus.LoggedOut, signedOut.authStatus);
    Assert.areEqual(Resources.formatCopilotSignIn(host.provider.profileDir), signedOut.error);
    Assert.areEqual(Resources.copilotSignInUnavailable, signIn.message);
  }

  @TestMethod
  public async closesTheSessionsTheListingAndTheSignInCheckOpenAndCarriesOnWhenTheCloseFails(): Promise<void> {
    await using host = new CopilotTestHost();

    const listed = await host.createAdapter({ TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions }).listModels(null);
    const check = await host.createAdapter().checkSignIn(host.provider);
    const refused = await host.createAdapter({ TEAMRUN_FAKE_ACP_CLOSE: "fail", TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions }).listModels(null);
    const refusedCheck = await host.createAdapter({ TEAMRUN_FAKE_ACP_CLOSE: "fail" }).checkSignIn(host.provider);

    Assert.areEqual("copilot-session\n".repeat(4), readFileSync(host.directory.resolve("work", "closed-sessions.txt"), "utf8"));
    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus);
    Assert.areEqual(true, refused.signedIn);
    Assert.areEqual(AuthStatus.LoggedIn, refusedCheck.authStatus);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async failsTheListingAndChecksTheSignInWithoutClosingASessionWhoseAnswerHasNoId(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_NEW: "noId" });

    await Assert.throwsAsync(() => adapter.listModels(null), Error);
    const check = await adapter.checkSignIn(host.provider);

    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus);
    Assert.isFalse(existsSync(host.directory.resolve("work", "closed-sessions.txt")));
  }

  @TestMethod
  @TestData("{\"list\":{}}")
  @TestData("{\"close\":null,\"list\":{}}")
  public async leavesTheSessionsOpenWhenCopilotOffersNoClose(capabilities: string): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_SESSION_CAPABILITIES: capabilities, TEAMRUN_FAKE_ACP_OPTIONS: CopilotAdapterTests.modelOptions });

    const listed = await adapter.listModels(null);
    const check = await adapter.checkSignIn(host.provider);

    Assert.areEqual(true, listed.signedIn);
    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus);
    Assert.isFalse(existsSync(host.directory.resolve("work", "closed-sessions.txt")));
  }

  @TestMethod
  public async streamsATurnLaunchedWithTheRequestedEffortAndTheProfileAsItsHome(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ COPILOT_HOME: host.directory.resolve("elsewhere"), COPILOT_ALLOW_ALL: "true" });
    const listener = new RecordingTurnListener();
    const plain = new RecordingTurnListener();
    const launch = (texts: readonly string[]): { args: string[]; home: string | null } =>
      JSON.parse(texts.find(t => t.startsWith("{"))!) as { args: string[]; home: string | null };

    const result = await adapter.runTurn(host.request("launch", null, null, "max", host.provider), listener, new AbortController().signal);
    const unset = await adapter.runTurn(host.request("launch"), plain, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("copilot-session", result.nativeSessionId);
    Assert.areEqual("max", result.observed.effort);
    Assert.isNull(result.observed.model);
    Assert.areEqual("1.0.100", result.observed.harnessVersion);
    Assert.isTrue(listener.texts.some(t => t.includes("Hello")));
    Assert.isTrue(listener.texts.some(t => t.includes("Run command")));
    Assert.areEqual("--acp --stdio --no-auto-update --reasoning-effort max --disable-builtin-mcps", launch(listener.texts).args.join(" "));
    Assert.areEqual(host.provider.profileDir, launch(listener.texts).home);
    Assert.isNull(unset.observed.effort);
    Assert.areEqual("--acp --stdio --no-auto-update --disable-builtin-mcps", launch(plain.texts).args.join(" "));
    Assert.isNull(launch(plain.texts).home);
  }

  @TestMethod
  public async declaresCompactionUpdatesAndShowsEachOneAnAgentSendsAfterTheTextBeforeIt(): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();

    const result = await host.createAdapter().runTurn(host.request("compact"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify(["Before", "GitHub Copilot compacted its context.", "After", "GitHub Copilot compacted its context."]),
      JSON.stringify(listener.texts.filter(t => t === "Before" || t === "After" || t.includes("compacted"))));
    Assert.isTrue(listener.details.filter(t => t.text.includes("compacted")).every(t => JSON.stringify(t.payload) === JSON.stringify(Resources.compactionPayload)));
  }

  @TestMethod
  public async showsEachCompactionIdOnceTwoInARowAsTwoAndOneAfterAPlanOrUsageAsItsOwn(): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();

    const result = await host.createAdapter().runTurn(host.request("compactTwice"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify(["GitHub Copilot compacted its context.", "GitHub Copilot compacted its context.", "Between", "GitHub Copilot compacted its context.",
      "GitHub Copilot compacted its context."]),
      JSON.stringify(listener.texts.filter(t => t === "Between" || t.includes("compacted"))));
  }

  @TestMethod
  @TestData("none")
  @TestData("minimal")
  public async launchesCopilotWithItsLowestEffortLevels(effort: string): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();

    const adapter = host.createAdapter();
    const result = await adapter.runTurn(host.request("launch", null, null, effort), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(`--acp --stdio --no-auto-update --reasoning-effort ${effort} --disable-builtin-mcps`,
      (JSON.parse(listener.texts.find(t => t.startsWith("{"))!) as { args: string[] }).args.join(" "));
  }

  @TestMethod
  public async marksAModelMissingFromTheProfilesListedModelsUnavailableAndObservesNoModelForIt(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createPatientAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" });
    const signal = new AbortController().signal;

    const unknown = await adapter.runTurn(host.request("launch", null, "gpt-5.4", null, host.provider), new RecordingTurnListener(), signal);
    await adapter.listModels(host.provider);
    const missing = await adapter.runTurn(host.request("launch", null, "gpt-5.4", null, host.provider), new RecordingTurnListener(), signal);
    const listed = await adapter.runTurn(host.request("launch", null, "gpt-5", null, host.provider), new RecordingTurnListener(), signal);
    const elsewhere = await adapter.runTurn(host.request("launch", null, "gpt-5.4"), new RecordingTurnListener(), signal);

    Assert.areEqual("gpt-5.4 false", `${unknown.observed.model} ${unknown.observed.unavailableModel}`);
    Assert.areEqual(TurnOutcome.Completed, missing.outcome);
    Assert.isNull(missing.observed.model);
    Assert.isTrue(missing.observed.unavailableModel);
    Assert.areEqual("gpt-5 false", `${listed.observed.model} ${listed.observed.unavailableModel}`);
    Assert.areEqual("gpt-5.4 false", `${elsewhere.observed.model} ${elsewhere.observed.unavailableModel}`);
  }

  @TestMethod
  public async marksEveryModelUnavailableOnCopilotFreeAndNoneWhenNoModelIsSet(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createPatientAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "free" });
    const signal = new AbortController().signal;

    await adapter.listModels(host.provider);
    const named = await adapter.runTurn(host.request("launch", null, "kimi-k3", "medium", host.provider), new RecordingTurnListener(), signal);
    const auto = await adapter.runTurn(host.request("launch", null, null, null, host.provider), new RecordingTurnListener(), signal);

    Assert.areEqual("null true medium", `${named.observed.model} ${named.observed.unavailableModel} ${named.observed.effort}`);
    Assert.areEqual("null false", `${auto.observed.model} ${auto.observed.unavailableModel}`);
  }

  @TestMethod
  public async listsAgainWhenTheKeptListLacksTheModelAndKeepsTheMarkOnlyWhenTheFreshListLacksItToo(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createPatientAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "free>serve" });
    const signal = new AbortController().signal;
    const listener = new RecordingTurnListener();

    await adapter.listModels(host.provider);
    const upgraded = await adapter.runTurn(host.request("launch", null, "gpt-5", null, host.provider), listener, signal);
    const missing = await adapter.runTurn(host.request("launch", null, "gpt-5.4", null, host.provider), new RecordingTurnListener(), signal);

    Assert.areEqual("null true", `${listener.observations[0]!.model} ${listener.observations[0]!.unavailableModel}`);
    Assert.areEqual(TurnOutcome.Completed, upgraded.outcome);
    Assert.areEqual("gpt-5 false", `${upgraded.observed.model} ${upgraded.observed.unavailableModel}`);
    Assert.areEqual("null true", `${missing.observed.model} ${missing.observed.unavailableModel}`);
    Assert.isTrue((await adapter.listModels(host.provider)).models.some(t => t.id === "gpt-5"));
  }

  @TestMethod
  @TestData("waited out")
  @TestData("held")
  public async dropsTheMarkFromAFreshListingSlowerThanTheModelCheckWaitUnlessTheWaitIsHeld(wait: string): Promise<void> {
    await using host = new CopilotTestHost();
    const timer = new ManualTimer();
    const adapter = host.createPatientAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve>late" }, wait === "held" ? host.patientTimer : timer);

    await adapter.listModels(host.provider);
    const run = adapter.runTurn(host.request("launch", null, "gpt-5.4", null, host.provider), new RecordingTurnListener(), new AbortController().signal);
    await Wait.until(() => existsSync(host.directory.resolve("work", "headless-held.txt")), "The fake did not write headless-held.txt.");
    await Wait.until(() => wait === "held" || timer.pending > 0, "The timer held no wait.");
    if (wait === "held")
      writeFileSync(host.directory.resolve("work", "headless-released.txt"), "");
    else
      timer.advance(Resources.modelCheckWait);
    const ended = await run;

    Assert.areEqual(TurnOutcome.Completed, ended.outcome);
    Assert.areEqual(wait === "held" ? "null true" : "gpt-5.4 false", `${ended.observed.model} ${ended.observed.unavailableModel}`);
  }

  @TestMethod
  public async dropsTheMarkWhenTheFreshListingFailsOrTheTurnDoesNotComplete(): Promise<void> {
    await using host = new CopilotTestHost();
    const failing = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "free>failSession" });
    const ending = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "free" });
    const signal = new AbortController().signal;

    await failing.listModels(host.provider);
    const unconfirmed = await failing.runTurn(host.request("launch", null, "kimi-k3", null, host.provider), new RecordingTurnListener(), signal);
    await ending.listModels(host.provider);
    const ended = await ending.runTurn(host.request("exit", null, "kimi-k3", null, host.provider), new RecordingTurnListener(), signal);

    Assert.areEqual(TurnOutcome.Completed, unconfirmed.outcome);
    Assert.areEqual("kimi-k3 false", `${unconfirmed.observed.model} ${unconfirmed.observed.unavailableModel}`);
    Assert.areEqual(TurnOutcome.Failed, ended.outcome);
    Assert.areEqual("kimi-k3 false", `${ended.observed.model} ${ended.observed.unavailableModel}`);
  }

  @TestMethod
  public async dropsTheMarkWhenAMarkedTurnIsStopped(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "free" });
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    await adapter.listModels(host.provider);
    const run = adapter.runTurn(host.request("cancel", null, "kimi-k3", null, host.provider), listener, controller.signal);
    await Wait.until(() => listener.texts.includes("working"), "The listener did not see 'working'.");
    controller.abort();
    const stopped = await run;

    Assert.areEqual("null true", `${listener.observations[0]!.model} ${listener.observations[0]!.unavailableModel}`);
    Assert.areEqual(TurnOutcome.Interrupted, stopped.outcome);
    Assert.areEqual("kimi-k3 false", `${stopped.observed.model} ${stopped.observed.unavailableModel}`);
  }

  @TestMethod
  @TestData("stop")
  @TestData("wait")
  public async endsTheWaitForAFreshListingOnStopOrAfterAShortWaitWithoutTheMark(ending: string): Promise<void> {
    await using host = new CopilotTestHost();
    const timer = new ManualTimer();
    const adapter = host.createPatientAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "free>hold" }, timer);
    const controller = new AbortController();

    await adapter.listModels(host.provider);
    const run = adapter.runTurn(host.request("launch", null, "kimi-k3", null, host.provider), new RecordingTurnListener(), controller.signal);
    await Wait.until(() => timer.pending > 0, "The timer held no wait.");
    await Wait.until(() => existsSync(host.directory.resolve("work", "headless-held.txt")), "The fake did not write headless-held.txt.");
    if (ending === "stop")
      controller.abort();
    else
      timer.advance(Resources.modelCheckWait);
    const ended = await run;

    Assert.areEqual(TurnOutcome.Completed, ended.outcome);
    Assert.areEqual("kimi-k3 false", `${ended.observed.model} ${ended.observed.unavailableModel}`);
  }

  @TestMethod
  public async leavesAFailedTurnWithAnUnavailableModelUnmarked(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve", TEAMRUN_FAKE_ACP_NEW: "fail" });

    await adapter.listModels(host.provider);
    const failed = await adapter.runTurn(host.request("launch", null, "gpt-5.4", null, host.provider), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, failed.outcome);
    Assert.isNull(failed.observed.model);
    Assert.isFalse(failed.observed.unavailableModel);
  }

  @TestMethod
  public async launchesATurnWithAModelAndRefusesANameThatIsNotOne(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const named = await adapter.runTurn(host.request("launch", null, "gpt-5.4", "max"), listener, new AbortController().signal);
    const flag = await adapter.runTurn(host.request("launch", null, "--allow-all-tools"), new RecordingTurnListener(), new AbortController().signal);
    const long = await adapter.runTurn(host.request("launch", null, `--${"x".repeat(60)}`), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, named.outcome);
    Assert.areEqual("gpt-5.4", named.observed.model);
    Assert.areEqual("--acp --stdio --no-auto-update --model gpt-5.4 --reasoning-effort max --disable-builtin-mcps",
      (JSON.parse(listener.texts.find(t => t.startsWith("{"))!) as { args: string[] }).args.join(" "));
    Assert.areEqual(TurnOutcome.Failed, flag.outcome);
    Assert.areEqual(Resources.formatCopilotModelNameInvalid("--allow-all-tools"), flag.error);
    Assert.isTrue(flag.error!.startsWith("\"--allow-all-tools\" isn't a model name Copilot can start with. Use up to 100 letters,"));
    Assert.areEqual(TurnOutcome.Failed, long.outcome);
    Assert.areEqual(`"--${"x".repeat(38)}…" isn't a model name Copilot can start with.`, long.error!.slice(0, long.error!.indexOf(".") + 1));
  }

  @TestMethod
  @TestData("yes")
  @TestData("no")
  public async asksForPermissionAndStopsATurn(choice: string): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const asked = new RecordingTurnListener();
    asked.decisions.push(choice);
    const controller = new AbortController();
    const stopped = new RecordingTurnListener();

    const approved = await adapter.runTurn(host.request("approve"), asked, new AbortController().signal);
    const run = adapter.runTurn(host.request("cancel"), stopped, controller.signal);
    await Wait.until(() => stopped.texts.includes("working"), "The stopped listener did not see 'working'.");
    controller.abort();

    Assert.areEqual(TurnOutcome.Completed, approved.outcome);
    Assert.isTrue(asked.details.some(t => t.text.includes(`"optionId":"${choice}"`)));
    Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
  }

  @TestMethod
  public async showsCopilotAmongTheRunningProgramsWhileATurnRunsAndNotAfter(): Promise<void> {
    await using host = new CopilotTestHost();
    const starter = new RunningProgramsStarter();
    const adapter = new CopilotAdapter(host.command, host.environment, host.directory.resolve("work"), host.info, host.programs.wrap(starter), host.timings, host.timer,
      null, undefined, null, host.elapsedIdleTimer, new SettledProcessTree());
    const listener = new RecordingTurnListener();
    const controller = new AbortController();
    try {
      const run = adapter.runTurn(host.request("cancel"), listener, controller.signal);
      await Wait.until(() => listener.texts.includes("working"), "The listener did not see 'working'.");
      const during = starter.ofKind("copilot").length;
      controller.abort();

      Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
      Assert.areEqual(1, during);
      Assert.areEqual(0, starter.running.length);
    }
    finally {
      await adapter.shutdown();
    }
  }

  @TestMethod
  public async resumesWithSessionLoadAndStartsFreshWithTheHistoryWhenTheLoadFails(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const resumed = new RecordingTurnListener();
    const fresh = new RecordingTurnListener();

    const loaded = await adapter.runTurn(host.request("complete", "copilot-earlier"), resumed, new AbortController().signal);
    const restarted = await adapter.runTurn(host.request("complete", "missing", null, null, null, "launch"), fresh, new AbortController().signal);

    Assert.areEqual("copilot-earlier", loaded.nativeSessionId);
    Assert.isTrue(resumed.starts[0]!.resumedNativeSession);
    Assert.isFalse(resumed.texts.includes("replayed history"));
    Assert.areEqual(TurnOutcome.Completed, restarted.outcome);
    Assert.areEqual("copilot-session", restarted.nativeSessionId);
    Assert.isFalse(fresh.starts[0]!.resumedNativeSession);
    Assert.isTrue(fresh.texts.some(t => t.startsWith(Resources.formatResumeFailed(String.empty))));
    Assert.isTrue(fresh.texts.some(t => t.startsWith("{")));
  }

  @TestMethod
  public async givesTeamRunsEndpointToANewAndALoadedSessionWithEachProcesssOwnTokenOnlyInItsHeader(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) },
      [], new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("copilot", null, null),
      resume, [], null, null, {}, false, tools);

    const started = await adapter.runTurn(request(null), new RecordingTurnListener(), new AbortController().signal);
    const loaded = await adapter.runTurn(request("copilot-earlier"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.shutdown();

    const sent = readFileSync(host.directory.resolve("work", "mcp-servers.txt"), "utf8").trimEnd().split("\n").filter(t => t !== "[]");
    const bearers = sent.map(t => RecordedMcpServers.bearerOf(t));
    Assert.areEqual(TurnOutcome.Completed, started.outcome);
    Assert.areEqual(TurnOutcome.Completed, loaded.outcome);
    Assert.areEqual(bearers.map(t => JSON.stringify([{ type: "http", name: "teamrun", url: "http://127.0.0.1:4711/mcp",
      headers: [{ name: "Authorization", value: `Bearer ${t}` }] }])).join("\n"), sent.join("\n"));
    Assert.areEqual(JSON.stringify([2, 43, 43]), JSON.stringify([new Set(bearers).size, ...bearers.map(t => t.length)]));
  }

  @TestMethod
  public async sendsCompactUnwrappedToALoadedSessionAndSaysThereIsNothingToCompactWithoutOne(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();
    const request = (resume: string | null): TurnRequest => new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("copilot", null, null),
      resume, [], "Review carefully", "launch", {}, true);
    const resumed = new RecordingTurnListener();
    const fresh = new RecordingTurnListener();

    const loaded = await adapter.runTurn(request("copilot-earlier"), resumed, new AbortController().signal);
    const restarted = await adapter.runTurn(request("missing"), fresh, new AbortController().signal);
    const unresumed = new RecordingTurnListener();
    const sessionless = await adapter.runTurn(request(null), unresumed, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, loaded.outcome);
    Assert.isTrue(resumed.texts.includes("/compact"));
    Assert.areEqual(TurnOutcome.Completed, restarted.outcome);
    Assert.isNull(restarted.nativeSessionId);
    Assert.isTrue(fresh.texts.includes("There's no session to compact."));
    Assert.isFalse(fresh.texts.some(t => t === "/compact" || t.startsWith("{") || t.startsWith(Resources.formatResumeFailed(String.empty))));
    Assert.isNull(sessionless.nativeSessionId);
    Assert.isTrue(unresumed.texts.includes("There's no session to compact."));
    Assert.isFalse(existsSync(host.directory.resolve("work", "new-sessions.txt")));
  }

  @TestMethod
  public async saysCopilotIsSignedOutWhenATurnNeedsSignIn(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_ACP_INIT: "loggedOut" });

    const named = await adapter.runTurn(host.request("complete", null, null, null, host.provider), new RecordingTurnListener(), new AbortController().signal);
    const native = await adapter.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, named.outcome);
    Assert.areEqual(Resources.formatCopilotSignIn(host.provider.profileDir), named.error);
    Assert.areEqual(Resources.formatCopilotSignIn(null), native.error);
  }

  @TestMethod
  public async saysCopilotIsMissingWhenItIsNotInstalled(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({}, null);

    const listing = await Assert.throwsAsync(() => adapter.listModels(null), ExecutableNotFoundException);
    const check = await adapter.checkSignIn(host.provider);
    const turn = await adapter.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(Resources.copilotNotFound, listing.message);
    Assert.areEqual(AuthStatus.Error, check.authStatus);
    Assert.areEqual(Resources.copilotNotFound, check.error);
    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.areEqual(Resources.copilotNotFound, turn.error);
    Assert.areEqual("copilot", adapter.descriptor.id);
    Assert.isTrue(adapter.descriptor.abilities === ProviderAbilityTable.copilot);
    Assert.isFalse(adapter.descriptor.supportsSignIn);
  }

  @TestMethod
  public async refusesAForkWithTheWordingEveryProviderWithoutOneSharesWithoutStartingCopilot(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter();

    const refused = await Assert.throwsAsync(() => adapter.forkSession(new ForkRequest(host.provider, host.directory.path, "s-1", "0",
      new RequestedSettings("copilot", null, null))), Error);

    Assert.isTrue(adapter.descriptor.supportsResume);
    Assert.isFalse(adapter.descriptor.supportsFork);
    Assert.areEqual("GitHub Copilot can't fork a session; a rewind goes on in a fresh session that is told what was said before.", refused.message);
    Assert.areEqual(0, host.programs.started.length);
  }

  @TestMethod
  public async reportsTheContextCopilotSendsDuringATurnAndTheTokensItsAnswerNames(): Promise<void> {
    await using host = new CopilotTestHost();
    const listener = new RecordingTurnListener();

    const result = await host.createAdapter().runTurn(host.request("usage"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("null null null null null null 30000/200000/null,1200 300 null 800 100 50 none", listener.usages.map(t => `${t.inputTokens} ${t.outputTokens} ${t.costUsd} ` +
      `${t.cacheReadTokens} ${t.cacheWriteTokens} ${t.reasoningTokens} ` +
      (Object.isNull(t.context) ? "none" : `${t.context.usedTokens}/${t.context.windowTokens}/${t.context.compactAtTokens}`)).join(","));
  }

  @TestMethod
  @TestData("serve", "MonthlyPremiumRequests 37.5 2026-12-01T00:00:00.000Z false,MonthlyChatRequests null null true / pro")
  @TestData("free", " / free")
  @TestData("failQuota", "none")
  @TestData("failSession", "none")
  @TestData("signedOut", "none")
  public async readsThePlanUseAndThePlanItNamesFromTheQuotaAndNothingWhenCopilotCannotSay(mode: string, plan: string): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: mode });

    const usage = await adapter.readPlanUsage(host.provider);

    Assert.areEqual(plan, Object.isNull(usage) ? "none"
      : [usage.windows.map(t => `${t.name} ${t.usedPercent} ${t.resetsAt} ${t.unlimited}`).join(","), usage.plan].join(" / "));
    Assert.areEqual(mode === "signedOut" || mode === "failSession" ? 0 : 1,
      readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8").split("\n").filter(t => t.startsWith("session.quota.get ")).length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async readsThePlanUseAgainAfterEachReplyOnlyWhileTheProviderReportsOne(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" });
    const unread = new RecordingTurnListener();
    const read = new RecordingTurnListener();
    const quotaAsks = (): number => readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8").split("\n").filter(t => t.startsWith("session.quota.get ")).length;

    await adapter.runTurn(host.request("usage", null, null, null, host.provider), unread, new AbortController().signal);
    await adapter.shutdown();
    const usage = await adapter.readPlanUsage(host.provider);
    await adapter.runTurn(host.request("usage", null, null, null, host.provider), read, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(0, unread.planUsages.length);
    Assert.areEqual("MonthlyPremiumRequests 37.5,MonthlyChatRequests null|MonthlyPremiumRequests 47.5,MonthlyChatRequests null", [usage!.windows, ...read.planUsages].map(t => t.map(w => `${w.name} ${w.usedPercent}`).join(",")).join("|"));
    Assert.areEqual(2, quotaAsks());
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  @TestData("serve")
  @TestData("failRefresh")
  public async readsThePlanUseAgainAfterEveryFailedTurnThatWasNotStoppedAndShowsTheQuotaUsedUpAfterAQuotaRefusal(mode: string): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: mode });
    const prompts = ["quota", "quotaInternal", "quotaStop", "limit", "rateLimit", "quotaPath"];
    const failed = prompts.map(() => new RecordingTurnListener());
    const stopped = new RecordingTurnListener();
    const controller = new AbortController();
    const outcomes: TurnOutcome[] = [];

    await adapter.readPlanUsage(host.provider);
    for (const [index, prompt] of prompts.entries()) {
      outcomes.push((await adapter.runTurn(host.request(prompt, null, null, null, host.provider), failed[index]!, new AbortController().signal)).outcome);
      await adapter.shutdown();
    }
    const run = adapter.runTurn(host.request("cancel", null, null, null, host.provider), stopped, controller.signal);
    await Wait.until(() => stopped.texts.includes("working"), "The stopped listener did not see 'working'.");
    controller.abort();
    outcomes.push((await run).outcome);
    await adapter.shutdown();
    const asked = readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8").split("\n").filter(t => t.startsWith("session.quota.")).map(t => t.split(" ")[0]);

    Assert.areEqual([...prompts.map(() => TurnOutcome.Failed), TurnOutcome.Interrupted].join(" "), outcomes.join(" "));
    Assert.areEqual(["Quota 100;MonthlyPremiumRequests 47.5,MonthlyChatRequests null,Quota 100", "Quota 100;MonthlyPremiumRequests 57.5,MonthlyChatRequests null,Quota 100",
      "Quota 100;MonthlyPremiumRequests 67.5,MonthlyChatRequests null,Quota 100", "MonthlyPremiumRequests 77.5,MonthlyChatRequests null",
      "MonthlyPremiumRequests 87.5,MonthlyChatRequests null", "MonthlyPremiumRequests 97.5,MonthlyChatRequests null", ""].join("|"),
    [...failed, stopped].map(t => t.planUsages.map(w => w.map(u => `${u.name} ${u.usedPercent}`).join(",")).join(";")).join("|"));
    Assert.areEqual(["session.quota.get", ...prompts.flatMap(() => ["session.quota.refresh", "session.quota.get"])].join(","), asked.join(","));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  @TestData("empty", "Quota 100 null|Quota 100 null", "")
  @TestData("failQuota", "Quota 100 null|Quota 100 null", "")
  @TestData("spent", "Quota 100 null|MonthlyPremiumRequests 100 2026-12-01T00:00:00.000Z", "MonthlyPremiumRequests 100 2026-12-01T00:00:00.000Z")
  public async reportsTheQuotaUsedInFullAfterARefusalForQuotaUnlessTheQuotaReadSaysSoUntilTheNextReading(mode: string, plan: string, laterPlan: string): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: mode });
    const refused = new RecordingTurnListener();
    const later = new RecordingTurnListener();

    const read = await adapter.readPlanUsage(host.provider);
    const quota = await adapter.runTurn(host.request("quota", null, null, null, host.provider), refused, new AbortController().signal);
    await adapter.shutdown();
    const completed = await adapter.runTurn(host.request("usage", null, null, null, host.provider), later, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(mode === "failQuota" ? "none" : mode === "empty" ? "0" : "1", Object.isNull(read) ? "none" : String(read.windows.length));
    Assert.areEqual(TurnOutcome.Failed, quota.outcome);
    Assert.areEqual(TurnOutcome.Completed, completed.outcome);
    Assert.areEqual(plan, refused.planUsages.map(t => t.map(w => `${w.name} ${w.usedPercent} ${w.resetsAt}`).join(",")).join("|"));
    Assert.areEqual(1, later.planUsages.length);
    Assert.areEqual(laterPlan, later.planUsages.map(t => t.map(w => `${w.name} ${w.usedPercent} ${w.resetsAt}`).join(",")).join("|"));
    Assert.isTrue(later.planUsages.flat().every(t => t.name !== PlanWindowName.Quota));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  @TestData("quotaReply", true)
  @TestData("quotaAfterText", true)
  @TestData("quotaTalk", false)
  @TestData("errorOther", false)
  @TestData("quotaLines", false)
  @TestData("quotaBeforeText", false)
  public async showsTheQuotaUsedInFullAtOnceWhenCopilotEndsATurnWithOnlyItsQuotaRefusalLineWhileTheQuotaReadIsHeld(prompt: string,
    refused: boolean): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "releaseConnect" });
    const listener = new RecordingTurnListener();
    const methods = host.directory.resolve("work", "headless-methods.txt");
    const shown = (): string => listener.planUsages.map(t => t.map(w => `${w.name} ${w.usedPercent}`).join(",")).join("|");

    const turn = await adapter.runTurn(host.request(prompt, null, null, null, host.provider), listener, new AbortController().signal);
    const atOnce = shown();
    await Wait.until(() => !refused || existsSync(methods) && readFileSync(methods, "utf8") === "connect {}\n", "Copilot did not get the connect request.");
    const held = shown();
    writeFileSync(host.directory.resolve("work", "headless-released.txt"), String.empty);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual(refused ? "Quota 100" : String.empty, atOnce);
    Assert.areEqual(atOnce, held);
    Assert.areEqual(refused ? "Quota 100|MonthlyPremiumRequests 37.5,MonthlyChatRequests null,Quota 100" : String.empty, shown());
    Assert.areEqual(refused, existsSync(methods));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async logsAPlanUseItReadAfterAReplyButCouldNotReport(): Promise<void> {
    await using host = new CopilotTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve" }, host.command, log);
    const listener = new FailingPlanUsageListener();

    Assert.isNotNull(await adapter.readPlanUsage(host.provider));
    const turn = await adapter.runTurn(host.request("usage", null, null, null, host.provider), listener, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.areEqual(1, listener.planUsages.length);
    Assert.areEqual(1, log.lines.filter(t => t === FailingPlanUsageListener.failure).length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async stopsReadingThePlanUseAfterRepliesOnceTheProviderReportsNone(): Promise<void> {
    await using host = new CopilotTestHost();
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve>free" });
    const emptied = new RecordingTurnListener();
    const later = new RecordingTurnListener();

    Assert.isNotNull(await adapter.readPlanUsage(host.provider));
    await adapter.runTurn(host.request("usage", null, null, null, host.provider), emptied, new AbortController().signal);
    await adapter.shutdown();
    await adapter.runTurn(host.request("usage", null, null, null, host.provider), later, new AbortController().signal);
    await adapter.shutdown();

    Assert.areEqual(0, emptied.planUsages.length + later.planUsages.length);
    Assert.areEqual(2, readFileSync(host.directory.resolve("work", "headless-methods.txt"), "utf8").split("\n").filter(t => t.startsWith("session.quota.get ")).length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new CopilotTestHost();
    const folder = join(host.provider.profileDir, "session-state", "copilot-session");
    mkdirSync(folder, { recursive: true });
    const database = new DatabaseSync(join(folder, "session.db"));
    database.exec("CREATE TABLE todos (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, status TEXT, created_at INTEGER, updated_at INTEGER);"
      + "INSERT INTO todos (id, title, status, created_at) VALUES ('a', 'Read the code', 'done', 1)");
    database.close();
    const models = [{ id: "claude-opus-4.8", name: "Claude Opus 4.8", capabilities: { supports: { vision: true, reasoningEffort: true } },
      supportedReasoningEfforts: ["low", "medium", "high"], defaultReasoningEffort: "medium", policy: { state: "enabled", terms: "" } },
    { id: "claude-opus-4.8-fast", name: "Claude Opus 4.8 Fast", capabilities: { supports: { vision: true, reasoningEffort: false } }, policy: { state: "enabled", terms: "" } }];
    const adapter = host.createAdapter({ TEAMRUN_FAKE_COPILOT_HEADLESS: "serve", TEAMRUN_FAKE_COPILOT_MODELS: JSON.stringify(models) });
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => new TurnRequest(host.provider, host.directory.path, prompt,
      new RequestedSettings("copilot", null, null), resume, attachments), host.directory.path);

    await AbilityChecks.runAsync(adapter.descriptor, {
      ...AbilityChecks.surface(adapter, host.provider, () => adapter.listModels(host.provider)),
      [ProviderAbility.ChooseSpeed]: AbilityChecks.listsModel(() => adapter.listModels(host.provider), "claude-opus-4.8-fast"),
      ...turns.probes({ [ProviderAbility.Questions]: TurnAbilityProbes.plain, [ProviderAbility.PlanChecklist]: "todos", [ProviderAbility.ReplyUsage]: "usage",
        [ProviderAbility.SubAgentRows]: "sub-agents", [ProviderAbility.BackgroundCommands]: TurnAbilityProbes.plain,
        [ProviderAbility.GeneratedImages]: TurnAbilityProbes.plain, [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "cancel" }),
      ...turns.subAgents("background-sub-agents"),
      [ProviderAbility.ApprovedTools]: async () => (await turns.approvedTurnAsync("launch")).listener.texts.some(t => t.includes(`(${TurnAbilityProbes.approvedTool})`))
    });
  }

  @TestMethod
  public async sendsCopilotThePlanToolRuleWithTheTeammatesInstructions(): Promise<void> {
    await using host = new CopilotTestHost();

    await PlanToolRule.expectSentAsync(host.createAdapter(), host.request("role-payload"));
  }

  private static allowAll(values: readonly string[] | null, current: string = "on", autopilot: boolean = true): string {
    const modes = { type: "select", id: "mode", name: "Mode", category: "mode", currentValue: Resources.copilotAgentMode,
      options: [{ value: Resources.copilotAgentMode, name: "Agent" }, { value: Resources.copilotPlanMode, name: "Plan" },
        ...autopilot ? [{ value: Resources.copilotAutopilotMode, name: "Autopilot" }] : []] };
    return JSON.stringify(Object.isNull(values) ? [modes]
      : [modes, { type: "select", id: "allow_all", name: "Allow All", category: "permissions", currentValue: current, options: values.map(t => ({ value: t, name: t })) }]);
  }

  private static sessionMethods(skipCache: boolean, quota: boolean = false): string {
    const session = JSON.stringify({ sessionId: "fake-session" });
    return ["connect {}", "auth.getStatus {}", "session.create {}", `session.model.list ${JSON.stringify({ sessionId: "fake-session", skipCache })}`,
      ...quota ? [`session.quota.get ${session}`] : [], `session.delete ${session}`, ""].join("\n");
  }
}

class FailingPlanUsageListener extends RecordingTurnListener {
  public static readonly failure: string = "The plan use could not be saved.";

  public override async onPlanUsageAsync(windows: readonly PlanWindow[]): Promise<void> {
    await super.onPlanUsageAsync(windows);
    throw new Error(FailingPlanUsageListener.failure);
  }
}
