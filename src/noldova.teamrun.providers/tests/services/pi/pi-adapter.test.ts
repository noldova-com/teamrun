/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, readdirSync, realpathSync, statSync, truncateSync, utimesSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Resources as CoreResources, ForkRequest, type IProviderAdapter, McpEndpoint, SessionTokens, SharedMcpFailureKind, SharedMcpValues, TitleTurn, TurnOutcome, TurnRequest, type TurnResult, TurnSteer, TurnTools }
  from "@noldova/teamrun.core";
import { AuthStatus, DetailKind, MessageAttachment, Provider, ProviderAbility, Resources as ProtocolResources, QuestionAnswer, ReplyAction, RequestedSettings,
  SharedMcpHeader, SharedMcpServerDefinition, SharedMcpTransport }
  from "@noldova/teamrun.protocol";
import { NodeProcessStarter, ProviderAbilityTable, ProviderTimings, Resources, SharedMcpLaunch } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { ControlledProcessTerminator } from "../../fixtures/controlled-process-terminator.fixture.js";
import { PiTestHost } from "../../fixtures/pi-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class PiAdapterTests {
  private static readonly search: SharedMcpServerDefinition =
    new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", ["-y", "search-server"], ["SEARCH_KEY"], null, [], null);
  private static readonly docs: SharedMcpServerDefinition =
    new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [new SharedMcpHeader("X-Team", "DOCS_TEAM")], "DOCS_TOKEN");
  private static readonly wiki: SharedMcpServerDefinition =
    new SharedMcpServerDefinition("wiki", SharedMcpTransport.Http, null, [], [], "https://wiki.example/mcp", [], null);

  @TestMethod
  public async describesPiAndKeepsPlanUsageSubAgentsAndTeamMcpServersOffWithAReason(): Promise<void> {
    await using host = new PiTestHost();
    await using own = new PiTestHost({ PI_CODING_AGENT_DIR: join(homedir(), "pi-elsewhere") });
    const adapter = host.createAdapter();
    const contract: IProviderAdapter = adapter;

    const signIn = await Assert.throwsAsync(() => adapter.signIn(host.createProvider(), new AbortController().signal), Error);

    Assert.areEqual(JSON.stringify(["pi", "Pi", true, true, true, false, "PI_CODING_AGENT_DIR", "pi", join(homedir(), ".pi/agent")]), JSON.stringify([
      adapter.descriptor.id, adapter.descriptor.displayName, adapter.descriptor.supportsResume, adapter.descriptor.supportsSignInCheck,
      adapter.descriptor.supportsFork, adapter.descriptor.supportsSignIn, adapter.descriptor.profile?.variable, adapter.descriptor.profile?.signInCommand,
      adapter.descriptor.profile?.usualFolder]));
    Assert.isTrue(adapter.descriptor.abilities === ProviderAbilityTable.pi);
    Assert.areEqual(JSON.stringify(["pi", false, "/logout", false]), JSON.stringify([adapter.descriptor.profile?.toolCommand, adapter.descriptor.supportsSignOut,
      adapter.descriptor.signOutCommand, adapter.descriptor.signOutEndsWithCommand]));
    Assert.areEqual(join(homedir(), "pi-elsewhere"), own.createAdapter().descriptor.profile?.usualFolder);
    Assert.areEqual(Resources.piSignInUnavailable, signIn.message);
    Assert.areEqual(JSON.stringify([["ask", false, false], ["read-only", false, true], ["allow-all", true, false]]),
      JSON.stringify(adapter.modes.map(t => [t.id, t.unrestricted, t.readOnly])));
    Assert.areEqual(JSON.stringify(["ask", "read-only", null, null]), JSON.stringify([adapter.defaultMode, adapter.explorerMode, adapter.planMode,
      adapter.backgroundSubAgentsNote]));
    Assert.areEqual(`${adapter.descriptor.displayName} can't switch on its own MCP servers here: ${Resources.piOwnServersSwitchAbility}.`, adapter.descriptor.ownMcpServersUnavailable);
    const withheld = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], [ProtocolResources.senderTokenVariable], null, [], null);
    const ownVariable = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example.com/mcp", [new SharedMcpHeader("X-Key", "teamrun_pi_tools_token")], null);
    Assert.areEqual(JSON.stringify([null, null,
      { reason: Resources.formatSharedMcpSenderTokenWithheld("Pi", ProtocolResources.senderTokenVariable),
        short: Resources.formatSharedMcpVariableWithheldShort(ProtocolResources.senderTokenVariable) },
      { reason: Resources.formatPiOwnVariableWithheld("teamrun_pi_tools_token"), short: Resources.formatSharedMcpVariableWithheldShort("teamrun_pi_tools_token") },
      { reason: Resources.formatSavedSecretsFromEnvironmentOnly("Pi"), short: "reads values only from its environment" }, "my_api_v2"]),
      JSON.stringify([adapter.sharedServerUnavailable(PiAdapterTests.search), adapter.sharedServerUnavailable(PiAdapterTests.docs), adapter.sharedServerUnavailable(withheld),
        adapter.sharedServerUnavailable(ownVariable), adapter.savedSecretsUnavailable(), adapter.sharedServerNamespaceOf("my-api_v2")]));
    Assert.isUndefined(contract.readPlanUsage);
    Assert.areEqual(JSON.stringify(["auth.json"]), JSON.stringify(adapter.profileSearch.entries));
  }

  @TestMethod
  public async listsThePersonsOwnServersFromTheMcpFileInTheProfileOrItsUsualFolder(): Promise<void> {
    await using host = new PiTestHost();
    await using usual = new PiTestHost({ PI_CODING_AGENT_DIR: host.directory.resolve("usual") });
    const provider = host.createProvider();
    const unnamed = host.createProvider(null, "unnamed");
    mkdirSync(host.directory.resolve("usual"), { recursive: true });
    writeFileSync(join(provider.profileDir, "mcp.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" },
      [ProtocolResources.mcpServerName]: { url: "http://127.0.0.1:1/mcp" }, web: { url: "https://web.example/mcp" } } }));
    writeFileSync(host.directory.resolve("usual", "mcp.json"), JSON.stringify({ mcpServers: { notes: { command: "notes" } } }));
    writeFileSync(join(unnamed.profileDir, "mcp.json"), JSON.stringify({ servers: { notes: { command: "notes" } } }));
    const listed = async (adapter: IProviderAdapter, listedProvider: Provider | null): Promise<string> =>
      (await adapter.listOwnMcpServers?.(listedProvider))?.map(t => `${t.name} ${t.state}`).join() ?? "none";

    Assert.areEqual(JSON.stringify(["docs Configured,web Configured", "notes Configured", "", ""]), JSON.stringify([await listed(host.createAdapter(), provider),
      await listed(usual.createAdapter(), null), await listed(host.createAdapter(), unnamed), await listed(host.createAdapter(), host.createProvider(null, "empty"))]));
  }

  @TestMethod
  public async refusesToListTheOwnServersNamingAnMcpFileThatCantBeReadOrIsTooLarge(): Promise<void> {
    await using host = new PiTestHost();
    const adapter = host.createAdapter();
    const provider = host.createProvider();
    const folder = host.createProvider(null, "folder");
    const file = join(provider.profileDir, "mcp.json");
    const refusal = async (listedProvider: Provider): Promise<string> => (await Assert.throwsAsync(() => adapter.listOwnMcpServers(listedProvider), Error)).message;

    writeFileSync(file, "{ not json");
    const malformed = await refusal(provider);
    writeFileSync(file, JSON.stringify({ mcpServers: ["docs"] }));
    const notAnObject = await refusal(provider);
    writeFileSync(file, JSON.stringify({ mcpServers: {} }));
    truncateSync(file, Resources.maximumConfigurationBytes + 1);
    const tooLarge = await refusal(provider);
    mkdirSync(join(folder.profileDir, "mcp.json"));
    const unreadable = await refusal(folder);

    Assert.areEqual(JSON.stringify([Resources.formatOwnMcpConfigUnreadable(file), Resources.formatOwnMcpConfigUnreadable(file), Resources.formatOwnMcpConfigTooLarge(file),
      Resources.formatOwnMcpConfigUnreadable(join(folder.profileDir, "mcp.json"))]), JSON.stringify([malformed, notAnObject, tooLarge, unreadable]));
  }

  @TestMethod
  @TestData("ready", "LoggedIn", null)
  @TestData("not_ready", "LoggedOut", "not-ready")
  @TestData("invalid", "Error", "invalid")
  public async checksTheSignInOfPisDefaultProviderByTheExitCodeOfAuthCheck(answer: string, status: string, error: string | null): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_AUTH: answer });
    const provider = host.createProvider();

    const check = await host.createAdapter().checkSignIn(provider);

    Assert.areEqual(status, check.authStatus);
    Assert.areEqual("1.4.0", check.harnessVersion);
    Assert.areEqual(error === "not-ready" ? Resources.formatPiNotReady("anthropic") : error === "invalid" ? Resources.formatPiAuthInvalid("anthropic", false) : null,
      check.error);
    Assert.areEqual(JSON.stringify([{ argv: ["auth", "check", "--provider", "anthropic", "--json"], agentDir: provider.profileDir }]), JSON.stringify(host.records));
  }

  @TestMethod
  public async failsTheSignInCheckWhenAuthCheckRunsPastItsTime(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_AUTH: "hang" });

    const check = await host.createAdapter(host.command, new ProviderTimings(5000, 200, 5000, 5000, 1000, 300, 500, 500, 200, 1, 20)).checkSignIn(host.createProvider());

    Assert.areEqual(AuthStatus.Error, check.authStatus);
    Assert.areEqual(Resources.formatPiAuthInvalid("anthropic", true), check.error);
  }

  @TestMethod
  @TestData(null)
  @TestData("{}")
  @TestData("{\"defaultProvider\":\" \"}")
  @TestData("{")
  public async asksForAModelInPiWhenTheProfileNamesNoDefaultProvider(settings: string | null): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_DEFAULT: "none" });
    const provider = host.createProvider(null);
    if (!Object.isNull(settings))
      writeFileSync(join(provider.profileDir, "settings.json"), settings);

    const check = await host.createAdapter().checkSignIn(provider);

    Assert.areEqual(AuthStatus.LoggedOut, check.authStatus);
    Assert.areEqual(Resources.piChooseModel, check.error);
    Assert.isFalse(host.records.some(t => (t["argv"] as string[] | undefined)?.[0] === "auth"));
  }

  @TestMethod
  @TestData("text", true)
  @TestData("no-state", false)
  public async asksPiForTheProviderOfItsStartingModelWhenTheSettingsNameNoneSoAnEnvironmentKeyCounts(scenario: string, signedIn: boolean): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: scenario });

    const check = await host.createAdapter().checkSignIn(host.createProvider(null));
    const authChecks = host.records.filter(t => (t["argv"] as string[] | undefined)?.[0] === "auth").map(t => t["argv"]);

    await host.programs.endedAt(host.programs.started.length);

    Assert.areEqual(signedIn ? AuthStatus.LoggedIn : AuthStatus.LoggedOut, check.authStatus);
    Assert.areEqual(JSON.stringify(signedIn ? [["auth", "check", "--provider", "anthropic", "--json"]] : []), JSON.stringify(authChecks));
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async takesThePlaceholderPiStartsWithWhenItHasNoModelForNoModel(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_DEFAULT: "unknown" });

    const check = await host.createAdapter().checkSignIn(host.createProvider(null));

    Assert.areEqual(AuthStatus.LoggedOut, check.authStatus);
    Assert.areEqual(Resources.piChooseModel, check.error);
    Assert.isFalse(host.records.some(t => (t["argv"] as string[] | undefined)?.[0] === "auth"));
  }

  @TestMethod
  public async refusesATurnOnAPiOlderThanItNeedsBeforeItStartsIt(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_VERSION: "1.0.9" });

    const result = await host.createAdapter().runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual(Resources.formatPiUnsupported("1.0.9"), result.error);
    Assert.areEqual(0, host.records.length);
  }

  @TestMethod
  public async asksAnUnchangedPiForItsVersionOnceAndAChangedOneAgain(): Promise<void> {
    await using host = new PiTestHost();
    const adapter = host.createAdapter();

    await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);
    await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);
    const unchanged = host.versionReader.reads;
    host.versionReader.stamp = "2";
    await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(JSON.stringify([1, 2]), JSON.stringify([unchanged, host.versionReader.reads]));
  }

  @TestMethod
  public async stopsWhileItReadsPisVersionAndStartsNoPi(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_VERSION: "hang" });
    const controller = new AbortController();

    const running = host.createAdapter().runTurn(host.createRequest("Hi"), new RecordingTurnListener(), controller.signal);
    await Wait.until(() => host.versionReader.reads === 1, "Pi's version was not read.");
    controller.abort();
    const result = await running;

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.areEqual(0, host.records.length);
  }

  @TestMethod
  public async waitsForAPromptByItsOwnTimeRatherThanARequestsSinceAPreRunCompactionCanHoldItsAnswer(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "silent-prompt" });

    const result = await host.createAdapter(host.command, host.timings, undefined, 100).runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual(Resources.formatPiTimedOut("prompt"), result.error);
  }

  @TestMethod
  public async endsAStoppedTurnWithoutWaitingForAPromptPiHasNotAnswered(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "silent-prompt" });
    const controller = new AbortController();

    const running = host.createAdapter().runTurn(host.createRequest("Hi"), new RecordingTurnListener(), controller.signal);
    await Wait.until(() => host.commands("prompt").length === 1, "Pi did not get a prompt command.");
    controller.abort();
    const result = await running;

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.areEqual(1, host.commands("abort").length);
  }

  @TestMethod
  public async sendsNoPromptAfterAStopWhileItsAttachmentsAreRead(): Promise<void> {
    await using host = new PiTestHost();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    const image = host.directory.resolve("shot.png");
    writeFileSync(image, Buffer.from([1, 2, 3]));
    listener.onObservedAsync = (): Promise<void> => {
      const observed = Promise.resolve();
      void observed.then(() => queueMicrotask(() => controller.abort()));
      return observed;
    };

    const result = await host.createAdapter().runTurn(host.createRequest("Hi", null, null, null, null, null, [new MessageAttachment("shot.png", "image/png", 3, image)]),
      listener, controller.signal);

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.areEqual(0, host.commands("prompt").length);
  }

  @TestMethod
  public async runsNoCompactAfterAStopDuringPisStartup(): Promise<void> {
    await using host = new PiTestHost();
    const session = host.directory.resolve("session.jsonl");
    writeFileSync(session, JSON.stringify(["entry-1"]));
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    listener.onObservedAsync = (): Promise<void> => {
      controller.abort();
      return Promise.resolve();
    };

    const result = await host.createAdapter().runTurn(host.createRequest("Compact", null, session, null, null, null, [], true), listener, controller.signal);

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.areEqual(0, host.commands("compact").length);
  }

  @TestMethod
  public async endsInterruptedWithoutAnErrorWhenAStoppedTurnAlsoFails(): Promise<void> {
    await using host = new PiTestHost();
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    listener.onObservedAsync = (): Promise<void> => {
      controller.abort();
      return Promise.reject(new Error("The listener failed."));
    };

    const result = await host.createAdapter().runTurn(host.createRequest("Hi"), listener, controller.signal);

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isNull(result.error);
    Assert.isNull(result.action);
  }

  @TestMethod
  public async stopsARunningCompactWithoutSayingItFailed(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "compact-held" });
    const session = host.directory.resolve("session.jsonl");
    writeFileSync(session, JSON.stringify(["entry-1"]));
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const running = host.createAdapter().runTurn(host.createRequest("Compact", null, session, null, null, null, [], true), listener, controller.signal);
    await Wait.until(() => host.commands("compact").length === 1, "Pi did not get a compact command.");
    controller.abort();
    const result = await running;

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isNull(result.error);
    Assert.areEqual(0, listener.texts.length);
  }

  @TestMethod
  public async endsAStoppedCompactThatPiDoesNotAnswer(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "compact-silent" });
    const session = host.directory.resolve("session.jsonl");
    writeFileSync(session, JSON.stringify(["entry-1"]));
    const controller = new AbortController();

    const running = host.createAdapter().runTurn(host.createRequest("Compact", null, session, null, null, null, [], true), new RecordingTurnListener(), controller.signal);
    await Wait.until(() => host.commands("compact").length === 1, "Pi did not get a compact command.");
    controller.abort();
    const result = await running;

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
  }

  @TestMethod
  public async leavesNoTemporaryFileWhenItCannotReplaceTheExtensionFile(): Promise<void> {
    await using host = new PiTestHost();
    const folder = host.directory.resolve("extension");
    mkdirSync(join(folder, Resources.piExtensionFile, "taken"), { recursive: true });

    const result = await host.createAdapter().runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.areEqual(JSON.stringify([Resources.piExtensionFile]), JSON.stringify(readdirSync(folder)));
  }

  @TestMethod
  public async replacesAStaleExtensionFileWholeAndLeavesACurrentOneAlone(): Promise<void> {
    await using host = new PiTestHost();
    const folder = host.directory.resolve("extension");
    const path = join(folder, Resources.piExtensionFile);
    const old = new Date(1_000_000_000_000);
    mkdirSync(folder, { recursive: true });
    writeFileSync(path, "stale");
    const adapter = host.createAdapter();

    await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);
    const written = readFileSync(path, "utf8");
    utimesSync(path, old, old);
    await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(Resources.piApprovalsExtension, written);
    Assert.areEqual(JSON.stringify([Resources.piExtensionFile]), JSON.stringify(readdirSync(folder)));
    Assert.areEqual(old.getTime(), statSync(path).mtimeMs);
  }

  @TestMethod
  public async doesNotKeepAnEmptyModelList(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_MODELS: "none" });
    const adapter = host.createAdapter();

    const first = await adapter.listModels(null);
    await adapter.listModels(null);

    Assert.isTrue(first.empty);
    Assert.areEqual(2, host.commands("get_available_models").length);
  }

  @TestMethod
  @TestData("1.0.9", true)
  @TestData("0.99.0", true)
  @TestData("1.1.0", false)
  @TestData("2.0.0", false)
  @TestData("dev", false)
  public async refusesAPiOlderThanTheMinimumNamingBothVersions(version: string, refused: boolean): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_VERSION: version });

    const check = await host.createAdapter().checkSignIn(host.createProvider());

    Assert.areEqual(refused ? AuthStatus.Error : AuthStatus.LoggedIn, check.authStatus);
    Assert.areEqual(refused ? Resources.formatPiUnsupported(version) : null, check.error);
  }

  @TestMethod
  public async failsWithoutPiAndFindsItOnceItIsThere(): Promise<void> {
    await using host = new PiTestHost();
    let found = false;
    const adapter = host.createAdapter(null, host.timings, () => found ? host.command : null);

    const missing = await adapter.checkSignIn(host.createProvider());
    const turn = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);
    found = true;
    const present = await adapter.checkSignIn(host.createProvider());

    Assert.areEqual(JSON.stringify([AuthStatus.Error, Resources.piNotFound]), JSON.stringify([missing.authStatus, missing.error]));
    Assert.areEqual(JSON.stringify([TurnOutcome.Failed, Resources.piNotFound]), JSON.stringify([turn.outcome, turn.error]));
    Assert.areEqual(AuthStatus.LoggedIn, present.authStatus);
  }

  @TestMethod
  @TestData("models")
  @TestData("none")
  public async listsPisModelsWithTheirThinkingLevelsAndImagesAndKeepsThemUntilARefresh(defaultModel: string): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_DEFAULT: defaultModel });
    const adapter = host.createAdapter();

    const first = await adapter.listModels(null);
    const kept = await adapter.listModels(null);
    const refreshed = await adapter.listModels(null, true);
    const profiled = await adapter.listModels(host.createProvider());

    Assert.areEqual(JSON.stringify([
      ["anthropic/sonnet-9", "Sonnet 9", "anthropic", Resources.piThinkingLevels, defaultModel === "models", true],
      ["openai/gpt-9", "openai/gpt-9", "openai", null, false, false],
      ["openai/gpt-10", "openai/gpt-10", "openai", ["off", "low", "medium", "high", "xhigh"], false, false]]),
    JSON.stringify(first.models.map(t => [t.id, t.displayName, t.description, t.effortLevels, t.isDefault, t.supportsImages])));
    Assert.areEqual(JSON.stringify(first.models), JSON.stringify(kept.models));
    Assert.areEqual(JSON.stringify([3, "ask", false]), JSON.stringify([host.commands("get_available_models").length, first.defaultMode, first.empty]));
    Assert.areEqual(3, first.modes.length);
    Assert.areEqual(JSON.stringify([3, 3]), JSON.stringify([refreshed.models.length, profiled.models.length]));
    Assert.isTrue(host.records.filter(t => Array.isArray(t["argv"])).every(t => (t["argv"] as string[]).includes("--no-session")));
  }

  @TestMethod
  public async listsModelsAndReadsTheStartingModelWithThePersonsMcpServersSkillsAndContextFilesOff(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "text" });
    const adapter = host.createAdapter();

    await adapter.listModels(null);
    await adapter.checkSignIn(host.createProvider(null));
    await host.programs.endedAt(host.programs.started.length);
    const hidden = host.records.map(t => t["argv"]).filter((t): t is string[] => Array.isArray(t) && t.includes("rpc"));
    const off = ["--no-session", "--no-mcp", "--no-skills", "--no-context-files", "--no-prompt-templates", "--no-themes"];

    Assert.areEqual(JSON.stringify([2, true]), JSON.stringify([hidden.length, hidden.every(t => off.every(u => t.includes(u)))]));
  }

  @TestMethod
  public async runsATurnInTheChatsFolderWithTheModelThinkingRoleAndApprovalsExtensionAndResumesItsSession(): Promise<void> {
    await using host = new PiTestHost();
    const provider = host.createProvider();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const first = await adapter.runTurn(host.createRequest("Hi", provider, null, "anthropic/sonnet-9", "high", null, [], false, "Be brief"), listener,
      new AbortController().signal);
    const resumed = await adapter.runTurn(host.createRequest("Again", provider, first.nativeSessionId, null, null, "allow-all"), listener,
      new AbortController().signal);

    const launches = host.records.filter(t => Array.isArray(t["argv"]));
    const extension = launches[0]!["argv"] as string[];
    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, "entry-1", TurnOutcome.Completed, "entry-2"]), JSON.stringify([first.outcome, first.nativeTurnId,
      resumed.outcome, resumed.nativeTurnId]));
    Assert.areEqual(first.nativeSessionId, resumed.nativeSessionId);
    Assert.areEqual(JSON.stringify([[first.nativeSessionId, false], [first.nativeSessionId, true]]), JSON.stringify(listener.starts.map(t => [t.nativeSessionId,
      t.resumedNativeSession])));
    Assert.areEqual(JSON.stringify(["pi", "anthropic/sonnet-9", "high"]), JSON.stringify([first.observed.kind, first.observed.model, first.observed.effort]));
    Assert.areEqual(Resources.piApprovalsExtension, readFileSync(extension[extension.indexOf("--extension") + 1]!, "utf8"));
    Assert.areEqual(JSON.stringify([[realpathSync(host.directory.path), provider.profileDir, "ask", "from the request", false],
      [realpathSync(host.directory.path), provider.profileDir, "allow-all", "from the request", true]]),
    JSON.stringify(launches.map(t => [realpathSync(String(t["cwd"])), t["agentDir"], t["mode"], t["extra"], (t["argv"] as string[]).includes("--session")])));
    Assert.areEqual(JSON.stringify([{ provider: "anthropic", modelId: "sonnet-9" }]), JSON.stringify(host.commands("set_model").map(t => ({ provider: t["provider"],
      modelId: t["modelId"] }))));
    Assert.areEqual(JSON.stringify([Resources.formatRolePrompt("Be brief", "Hi"), Resources.formatRolePrompt(null, "Again")]),
      JSON.stringify(host.commands("prompt").map(t => t["message"])));
    Assert.areEqual(2, listener.texts.filter(t => t === "Hello there").length);
    Assert.areEqual(2, listener.texts.filter(t => t === "Thinking").length);
    Assert.areEqual(JSON.stringify([100, 20, 0.3, 30, 5, 60000, 200000]), JSON.stringify([listener.usages[0]!.inputTokens, listener.usages[0]!.outputTokens,
      listener.usages[0]!.costUsd, listener.usages[0]!.cacheReadTokens, listener.usages[0]!.cacheWriteTokens, listener.usages[0]!.context?.usedTokens,
      listener.usages[0]!.context?.windowTokens]));
    Assert.areEqual(0, listener.taskStarts.length);
  }

  @TestMethod
  @TestData("text", "anthropic/sonnet-9", "Hello there")
  @TestData("error", "anthropic/sonnet-9", null)
  @TestData("text", "from-an-extension/model-1", null)
  public async asksForAChatTitleInAPiWithNoSessionToolsOrExtensionsButBuiltInProvidersThatItClosesOnceItAnswers(scenario: string, model: string,
    title: string | null): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: scenario });
    const provider = host.createProvider();
    const adapter = host.createAdapter();
    const request = new TurnRequest(provider, host.directory.path, "Name this chat", new RequestedSettings("pi", model, null, null, null), null, [],
      null, null, {}, false, null, [], null, undefined, SharedMcpValues.none, null, true);

    const answer = await TitleTurn.ask(adapter, request, new AbortController().signal);
    await host.programs.endedAt(host.programs.started.length);

    const launches = host.records.map(t => t["argv"]).filter((t): t is string[] => Array.isArray(t));
    const off = ["--no-session", "--no-tools", "--no-extensions", "--no-mcp", "--no-skills", "--no-context-files", "--no-prompt-templates", "--no-themes"];
    const extensions = (launches.at(0) ?? []).flatMap((t, i, all) => t === "--extension" ? [all[i + 1]] : []);
    Assert.areEqual(title, answer);
    Assert.areEqual(JSON.stringify([1, true, ["builtin:llama.cpp"]]), JSON.stringify([launches.length, off.every(t => launches.at(0)?.includes(t) === true),
      extensions]));
    Assert.areEqual(JSON.stringify(model.startsWith("anthropic/") ? [Resources.formatRolePrompt(null, "Name this chat")] : []),
      JSON.stringify(host.commands("prompt").map(t => t["message"])));
    Assert.areEqual(JSON.stringify([1, 1, 0]), JSON.stringify([host.programs.started.length, host.programs.ended.length, host.idleTimer.pending]));
    Assert.areEqual(0, readdirSync(host.directory.path).filter(t => t.startsWith("session-")).length);
  }

  @TestMethod
  public async keepsPiForTheIdleLimitForTheChatsNextTurnAndResumesTheSessionInANewPiOnceItCloses(): Promise<void> {
    await using host = new PiTestHost();
    const provider = host.createProvider();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const turn = (resume: string | null): Promise<TurnResult> => adapter.runTurn(host.createRequest("Hi", provider, resume), listener, new AbortController().signal);

    const first = await turn(null);
    host.idleTimer.advance(host.timings.idleLimit - 1);
    const kept = await turn(first.nativeSessionId);
    const before = [host.programs.started.length, host.programs.ended.length, host.idleTimer.pending];
    host.idleTimer.advance(host.timings.idleLimit);
    await host.programs.endedAt(1);
    const reopened = await turn(first.nativeSessionId);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed, first.nativeSessionId]), JSON.stringify([kept.outcome, reopened.outcome,
      reopened.nativeSessionId]));
    Assert.areEqual(JSON.stringify([1, 0, 1]), JSON.stringify(before));
    Assert.areEqual(JSON.stringify([false, true]), JSON.stringify(host.records.filter(t => Array.isArray(t["argv"])).map(t => (t["argv"] as string[])
      .includes("--session"))));
    Assert.areEqual(3, host.commands("prompt").length);
  }

  @TestMethod
  @TestData(true, 1)
  @TestData(false, 2)
  public async keepsPiForATurnWithANewSenderTokenWhenTheTurnAdoptsTheKeptPisToken(adopts: boolean, started: number): Promise<void> {
    await using host = new PiTestHost();
    const adapter = host.createAdapter();
    const adopted: string[] = [];
    const turn = (token: string, resume: string | null): Promise<TurnResult> => adapter.runTurn(new TurnRequest(null, host.directory.path, "Hi",
      new RequestedSettings("pi", null, null), resume, [], null, null, { [ProtocolResources.senderTokenVariable]: token }, false, null, [], null, t => {
        adopted.push(t);
        return adopts;
      }), new RecordingTurnListener(), new AbortController().signal);

    const first = await turn("sender-1", null);
    const second = await turn("sender-2", first.nativeSessionId);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, first.nativeSessionId, started, ["sender-1"]]),
      JSON.stringify([second.outcome, second.nativeSessionId, host.programs.started.length, adopted]));
  }

  @TestMethod
  public async givesAPiTeamRunsToolsThroughTheExtensionWithAKeptTokenTheNextTurnAdoptsAndRevokesItOnceThatPiCloses(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_PI_TOOLS_URL: "http://127.0.0.1:4712/mcp", TEAMRUN_PI_TOOLS_TOKEN: "outer-token" });
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [],
      new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
    const turn = (resume: string | null, served: TurnTools | null): Promise<TurnResult> => adapter.runTurn(new TurnRequest(null, host.directory.path, "Hi",
      new RequestedSettings("pi", null, null), resume, [], null, null, {}, false, served), new RecordingTurnListener(), new AbortController().signal);

    const first = await turn(null, tools);
    const kept = await turn(first.nativeSessionId, tools);
    const launched = host.records.filter(t => Array.isArray(t["argv"]));
    const token = String(launched[0]?.["toolsToken"]);
    const session = tokens.find(token);
    const plain = await turn(first.nativeSessionId, null);
    const launches = host.records.filter(t => Array.isArray(t["argv"]));

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed, TurnOutcome.Completed]), JSON.stringify([first, kept, plain].map(t => t.outcome)));
    Assert.areEqual(JSON.stringify([1, "http://127.0.0.1:4711/mcp", "session-1"]), JSON.stringify([launched.length, launched[0]?.["toolsUrl"], session]));
    Assert.areEqual(JSON.stringify([2, "", "", null]), JSON.stringify([launches.length, launches[1]?.["toolsUrl"], launches[1]?.["toolsToken"], tokens.find(token)]));
  }

  @TestMethod
  public async startsAnotherPiForTheChatsNextTurnWhenTheServedToolsChangedSinceTheKeptPiListedThem(): Promise<void> {
    await using host = new PiTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const served = ["terminal_run"];
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve(served.map(t => ({ name: t }))), callToolAsync: () => Promise.resolve({}) }, [],
      new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
    const turn = (resume: string | null): Promise<TurnResult> => adapter.runTurn(new TurnRequest(null, host.directory.path, "Hi",
      new RequestedSettings("pi", null, null), resume, [], null, null, {}, false, tools), new RecordingTurnListener(), new AbortController().signal);
    const launches = (): number => host.records.filter(t => Array.isArray(t["argv"])).length;

    const first = await turn(null);
    await turn(first.nativeSessionId);
    const kept = launches();
    served.push("computer_click");
    const changed = await turn(first.nativeSessionId);

    Assert.areEqual(TurnOutcome.Completed, changed.outcome);
    Assert.areEqual(JSON.stringify([1, 2]), JSON.stringify([kept, launches()]));
  }

  @TestMethod
  public async notesInEachCompletedTurnOfAPiThatNeverListedTeamRunsToolsThatTheyArentInTheChatAndNotOnceItListedThem(): Promise<void> {
    await using host = new PiTestHost();
    const adapter = host.createAdapter();
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const provider = new Provider("work", "pi", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "2026-11-09T00:00:00.000Z");
    const tools = (listed: boolean): TurnTools => {
      const served = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [],
        new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
      if (listed)
        served.markListed();
      return served;
    };
    const turn = async (owner: Provider | null, resume: string | null, served: TurnTools | null): Promise<readonly [TurnResult, readonly unknown[]]> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(new TurnRequest(owner, host.directory.path, "Hi", new RequestedSettings("pi", null, null), resume, [], null, null, {},
        false, served), listener, new AbortController().signal);
      return [result, listener.sharedFailures.map(t => [t.providerId, t.providerLabel, t.server, t.kind, t.reason])];
    };

    const [first, unlisted] = await turn(provider, null, tools(false));
    const [, stillUnlisted] = await turn(provider, first.nativeSessionId, tools(false));
    const [listedFirst, listed] = await turn(null, null, tools(true));
    const [, keptListed] = await turn(null, listedFirst.nativeSessionId, tools(false));
    const [, another] = await turn(null, null, tools(false));
    const [, plain] = await turn(null, null, null);

    const note = (id: string, label: string): readonly unknown[] => [id, label, "teamrun", SharedMcpFailureKind.Unlisted, Resources.piTeamRunToolsUnlisted];
    Assert.areEqual(JSON.stringify([[note("work", "Work")], [note("work", "Work")], [], [], [note("pi", "Pi")], []]),
      JSON.stringify([unlisted, stillUnlisted, listed, keptListed, another, plain]));
    Assert.areEqual(3, host.records.filter(t => Array.isArray(t["argv"]) && t["toolsUrl"] !== String.empty).length);
  }

  @TestMethod
  @TestData("error", false)
  @TestData("hold", true)
  public async notesNothingForATurnThatFailsOrIsStoppedWhileItsPiNeverListedTeamRunsTools(scenario: string, stops: boolean): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: scenario });
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [],
      new McpEndpoint("http://127.0.0.1:4711/mcp", tokens, "session-1"));
    const listener = new RecordingTurnListener();
    const controller = new AbortController();

    const running = host.createAdapter().runTurn(new TurnRequest(null, host.directory.path, "Hi", new RequestedSettings("pi", null, null), null, [], null, null, {},
      false, tools), listener, controller.signal);
    if (stops) {
      await Wait.until(() => host.commands("prompt").length === 1, "Pi did not get a prompt command.");
      controller.abort();
    }
    const result = await running;

    Assert.areEqual(JSON.stringify([stops ? TurnOutcome.Interrupted : TurnOutcome.Failed, 0]), JSON.stringify([result.outcome, listener.sharedFailures.length]));
    Assert.isFalse(tools.isListed);
  }

  @TestMethod
  public async givesAPiTeamRunsSharedServersThroughTheExtensionReadingTheirValuesFromItsEnvironmentAndStartsAnotherPiWhenTheyChange(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_PI_SHARED_SERVERS: "{\"outer\":{\"command\":\"node\"}}" });
    const adapter = host.createAdapter();
    const turn = (resume: string | null, servers: readonly SharedMcpServerDefinition[]): Promise<TurnResult> => adapter.runTurn(new TurnRequest(null,
      host.directory.path, "Hi", new RequestedSettings("pi", null, null), resume, [], null, null, {}, false, null, servers), new RecordingTurnListener(),
      new AbortController().signal);

    const servers = [PiAdapterTests.search, PiAdapterTests.docs, PiAdapterTests.wiki];
    const first = await turn(null, servers);
    const kept = await turn(first.nativeSessionId, servers);
    const plain = await turn(first.nativeSessionId, []);
    const launches = host.records.filter(t => Array.isArray(t["argv"]));
    const launch = new SharedMcpLaunch();

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed, TurnOutcome.Completed, 2]),
      JSON.stringify([...[first, kept, plain].map(t => t.outcome), launches.length]));
    Assert.areEqual(JSON.stringify({
      search: { command: launch.program, args: [launch.script, "--variables", "SEARCH_KEY", "--", "npx", "-y", "search-server"], env: { ELECTRON_RUN_AS_NODE: "1" },
        exposure: "direct" },
      docs: { url: "https://docs.example/mcp", headers: { "X-Team": "${DOCS_TEAM}", Authorization: "Bearer ${DOCS_TOKEN}" }, exposure: "direct" },
      wiki: { url: "https://wiki.example/mcp", headers: {}, exposure: "direct" }
    }), String(launches[0]?.["sharedServers"]));
    Assert.areEqual(String.empty, launches[1]?.["sharedServers"]);
  }

  @TestMethod
  @TestData("teamrun_list_chats", 0, true)
  @TestData("teamrun_send_message", 1, false)
  public async answersItsExtensionsConfirmForAnApprovedTeamRunToolWithoutAskingAndAsksForAnyOther(approved: string, asks: number, confirmed: boolean)
    : Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "approved-tool" });
    const listener = new RecordingTurnListener();
    listener.defaultDecision = "no";
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [approved],
      new McpEndpoint("http://127.0.0.1:4711/mcp", new SessionTokens(), "session-1"));

    const result = await host.createAdapter().runTurn(new TurnRequest(null, host.directory.path, "Hi", new RequestedSettings("pi", null, null), null, [], null,
      null, {}, false, tools), listener, new AbortController().signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, asks, confirmed]),
      JSON.stringify([result.outcome, listener.asks.length, host.commands("extension_ui_response")[0]?.["confirmed"]]));
  }

  @TestMethod
  public async revokesTheToolsTokenOfATurnWhosePiCannotStart(): Promise<void> {
    await using host = new PiTestHost();
    const tokens = new SessionTokens();
    tokens.open("session-1", "c1/t1");
    const issued: string[] = [];
    const endpoint = new class extends McpEndpoint {
      public override issueKept(): string {
        const token = super.issueKept();
        issued.push(token);
        return token;
      }
    }("http://127.0.0.1:4711/mcp", tokens, "session-1");
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [], endpoint);

    const result = await host.createAdapter(null, host.timings, () => null).runTurn(new TurnRequest(null, host.directory.path, "Hi",
      new RequestedSettings("pi", null, null), null, [], null, null, {}, false, tools), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Failed, Resources.piNotFound, 1, null]),
      JSON.stringify([result.outcome, result.error, issued.length, tokens.find(issued[0] ?? String.empty)]));
  }

  @TestMethod
  public async failsATurnWhoseToolsTeamRunDoesNotServe(): Promise<void> {
    await using host = new PiTestHost();
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, []);

    const result = await host.createAdapter().runTurn(new TurnRequest(null, host.directory.path, "Hi", new RequestedSettings("pi", null, null), null, [], null, null, {},
      false, tools), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Failed, Resources.formatToolsNotServed("Pi")]), JSON.stringify([result.outcome, result.error]));
  }

  @TestMethod
  @TestData("http://127.0.0.1:4711/mcp", "{\"search\":{\"command\":\"node\"}}")
  @TestData("", "")
  public async registersTeamRunsServerAndItsSharedServersFromItsExtensionOnlyWhenTheTurnHasThem(url: string, shared: string): Promise<void> {
    const registered: unknown[] = [];

    await PiAdapterTests.loadExtensionAsync({ TEAMRUN_PI_TOOLS_URL: url, TEAMRUN_PI_TOOLS_TOKEN: "token-1", TEAMRUN_PI_SHARED_SERVERS: shared },
      { on: () => undefined, registerMcpServer: (name: string, config: unknown) => registered.push([name, config]) });

    Assert.areEqual(JSON.stringify(url.length > 0
      ? [["teamrun", { url, exposure: "direct", headers: { authorization: "Bearer token-1" } }], ["search", { command: "node" }]]
      : []), JSON.stringify(registered));
  }

  @TestMethod
  public async keepsItsToolCallGateAndTheOtherServersWhenPiRefusesARegistration(): Promise<void> {
    const events: string[] = [];
    const tried: string[] = [];

    await PiAdapterTests.loadExtensionAsync({ TEAMRUN_PI_TOOLS_URL: "http://127.0.0.1:4711/mcp", TEAMRUN_PI_TOOLS_TOKEN: "token-1",
      TEAMRUN_PI_SHARED_SERVERS: "{\"my-api\":{\"command\":\"node\"},\"my_api\":{\"command\":\"node\"},\"docs\":{\"url\":\"https://docs.example.com/mcp\"}}" },
    { on: (event: string) => events.push(event), registerMcpServer: (name: string) => {
      tried.push(name);
      if (name !== "docs")
        throw new Error(`MCP server "${name}" is already registered.`);
    } });

    Assert.areEqual(JSON.stringify([["tool_call"], ["teamrun", "my-api", "my_api", "docs"]]), JSON.stringify([events, tried]));
  }

  private static async loadExtensionAsync(environment: Readonly<Record<string, string>>, pi: object): Promise<void> {
    const names = Object.keys(environment);
    const saved = names.map(t => process.env[t]);
    Object.assign(process.env, environment);
    try {
      const extension: { readonly default?: unknown } = await import(`data:text/javascript,${encodeURIComponent(Resources.piApprovalsExtension)}`);
      if (typeof extension.default !== "function")
        throw new Error("The extension exports no function.");
      extension.default(pi);
    }
    finally {
      names.forEach((name, index) => {
        const value = saved[index];
        if (Object.isUndefined(value))
          Reflect.deleteProperty(process.env, name);
        else
          process.env[name] = value;
      });
    }
  }

  @TestMethod
  public async keepsEachSessionsPiApartIncludingACompactedOneAndClosesThemAllOnShutdown(): Promise<void> {
    await using host = new PiTestHost();
    const adapter = host.createAdapter();
    const kept = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);
    const other = host.directory.resolve("other.jsonl");
    writeFileSync(other, JSON.stringify(["entry-1"]));
    const compacted = await adapter.runTurn(host.createRequest("Compact", null, other, null, null, null, [], true), new RecordingTurnListener(),
      new AbortController().signal);
    const before = [host.programs.started.length, host.programs.ended.length, host.idleTimer.pending];

    await adapter.shutdown();

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, TurnOutcome.Completed]), JSON.stringify([kept.outcome, compacted.outcome]));
    Assert.areEqual(JSON.stringify([2, 0, 2]), JSON.stringify(before));
    Assert.areEqual(JSON.stringify([2, 0]), JSON.stringify([host.programs.ended.length, host.idleTimer.pending]));
  }

  @TestMethod
  public async sendsTheTurnsImagesAsPiImagesAndLeavesOtherAttachmentsOut(): Promise<void> {
    await using host = new PiTestHost();
    const image = host.directory.resolve("shot.png");
    writeFileSync(image, Buffer.from([1, 2, 3]));
    const listener = new RecordingTurnListener();

    await host.createAdapter().runTurn(host.createRequest("Look", null, null, null, null, null, [new MessageAttachment("shot.png", "image/png", 3, image),
      new MessageAttachment("notes.txt", "text/plain", 3, image)]), listener, new AbortController().signal);

    Assert.areEqual(JSON.stringify([[{ type: "image", mimeType: "image/png", data: "AQID" }]]), JSON.stringify(host.commands("prompt").map(t => t["images"])));
    Assert.isTrue(listener.texts.includes("Hello with 1 image"));
  }

  @TestMethod
  @TestData("allow", "removed", false)
  @TestData("deny", "The person refused this tool in TeamRun.", true)
  public async asksBeforeAToolThroughTheApprovalsExtensionAndRunsOrRefusesIt(decision: string, output: string, isError: boolean): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "approval" });
    const listener = new RecordingTurnListener();
    listener.decisions.push(decision);

    const result = await host.createAdapter().runTurn(host.createRequest("Clean"), listener, new AbortController().signal);

    const ended = listener.details.filter(t => t.providerItemId === "call-1").at(-1)!.payload as Record<string, unknown>;
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify(["bash: rm -rf build"]), JSON.stringify(listener.asks.map(t => t.summary)));
    Assert.areEqual(JSON.stringify([output, isError]), JSON.stringify([ended["output"], ended["isError"]]));
    Assert.areEqual(JSON.stringify([decision === "allow"]), JSON.stringify(host.commands("extension_ui_response").map(t => t["confirmed"])));
  }

  @TestMethod
  public async asksAnExtensionsDialogsThroughTheQuestionCardAndSendsPiTheAnswers(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "dialogs" });
    const listener = new RecordingTurnListener();
    listener.answers.push([new QuestionAnswer("d-1", ["production"], null)], [new QuestionAnswer("d-2", [Resources.yesLabel], null)],
      [new QuestionAnswer("d-3", [], "Atlas")], null);

    const result = await host.createAdapter().runTurn(host.createRequest("Deploy"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(JSON.stringify([["select", "", "Which target?"], ["confirm", "Deploy now?", "It restarts the server."], ["input", "", "Release name?"],
      ["editor", "", "Release notes"]]), JSON.stringify(listener.questionAsks.map(t => [t.nativeKind, t.questions[0]?.header, t.questions[0]?.text])));
    Assert.areEqual(JSON.stringify([{ value: "production" }, { confirmed: true }, { value: "Atlas" }, { cancelled: true }].map((t, index) => ({
      type: "extension_ui_response", id: `d-${String(index + 1)}`, ...t }))), JSON.stringify(host.commands("extension_ui_response")));
  }

  @TestMethod
  @TestData("unknown-model", "Failed")
  @TestData("error", "Failed")
  @TestData("exit", "Failed")
  @TestData("refuse-prompt", "Failed")
  @TestData("handled", "Completed")
  @TestData("no-stats", "Completed")
  @TestData("no-context", "Completed")
  @TestData("no-entries", "Completed")
  public async endsTheTurnWithWhatPiReports(scenario: string, outcome: string): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: scenario, TEAMRUN_FAKE_PI_DEFAULT: scenario === "handled" ? "none" : "models" });
    const listener = new RecordingTurnListener();

    const result = await host.createAdapter().runTurn(host.createRequest("Hi", null, null, scenario === "unknown-model" ? "anthropic/none" : null), listener,
      new AbortController().signal);
    const exited = result.error?.startsWith("Pi exited (code 3") === true && result.error.endsWith("Pi crashed");

    const errors: Readonly<Record<string, string>> = {
      "unknown-model": Resources.formatModelUnavailable("Pi", "anthropic/none (Pi refused set_model: Model not found: anthropic/none.)"),
      "error": "The provider failed.",
      "refuse-prompt": "Pi refused prompt: Agent is busy."
    };
    Assert.areEqual(outcome, result.outcome);
    Assert.areEqual(scenario === "exit" ? "exited" : errors[scenario] ?? null, exited ? "exited" : result.error);
    Assert.areEqual(scenario === "unknown-model" ? ReplyAction.ChooseModel : null, result.action);
    Assert.areEqual(["no-entries", "handled"].includes(scenario) || outcome === "Failed" && scenario !== "error" ? null : "entry-1", result.nativeTurnId);
    Assert.areEqual(["no-stats", "no-context"].includes(scenario) ? 1 : 0, listener.usages.filter(t => Object.isNull(t.context)).length);
  }

  @TestMethod
  @TestData("hold")
  @TestData("deaf")
  @TestData("approval-held")
  public async abortsTheRunningTurnAndRefusesItsOpenApprovals(scenario: string): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: scenario });
    const listener = new RecordingTurnListener();
    listener.heldDecision = new Promise<string>(() => undefined);
    const controller = new AbortController();

    const running = host.createAdapter(host.command, new ProviderTimings(5000, 5000, 5000, 5000, 100, 300, 500, 500, 200, 1, 20))
      .runTurn(host.createRequest("Hi"), listener, controller.signal);
    await Wait.until(() => host.commands("prompt").length === 1, "Pi did not get a prompt command.");
    await Wait.until(() => scenario !== "approval-held" || listener.asks.length === 1, "The listener did not see a question.");
    controller.abort();
    const result = await running;

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isNull(result.error);
    Assert.areEqual(1, host.commands("abort").length);
    Assert.areEqual(scenario === "approval-held", listener.signals.some(t => t?.aborted === true));
  }

  @TestMethod
  public async interruptsATurnAbortedBeforeItsPrompt(): Promise<void> {
    await using host = new PiTestHost();
    const controller = new AbortController();
    controller.abort();

    const result = await host.createAdapter().runTurn(host.createRequest("Hi"), new RecordingTurnListener(), controller.signal);
    const missing = await host.createAdapter(null).runTurn(host.createRequest("Hi"), new RecordingTurnListener(), controller.signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Interrupted, TurnOutcome.Interrupted, null]), JSON.stringify([result.outcome, missing.outcome, missing.error]));
    Assert.areEqual(0, host.commands("prompt").length);
  }

  @TestMethod
  @TestData("start", "Completed")
  @TestData("text", "Completed")
  @TestData("compact-fails", "Failed")
  public async compactsAResumedSessionAndHasNothingToCompactWithoutOne(scenario: string, outcome: string): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: scenario });
    const session = host.directory.resolve("session.jsonl");
    writeFileSync(session, JSON.stringify(["entry-1"]));
    const listener = new RecordingTurnListener();

    const result = await host.createAdapter().runTurn(host.createRequest("Compact", null, scenario === "start" ? null : session, null, null, null, [], true), listener,
      new AbortController().signal);

    Assert.areEqual(outcome, result.outcome);
    Assert.areEqual(JSON.stringify(scenario === "start" ? [CoreResources.nothingToCompact] : scenario === "text" ? [Resources.piCompacted] : []), JSON.stringify(listener.texts));
    Assert.areEqual(scenario === "compact-fails" ? "Pi refused compact: Nothing to compact." : null, result.error);
    Assert.areEqual(scenario === "start" ? 0 : 1, host.commands("compact").length);
    Assert.areEqual(0, host.commands("prompt").length);
  }

  @TestMethod
  @TestData("entry-1", "fork", "[\"entry-1\"]")
  @TestData("entry-2", "clone", "[\"entry-1\",\"entry-2\"]")
  public async forksAfterATurnAtTheNextUserMessageOrClonesAfterTheLast(lastTurnId: string, command: string, entries: string): Promise<void> {
    await using host = new PiTestHost();
    const session = host.directory.resolve("session.jsonl");
    writeFileSync(session, JSON.stringify(["entry-1", "entry-2"]));
    const provider = command === "fork" ? host.createProvider() : null;

    const forked = await host.createAdapter().forkSession(new ForkRequest(provider, host.directory.path, session, lastTurnId, new RequestedSettings("pi", null, null)));

    Assert.areEqual(JSON.stringify(["pi", command === "fork" ? "pi-1" : null]), JSON.stringify([forked.kind, forked.providerId]));
    Assert.areNotEqual(session, forked.nativeSessionId);
    Assert.areEqual(entries, readFileSync(forked.nativeSessionId, "utf8"));
    Assert.areEqual(1, host.commands(command).length);
    Assert.areEqual(command === "fork" ? "entry-2" : undefined, host.commands(command)[0]!["entryId"]);
    Assert.areEqual(JSON.stringify([["--no-mcp", "--no-skills", "--no-context-files", "--no-prompt-templates", "--no-themes", "--session", session]]),
      JSON.stringify(host.records.map(t => t["argv"]).filter((t): t is string[] => Array.isArray(t)).map(t => t.slice(2))));
  }

  @TestMethod
  @TestData("missing", "text")
  @TestData("entry-1", "fork-cancelled")
  public async refusesAForkAfterAMessageItDoesNotHaveOrThatAnExtensionCancels(lastTurnId: string, scenario: string): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: scenario });
    const session = host.directory.resolve("session.jsonl");
    writeFileSync(session, JSON.stringify(["entry-1", "entry-2"]));

    const failure = await Assert.throwsAsync(() => host.createAdapter().forkSession(new ForkRequest(null, host.directory.path, session, lastTurnId,
      new RequestedSettings("pi", null, null))), Error);

    Assert.areEqual(scenario === "fork-cancelled" ? Resources.piForkCancelled : Resources.formatPiTurnNotFound("missing"), failure.message);
  }

  @TestMethod
  public async steersTheRunningTurnWithItsImagesAndRefusesASteerOnceTheTurnEnded(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "hold" });
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);
    const image = host.directory.resolve("image.png");
    writeFileSync(image, "png");

    const running = adapter.runTurn(host.createRequest("Hi"), listener, new AbortController().signal);
    await Wait.untilOrSettled(() => offers.length === 1, running);
    const offered = offers[0];
    const taken = await offered?.(new TurnSteer("Look again", [new MessageAttachment("image.png", "image/png", 3, image),
      new MessageAttachment("notes.txt", "text/plain", 1, host.directory.resolve("notes.txt"))]));
    const result = await running;
    const late = await offered?.(new TurnSteer("Too late", []));

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("true|false", [taken, late].join("|"));
    Assert.areEqual("function|null", offers.map(t => Object.isNull(t) ? "null" : typeof t).join("|"));
    Assert.areEqual(JSON.stringify(["Look again", [{ type: "image", mimeType: "image/png", data: Buffer.from("png").toString("base64") }]]),
      JSON.stringify(host.commands("steer").map(t => [t["message"], t["images"]])[0]));
    Assert.isTrue(listener.texts.join("").includes("Hello with 1 image"), listener.texts.join("|"));
  }

  @TestMethod
  public async forgetsAKeptPiWhoseCloseFailsOnceItsIdleLimitPassesAndResumesTheSessionInANewPi(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_STAY: "1" });
    const terminator = new ControlledProcessTerminator(process.platform);
    terminator.failures = 1;
    const adapter = host.createAdapter(undefined, undefined, undefined, undefined, new NodeProcessStarter(terminator));
    const stayed: number[] = [];
    try {
      const first = await adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);
      const kept = host.programs.started.length;
      stayed.push(...host.programs.started.map(t => t.processId));
      host.idleTimer.advance(host.timings.idleLimit - 1);
      const early = terminator.calls;
      host.idleTimer.advance(1);
      await terminator.called;
      const next = await adapter.runTurn(host.createRequest("Again", null, first.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);

      Assert.areEqual([TurnOutcome.Completed, first.nativeSessionId, 0, 1, kept + 1].join("|"),
        [next.outcome, next.nativeSessionId, early, terminator.calls, host.programs.started.length].join("|"));
    }
    finally {
      await adapter.shutdown();
      for (const processId of stayed.filter(t => !host.programs.ended.includes(t))) {
        process.kill(processId);
        await host.programs.endOf(processId);
      }
    }
  }

  @TestMethod
  public async closesADeletedChatsKeptPiNowAndItsRunningPiOnceItsTurnEnds(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "hold" });
    const adapter = host.createAdapter();
    const turn = async (): Promise<{ readonly listener: RecordingTurnListener; readonly finish: () => Promise<TurnResult> }> => {
      const listener = new RecordingTurnListener();
      const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
      listener.onSteerable = t => offers.push(t);
      const running = adapter.runTurn(host.createRequest("Hi"), listener, new AbortController().signal);
      await Wait.untilOrSettled(() => offers.length === 1, running);
      return { listener, finish: async () => {
        await offers[0]?.(new TurnSteer("Done", []));
        return running;
      } };
    };

    const kept = await turn();
    await kept.finish();
    const other = await turn();
    await other.finish();
    const running = await turn();
    await adapter.closeSessions([String(kept.listener.starts[0]?.nativeSessionId), String(running.listener.starts[0]?.nativeSessionId), "missing"]);
    await host.programs.endedAt(1);
    const first = [...host.programs.ended];
    const result = await running.finish();
    await host.programs.endedAt(2);

    const [keptPi, , runningPi] = host.programs.started.map(t => t.processId);
    Assert.areEqual(JSON.stringify([[keptPi], [keptPi, runningPi], TurnOutcome.Completed]), JSON.stringify([first, host.programs.ended, result.outcome]));
  }

  @TestMethod
  public async answersFalseToASteerPiRefusesWhileTheTurnRuns(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "hold" });
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);

    const running = adapter.runTurn(host.createRequest("Hi"), listener, new AbortController().signal);
    await Wait.untilOrSettled(() => offers.length === 1, running);
    const offered = offers[0];
    const answers = await Promise.all([offered?.(new TurnSteer("Look again", [])), offered?.(new TurnSteer("And again", []))]);
    const result = await running;

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("true|false", answers.join("|"));
    Assert.areEqual(2, host.commands("steer").length);
  }

  @TestMethod
  public async stopsTheRunningPiOnShutdown(): Promise<void> {
    await using host = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "hold" });
    const adapter = host.createAdapter();

    const running = adapter.runTurn(host.createRequest("Hi"), new RecordingTurnListener(), new AbortController().signal);
    await Wait.until(() => host.commands("prompt").length === 1, "Pi did not get a prompt command.");
    await adapter.shutdown();
    const result = await running;

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.isTrue(result.error?.startsWith("Pi exited (code 0") === true);
  }

  @TestMethod
  @TestData("/skill:review src")
  @TestData("/fix-tests")
  @TestData("/bookmark")
  public async sendsACommandPiListsAsItsTextAloneWithoutTheRole(command: string): Promise<void> {
    await using host = new PiTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(PiAdapterTests.commandRequest(host, command), listener, new AbortController().signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, 1, [command]]), JSON.stringify([turn.outcome, host.commands("get_commands").length,
      host.commands("prompt").map(t => t["message"])]));
    Assert.isFalse(listener.details.some(t => t.kind === DetailKind.Note), JSON.stringify(listener.details));
  }

  @TestMethod
  @TestData("/tmp is full, clean it up", null, "", 0)
  @TestData("/deploy now", "session.jsonl", "", 0)
  @TestData("/skill:review", null, "none", 0)
  @TestData("/fix-tests", null, "", 1)
  public async sendsACommandPiDoesntListOrOneWithFilesInsideItsPromptAsAnyMessage(command: string, resume: string | null, listed: string, files: number): Promise<void> {
    await using host = new PiTestHost(listed.length === 0 ? {} : { TEAMRUN_FAKE_PI_COMMANDS: listed });
    const listener = new RecordingTurnListener();
    const attachments = Array.from({ length: files }, () => new MessageAttachment("notes.txt", "text/plain", 3, join(host.directory.path, "notes.txt")));

    const turn = await host.createAdapter().runTurn(PiAdapterTests.commandRequest(host, command, resume, attachments), listener, new AbortController().signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, 1 - files, [Resources.formatRolePrompt(null, command)]]), JSON.stringify([turn.outcome,
      host.commands("get_commands").length, host.commands("prompt").map(t => t["message"])]));
    Assert.isFalse(listener.details.some(t => t.kind === DetailKind.Note), JSON.stringify(listener.details));
  }

  @TestMethod
  public async sendsTheWholeChatOnceOnTheTurnAfterACommandOpenedTheSession(): Promise<void> {
    await using host = new PiTestHost();
    const adapter = host.createAdapter();
    const turn = (resume: string | null, command: string | null): Promise<TurnResult> => adapter.runTurn(new TurnRequest(null, host.directory.path, "Again",
      new RequestedSettings("pi", null, null, null, null), resume, [], "Be brief", "The whole chat", {}, false, null, [], null, () => false, SharedMcpValues.none, null, false,
      command), new RecordingTurnListener(), new AbortController().signal);

    const first = await turn(null, "/fix-tests");
    await turn(first.nativeSessionId, null);
    await turn(first.nativeSessionId, "/fix-tests");
    await turn(first.nativeSessionId, null);

    Assert.areEqual(JSON.stringify(["/fix-tests", Resources.formatRolePrompt("Be brief", "The whole chat"), "/fix-tests", Resources.formatRolePrompt("Be brief", "Again")]),
      JSON.stringify(host.commands("prompt").map(t => t["message"])));
  }

  @TestMethod
  public async answersABuiltInCommandWithWhyItCantRunItBeforeStartingPi(): Promise<void> {
    await using host = new PiTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(PiAdapterTests.commandRequest(host, "/settings", "session.jsonl"), listener, new AbortController().signal);

    Assert.areEqual(JSON.stringify([TurnOutcome.Completed, "session.jsonl", 0, 0]),
      JSON.stringify([turn.outcome, turn.nativeSessionId, host.programs.started.length, listener.starts.length]));
    Assert.areEqual(JSON.stringify([[DetailKind.Note, `Pi can't run /settings: ${Resources.piBuiltInCommandsAbility}.`]]),
      JSON.stringify(listener.details.map(t => [t.kind, t.text])));
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new PiTestHost();
    await using approval = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "approval" });
    await using dialogs = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "dialogs" });
    await using hold = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "hold" });
    await using approvedTool = new PiTestHost({ TEAMRUN_FAKE_PI_TURN: "approved-tool" });
    const provider = host.createProvider();
    const adapter = host.createAdapter();
    const scenarios = new Map([["approval", approval.createAdapter()], ["dialogs", dialogs.createAdapter()], ["hold", hold.createAdapter()],
      ["approved-tool", approvedTool.createAdapter()]]);
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => host.createRequest(prompt, provider, resume, null, null, null, attachments),
      host.directory.path, prompt => scenarios.get(prompt) ?? adapter);

    await AbilityChecks.runAsync(adapter.descriptor, {
      ...AbilityChecks.surface(adapter, provider, () => adapter.listModels(provider)),
      ...turns.probes({ [ProviderAbility.Questions]: "dialogs", [ProviderAbility.PlanChecklist]: TurnAbilityProbes.plain, [ProviderAbility.ReplyUsage]: TurnAbilityProbes.plain,
        [ProviderAbility.SubAgentRows]: TurnAbilityProbes.plain, [ProviderAbility.BackgroundCommands]: TurnAbilityProbes.plain,
        [ProviderAbility.GeneratedImages]: TurnAbilityProbes.plain, [ProviderAbility.PermissionCards]: "approval", [ProviderAbility.SteerTurn]: "hold" }),
      [ProviderAbility.Images]: () => turns.sendsAsync("images", "image.png", "image/png", t => t.texts.includes("Hello with 1 image")),
      [ProviderAbility.Files]: () => turns.sendsAsync("files", "notes.txt", "text/plain",
        () => host.commands("prompt").some(t => JSON.stringify(t["message"]).includes("notes.txt"))),
      ...turns.subAgents(TurnAbilityProbes.plain),
      ...turns.command("/skill:review"),
      [ProviderAbility.ApprovedTools]: async () => {
        const { turn, listener } = await turns.approvedTurnAsync("approved-tool");
        return turn.outcome === TurnOutcome.Completed && listener.asks.length === 0;
      }
    });
  }

  @TestMethod
  public async sendsPiThePlanToolRuleInEachPromptWithTheTeammatesInstructions(): Promise<void> {
    await using host = new PiTestHost();
    const provider = host.createProvider();
    const adapter = host.createAdapter();
    const instructions = CoreResources.formatTeammateInstructions("Review carefully", null);

    const first = await adapter.runTurn(host.createRequest("Plan it", provider, null, null, null, null, [], false, instructions), new RecordingTurnListener(),
      new AbortController().signal);
    const second = await adapter.runTurn(host.createRequest("Next step", provider, first.nativeSessionId, null, null, null, [], false, instructions),
      new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual("Completed:Completed", [first.outcome, second.outcome].join(":"), first.error ?? second.error ?? "");
    Assert.areEqual("true:true", host.commands("prompt").map(t => String(String(t["message"]).includes(CoreResources.planToolInstructions))).join(":"));
  }

  private static commandRequest(host: PiTestHost, command: string, resume: string | null = null, attachments: readonly MessageAttachment[] = []): TurnRequest {
    const asked = host.createRequest(command, host.createProvider(), resume);
    return new TurnRequest(asked.provider, asked.workingDirectory, asked.prompt, asked.requested, asked.resumeNativeSessionId, attachments, null, null, {},
      false, null, [], null, () => false, asked.sharedValues, null, false, command);
  }
}
