/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import fsPromises from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { mock } from "node:test";
import { JsonException, type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { Resources as CoreResources, ForkRequest, McpEndpoint, SessionTokens, SharedMcpFailureKind, SharedMcpValues, type TurnDetail, TurnOutcome, TurnRequest,
  TurnSteer, TurnTools } from "@noldova/teamrun.core";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { AuthStatus, DetailKind, MessageAttachment, Provider, ProviderAbility, ReplyAction, type ReplyUsage, RequestedSettings, SharedMcpServerDefinition,
  SharedMcpTransport } from "@noldova/teamrun.protocol";
import { ForkUnavailableException, GrokAdapter, ProcessCommand, ProviderAbilityTable, ProviderTimings, Resources, SharedMcpLaunch, SignInException } from "@noldova/teamrun.providers";

import { AbilityChecks } from "../../fixtures/ability-checks/ability-checks.fixture.js";
import { TurnAbilityProbes } from "../../fixtures/ability-checks/turn-ability-probes.fixture.js";
import { AcpCommandCheck } from "../../fixtures/acp-command-check.fixture.js";
import { ElapsedDelayTimer } from "../../fixtures/elapsed-delay-timer.fixture.js";
import { GrokModelStateRecording } from "../../fixtures/grok-model-state.recording.js";
import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { HeldDelayTimer } from "../../fixtures/held-delay-timer.fixture.js";
import { PlanToolRule } from "../../fixtures/plan-tool-rule.fixture.js";
import { RecordedMcpServers } from "../../fixtures/recorded-mcp-servers.fixture.js";
import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { RunningProgramsStarter } from "../../fixtures/running-programs-starter.fixture.js";
import { TitleAsks } from "../../fixtures/title-asks.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";
import { WatchingProcessStarter } from "../../fixtures/watching-process-starter.fixture.js";
import { ControlledProcessTerminator } from "../../fixtures/controlled-process-terminator.fixture.js";

class BlockingOnReplyListener extends RecordingTurnListener {
  public blocked: boolean = false;
  private readonly block: () => void;

  public constructor(block: () => void) {
    super();
    this.block = block;
  }

  public override async onDetailAsync(detail: TurnDetail): Promise<void> {
    this.block();
    this.blocked = true;
    await super.onDetailAsync(detail);
  }
}

@TestClass
export class GrokAdapterTests {
  private static readonly hooks: JsonObject = { "x.ai/hooks": { blockingEvents: ["PreToolUse", "Stop", "SubagentStop"], decisions: ["deny", "block"] } };
  private static readonly editRefused: string = Resources.formatReadOnlyChatRefused(Resources.grokDisplayName, "Edit notes.md");

  @TestMethod
  public async passesAListedSlashCommandUnwrappedAndAnswersAnyOtherBeforeSendingIt(): Promise<void> {
    await using host = new GrokTestHost();
    await AcpCommandCheck.passesOnlyListedCommandsAsync(host.createAdapter({ ...host.environment, ...AcpCommandCheck.environment(host.directory.path) }), host.request("unused"),
      host.directory.path);
  }

  @TestMethod
  public async passesTheSharedServersInSessionNewWithTheirValuesOutOfItsArgumentsAndItsHomeAndAsksBeforeTheirTools(): Promise<void> {
    await using host = new GrokTestHost();
    mkdirSync(host.directory.resolve("person", ".grok"), { recursive: true });
    const log = new RecordingLog();
    const adapter = host.createAdapter(GrokAdapterTests.offeringHttp(host), host.command, host.terminator, host.timings, undefined, undefined, undefined, log);
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", ["-y", "search-server"], ["SEARCH_KEY"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN");
    const saved = { SEARCH_KEY: "search-value-6911", DOCS_TOKEN: "docs-value-6912" };
    const values = new SharedMcpValues(new Map([["search", new Map([["SEARCH_KEY", saved.SEARCH_KEY]])], ["docs", new Map([["DOCS_TOKEN", saved.DOCS_TOKEN]])]]));
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([{ name: "teamrun_list_chats" }]), callToolAsync: () => Promise.resolve({}) }, [],
      GrokAdapterTests.endpoint());
    tools.markListed();
    const callOf = (tool: string): string => JSON.stringify({ title: "use_tool", rawInput: { tool_name: tool, tool_input_file: "/tmp/arguments.json" } });
    const request = (prompt: string): TurnRequest => new TurnRequest(null, host.directory.path, prompt, new RequestedSettings("grok", null, null), null, [], null,
      null, {}, false, tools, [stdio, http], null, undefined, values);
    const listener = new RecordingTurnListener();
    listener.decisions.push("yes");

    const launched = await adapter.runTurn(request("launch"), listener, new AbortController().signal);
    const asked = await adapter.runTurn(request(`use tool ${callOf("search__find")}`), listener, new AbortController().signal);
    const refused = await adapter.runTurn(request(`use tool ${callOf("teamrun__teamrun_check_provider")}`), listener, new AbortController().signal);

    const sent = readFileSync(host.directory.resolve("person", "mcp-servers.txt"), "utf8").split("\n");
    const launch = new SharedMcpLaunch();
    const shared = JSON.stringify([
      { name: "search", command: launch.program, args: [launch.script, "--variables", "SEARCH_KEY", "--", "npx", "-y", "search-server"],
        env: [{ name: "SEARCH_KEY", value: saved.SEARCH_KEY }, { name: "ELECTRON_RUN_AS_NODE", value: "1" }] },
      { type: "http", name: "docs", url: "https://docs.example/mcp", headers: [{ name: "Authorization", value: `Bearer ${saved.DOCS_TOKEN}` }] }
    ]);
    Assert.isNull(adapter.sharedServerUnavailable(stdio));
    Assert.isNull(adapter.sharedServerUnavailable(http));
    Assert.areEqual(`${TurnOutcome.Completed},${TurnOutcome.Completed},${TurnOutcome.Completed}`, [launched.outcome, asked.outcome, refused.outcome].join(","));
    Assert.isTrue(sent.at(0)?.startsWith(`${shared.slice(0, -1)},{"type":"http","name":"teamrun"`) === true, sent.at(0) ?? String.empty);
    Assert.areEqual("search__find: arguments in /tmp/arguments.json", listener.asks.map(t => t.summary).join("|"));
    Assert.isTrue(listener.texts.includes(Resources.formatRoutedMcpToolRefused(Resources.grokDisplayName, "teamrun__teamrun_check_provider")));
    const started = listener.texts.find(t => t.startsWith("{\"args\"")) ?? String.empty;
    Assert.isTrue(started.length > 0);
    const homeFiles = readdirSync(host.directory.resolve("person", ".grok"), { recursive: true, withFileTypes: true }).filter(t => t.isFile())
      .map(t => readFileSync(join(t.parentPath, t.name), "utf8"));
    for (const value of Object.values(saved))
      Assert.isFalse([started, ...homeFiles, ...log.lines, JSON.stringify([launched, asked, refused]), JSON.stringify(listener)].some(t => t.includes(value)), value);
  }

  @TestMethod
  public async sendsNoPromptWhenTheTurnIsAbortedWhileItsImagesAreRead(): Promise<void> {
    await using host = new GrokTestHost();
    const path = host.directory.resolve("image.png");
    writeFileSync(path, "fixture-image");
    const request = new TurnRequest(null, host.directory.path, "images", new RequestedSettings("grok", null, null), null,
      [new MessageAttachment("image.png", "image/png", 13, path)]);
    const timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 2000, 100, host.timings.killWait, 100, 1, 10);
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "images" }, host.command, host.terminator, timings);
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const result = await GrokAdapterTests.abortingWhileReading(path, controller, () => adapter.runTurn(request, listener, controller.signal));

    Assert.areEqual(TurnOutcome.Interrupted, result.outcome);
    Assert.isFalse(listener.details.some(t => t.text.includes(Buffer.from("fixture-image").toString("base64"))));
    const sent = await adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, sent.outcome);
  }

  @TestMethod
  public async setsTheTeammatesChatAndTeammateInTheAgentsProcess(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const cases: readonly Readonly<Record<string, string>>[] = [{ TEAMRUN_SENDER_TOKEN: "c1", TEAMRUN_TEST_VARIABLE: "t1" }, {}];
    for (const environment of cases) {
      const listener = new RecordingTurnListener();
      const base = host.request("environment");
      await adapter.runTurn(new TurnRequest(base.provider, base.workingDirectory, base.prompt, base.requested, null, [], null, null, environment),
        listener, new AbortController().signal);
      const expected = JSON.stringify({ token: environment["TEAMRUN_SENDER_TOKEN"] ?? null, other: environment["TEAMRUN_TEST_VARIABLE"] ?? null });
      Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Text && t.text.includes(expected)), expected);
    }
  }

  @TestMethod
  public async recordsThePromptFallbackAndReplacesTheRoleOnEveryTurn(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    for (const role of ["Review carefully", null]) {
      const listener = new RecordingTurnListener();
      const base = host.request("role-payload", "grok-session");
      await adapter.runTurn(new TurnRequest(base.provider, base.workingDirectory, base.prompt, base.requested,
        base.resumeNativeSessionId, [], role), listener, new AbortController().signal);
      const payload = listener.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join("\n");
      Assert.isTrue(payload.includes(role ?? "No additional teammate role instructions."), payload);
      Assert.areEqual(role === null ? null : "Prompt", listener.starts[0]?.roleApplied);
    }
  }

  @TestMethod
  public async leavesThePersonsRuleFilesToGrokOnANewSessionAndAfterACompaction(): Promise<void> {
    await using host = new GrokTestHost();
    mkdirSync(host.directory.resolve("person", ".grok", "rules"), { recursive: true });
    writeFileSync(host.directory.resolve("person", ".grok", "rules", "style.md"), "person-rule-fixture");
    writeFileSync(host.directory.resolve("person", ".grok", "AGENTS.md"), "person-agents-fixture");
    const adapter = host.createAdapter();
    const sendAsync = async (role: string | null, resume: string | null, prompt: string = "role-payload", compacts: boolean = false): Promise<string> => {
      const listener = new RecordingTurnListener();
      const base = host.request(prompt, resume);
      await adapter.runTurn(new TurnRequest(base.provider, base.workingDirectory, base.prompt, base.requested, base.resumeNativeSessionId, [], role, null, {}, compacts),
        listener, new AbortController().signal);
      return listener.details.filter(t => t.kind === DetailKind.Text).map(t => t.text).join("\n");
    };

    const fresh = await sendAsync("Review carefully", null);
    const bare = await sendAsync(null, null);
    await sendAsync(null, "grok-session", "compact", true);
    const afterCompaction = await sendAsync(null, "grok-session");

    Assert.isTrue(fresh.includes("Review carefully") && bare.includes("No additional teammate role instructions."), `${fresh}\n${bare}`);
    Assert.areEqual("false,false,false", [fresh, bare, afterCompaction].map(t => String(t.includes("person-rule-fixture") || t.includes("person-agents-fixture") ||
      t.includes("Contents of"))).join(","));
  }

  @TestMethod
  public async runsGrokInTheGrokHomeTheLaunchsEnvironmentNames(): Promise<void> {
    await using host = new GrokTestHost();
    const moved = host.directory.resolve("moved");
    mkdirSync(moved, { recursive: true });
    const watching = new WatchingProcessStarter(() => undefined);
    const starter = { start: watching.start.bind(watching), readEnvironmentAsync: (own: NodeJS.ProcessEnv) => Promise.resolve({ ...own, GROK_HOME: moved }) };
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, host.timings, starter);

    Assert.areEqual(TurnOutcome.Completed, (await adapter.runTurn(host.request("role-payload", null), new RecordingTurnListener(), new AbortController().signal)).outcome);

    Assert.areEqual(JSON.stringify([moved]), JSON.stringify([...new Set(watching.environments.map(t => t["GROK_HOME"]))]));
  }

  @TestMethod
  public async showsGrokAmongTheRunningProgramsWhileATurnRunsAndNotAfter(): Promise<void> {
    await using host = new GrokTestHost();
    const starter = new RunningProgramsStarter();
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, host.timings, starter);
    const controller = new AbortController();
    const listener = new RecordingTurnListener();

    const run = adapter.runTurn(host.request("cancel"), listener, controller.signal);
    await Wait.until(() => listener.details.some(t => t.text === "working"), "The listener did not see 'working'.");
    const during = starter.ofKind("grok").length;
    controller.abort();

    Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
    Assert.areEqual(1, during);
    Assert.areEqual(0, starter.running.length);
  }

  @TestMethod
  public async retriesCancellationCleanupAndReportsCleanupFailures(): Promise<void> {
    await using host = new GrokTestHost();
    const terminator = new ControlledProcessTerminator(process.platform);
    const environment = { ...host.environment, TEAMRUN_FAKE_ACP_STAY_OPEN: "1", TEAMRUN_FAKE_ACP_IGNORE_CANCEL: "1" };
    const adapter = host.createAdapter(environment, host.command, terminator, host.stayOpenTimings);
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    terminator.failures = 1;
    const run = adapter.runTurn(host.request("cancel"), listener, controller.signal);
    await Wait.until(() => listener.details.some(t => t.text === "working"), "The listener did not see 'working'.");
    controller.abort();
    Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
    Assert.areEqual(0, terminator.failures);

    const failed = host.createAdapter(environment, host.command, terminator, host.stayOpenTimings);
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    terminator.failures = 1;
    await Assert.throwsAsync(() => failed.checkSignIn(provider), Error);
    await failed.shutdown();
    terminator.failures = 1;
    Assert.areEqual(TurnOutcome.Completed, (await failed.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal)).outcome);
    await Wait.until(() => terminator.failures === 0, "The agent's close after its idle limit was not tried.");
    await failed.shutdown();
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async reportsTheImageGrokBuildsImageToolSavedInItsSessionAsAGeneratedImage(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    const result = await host.createAdapter().runTurn(host.request("image"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    const image = listener.details.filter(t => t.providerItemId === "grok-tool-i1");
    Assert.areEqual(2, image.length);
    Assert.areEqual("image_gen", image[0]!.text);
    const payload = image[1]!.payload as Record<string, unknown>;
    Assert.areEqual(DetailKind.Note, image[1]!.kind);
    Assert.areEqual("imageGeneration", payload["itemType"]);
    Assert.areEqual("/9j/4A==", payload["imageData"]);
    Assert.areEqual("image/jpeg", payload["mediaType"]);
    Assert.areEqual(join(host.directory.resolve("person", ".grok"), "sessions", "%2Fwork", "grok-session", "images", "1.jpg"), payload["savedPath"]);
  }

  @TestMethod
  public async reportsAFailedGrokBuildImageToolAsAFailedGeneratedImageWithGroksReason(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    const result = await host.createAdapter().runTurn(host.request("failed image"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    const image = listener.details.filter(t => t.providerItemId === "grok-tool-i2");
    Assert.areEqual("imagine: a square", image.at(-2)?.text);
    const payload = image.at(-1)!.payload as Record<string, unknown>;
    Assert.areEqual(DetailKind.Note, image.at(-1)!.kind);
    Assert.areEqual("imageGeneration", payload["itemType"]);
    Assert.areEqual("failed", payload["status"]);
    Assert.areEqual(JSON.stringify({ error: "tool_execution_failed", message: "Image generation failed with HTTP 422" }), JSON.stringify(payload["failure"]));
    Assert.isNull(payload["savedPath"]);
    Assert.isNull(payload["imageData"]);
  }

  @TestMethod
  public async supportsUnknownSessionMetadataAndShutdownDuringWork(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_NO_METADATA: "1" });
    const result = await adapter.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isNull(result.observed.model);
    Assert.isNull(result.observed.effort);
    const listener = new RecordingTurnListener();
    const running = adapter.runTurn(host.request("cancel"), listener, new AbortController().signal);
    await Wait.until(() => listener.details.some(t => t.text === "working"), "The listener did not see 'working'.");
    await adapter.shutdown();
    Assert.areEqual(TurnOutcome.Failed, (await running).outcome);
    const controller = new AbortController();
    const cancelled = new RecordingTurnListener();
    cancelled.onStartedAsync = () => {
      controller.abort();
      return Promise.resolve();
    };
    Assert.areEqual(TurnOutcome.Interrupted, (await adapter.runTurn(host.request("complete"), cancelled, controller.signal)).outcome);
    Assert.isFalse(cancelled.texts.some(t => t.includes("Hello")));
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const loggedOut = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" });
    const request = new TurnRequest(provider, host.directory.path, "complete", new RequestedSettings("grok", null, null), null);
    Assert.areEqual(TurnOutcome.Failed, (await loggedOut.runTurn(request, new RecordingTurnListener(), new AbortController().signal)).outcome);
  }

  @TestMethod
  public async signsInWithTheCliBrowserMethodSoTheCheckPassesAndSkipsAProfileSignedInAlready(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" });
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const browsers = (): readonly string[] => readdirSync(provider.profileDir).filter(t => t.startsWith("browser-"))
      .map(t => readFileSync(join(provider.profileDir, t), "utf8"));

    Assert.areEqual(AuthStatus.LoggedOut, (await adapter.checkSignIn(provider)).authStatus);
    await adapter.signIn(provider, new AbortController().signal);
    await adapter.signIn(provider, new AbortController().signal);

    Assert.isTrue(adapter.descriptor.supportsSignIn);
    Assert.isTrue(adapter.descriptor.abilities === ProviderAbilityTable.grok);
    Assert.areEqual("true:null", [adapter.descriptor.supportsSignOut, adapter.descriptor.signOutCommand ?? "null"].join(":"));
    Assert.areEqual(JSON.stringify({ variable: "GROK_HOME", signInCommand: null, usualFolder: host.directory.resolve("person", ".grok"), toolCommand: null, signInVariables: {}, signInValues: {},
      personFolders: [host.directory.resolve("person", ".grok"), host.directory.resolve("profile")] }),
      JSON.stringify(adapter.descriptor.profile?.toJson()));
    Assert.areEqual(`${host.directory.resolve("person", ".grok")} ${Resources.grokProfileEntries.join()}`,
      `${adapter.profileSearch?.folders.join()} ${adapter.profileSearch?.entries.join()}`);
    Assert.areEqual(`${adapter.descriptor.displayName} can't switch on its own MCP servers here: ${Resources.grokOwnServersSwitchAbility}.`, adapter.descriptor.ownMcpServersUnavailable);
    Assert.areEqual("docs,linear", (await adapter.listOwnMcpServers(provider))?.map(t => t.name).join(","));
    Assert.areEqual(JSON.stringify([{ methodId: "grok.com" }]), JSON.stringify(browsers().map(t => JSON.parse(t) as unknown)));
    Assert.areEqual(AuthStatus.LoggedIn, (await adapter.checkSignIn(provider)).authStatus);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async signsInAndChecksWithThePersonsOwnHomeAndAppDataFoldersXAuthorityAndBrowserKeepingAnAddedProvidersGrokHome(): Promise<void> {
    await using host = new GrokTestHost();
    const person = host.directory.resolve("person");
    const own = { HOME: person, USERPROFILE: person, APPDATA: join(person, "roaming"), LOCALAPPDATA: join(person, "local"),
      XDG_CONFIG_HOME: join(person, "config"), XDG_DATA_HOME: join(person, "data") };
    const starter = new WatchingProcessStarter(() => undefined);
    const display = { XAUTHORITY: join(person, "xauth"), BROWSER: "firefox" };
    const adapter = host.createAdapter({ ...host.environment, ...own, ...display, TEAMRUN_FAKE_ACP_INIT: "loggedOut" }, host.command, host.terminator,
      host.timings, starter);
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const folders = (environment: NodeJS.ProcessEnv | undefined): string => [...Object.keys(own), ...Object.keys(display)]
      .map(t => `${t}=${environment?.[t]} ${environment?.["GROK_HOME"]}`).join(",");
    const expected = Object.entries({ ...own, ...display }).map(([name, value]) => `${name}=${value} ${provider.profileDir}`).join(",");

    await adapter.signIn(provider, new AbortController().signal);
    const signingIn = starter.environments.at(-1);
    Assert.areEqual(AuthStatus.LoggedIn, (await adapter.checkSignIn(provider)).authStatus);

    Assert.areEqual(expected, folders(signingIn));
    Assert.areEqual(expected, folders(starter.environments.at(-1)));
  }

  @TestMethod
  public async stopsTheCliWhenASignInIsAbortedAndLeavesTheProfileSignedOut(): Promise<void> {
    await using host = new GrokTestHost();
    const environment = { ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" };
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const controller = new AbortController();

    const signing = host.createAdapter({ ...environment, TEAMRUN_FAKE_ACP_SIGNIN_HOLD: "1" }).signIn(provider, controller.signal)
      .then(() => "resolved", () => "rejected");
    await Wait.until(() => existsSync(provider.profileDir) && readdirSync(provider.profileDir).some(t => t.startsWith("browser-")), "Grok did not make a browser profile.");
    controller.abort();

    Assert.areEqual("rejected", await signing);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
    Assert.areEqual(AuthStatus.LoggedOut, (await host.createAdapter(environment).checkSignIn(provider)).authStatus);
  }

  @TestMethod
  public async stillStopsTheCliWhenTheAbortedSignInsFirstStopFails(): Promise<void> {
    await using host = new GrokTestHost();
    const terminator = new ControlledProcessTerminator(process.platform);
    const environment = { ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut", TEAMRUN_FAKE_ACP_SIGNIN_HOLD: "1", TEAMRUN_FAKE_ACP_STAY_OPEN: "1" };
    const adapter = host.createAdapter(environment, host.command, terminator, host.stayOpenTimings);
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const controller = new AbortController();
    terminator.failures = 1;

    const signing = adapter.signIn(provider, controller.signal).then(() => "resolved", () => "rejected");
    await Wait.until(() => existsSync(provider.profileDir) && readdirSync(provider.profileDir).some(t => t.startsWith("browser-")), "Grok did not make a browser profile.");
    controller.abort();

    Assert.areEqual("rejected", await signing);
    Assert.areEqual(0, terminator.failures);
    await adapter.shutdown();
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async refusesASignInTheCliOffersNoMethodForOrRefuses(): Promise<void> {
    await using host = new GrokTestHost();
    const environment = { ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" };
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const signal = new AbortController().signal;

    const unavailable = await Assert.throwsAsync(() => host.createAdapter({ ...environment, TEAMRUN_FAKE_ACP_NO_BROWSER_METHOD: "1" }).signIn(provider, signal), Error);
    await Assert.throwsAsync(() => host.createAdapter({ ...environment, TEAMRUN_FAKE_ACP_SIGNIN_FAIL: "1" }).signIn(provider, signal), Error);
    await Assert.throwsAsync(() => host.createAdapter(environment, null).signIn(provider, signal), Error);

    Assert.areEqual("Grok CLI offers no sign-in TeamRun can start. Run grok login with the profile's GROK_HOME.", unavailable.message);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async startsItsAgentForTheProviderItServes(): Promise<void> {
    await using host = new GrokTestHost();
    const starter = new WatchingProcessStarter(() => undefined);
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, host.timings, starter);
    const provider = new Provider("g1", "grok", "Work", host.directory.resolve("work"), AuthStatus.Unknown, null, null, null, null, "t");

    await adapter.listModels(provider);
    await adapter.listModels(null);

    Assert.areEqual("grok g1,grok null", starter.started.map(t => `${t.origin?.kind} ${t.origin?.providerId}`).join(","));
  }

  @TestMethod
  public async turnsThePersonsMemoryMcpServersAndHooksOffWhenListingModels(): Promise<void> {
    await using host = new GrokTestHost();
    const starter = new WatchingProcessStarter(() => undefined);
    const variables = ["GROK_MEMORY", "GROK_MANAGED_MCPS_ENABLED", "GROK_CLAUDE_MCPS_ENABLED", "GROK_CURSOR_MCPS_ENABLED", "GROK_CODEX_MCPS_ENABLED",
      "GROK_CLAUDE_HOOKS_ENABLED", "GROK_CURSOR_HOOKS_ENABLED", "GROK_CODEX_HOOKS_ENABLED"];
    const turnedOn = Object.fromEntries(variables.map(t => [t, "1"]));
    const adapter = host.createAdapter({ ...host.environment, ...turnedOn }, host.command, host.terminator, host.timings, starter);

    await adapter.listModels(null);

    const expected = variables.map(t => `${t}=0`).join(",");
    Assert.isTrue(starter.environments.length > 0);
    Assert.areEqual(starter.environments.map(() => expected).join("|"),
      starter.environments.map(e => variables.map(t => `${t}=${e[t]}`).join(",")).join("|"));
  }

  @TestMethod
  public async sendsNoMetaInInitialize(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    const turn = await host.createAdapter().runTurn(host.request("methods"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, turn.outcome);
    Assert.isFalse(JsonReader.parse(listener.texts.find(t => t.startsWith("{\"methods\"")) ?? "").readBoolean("metaSent"));
  }

  @TestMethod
  public async startsATitleSessionInAskModeRatherThanAsThePersonsOwnSettingsSay(): Promise<void> {
    await using host = new GrokTestHost();
    const modes = { currentModeId: "default", availableModes: [{ id: "default", name: "Default" }, { id: "plan", name: "Plan" }, { id: "ask", name: "Ask" }] };
    const request = host.request("methods");

    const answer = await TitleAsks.answerAsync(host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(modes) }), TitleAsks.isolated(request));

    Assert.areEqual("mode=ask", (JSON.parse(answer) as { readonly sets: readonly string[] }).sets.filter(t => t.startsWith("mode=")).join(","));
  }

  @TestMethod
  public async listsItsSessionModesAtDefaultAndRunsAChosenOneThroughSessionSetMode(): Promise<void> {
    await using host = new GrokTestHost();
    const modes = { currentModeId: "default", availableModes: [{ id: "default", name: "Default" }, { id: "plan", name: "Plan" }, { id: "ask", name: "Ask" }] };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(modes) });

    const listed = await adapter.listModels(null);
    const sets: string[] = [];
    for (const mode of ["plan", "ask", "default", "bypassPermissions", "unlisted", null]) {
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(host.request("methods", null, null, null, null, mode), listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, turn.outcome, String(mode));
      const sent = JSON.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly methods: readonly string[]; readonly sets: readonly string[] };
      sets.push(`${sent.sets.join(",")}/${String(sent.methods.includes("session/set_mode"))}`);
    }

    Assert.areEqual("default:Default:false:false,plan:Plan:false:true,ask:Ask:false:true,bypassPermissions:Always-approve:true:false",
      listed.modes.map(t => [t.id, t.name, t.unrestricted, t.readOnly].join(":")).join(","));
    Assert.areEqual([Resources.grokDefaultModeDescription, Resources.grokPlanModeDescription, Resources.grokAskModeDescription, Resources.grokAlwaysApproveModeDescription]
      .join("|"), listed.modes.map(t => t.description).join("|"));
    Assert.areEqual("default", listed.defaultMode);
    Assert.areEqual(listed.modes.map(t => t.id).join(","), adapter.modes.map(t => t.id).join(","));
    Assert.areEqual("default", adapter.defaultMode);
    Assert.areEqual("plan", adapter.planMode);
    Assert.areEqual("mode=plan/true|mode=ask/true|/false|/false|/false|/false", sets.join("|"));
  }

  @TestMethod
  public async runsEachChosenModeButTheDefaultAndAPlanFirstTurnThroughSessionSetModeThoughTheSessionListsNoModes(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const sets: string[] = [];
    for (const [mode, planFirst] of [["plan", false], ["ask", false], ["default", false], ["default", true], ["bypassPermissions", false], [null, false]] as const) {
      const asked = host.request("methods", null, null, null, null, mode);
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(asked.withRequested(asked.requested.withPlanFirst(planFirst)), listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, turn.outcome, `${String(mode)}:${String(planFirst)}`);
      sets.push(GrokAdapterTests.modesSet(listener));
    }

    Assert.areEqual("mode=plan|mode=ask||mode=plan||", sets.join("|"));
  }

  @TestMethod
  public async restartsAnApprovedPlanFirstTurnOfAReadOnlyChatInItsModeOnceGrokLeavesThePlanForDefaultRefusingAnEditMeanwhile(): Promise<void> {
    await using host = new GrokTestHost();

    const seen = [await GrokAdapterTests.leavePlanAsync(host, "ask", null), await GrokAdapterTests.leavePlanAsync(host, "default", null),
      await GrokAdapterTests.leavePlanAsync(host, "ask", "fail-ask")];

    const approved = "{\"result\":{\"outcome\":\"approved\"}";
    Assert.areEqual([`${TurnOutcome.Completed} 1 null 1 ${approved},"edit":{"outcome":{"outcome":"selected","optionId":"reject-once"}},"sets":["mode=plan"],"cancelled":true}`
      + `|{"restarted":["${CoreResources.planApprovedPrompt}"],"sets":["mode=plan","mode=ask"]}`,
      `${TurnOutcome.Completed} 2 null 0 ${approved},"edit":{"outcome":{"outcome":"selected","optionId":"allow-once"}},"sets":["mode=plan"],"cancelled":false}`,
      `${TurnOutcome.Failed} 1 Mode refused 1 ${approved},"edit":{"outcome":{"outcome":"selected","optionId":"reject-once"}},"sets":["mode=plan"],"cancelled":true}`].join("\n"),
      seen.join("\n"));
  }

  @TestMethod
  public async holdsASteerSentWhileAnApprovedPlanFirstTurnRestartsAndSendsItWithTheNewPromptOnceAskIsSet(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_PLAN_LEFT_HOLD: "1" });
    const asked = host.request("plan-left-for-default", null, null, null, null, "ask");
    const listener = new RecordingTurnListener();
    listener.decisions.push(Resources.acpApprovePlanOption);
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);

    const running = adapter.runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, new AbortController().signal);
    await Wait.until(() => listener.texts.some(t => t.startsWith(GrokAdapterTests.editRefused)), "The edit was not refused.");
    const taken = offers.at(-1)?.(new TurnSteer("Check the tests too.", [])) ?? Promise.resolve(null);
    writeFileSync(join(host.directory.resolve("person"), "plan-left-released.txt"), "");
    const turn = await running;

    Assert.areEqual(`${TurnOutcome.Completed} true {"restarted":["${CoreResources.planApprovedPrompt}","Check the tests too."],"sets":["mode=plan","mode=ask"]}`,
      [turn.outcome, await taken, listener.texts.find(t => t.includes("\"restarted\""))].join(" "));
  }

  @TestMethod
  public async refusesOnlyAHeldSteerWhoseImageCantBeReadAndRestartsAnApprovedPlanFirstTurnWithTheOthers(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_PLAN_LEFT_HOLD: "1" });
    const asked = host.request("plan-left-for-default", null, null, null, null, "ask");
    const listener = new RecordingTurnListener();
    listener.decisions.push(Resources.acpApprovePlanOption);
    const offers: (((steer: TurnSteer) => Promise<boolean>) | null)[] = [];
    listener.onSteerable = t => offers.push(t);

    const running = adapter.runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, new AbortController().signal);
    await Wait.until(() => listener.texts.some(t => t.startsWith(GrokAdapterTests.editRefused)), "The edit was not refused.");
    const offer = offers.at(-1) ?? null;
    const unread = offer?.(new TurnSteer("See the screenshot.", [new MessageAttachment("missing.png", "image/png", 13, host.directory.resolve("missing.png"))]))
      ?? Promise.resolve(null);
    const taken = offer?.(new TurnSteer("Check the tests too.", [])) ?? Promise.resolve(null);
    writeFileSync(join(host.directory.resolve("person"), "plan-left-released.txt"), "");
    const turn = await running;

    Assert.areEqual(`${TurnOutcome.Completed} false true {"restarted":["${CoreResources.planApprovedPrompt}","Check the tests too."],"sets":["mode=plan","mode=ask"]}`,
      [turn.outcome, await unread, await taken, listener.texts.find(t => t.includes("\"restarted\""))].join(" "));
  }

  @TestMethod
  public async sendsNoNewPromptWhenTheReplyIsStoppedWhileAnApprovedPlanFirstTurnRestarts(): Promise<void> {
    await using host = new GrokTestHost();
    const prompts = host.directory.resolve("prompts.txt");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_PLAN_LEFT_HOLD: "1", TEAMRUN_FAKE_ACP_PROMPTS: prompts });
    const asked = host.request("plan-left-for-default", null, null, null, null, "ask");
    const listener = new RecordingTurnListener();
    listener.decisions.push(Resources.acpApprovePlanOption);
    const stop = new AbortController();

    const running = adapter.runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, stop.signal);
    await Wait.until(() => listener.texts.some(t => t.startsWith(GrokAdapterTests.editRefused)), "The edit was not refused.");
    stop.abort();
    writeFileSync(join(host.directory.resolve("person"), "plan-left-released.txt"), "");
    const turn = await running;

    Assert.areEqual(`${TurnOutcome.Interrupted} 1 false`, [turn.outcome, readFileSync(prompts, "utf8").trim().split("\n").length,
      listener.texts.some(t => t.includes("\"restarted\""))].join(" "));
  }

  @TestMethod
  public async switchesAnApprovedPlanFirstTurnThatEndedBeforeItsCancelToItsChatsModeForTheNextTurnWithoutANewPrompt(): Promise<void> {
    await using host = new GrokTestHost();
    const prompts = host.directory.resolve("prompts.txt");
    const sets = host.directory.resolve("sets.txt");
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_PROMPTS: prompts, TEAMRUN_FAKE_ACP_SETS: sets });
    const asked = host.request("plan-left-ends-first", null, null, null, null, "ask");
    const listener = new RecordingTurnListener();
    listener.decisions.push(Resources.acpApprovePlanOption);

    const turn = await adapter.runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, new AbortController().signal);

    Assert.areEqual(`${TurnOutcome.Completed} 1 mode=plan,mode=ask`, [turn.outcome, readFileSync(prompts, "utf8").trim().split("\n").length,
      readFileSync(sets, "utf8").trim().split("\n").join(",")].join(" "));
  }

  @TestMethod
  public async setsEveryChosenModeOnALoadedSessionSoADefaultTurnLeavesThePlanModeGrokRestored(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const planned = await adapter.runTurn(host.request("Plan it", null, null, null, null, "plan"), new RecordingTurnListener(), new AbortController().signal);
    const sets: string[] = [];
    for (const mode of ["default", "bypassPermissions", null, "ask"]) {
      const listener = new RecordingTurnListener();
      const turn = await adapter.runTurn(host.request("methods", planned.nativeSessionId, null, null, null, mode), listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, turn.outcome, String(mode));
      sets.push(GrokAdapterTests.modesSet(listener));
    }

    Assert.areEqual("grok-session", planned.nativeSessionId);
    Assert.areEqual("mode=default|mode=default|mode=default|mode=ask", sets.join("|"));
  }

  @TestMethod
  public async failsATurnBeforeItsPromptWhenTheSessionListsItsModesWithoutTheChosenOne(): Promise<void> {
    await using host = new GrokTestHost();
    const modes = { currentModeId: "default", availableModes: [{ id: "default", name: "Default" }] };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(modes) });

    const chosen = new RecordingTurnListener();
    const refused = await adapter.runTurn(host.request("methods", null, null, null, null, "plan"), chosen, new AbortController().signal);
    const plain = new RecordingTurnListener();
    const kept = await adapter.runTurn(host.request("methods", null, null, null, null, "default"), plain, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, refused.outcome);
    Assert.areEqual(Resources.formatModeUnavailable("Grok", "Plan"), refused.error);
    Assert.isFalse(chosen.texts.some(t => t.startsWith("{\"methods\"")));
    Assert.areEqual(TurnOutcome.Completed, kept.outcome);
    Assert.isFalse((JSON.parse(plain.texts.find(t => t.startsWith("{\"methods\""))!) as { readonly methods: readonly string[] }).methods.includes("session/set_mode"));
  }

  @TestMethod
  public async failsATurnBeforeItsPromptWhenGrokRefusesTheChosenMode(): Promise<void> {
    await using host = new GrokTestHost();
    const modes = { currentModeId: "default", availableModes: [{ id: "default", name: "Default" }, { id: "plan", name: "Plan" }] };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(modes), TEAMRUN_FAKE_ACP_SET_MODE: "fail" });
    const listener = new RecordingTurnListener();

    const refused = await adapter.runTurn(host.request("methods", null, null, null, null, "plan"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, refused.outcome);
    Assert.isTrue(refused.error?.includes("Mode refused") ?? false, refused.error ?? "no error");
    Assert.isFalse(listener.texts.some(t => t.startsWith("{\"methods\"")));
  }

  @TestMethod
  public async signsOutWithEitherLogoutFormAndSaysWhyWhenGrokAnswersNeitherRefusesOrKeepsAnApiKey(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.LoggedIn, null, null, null, null, "t");
    const outcomes: string[] = [];
    for (const mode of ["signedOut", "plain", "unknown", "refused", "apiKey"]) {
      outcomes.push(await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_LOGOUT: mode }).signOut(provider).then(() => "signed out",
        (error: unknown) => error instanceof Error ? error.message : "not an Error"));
    }

    Assert.areEqual(JSON.stringify(["signed out", "signed out",
      "Grok 1.0.30-fixture answers neither sign-out request TeamRun knows, _x.ai/auth/logout or x.ai/auth/logout. Update Grok, then sign out again.",
      Resources.grokSignOutRefused, Resources.grokApiKeyStillSet]), JSON.stringify(outcomes));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async forksASessionThroughThePromptIndexItsTurnReportedAndLoadsTheFork(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_ECHO: "1" });
    const request = (turnId: string): ForkRequest => new ForkRequest(null, host.directory.path, "grok-session", turnId, new RequestedSettings("grok", null, null));
    const forkWith = (mode: string, turnId: string = "0"): Promise<string> =>
      host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_FORK: mode }).forkSession(request(turnId)).then(t => t.nativeSessionId);
    const requests = (): string[] => readFileSync(join(host.directory.resolve("person"), "fork-requests.txt"), "utf8").trimEnd().split("\n");

    const first = await adapter.runTurn(host.request("hello"), new RecordingTurnListener(), new AbortController().signal);
    const forked = await adapter.forkSession(request(first.nativeTurnId!));
    const resumed = await adapter.runTurn(host.request("again", forked.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);

    Assert.isTrue(adapter.descriptor.supportsResume);
    Assert.isTrue(adapter.descriptor.supportsFork);
    Assert.areEqual("grok-session", first.nativeSessionId);
    Assert.areEqual("0", first.nativeTurnId);
    Assert.areEqual(JSON.stringify(["grok", null, "fork-of-grok-session-at-0", null]),
      JSON.stringify([forked.kind, forked.providerId, forked.nativeSessionId, forked.resumeAt]));
    Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
    Assert.areEqual("fork-of-grok-session-at-0", resumed.nativeSessionId);
    Assert.areEqual(`_x.ai/session/fork ${JSON.stringify({ sourceSessionId: "grok-session", sourceCwd: host.directory.path, newCwd: host.directory.path,
      targetPromptIndex: 0 })}`, requests()[0]);
    Assert.areEqual("fork-of-grok-session-at-12", await forkWith("plain", "12"));
    Assert.areEqual("_x.ai/session/fork,x.ai/session/fork", requests().slice(1).map(t => t.split(" ")[0]).join(","));
    await Assert.throwsAsync(() => forkWith("unknown"), Error);
    await Assert.throwsAsync(() => forkWith("fail"), Error);
    Assert.areEqual(6, requests().length);
    for (const turnId of ["x", "-1", "1.5", "99999999999999999999"])
      Assert.areEqual(Resources.formatPromptIndexInvalid(turnId), (await Assert.throwsAsync(() => forkWith("", turnId), ForkUnavailableException)).message);
    Assert.areEqual(6, requests().length);
    const signedOut = await Assert.throwsAsync(() => host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" }).forkSession(request("0")), SignInException);
    Assert.areEqual(Resources.formatGrokSignIn(host.directory.resolve("person", ".grok")), signedOut.message);
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    Assert.areEqual("a", (await adapter.forkSession(new ForkRequest(provider, host.directory.path, "grok-session", "1", new RequestedSettings("grok", null, null)))).providerId);
    Assert.areEqual(7, requests().length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async aSignedInCheckReadsTheEmailFromAuthInfoWithoutASessionOrAPrompt(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const checked: string[] = [];
    for (const environment of [{}, { TEAMRUN_FAKE_ACP_ACCOUNT: "plain" }, { TEAMRUN_FAKE_ACP_ACCOUNT: "none" }, { TEAMRUN_FAKE_ACP_ACCOUNT: "unknown" },
      { TEAMRUN_FAKE_ACP_ACCOUNT: "fail" }, { TEAMRUN_FAKE_ACP_INIT: "loggedOut" }]) {
      const check = await host.createAdapter({ ...host.environment, ...environment }).checkSignIn(provider);
      checked.push([check.authStatus, check.identity?.email ?? "none", check.identity?.authMethod ?? "none"].join(" "));
    }

    Assert.areEqual(["LoggedIn person@example.com cached_token", "LoggedIn person@example.com cached_token", "LoggedIn none none", "LoggedIn none none",
      "LoggedIn none none", "LoggedOut none none"].join(","), checked.join(","));
    Assert.areEqual(["_x.ai/auth/info,_x.ai/billing", "_x.ai/auth/info,x.ai/auth/info,_x.ai/billing", "_x.ai/auth/info,_x.ai/billing",
      "_x.ai/auth/info,x.ai/auth/info,_x.ai/billing", "_x.ai/auth/info,_x.ai/billing"].join(","), GrokAdapterTests.usageRequests(host));
    Assert.isFalse(existsSync(join(host.directory.resolve("person"), "new-sessions.txt")));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async aSignedInCheckReadsThePlanFromTheBillingAndTheOrganizationOrTeamFromAuthInfoAndStaysSignedInWithoutThem(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const checked: string[] = [];
    for (const environment of [{}, { TEAMRUN_FAKE_ACP_ACCOUNT: "team" }, { TEAMRUN_FAKE_ACP_ACCOUNT: "none" }, { TEAMRUN_FAKE_ACP_BILLING: "noTier" },
      { TEAMRUN_FAKE_ACP_BILLING: "plain" }, { TEAMRUN_FAKE_ACP_BILLING: "unknown" }, { TEAMRUN_FAKE_ACP_BILLING: "fail" }]) {
      const check = await host.createAdapter({ ...host.environment, ...environment }).checkSignIn(provider);
      checked.push([check.authStatus, check.identity?.email ?? "none", check.identity?.plan ?? "none", check.identity?.organization ?? "none"].join("|"));
    }

    Assert.areEqual(["LoggedIn|person@example.com|SuperGrok Heavy|Acme", "LoggedIn|person@example.com|SuperGrok Heavy|Lab", "LoggedIn|none|SuperGrok Heavy|none",
      "LoggedIn|person@example.com|none|Acme", "LoggedIn|person@example.com|SuperGrok Heavy|Acme", "LoggedIn|person@example.com|none|Acme",
      "LoggedIn|person@example.com|none|Acme"].join(","), checked.join(","));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async aSignedInCheckGivesEachAccountMethodItsOwnShortTimeoutAndTriesThePlainAccountMethodAfterAHangButNotThePlainBillingOne(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    const timings = new ProviderTimings(2000, 2000, 10_000, 10_000, 100, 100, 100, 5000, 100, 1, 10, Resources.wakeGrace, Resources.taskOutputFollowInterval, 500);
    const checked: string[] = [];
    for (const [read, mode] of [["ACCOUNT", "hangNamespaced"], ["ACCOUNT", "hang"], ["BILLING", "hangNamespaced"], ["BILLING", "hang"]]) {
      const started = performance.now();
      const check = await host.createAdapter({ ...host.environment, [`TEAMRUN_FAKE_ACP_${read}`]: mode }, host.command, host.terminator, timings)
        .checkSignIn(provider);
      checked.push([check.authStatus, check.identity?.email ?? "none", check.identity?.plan ?? "none", String(performance.now() - started < timings.requestTimeout)]
        .join(" "));
    }

    Assert.areEqual(["LoggedIn person@example.com SuperGrok Heavy true", "LoggedIn none SuperGrok Heavy true", "LoggedIn person@example.com none true",
      "LoggedIn person@example.com none true"].join(","), checked.join(","));
    Assert.areEqual(["_x.ai/auth/info", "x.ai/auth/info", "_x.ai/billing", "_x.ai/auth/info", "x.ai/auth/info", "_x.ai/billing", "_x.ai/auth/info", "_x.ai/billing",
      "_x.ai/auth/info", "_x.ai/billing"].join(","), GrokAdapterTests.usageRequests(host));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async discoversModelsChecksCachedAuthenticationAndClosesProcesses(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const list = await adapter.listModels(null);
    const models = list.models;
    Assert.areEqual("grok-test,grok-other", models.map(t => t.id).join(","));
    Assert.areEqual(true, list.signedIn);
    const signedOut = await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" }).listModels(null);
    Assert.areEqual(false, signedOut.signedIn);
    Assert.areEqual("grok-test,grok-other", signedOut.models.map(t => t.id).join(","));
    Assert.areEqual("high,low", models[0]?.effortLevels?.join(","));
    Assert.isFalse(models[0]?.supportsImages ?? true);
    const provider = new Provider("a", "grok", "Dedicated", host.directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");
    Assert.areEqual(AuthStatus.LoggedIn, (await adapter.checkSignIn(provider)).authStatus);
    Assert.areEqual(AuthStatus.LoggedOut,
      (await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" }).checkSignIn(provider)).authStatus);
    Assert.areEqual(AuthStatus.Error, (await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_SIGNIN_FAIL: "1" }).checkSignIn(provider)).authStatus);
    Assert.areEqual(AuthStatus.Error, (await host.createAdapter(host.environment, null).checkSignIn(provider)).authStatus);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async streamsDetailsAndResumesWithoutReplayingOldOrLateText(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();
    const result = await adapter.runTurn(host.request("complete", "old-session", "grok-test", "high"), listener, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("old-session", result.nativeSessionId);
    Assert.areEqual("grok-test", result.observed.model);
    Assert.areEqual("low", result.observed.effort);
    Assert.areEqual("1.0.30-fixture", result.observed.harnessVersion);
    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Reasoning && t.text === "Reasoning"));
    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Text && t.text === "Hello world"));
    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.Command));
    Assert.isTrue(listener.details.some(t => t.kind === DetailKind.FileChange));
    Assert.isFalse(listener.details.some(t => t.text.includes("replayed history") || t.text.includes("late after response")));
    const switched = await adapter.runTurn(host.request("complete", "old-session", "grok-other"), new RecordingTurnListener(), new AbortController().signal);
    Assert.areEqual("grok-other", switched.observed.model);
    Assert.isFalse(switched.observed.unavailableModel);
  }

  @TestMethod
  public async failsAResumedTurnWhoseModelSwitchIsRefusedWithNoModelObserved(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_SET_MODEL: "fail" });
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.request("complete", "old-session", "grok-other"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.isTrue(result.error?.includes("Model refused") ?? false, result.error ?? "no error");
    Assert.isNull(result.observed.model);
    Assert.isFalse(result.observed.unavailableModel);
    Assert.isFalse(listener.details.some(t => t.text === "Hello world"));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async setsAModelItsSessionOffersAsAConfigOptionAsAModelOfItsOwn(): Promise<void> {
    await using host = new GrokTestHost();
    const options = [{ id: "model", name: "Model", category: "model", type: "select", currentValue: "grok-test",
      options: [{ value: "grok-test", name: "Grok Test" }, { value: "grok-other", name: "Grok Other" }] }];
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_OPTIONS: JSON.stringify(options) });

    const result = await adapter.runTurn(host.request("complete", null, "grok-other"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome, result.error ?? "no error");
    Assert.areEqual("grok-other", result.observed.model);
  }

  @TestMethod
  @TestData("yes")
  @TestData("no")
  public async routesPermissionChoicesWithoutOfferingPersistentGrants(choice: string): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    listener.decisions.push(choice);
    const result = await host.createAdapter().runTurn(host.request("approve"), listener, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isTrue(listener.details.some(t => t.text.includes(`"optionId":"${choice}"`)));
    Assert.areEqual("yes:Approved:Once,no:Denied:Once", listener.asks[0]?.options.map(t => [t.id, t.outcome, t.scope].join(":")).join(","));
  }

  @TestMethod
  public async waitsForTeamRunsToolsThenAsksForAUseToolCallToATeamRunToolOutsideTheListAllowsAReadOnlyOneOnItAndRefusesOneWithoutAskingInATurnWithoutTeamRunsTools(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();
    listener.decisions.push("yes");
    const adapter = host.createAdapter(GrokAdapterTests.offeringHttp(host));
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([{ name: "teamrun_check_provider" }, { name: "teamrun_list_chats" }]),
      callToolAsync: () => Promise.resolve({}) }, ["teamrun_list_chats"], GrokAdapterTests.endpoint());
    const callOf = (tool: string): string => JSON.stringify({ title: "use_tool", rawInput: { tool_name: `teamrun__${tool}`, tool_input_file: "/tmp/arguments.json" } });
    const request = (turnTools: TurnTools | null, tool: string): TurnRequest => new TurnRequest(null, host.directory.path, `use tool ${callOf(tool)}`,
      new RequestedSettings("grok", null, null), null, [], null, null, {}, false, turnTools);

    let settled = false;
    const asking = adapter.runTurn(request(tools, "teamrun_check_provider"), listener, new AbortController().signal).finally(() => { settled = true; });
    await Wait.until(() => host.timer.requested.includes(Resources.teamRunToolsWait), "The adapter did not wait for the TeamRun tools.");
    const waited = !settled && listener.asks.length === 0;
    tools.markListed();
    const asked = await asking;
    const allowed = await adapter.runTurn(request(tools, "teamrun_list_chats"), listener, new AbortController().signal);
    const refused = await adapter.runTurn(request(null, "teamrun_list_chats"), listener, new AbortController().signal);

    Assert.isTrue(waited);
    Assert.areEqual(`${TurnOutcome.Completed},${TurnOutcome.Completed},${TurnOutcome.Completed}`, [asked.outcome, allowed.outcome, refused.outcome].join(","));
    Assert.areEqual("teamrun__teamrun_check_provider: arguments in /tmp/arguments.json", listener.asks.map(t => t.summary).join("|"));
    Assert.areEqual("Tool", listener.asks[0]?.kind);
    Assert.isTrue(listener.texts.some(t => t.includes(`\"optionId\":\"yes\"`)) && listener.texts.some(t => t.includes(`\"optionId\":\"no\"`)));
    Assert.isTrue(listener.texts.includes(Resources.formatRoutedMcpToolRefused(Resources.grokDisplayName, "teamrun__teamrun_list_chats")));
  }

  @TestMethod
  public async writesToItsLogThatThePromptWentWithoutTeamRunsToolsWhenTheirWaitEndsByTime(): Promise<void> {
    await using host = new GrokTestHost();
    const log = new RecordingLog();
    const adapter = host.createAdapter(GrokAdapterTests.offeringHttp(host), host.command, host.terminator, host.timings, undefined, undefined,
      new ElapsedDelayTimer(Resources.teamRunToolsWait), log);
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [], GrokAdapterTests.endpoint());
    const request = new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("grok", null, null), null, [], null, null, {}, false, tools);

    const result = await adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isTrue(log.lines.includes(Resources.formatTeamRunToolsUnlisted(Resources.grokKindId,
      Resources.formatTeamRunToolsTimedOut(Resources.grokDisplayName, Resources.teamRunToolsWait))), log.lines.join("\n"));
  }

  @TestMethod
  public async endsTheWaitForTeamRunsToolsWhenTheTurnFailsAfterTheWaitStarted(): Promise<void> {
    await using host = new GrokTestHost();
    const timer = new HeldDelayTimer(host.timings.killWait, Resources.teamRunToolsWait);
    const adapter = host.createAdapter({ ...GrokAdapterTests.offeringHttp(host), TEAMRUN_FAKE_ACP_SET_MODEL: "fail" }, host.command, host.terminator, host.timings,
      undefined, undefined, timer);
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [], GrokAdapterTests.endpoint());
    const request = new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("grok", "grok-other", null), "old-session", [], null, null, {}, false,
      tools);

    const result = await adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.isTrue(timer.requested.includes(Resources.teamRunToolsWait), timer.requested.join(","));
    Assert.isTrue(timer.aborted.includes(Resources.teamRunToolsWait), timer.aborted.join(","));
  }

  @TestMethod
  public async reachesTeamRunsToolsAtTheEndpointWhenItsInitializeOffersHttpAndStillWaitsForTheirListing(): Promise<void> {
    await using host = new GrokTestHost();
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: false }, mcpCapabilities: { http: true, sse: true }, _meta: GrokAdapterTests.hooks } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) });
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) },
      [], new McpEndpoint("http://127.0.0.1:4711/mcp", new SessionTokens(), "c1/t1"));
    const request = new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("grok", null, null), null, [], null, null, {}, false, tools);

    let settled = false;
    const running = adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal).finally(() => { settled = true; });
    await Wait.until(() => host.timer.requested.includes(Resources.teamRunToolsWait), "The adapter did not wait for the TeamRun tools.");
    const waited = !settled;
    tools.markListed();
    const result = await running;

    const sent = readFileSync(join(host.directory.resolve("person"), "mcp-servers.txt"), "utf8").trimEnd();
    const token = RecordedMcpServers.bearerOf(sent);
    Assert.isTrue(waited);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isTrue(token.length > 0);
    Assert.areEqual(JSON.stringify([{ type: "http", name: "teamrun", url: "http://127.0.0.1:4711/mcp", headers: [{ name: "Authorization", value: `Bearer ${token}` }] }]),
      sent);
  }

  @TestMethod
  public async namesTheBlockGrokLoggedForTeamRunsServerWhenTheWaitForItsToolsEndsByTime(): Promise<void> {
    await using host = new GrokTestHost();
    const log = new RecordingLog();
    mkdirSync(host.directory.resolve("person", ".grok", "logs"), { recursive: true });
    writeFileSync(host.directory.resolve("person", ".grok", "logs", "unified.jsonl"), [
      JSON.stringify({ ts: "2000-01-01T00:00:00.000Z", msg: Resources.grokMcpBlockedMessage, ctx: { server: "teamrun", reason: "an earlier block" } }),
      JSON.stringify({ ts: "2999-01-01T00:00:00.000Z", msg: Resources.grokMcpBlockedMessage, ctx: { server: "teamrun", reason: "locked down by policy (requirements.toml)" } })
    ].join("\n"));
    const adapter = host.createAdapter(GrokAdapterTests.offeringHttp(host), host.command, host.terminator, host.timings, undefined, undefined,
      new ElapsedDelayTimer(Resources.teamRunToolsWait), log);
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([]), callToolAsync: () => Promise.resolve({}) }, [], GrokAdapterTests.endpoint());
    const request = new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("grok", null, null), null, [], null, null, {}, false, tools);

    await adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal);

    const line = Resources.formatTeamRunToolsUnlisted(Resources.grokKindId, Resources.formatTeamRunToolsTimedOut(Resources.grokDisplayName,
      Resources.teamRunToolsWait), "locked down by policy (requirements.toml)");
    Assert.isTrue(log.lines.includes(line), log.lines.join("\n"));
  }

  @TestMethod
  public async reportsEachSharedServerGrokLoggedAsBlockedButNotTeamRunsOwnOrAServerTheTurnDidntPass(): Promise<void> {
    await using host = new GrokTestHost();
    const blocks = (home: string, entries: readonly (readonly [string, string])[]): void => {
      mkdirSync(join(home, "logs"), { recursive: true });
      writeFileSync(join(home, "logs", "unified.jsonl"), entries.map(([server, reason]) =>
        JSON.stringify({ ts: "2999-01-01T00:00:00.000Z", msg: Resources.grokMcpBlockedMessage, ctx: { server, reason } })).join("\n"));
    };
    blocks(host.directory.resolve("person", ".grok"), [["teamrun", "locked down by policy"], ["docs", "not in allowed_mcp_servers"], ["other", "not passed"]]);
    blocks(host.directory.resolve("added"), [["search", "denied by requirements.toml"]]);
    blocks(host.directory.resolve("plain"), [["teamrun", "locked down by policy"], ["other", "not passed"]]);
    const adapter = host.createAdapter(GrokAdapterTests.offeringHttp(host));
    const tools = new TurnTools({ listToolsAsync: () => Promise.resolve([{ name: "teamrun_list_chats" }]), callToolAsync: () => Promise.resolve({}) }, [],
      GrokAdapterTests.endpoint());
    tools.markListed();
    const shared = [new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", ["-y", "search-server"], [], null, [], null),
      new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], null)];
    const provider = (folder: string): Provider => new Provider("a", "grok", "Dedicated", host.directory.resolve(folder), AuthStatus.Unknown, null, null, null,
      null, "t");
    const failuresOf = async (owner: Provider | null): Promise<string> => {
      const listener = new RecordingTurnListener();
      const result = await adapter.runTurn(new TurnRequest(owner, host.directory.path, "complete", new RequestedSettings("grok", null, null), null, [], null, null,
        {}, false, tools, shared), listener, new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, result.outcome);
      return JSON.stringify(listener.sharedFailures.map(t => [t.providerId, t.providerLabel, t.server, t.kind, t.reason]));
    };

    Assert.areEqual(JSON.stringify([[Resources.grokKindId, Resources.grokDisplayName, "docs", SharedMcpFailureKind.Blocked, "not in allowed_mcp_servers"]]),
      await failuresOf(null));
    Assert.areEqual(JSON.stringify([["a", "Dedicated", "search", SharedMcpFailureKind.Blocked, "denied by requirements.toml"]]), await failuresOf(provider("added")));
    Assert.areEqual("[]", await failuresOf(provider("plain")));
  }

  @TestMethod
  public async logsWhyANoteOnABlockedSharedServerCouldntReachTheChatAndStillCompletesTheTurn(): Promise<void> {
    await using host = new GrokTestHost();
    const home = host.directory.resolve("person", ".grok");
    mkdirSync(join(home, "logs"), { recursive: true });
    writeFileSync(join(home, "logs", "unified.jsonl"),
      JSON.stringify({ ts: "2999-01-01T00:00:00.000Z", msg: Resources.grokMcpBlockedMessage, ctx: { server: "docs", reason: "not in allowed_mcp_servers" } }));
    const log = new RecordingLog();
    const listener = new RecordingTurnListener();
    listener.sharedFailureError = new Error("The chat is gone.");
    const docs = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], null);

    const result = await host.createAdapter(GrokAdapterTests.offeringHttp(host), host.command, host.terminator, host.timings, undefined, undefined, undefined, log)
      .runTurn(new TurnRequest(null, host.directory.path, "complete", new RequestedSettings("grok", null, null), null, [], null, null, {}, false, null, [docs]),
        listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isTrue(log.lines.includes(Resources.formatBlockedServersUnnoted(Resources.grokKindId, "The chat is gone.")), log.lines.join("\n"));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async reportsASharedServerGrokLogsAsBlockedOnlyOnceTheSessionStartedFromItsReadAtTheTurnsEndWhetherTheReplyCompletesOrIsInterrupted(
    interrupted: boolean): Promise<void> {
    await using host = new GrokTestHost();
    const home = host.directory.resolve("person", ".grok");
    const controller = new AbortController();
    const listener = new BlockingOnReplyListener(() => {
      mkdirSync(join(home, "logs"), { recursive: true });
      writeFileSync(join(home, "logs", "unified.jsonl"),
        JSON.stringify({ ts: "2999-01-01T00:00:00.000Z", msg: Resources.grokMcpBlockedMessage, ctx: { server: "docs", reason: "not in allowed_mcp_servers" } }));
      if (interrupted)
        controller.abort();
    });
    const docs = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], null);

    const result = await host.createAdapter(GrokAdapterTests.offeringHttp(host)).runTurn(new TurnRequest(null, host.directory.path, "noticed",
      new RequestedSettings("grok", null, null), null, [], null, null, {}, false, null, [docs]), listener, controller.signal);

    Assert.areEqual(interrupted ? TurnOutcome.Interrupted : TurnOutcome.Completed, result.outcome);
    Assert.isTrue(listener.blocked);
    Assert.areEqual(JSON.stringify([["docs", SharedMcpFailureKind.Blocked, "not in allowed_mcp_servers"]]),
      JSON.stringify(listener.sharedFailures.map(t => [t.server, t.kind, t.reason])));
  }

  @TestMethod
  @TestData(false)
  @TestData(true)
  public async cancelsAndStopsEvenWhenTheAgentIgnoresCancellation(ignore: boolean): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_IGNORE_CANCEL: ignore ? "1" : "0" }, host.command, host.terminator,
      ignore ? host.ignoredCancelTimings : host.timings);
    const controller = new AbortController();
    const listener = new RecordingTurnListener();
    const run = adapter.runTurn(host.request("cancel"), listener, controller.signal);
    await Wait.until(() => listener.details.some(t => t.text === "working"), "The listener did not see 'working'.");
    controller.abort();
    Assert.areEqual(TurnOutcome.Interrupted, (await run).outcome);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
    Assert.areEqual(TurnOutcome.Interrupted, (await adapter.runTurn(host.request("complete"), listener, controller.signal)).outcome);
  }

  @TestMethod
  public async showsEachCompactionOnceAfterTheTextBeforeItAndFailsATurnWhoseContextIsFull(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const compacted = await adapter.runTurn(host.request("compact"), listener, new AbortController().signal);
    const full = await adapter.runTurn(host.request("full"), new RecordingTurnListener(), new AbortController().signal);
    const refused = await adapter.runTurn(host.request("notFull"), new RecordingTurnListener(), new AbortController().signal);
    const twice = new RecordingTurnListener();
    await adapter.runTurn(host.request("compactTwice"), twice, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, compacted.outcome);
    Assert.areEqual(JSON.stringify(["Before", "Grok compacted its context.", "After", "Grok compacted its context."]),
      JSON.stringify(listener.details.filter(t => t.kind === DetailKind.Text || t.text.includes("compacted")).map(t => t.text)));
    Assert.areEqual(TurnOutcome.Failed, full.outcome);
    Assert.areEqual("Grok's context is full. Send /compact to compact it, then retry.", full.error);
    Assert.areNotEqual("Grok's context is full. Send /compact to compact it, then retry.", refused.error);
    Assert.areEqual(JSON.stringify(["Grok compacted its context.", "Grok compacted its context.", "Between", "Grok compacted its context.",
      "Grok compacted its context."]),
      JSON.stringify(twice.details.filter(t => t.kind === DetailKind.Text || t.text.includes("compacted")).map(t => t.text)));
  }

  @TestMethod
  public async reportsStartupTurnAndSelectionFailuresWithoutSubstitutingModels(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    for (const request of [host.request("exit"), host.request("reject"), host.request("limit"), host.request("complete", null, "grok-test", "unsupported")]) {
      const result = await adapter.runTurn(request, new RecordingTurnListener(), new AbortController().signal);
      Assert.areEqual(TurnOutcome.Failed, result.outcome);
      Assert.isNull(result.action);
    }
    const unoffered = await adapter.runTurn(host.request("complete", null, "grok-4.7"), new RecordingTurnListener(), new AbortController().signal);
    Assert.areEqual(TurnOutcome.Failed, unoffered.outcome);
    Assert.areEqual("Grok doesn't offer the model grok-4.7. Open the teammate or the composer's model menu, refresh the models, and choose one.", unoffered.error);
    Assert.areEqual(ReplyAction.ChooseModel, unoffered.action);
    const loggedOut = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" });
    Assert.areEqual(TurnOutcome.Failed, (await loggedOut.runTurn(host.request("complete"), new RecordingTurnListener(), new AbortController().signal)).outcome);
    const missing = host.createAdapter(host.environment, new ProcessCommand("teamrun-missing-grok", []));
    await Assert.throwsAsync(() => missing.listModels(null), Error);
  }

  @TestMethod
  public async listsTheCatalogGrokLoadsAfterItsFirstAnswerListedOnlyItsBuiltInModels(): Promise<void> {
    await using host = new GrokTestHost();
    const loading = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MODELS: "grok-4.6,grok-4.5",
      TEAMRUN_FAKE_ACP_LISTED_MODELS: "grok-4.7,grok-4.6,grok-4.5" });
    const plain = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MODELS: "grok-4.6,grok-4.5", TEAMRUN_FAKE_ACP_LISTED_MODELS: "grok-4.7,grok-4.6",
      TEAMRUN_FAKE_ACP_MODEL_LIST: "plain" });

    const list = await loading.listModels(null);
    const unprefixed = await plain.listModels(null);
    const asked = GrokAdapterTests.usageRequests(host);
    const loaded = await host.createAdapter().listModels(null);

    Assert.areEqual("grok-4.7:true,grok-4.6:false,grok-4.5:false", list.models.map(t => `${t.id}:${String(t.isDefault)}`).join(","));
    Assert.isFalse(list.empty);
    Assert.areEqual("grok-4.7,grok-4.6", unprefixed.models.map(t => t.id).join(","));
    Assert.areEqual("_x.ai/models/list,_x.ai/models/list,x.ai/models/list", asked);
    Assert.areEqual("grok-test,grok-other", loaded.models.map(t => t.id).join(","));
    Assert.areEqual(asked, GrokAdapterTests.usageRequests(host));
  }

  @TestMethod
  public async givesUpOnACatalogGrokNeverAnswersAfterTheModelListTimeoutRatherThanTheRequestTimeout(): Promise<void> {
    await using host = new GrokTestHost();
    const timings = new ProviderTimings(2000, 2000, 10_000, 600_000, 100, 100, 100, 5000, 100, 1, 10, Resources.wakeGrace, Resources.taskOutputFollowInterval,
      Resources.accountTimeout, 100);
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MODELS: "grok-4.6,grok-4.5", TEAMRUN_FAKE_ACP_MODEL_LIST: "hang" }, host.command,
      host.terminator, timings);

    const list = await adapter.listModels(null);

    Assert.areEqual(0, list.models.length);
    Assert.isTrue(list.empty);
    Assert.areEqual("_x.ai/models/list", GrokAdapterTests.usageRequests(host));
  }

  @TestMethod
  @TestData("")
  @TestData("unknown")
  @TestData("fail")
  @TestData("error")
  @TestData("invalid")
  public async takesAListOfOnlyGrokBuiltInModelsForACatalogNotYetLoaded(modelList: string): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MODELS: "grok-4.6,grok-4.5",
      ...modelList === "" ? {} : { TEAMRUN_FAKE_ACP_MODEL_LIST: modelList } });

    const list = await adapter.listModels(null);
    const late = await adapter.runTurn(host.request("complete", null, "grok-4.7"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(0, list.models.length);
    Assert.isTrue(list.empty);
    Assert.areEqual(TurnOutcome.Failed, late.outcome);
    Assert.areEqual("Grok hasn't loaded its models yet, so it can't use grok-4.7 now. Try again in a moment.", late.error);
    Assert.isNull(late.action);
  }

  @TestMethod
  public async stopsItsAgentsOnTheTimerItIsGiven(): Promise<void> {
    await using host = new GrokTestHost();
    const timer = new ManualTimer();
    const adapter = new GrokAdapter(host.command, { ...host.environment, TEAMRUN_FAKE_ACP_STAY_OPEN: "1" }, host.directory.resolve("profile"), host.info,
      host.programs.wrap(host.starter), host.timings, timer);
    const models = adapter.listModels(null);
    await timer.delayed;
    timer.advance(host.timings.stopGrace);
    Assert.areEqual(2, (await models).models.length);
    Assert.areEqual(0, timer.pending);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async leavesOutUnadvertisedImagesWithALineAndEncodesThemOnlyWhenAdvertised(): Promise<void> {
    await using host = new GrokTestHost();
    const path = host.directory.resolve("image.png");
    writeFileSync(path, "fixture-image");
    const request = new TurnRequest(null, host.directory.path, "images", new RequestedSettings("grok", null, null), null,
      [new MessageAttachment("image.png", "image/png", 13, path)]);
    const encoded = Buffer.from("fixture-image").toString("base64");
    const leftOut = JSON.stringify(CoreResources.formatImagesLeftOut("images", [JSON.stringify("image.png")])).slice(1, -1);
    const without = new RecordingTurnListener();
    Assert.areEqual(TurnOutcome.Completed, (await host.createAdapter().runTurn(request, without, new AbortController().signal)).outcome);
    Assert.isTrue(without.details.some(t => t.text.includes(leftOut)));
    Assert.isFalse(without.details.some(t => t.text.includes(encoded)));
    const listener = new RecordingTurnListener();
    const result = await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "images" }).runTurn(request, listener, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.isTrue(listener.details.some(t => t.text.includes(encoded)));
    Assert.isFalse(listener.details.some(t => t.text.includes(leftOut)));
  }

  @TestMethod
  public async startsAFreshSessionOnTheFreshPromptWhenTheResumeFailsAndResumesItNext(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.request("exit", "missing", null, null, "role-payload"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("grok-session", result.nativeSessionId);
    Assert.isFalse(listener.starts[0]?.resumedNativeSession ?? true);
    Assert.isTrue(listener.texts[0]?.startsWith("The native session could not be resumed, so a fresh one was started: ") ?? false);
    Assert.isTrue(listener.texts[0]?.includes("Session not found") ?? false);
    Assert.isTrue(listener.texts.some(t => t.includes("role-payload")));

    const next = new RecordingTurnListener();
    const resumed = await adapter.runTurn(host.request("complete", result.nativeSessionId), next, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
    Assert.areEqual("grok-session", resumed.nativeSessionId);
    Assert.isTrue(next.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(0, next.texts.filter(t => t.includes("could not be resumed")).length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async startsANewGrokWhenGrokExitsDuringTheResumeAndResumesItsSessionNext(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.request("exit", "crash", null, null, "role-payload"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual("grok-session", result.nativeSessionId);
    Assert.isFalse(listener.starts[0]?.resumedNativeSession ?? true);
    Assert.isTrue(listener.texts[0]?.startsWith("The native session could not be resumed, so a fresh one was started: ") ?? false);
    Assert.isTrue(listener.texts.some(t => t.includes("role-payload")));
    Assert.areEqual(2, host.programs.started.length);

    const next = new RecordingTurnListener();
    const resumed = await adapter.runTurn(host.request("complete", result.nativeSessionId), next, new AbortController().signal);
    Assert.areEqual(TurnOutcome.Completed, resumed.outcome);
    Assert.areEqual("grok-session", resumed.nativeSessionId);
    Assert.isTrue(next.starts[0]?.resumedNativeSession ?? false);
    Assert.areEqual(0, next.texts.filter(t => t.includes("could not be resumed")).length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async startsNoNewGrokWhenTheAdapterShutsDownWhileTheStoppedGrokCloses(): Promise<void> {
    await using host = new GrokTestHost();
    const timings = new ProviderTimings(2000, 2000, 10_000, 2000, 100, 100, host.timings.killWait, host.timings.killWait, 100, 1, 10);
    const adapter = host.createAdapter(host.environment, host.command, host.terminator, timings);
    const listener = new RecordingTurnListener();

    const running = adapter.runTurn(host.request("complete", "garble"), listener, new AbortController().signal);
    await Wait.until(() => existsSync(join(host.directory.resolve("person"), "load-closed.txt")), "The fake did not write load-closed.txt.");
    const stopping = adapter.shutdown();
    process.kill(host.programs.started[0]!.processId);
    await stopping;

    Assert.areEqual(TurnOutcome.Failed, (await running).outcome);
    Assert.areEqual(0, listener.starts.length);
    Assert.areEqual(0, listener.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual(1, host.programs.started.length);
    Assert.areEqual(1, host.programs.ended.length);
  }

  @TestMethod
  public async failsTheTurnAndLeavesNoGrokRunningWhenTheNewGrokCantSignIn(): Promise<void> {
    await using host = new GrokTestHost();
    const listener = new RecordingTurnListener();

    const result = await host.createAdapter().runTurn(host.request("exit", "crash-signin", null, null, "role-payload"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, result.outcome);
    Assert.isTrue(result.error?.includes("Authentication refused") ?? false);
    Assert.areEqual(0, listener.starts.length);
    Assert.areEqual(0, listener.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual(2, host.programs.started.length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async startsNoNewGrokWhenTheAdapterShutsDownOrTheTurnIsAbortedDuringTheResume(): Promise<void> {
    await using stopping = new GrokTestHost();
    const stopped = stopping.createAdapter();
    const shut = new RecordingTurnListener();
    const holding = stopped.runTurn(stopping.request("complete", "hold"), shut, new AbortController().signal);
    await Wait.until(() => existsSync(join(stopping.directory.resolve("person"), "load-held.txt")), "The fake did not write load-held.txt.");
    await stopped.shutdown();
    Assert.areEqual(TurnOutcome.Failed, (await holding).outcome);
    Assert.areEqual(0, shut.starts.length);
    Assert.areEqual(0, shut.texts.filter(t => t.includes("could not be resumed")).length);
    Assert.areEqual(1, stopping.programs.started.length);
    Assert.areEqual(1, stopping.programs.ended.length);

    await using host = new GrokTestHost();
    const adapter = host.createAdapter();
    const controller = new AbortController();
    const held = new RecordingTurnListener();
    const marker = join(host.directory.resolve("person"), "load-held.txt");
    const running = adapter.runTurn(host.request("complete", "hold"), held, controller.signal);
    await Wait.until(() => existsSync(marker), "The marker file was not written.");
    controller.abort();
    Assert.areEqual(TurnOutcome.Interrupted, (await running).outcome);
    Assert.areEqual(0, held.starts.length);
    Assert.areEqual(0, held.texts.filter(t => t.includes("could not be resumed")).length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  @TestData("", "_x.ai/session/info,_x.ai/billing", "31000/200000/170000")
  @TestData("plain", "_x.ai/session/info,x.ai/session/info,_x.ai/billing", "31000/200000/170000")
  @TestData("unknown", "_x.ai/session/info,x.ai/session/info,_x.ai/billing", "none")
  @TestData("fail", "_x.ai/session/info,_x.ai/billing", "none")
  public async reportsTheReplysTokensAndCostAndTheContextFromTheSessionInfo(mode: string, methods: string, context: string): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_SESSION_INFO: mode });
    const listener = new RecordingTurnListener();

    const result = await adapter.runTurn(host.request("usage"), listener, new AbortController().signal);

    Assert.areEqual(TurnOutcome.Completed, result.outcome);
    Assert.areEqual(`null null null 30000/200000/null,1200 300 0.0025 ${context}`, listener.usages.map(GrokAdapterTests.formatUsage).join(","));
    Assert.areEqual(methods, GrokAdapterTests.usageRequests(host));
  }

  @TestMethod
  @TestData("", "_x.ai/billing", "WeeklyCredits 37.5 2026-10-27T00:00:00.000Z")
  @TestData("plain", "_x.ai/billing,x.ai/billing", "WeeklyCredits 37.5 2026-10-27T00:00:00.000Z")
  @TestData("unknown", "_x.ai/billing,x.ai/billing", "none")
  @TestData("fail", "_x.ai/billing", "none")
  public async readsThePlanUseFromTheBillingAndNothingWhenGrokCannotSay(mode: string, methods: string, plan: string): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_BILLING: mode });

    const usage = await adapter.readPlanUsage(null);

    Assert.areEqual(plan, Object.isNull(usage) ? "none" : usage.windows.map(t => `${t.name} ${t.usedPercent} ${t.resetsAt}`).join(","));
    Assert.areEqual(methods, GrokAdapterTests.usageRequests(host));
    Assert.isNull(await host.createAdapter(host.environment, null).readPlanUsage(null));
    Assert.isNull(await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut", TEAMRUN_FAKE_ACP_BILLING: mode }).readPlanUsage(null));
    Assert.areEqual(methods, GrokAdapterTests.usageRequests(host));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  @TestData("", "_x.ai/mcp/list", "docs Configured,linear Configured")
  @TestData("plain", "_x.ai/mcp/list,x.ai/mcp/list", "docs Configured,linear Configured")
  @TestData("unknown", "_x.ai/mcp/list,x.ai/mcp/list", "none")
  public async listsItsOwnMcpServersFromItsListWithoutASessionOrTeamRunsOwnEachNameOnceAndNoneWhenGrokOffersNoList(mode: string, methods: string, servers: string): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MCP_LIST: mode });

    const listed = await adapter.listOwnMcpServers(null);

    Assert.areEqual(servers, Object.isNull(listed) ? "none" : listed.map(t => `${t.name} ${t.state}`).join(","));
    Assert.areEqual(methods, GrokAdapterTests.usageRequests(host));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async failsItsOwnMcpServerListWhenGrokFailsItAnswersAnotherShapeIsSignedOutOrIsNotFound(): Promise<void> {
    await using host = new GrokTestHost();

    const failed = await Assert.throwsAsync(() => host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MCP_LIST: "fail" }).listOwnMcpServers(null), Error);
    const invalid = await Assert.throwsAsync(() => host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_MCP_LIST: "invalid" }).listOwnMcpServers(null),
      JsonException);
    const signedOut = await Assert.throwsAsync(() => host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_INIT: "loggedOut" }).listOwnMcpServers(null),
      Error);
    await Assert.throwsAsync(() => host.createAdapter(host.environment, null).listOwnMcpServers(null), Error);

    Assert.areEqual("Usage unavailable", failed.message);
    Assert.areEqual("$.servers", invalid.path);
    Assert.areEqual(Resources.formatGrokSignIn(host.directory.resolve("person", ".grok")), signedOut.message);
    Assert.areEqual("_x.ai/mcp/list,_x.ai/mcp/list", GrokAdapterTests.usageRequests(host));
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async readsThePlanUseAfterEachReplySoASecondReplyMovesItAndNothingWhenGrokCannotSay(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter(host.environment);
    const first = new RecordingTurnListener();
    const second = new RecordingTurnListener();
    const silent = new RecordingTurnListener();

    await adapter.runTurn(host.request("usage"), first, new AbortController().signal);
    await adapter.runTurn(host.request("usage"), second, new AbortController().signal);
    await host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_BILLING: "unknown" }).runTurn(host.request("usage"), silent, new AbortController().signal);

    Assert.areEqual("WeeklyCredits 37.5|WeeklyCredits 47.5", [...first.planUsages, ...second.planUsages].map(t => t.map(w => `${w.name} ${w.usedPercent}`).join(",")).join("|"));
    Assert.areEqual(0, silent.planUsages.length);
    await host.programs.endedAt(host.programs.started.length);
    Assert.areEqual(host.programs.started.length, host.programs.ended.length);
  }

  @TestMethod
  public async doesOnItsDoubleWhatItsAbilityRowSays(): Promise<void> {
    await using host = new GrokTestHost();
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: true }, mcpCapabilities: { http: true }, _meta: GrokAdapterTests.hooks },
      _meta: { agentVersion: "1.0.30-fixture", modelState: JsonReader.fromValue(GrokModelStateRecording.initialized).readObject("_meta").readObject("modelState").toJson() } };
    const adapter = host.createAdapter({ ...host.environment, TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) });
    const provider = new Provider("g", "grok", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "t");
    const turns = new TurnAbilityProbes(adapter, (prompt, resume, attachments) => new TurnRequest(null, host.directory.path, prompt,
      new RequestedSettings("grok", null, null), resume, attachments), host.directory.path);

    await AbilityChecks.runAsync(adapter.descriptor, {
      ...AbilityChecks.surface(adapter, provider, () => adapter.listModels(provider)),
      [ProviderAbility.ChooseSpeed]: AbilityChecks.listsModel(() => adapter.listModels(provider), "grok-4.7-build-fast"),
      ...turns.probes({ [ProviderAbility.Questions]: "grok-question", [ProviderAbility.PlanChecklist]: "plan", [ProviderAbility.ReplyUsage]: "usage",
        [ProviderAbility.SubAgentRows]: "background-sub-agent", [ProviderAbility.BackgroundCommands]: "background", [ProviderAbility.GeneratedImages]: "image",
        [ProviderAbility.PermissionCards]: "approve", [ProviderAbility.SteerTurn]: "cancel" }),
      ...turns.subAgents("background-sub-agent"),
      [ProviderAbility.ApprovedTools]: () => turns.runsApprovedToolAsync({ title: Resources.grokRoutedMcpTool,
        rawInput: { variant: "UseTool", tool_name: `teamrun__${TurnAbilityProbes.approvedTool}`, tool_input: {} } })
    });
  }

  @TestMethod
  public async sendsGrokThePlanToolRuleWithTheTeammatesInstructions(): Promise<void> {
    await using host = new GrokTestHost();

    await PlanToolRule.expectSentAsync(host.createAdapter(), host.request("role-payload"));
  }

  private static async leavePlanAsync(host: GrokTestHost, mode: string, setMode: string | null): Promise<string> {
    const adapter = host.createAdapter(Object.isNull(setMode) ? host.environment : { ...host.environment, TEAMRUN_FAKE_ACP_SET_MODE: setMode });
    const asked = host.request("plan-left-for-default", null, null, null, null, mode);
    const listener = new RecordingTurnListener();
    listener.decisions.push(Resources.acpApprovePlanOption, "allow-once");
    const turn = await adapter.runTurn(asked.withRequested(asked.requested.withPlanFirst(true)), listener, new AbortController().signal);
    const refused = listener.texts.filter(t => t.startsWith(GrokAdapterTests.editRefused)).length;
    const answers = listener.texts.filter(t => t.includes("\"sets\"")).join("|");
    return [turn.outcome, listener.asks.length, String(turn.error), refused, answers].join(" ");
  }

  private static modesSet(listener: RecordingTurnListener): string {
    const echoed = listener.texts.find(t => t.startsWith("{\"methods\""));
    if (Object.isUndefined(echoed))
      throw new Error("Grok was sent no prompt, so it echoed no modes set.");
    return JsonReader.parse(echoed).readStringArray("sets").join(",");
  }

  private static offeringHttp(host: GrokTestHost): NodeJS.ProcessEnv {
    const capabilities = { agentCapabilities: { loadSession: true, promptCapabilities: { image: false }, mcpCapabilities: { http: true, sse: true }, _meta: GrokAdapterTests.hooks } };
    return { ...host.environment, TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify(capabilities) };
  }

  private static endpoint(): McpEndpoint {
    return new McpEndpoint("http://127.0.0.1:4711/mcp", new SessionTokens(), "c1/t1");
  }

  @TestMethod
  public async registersItsReadOnlyHookOnEachNewAndLoadedSessionOnlyWhenGrokOffersToRefuseACall(): Promise<void> {
    await using host = new GrokTestHost();
    await using plain = new GrokTestHost();
    const first = await host.createAdapter().runTurn(host.request("Hello"), new RecordingTurnListener(), new AbortController().signal);
    await host.createAdapter().runTurn(host.request("Again", first.nativeSessionId), new RecordingTurnListener(), new AbortController().signal);
    await plain.createAdapter(GrokAdapterTests.withoutHooks(plain)).runTurn(plain.request("Hello"), new RecordingTurnListener(), new AbortController().signal);

    const hooks = JSON.stringify({ "x.ai/hooks": { PreToolUse: [{ hookCallbackIds: ["teamrun-read-only-chat"] }] } });
    Assert.areEqual(`session/new ${hooks}\nsession/load ${hooks}\nsession/new null`,
      [host, plain].map(t => readFileSync(join(t.directory.resolve("person"), "session-meta.txt"), "utf8").trim()).join("\n"));
  }

  @TestMethod
  public async refusesEachToolGrokDoesntMarkReadOnlyInAReadOnlyChatThroughItsHookAheadOfGrokRulesAndLetsOtherChatsGoOn(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter();

    const answers = [await GrokAdapterTests.gateAsync(host, adapter, "gated-edit:write", "ask"), await GrokAdapterTests.gateAsync(host, adapter, "gated-read:read_file", "ask"),
      await GrokAdapterTests.gateAsync(host, adapter, "gated-unknown", "ask"), await GrokAdapterTests.gateAsync(host, adapter, "gated-edit:write", "default")];

    const refused = (tool: string): string =>
      JSON.stringify({ gate: { decision: "deny", reason: Resources.formatReadOnlyToolRefused(Resources.grokDisplayName, tool) } });
    Assert.areEqual([`${TurnOutcome.Completed} ${refused("Gated edit")}`, `${TurnOutcome.Completed} {"gate":{}}`, `${TurnOutcome.Completed} ${refused("Gated unknown")}`,
      `${TurnOutcome.Completed} {"gate":{}}`].join("\n"), answers.join("\n"));
  }

  @TestMethod
  public async refusesAReadOnlyChatOnAGrokThatOffersNoHookAndRunsOtherChatsThere(): Promise<void> {
    await using host = new GrokTestHost();
    const adapter = host.createAdapter(GrokAdapterTests.withoutHooks(host));

    const asked = await adapter.runTurn(host.request("gated-edit:write", null, null, null, null, "ask"), new RecordingTurnListener(), new AbortController().signal);
    const chatted = await GrokAdapterTests.gateAsync(host, adapter, "gated-edit:write", "default");

    Assert.areEqual(`${TurnOutcome.Failed}:${Resources.formatModeUnavailable(Resources.grokDisplayName, "Ask")}|${TurnOutcome.Completed} {"gate":{}}`,
      `${asked.outcome}:${String(asked.error)}|${chatted}`);
  }

  private static async gateAsync(host: GrokTestHost, adapter: GrokAdapter, prompt: string, mode: string): Promise<string> {
    const listener = new RecordingTurnListener();
    const turn = await adapter.runTurn(host.request(prompt, null, null, null, null, mode), listener, new AbortController().signal);
    return `${turn.outcome} ${listener.texts.find(t => t.startsWith("{\"gate\"")) ?? "no answer"}`;
  }

  private static withoutHooks(host: GrokTestHost): NodeJS.ProcessEnv {
    return { ...host.environment, TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify({ agentCapabilities: { loadSession: true, promptCapabilities: { image: false } } }) };
  }

  private static formatUsage(usage: ReplyUsage): string {
    const context = Object.isNull(usage.context) ? "none" : `${usage.context.usedTokens}/${usage.context.windowTokens}/${usage.context.compactAtTokens}`;
    return `${usage.inputTokens} ${usage.outputTokens} ${usage.costUsd} ${context}`;
  }

  private static usageRequests(host: GrokTestHost): string {
    return readFileSync(join(host.directory.resolve("person"), "usage-requests.txt"), "utf8").trimEnd().split("\n").join(",");
  }

  private static async abortingWhileReading<T>(path: string, controller: AbortController, action: () => Promise<T>): Promise<T> {
    const original = fsPromises.readFile;
    const read = mock.method(fsPromises, "readFile", (...args: Parameters<typeof original>): ReturnType<typeof original> => {
      if (args[0] === path)
        controller.abort();
      return original(...args);
    });
    syncBuiltinESMExports();
    try {
      return await action();
    }
    finally {
      read.mock.restore();
      syncBuiltinESMExports();
    }
  }
}
