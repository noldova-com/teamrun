/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { TurnOutcome } from "@noldova/teamrun.core";
import { AuthStatus, Provider, SharedMcpServerDefinition, SharedMcpTransport } from "@noldova/teamrun.protocol";
import { CommandSource, ExecutableNotFoundException, GeneralAcpAgent, ProcessCommand, ProviderAbilityTable, Resources, SignInException } from "@noldova/teamrun.providers";

import { GrokTestHost } from "../../fixtures/grok-test-host.fixture.js";
import { RecordingTurnListener } from "../../fixtures/recording-turn-listener.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

const COMMAND = new ProcessCommand("devin", ["acp"]);

@TestClass
export class GeneralAcpAgentTests {
  @TestMethod
  public tellsItsTeammatesTheirBackgroundSubAgentsEndWithTheirTurn(): void {
    Assert.areEqual(Resources.acpBackgroundSubAgentsNote, new GeneralAcpAgent("devin", "Devin", COMMAND, {}, {}, "home").backgroundSubAgentsNote);
  }

  @TestMethod
  public describesAKindThatSignsInAndOutThroughAcpAndResumesButCantFork(): void {
    const agent = new GeneralAcpAgent("devin", "Devin", COMMAND, {}, {}, "home");
    const descriptor = agent.descriptor;

    Assert.areEqual("devin:Devin:true:true:false:true:true:null", [descriptor.id, descriptor.displayName, descriptor.supportsResume, descriptor.supportsSignInCheck,
      descriptor.supportsFork, descriptor.supportsSignIn, descriptor.supportsSignOut, descriptor.profile].map(String).join(":"));
    Assert.areEqual(`${descriptor.displayName} can't switch on its own MCP servers here: ${Resources.fxOwnServersSwitchAbility}.`, descriptor.ownMcpServersUnavailable);
    Assert.areEqual(Resources.formatGeneralAcpSingleAccount("Devin"), descriptor.singleAccount);
    Assert.isTrue(descriptor.abilities === ProviderAbilityTable.acpAgent);
    Assert.isTrue(descriptor.confirmsSignInAtPrompt);
    Assert.areEqual("Devin tool", agent.toolTitle);
    Assert.areEqual("false:true:false:true:true:0", [agent.authenticates, agent.logsOut, agent.compacts, agent.compactsIfListed, agent.runsTerminals, agent.forkMethods.length].join(":"));
    Assert.isNull(agent.isSignedIn(null));
    Assert.isNull(agent.formatUnsupported("0.0.1"));
    Assert.isNull(agent.memberOf("swe-1-6-fast", "SWE 1.6 Fast"));
    Assert.isNull(agent.readEffort(JsonReader.fromValue({})));
    Assert.isNull(agent.sessionMeta());
    Assert.areEqual(Resources.formatGeneralAcpStopped("Devin", "max_tokens"), agent.formatStopped("max_tokens"));
    Assert.areEqual(Resources.formatGeneralAcpSignIn("Devin"), agent.formatSignIn(null));
  }

  @TestMethod
  public launchesItsCommandWithItsVariablesInTheTurnsFolderOrItsHome(): void {
    const agent = new GeneralAcpAgent("droid", "Droid", COMMAND, { DROID_DISABLE_AUTO_UPDATE: "true", PATH: "agent" }, { PATH: "person", HOME: "home" }, "home");

    const turn = agent.launch(null, null, "chat");
    const check = agent.launch(null, null, null, null, { HOME: "other" });

    Assert.areEqual("devin|acp|chat|true|agent|home", [turn.command.executable, turn.command.arguments.join(" "), turn.directory, turn.environment["DROID_DISABLE_AUTO_UPDATE"],
      turn.environment["PATH"], turn.environment["HOME"]].join("|"));
    Assert.areEqual("home|other|true", [check.directory, check.environment["HOME"], check.environment["DROID_DISABLE_AUTO_UPDATE"]].join("|"));
  }

  @TestMethod
  public leavesCredentialsAndOtherProvidersSettingsOutOfItsEnvironmentAndKeepsItsOwnVariables(): void {
    const person = { PATH: "path", HOME: "home", USERPROFILE: "profile", APPDATA: "appdata", LANG: "en_US.UTF-8", OPENAI_API_KEY: "openai", GITHUB_TOKEN: "github",
      ANTHROPIC_BASE_URL: "anthropic", AWS_PROFILE: "aws", MY_SECRET: "mine", CODEX_HOME: "codex", DB_PASS: "db", SMTP_PASS: "smtp", DB_PASSWD: "db", MYSQL_PWD: "mysql",
      SESSION_COOKIE: "cookie", API_JWT: "jwt", MY_BEARER: "bearer", PWD: "folder", OLDPWD: "earlier" };
    const agent = new GeneralAcpAgent("devin", "Devin", COMMAND, { DEVIN_API_KEY: "devin" }, person, "home");

    const environment = agent.launch(null, null).environment;

    Assert.areEqual("APPDATA,DEVIN_API_KEY,HOME,LANG,OLDPWD,PATH,PWD,USERPROFILE", Object.keys(environment).sort().join(","));
    Assert.areEqual("devin|path", `${environment["DEVIN_API_KEY"]}|${environment["PATH"]}`);
  }

  @TestMethod
  public async takesNoSharedServerUntilACaptureShowsWhatTheAgentKeeps(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new GeneralAcpAgent("devin", "Devin", COMMAND, {}, {}, "home");
    const adapter = host.createAcpAdapter(agent);
    const stdio = new SharedMcpServerDefinition("search", SharedMcpTransport.Stdio, "npx", [], ["SEARCH_KEY"], null, [], null);
    const http = new SharedMcpServerDefinition("docs", SharedMcpTransport.Http, null, [], [], "https://docs.example/mcp", [], "DOCS_TOKEN");

    Assert.areEqual("0|null", `${agent.sharedServerTransports.length}|${agent.sharedServerRefusal}`);
    Assert.areEqual(JSON.stringify([Resources.formatSharedMcpUnconfirmed("Devin"), "not confirmed yet"]),
      JSON.stringify([adapter.sharedServerUnavailable(stdio)?.reason, adapter.sharedServerUnavailable(stdio)?.short]));
    Assert.areEqual(Resources.formatSharedMcpUnconfirmed("Devin"), adapter.sharedServerUnavailable(http)?.reason);
  }

  @TestMethod
  public findsItsCommandWhenItIsInstalledAndFailsUntilThen(): void {
    let installed: ProcessCommand | null = null;
    const agent = new GeneralAcpAgent("devin", "Devin", null, {}, {}, "home", () => installed);

    Assert.areEqual(Resources.formatGeneralAcpNotFound("Devin"), Assert.throws(() => agent.launch(null, null), ExecutableNotFoundException).message);
    installed = COMMAND;
    Assert.areEqual("devin", agent.launch(null, null).command.executable);
  }

  @TestMethod
  public readsItsVariablesAtEachLaunchAndFailsWithTheReasonWhenTheyCantBeRead(): void {
    let mode = "first";
    const reading = new GeneralAcpAgent("devin", "Devin", COMMAND, () => ({ MODE: mode }), {}, "home");
    const refused = new GeneralAcpAgent("devin", "Devin", COMMAND, () => {
      throw new Error("The value can't be read.");
    }, {}, "home");

    Assert.areEqual("first", reading.launch(null, null).environment["MODE"]);
    mode = "second";
    Assert.areEqual("second", reading.launch(null, null).environment["MODE"]);
    Assert.areEqual("The value can't be read.", Assert.throws(() => refused.launch(null, null), Error).message);
  }

  @TestMethod
  public asksForItsCommandAtEachLaunchSoAnUpdateTakesEffect(): void {
    let version = "1.0.0";
    const agent = new GeneralAcpAgent("devin", "Devin", null, {}, {}, "home", () => new ProcessCommand(version, []));

    Assert.areEqual("1.0.0", agent.launch(null, null).command.executable);
    version = "2.0.0";
    Assert.areEqual("2.0.0", agent.launch(null, null).command.executable);
  }

  @TestMethod
  public readsATerminalSignInAsAPlainCommandWithItsFolderOnThePath(): void {
    const folder = join("installs", "devin", "1.0.0", "bin");
    const agent = new GeneralAcpAgent("devin", "Devin", null, {}, { Path: "person" }, "home", CommandSource.none, () => join(folder, "devin"));
    const read = (value: object): string | null => {
      const command = agent.readTerminalSignIn(JsonReader.fromValue(value));
      return Object.isNull(command) ? null : `${command.command}|${JSON.stringify(command.environment)}`;
    };
    const path = [folder, "person"].join(delimiter);

    Assert.areEqual(`devin auth login|${JSON.stringify({ Path: path })}`, read({ authMethods: [{ type: "terminal", id: "login", args: ["auth", "login"] }] }));
    Assert.areEqual(`devin|${JSON.stringify({ DEVIN_MODE: "browser", Path: path })}`, read({ authMethods: [{ type: "env_var", id: "key" },
      { type: "terminal", id: "login", env: { DEVIN_MODE: "browser" } }] }));
    Assert.isNull(read({}));
    Assert.isNull(read({ authMethods: [] }));
    Assert.isNull(read({ authMethods: [{ type: "env_var", id: "key" }] }));
    Assert.isNull(read({ authMethods: [{ id: "browser" }, { type: "terminal", id: "login" }] }));
    Assert.isNull(read({ authMethods: [{ type: "terminal", id: "login", args: ["; rm", "&&"] }] }));
    Assert.isNull(read({ authMethods: [{ type: "terminal", id: "login", args: ["two words"] }] }));
  }

  @TestMethod
  public leavesThePathAloneForAProgramThePathFindsAndNamesThePathWhenThePersonHasNone(): void {
    const named = new GeneralAcpAgent("devin", "Devin", null, {}, { PATH: "person" }, "home", CommandSource.none, () => "devin");
    const unset = new GeneralAcpAgent("devin", "Devin", null, {}, {}, "home", CommandSource.none, () => join("bin", "devin"));
    const notInstalled = new GeneralAcpAgent("devin", "Devin", null, {}, {}, "home");
    const fixed = new GeneralAcpAgent("devin", "Devin", COMMAND, {}, {}, "home");
    const initialized = JsonReader.fromValue({ authMethods: [{ type: "terminal", id: "login" }] });

    Assert.areEqual("devin|{}", [named.readTerminalSignIn(initialized)?.command, JSON.stringify(named.readTerminalSignIn(initialized)?.environment)].join("|"));
    Assert.areEqual(JSON.stringify({ PATH: ["bin", ""].join(delimiter) }), JSON.stringify(unset.readTerminalSignIn(initialized)?.environment));
    Assert.isNull(notInstalled.readTerminalSignIn(initialized));
    Assert.areEqual("devin", fixed.readTerminalSignIn(initialized)?.command);
  }

  @TestMethod
  public async leavesAnAgentThatListsNoSignInMethodsToItsCheckWhichFindsItSignedInWhenItsSessionStarts(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a1", "devin", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
    const checks: string[] = [];
    for (const methods of ["[]", "omit"]) {
      const adapter = host.createAcpAdapter(new GeneralAcpAgent("devin", "Devin", host.command, { TEAMRUN_FAKE_ACP_AUTH_METHODS: methods }, host.environment,
        host.directory.path));
      await adapter.signIn(provider, new AbortController().signal);
      const check = await adapter.checkSignIn(provider);
      checks.push(`${methods}:${check.authStatus}`);
    }

    Assert.areEqual(`[]:${AuthStatus.LoggedIn},omit:${AuthStatus.LoggedIn}`, checks.join(","));
  }

  @TestMethod
  public async refusesToSignInAnAgentWhoseOnlySignInMethodRunsInATerminal(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a1", "devin", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
    const agent = new GeneralAcpAgent("devin", "Devin", host.command, { TEAMRUN_FAKE_ACP_AUTH_METHODS: JSON.stringify([{ type: "terminal", id: "login", args: ["login"] }]) },
      host.environment, host.directory.path);

    const refused = await Assert.throwsAsync(() => host.createAcpAdapter(agent).signIn(provider, new AbortController().signal), SignInException);

    Assert.areEqual(Resources.formatGeneralAcpSignInUnavailable("Devin"), refused.message);
  }

  @TestMethod
  public async asksTheAgentForItsTerminalSignInAndAnAgentWithoutOneHasNone(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a1", "devin", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
    const agent = new GeneralAcpAgent("devin", "Devin", host.command, { TEAMRUN_FAKE_ACP_AUTH_METHODS: JSON.stringify([{ type: "terminal", id: "login", args: ["login"] }]) }, host.environment,
      host.directory.path, CommandSource.none, () => "devin");

    const command = await host.createAcpAdapter(agent).readSignInCommand(provider);

    Assert.areEqual("devin login", command?.command);
    Assert.isNull(await host.createAdapter().readSignInCommand(provider));
  }

  @TestMethod
  public async signsOutThroughTheAgentsLogoutWhenItOffersOneAndSaysWhenItDoesnt(): Promise<void> {
    await using host = new GrokTestHost();
    const provider = new Provider("a1", "devin", "Work", host.directory.resolve("profile"), AuthStatus.LoggedIn, null, null, null, null, "2026-09-09T00:00:00.000Z");
    const offering = new GeneralAcpAgent("devin", "Devin", host.command, {}, { ...host.environment, TEAMRUN_FAKE_ACP_CAPABILITIES: JSON.stringify({ agentCapabilities: { auth: { logout: {} } } }) },
      host.directory.path);
    const without = new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path);

    await host.createAcpAdapter(offering).signOut(provider);
    const failure = await Assert.throwsAsync(() => host.createAcpAdapter(without).signOut(provider), Error);

    Assert.areEqual("logout", (JSON.parse(readFileSync(host.directory.resolve("logout.txt"), "utf8")) as { readonly methods: readonly string[] }).methods.at(-1));
    Assert.isTrue(failure.message.includes("doesn't support signing out"), failure.message);
  }

  @TestMethod
  public signsInWithTheFirstMethodTheAgentRunsItselfAndReadsItsVersion(): void {
    const agent = new GeneralAcpAgent("devin", "Devin", COMMAND, {}, {}, "home");
    const read = (value: object): string | null => agent.readSignInMethod(JsonReader.fromValue(value));

    Assert.areEqual("devin-browser", read({ authMethods: [{ type: "terminal", id: "devin-terminal-login", args: ["--login"] }, { id: "devin-browser", name: "Browser" }] }));
    Assert.areEqual("device-pairing", read({ authMethods: [{ type: "agent", id: "device-pairing" }, { id: "api-key" }] }));
    Assert.isNull(read({ authMethods: [{ type: "terminal", id: "login" }, { type: "env_var", id: "key" }] }));
    Assert.isNull(read({ authMethods: [] }));
    Assert.isNull(read({}));
    Assert.areEqual("3000.11.234", agent.readVersion(JsonReader.fromValue({ agentInfo: { name: "devin", version: "3000.11.234" } })));
    Assert.isNull(agent.readVersion(JsonReader.fromValue({})));
  }

  @TestMethod
  public learnsItsModesFromEachNewSessionAndKeepsItsDefaultWhileTheyListIt(): void {
    const agent = new GeneralAcpAgent("devin", "Devin", COMMAND, {}, {}, "home");
    const shown = (): string => `${agent.modes.map(t => [t.id, t.name, t.description, t.unrestricted].join(":")).join(",")}|${agent.defaultMode}`;
    const modes = (current: string, ...ids: readonly string[]): object => ({ modes: { currentModeId: current,
      availableModes: ids.map(t => ({ id: t, name: t === "plan" ? "Plan" : " ", description: t === "plan" ? "Plan first" : "" })) } });

    const before = shown();
    agent.readSession(JsonReader.fromValue({ sessionId: "s" }));
    const none = shown();
    agent.readSession(JsonReader.fromValue(modes("ask", "code", "ask", "plan")));
    const listed = shown();
    agent.readSession(JsonReader.fromValue(modes("code", "ask", "plan")));
    const kept = shown();
    agent.readSession(JsonReader.fromValue({ configOptions: [{ id: "mode", category: "mode", type: "select", currentValue: "plan",
      options: [{ value: "build", name: "Build" }, { value: "plan", name: "Plan" }] }], ...modes("ask", "ask") }));
    const option = shown();
    agent.readSession(JsonReader.fromValue(modes("missing", "a", "b")));
    const unlisted = shown();
    agent.readSession(JsonReader.fromValue({ modes: { currentModeId: "c", availableModes: [] } }));
    const empty = shown();
    for (const malformed of [{ modes: { availableModes: [{ id: 7 }] } }, { modes: { availableModes: "plan" } }, { modes: "plan" },
      { configOptions: [{ id: "mode", category: "mode", type: "select", currentValue: 3, options: "none" }] }])
      agent.readSession(JsonReader.fromValue(malformed));
    const malformed = shown();
    const fresh = new GeneralAcpAgent("droid", "Droid", COMMAND, {}, {}, "home");
    fresh.readSession(JsonReader.fromValue({ modes: { availableModes: [{ id: "auto" }, { id: "spec", name: "Spec" }] } }));
    const uncurrent = `${fresh.modes.map(t => `${t.id}:${t.name}`).join(",")}|${fresh.defaultMode}`;
    fresh.readSession(JsonReader.fromValue({ configOptions: [{ id: "mode", category: "mode", type: "select", currentValue: "spec",
      options: [{ value: "auto", name: " " }, { value: "spec", name: "Spec" }] }] }));
    const unnamed = `${fresh.modes.map(t => `${t.id}:${t.name}`).join(",")}|${fresh.defaultMode}`;

    Assert.areEqual("|null", before);
    Assert.areEqual("|null", none);
    Assert.areEqual("code:code::false,ask:ask::false,plan:Plan:Plan first:false|ask", listed);
    Assert.areEqual("ask:ask::false,plan:Plan:Plan first:false|ask", kept);
    Assert.areEqual("build:Build::false,plan:Plan::false|plan", option);
    Assert.areEqual("a:a::false,b:b::false|a", unlisted);
    Assert.areEqual(unlisted, empty);
    Assert.areEqual(unlisted, malformed);
    Assert.areEqual("auto:auto,spec:Spec|auto", uncurrent);
    Assert.areEqual("auto:auto,spec:Spec|auto", unnamed);
  }

  @TestMethod
  public async isNeverAskedForATitleSinceItMayStartThePersonsOwnServers(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new GeneralAcpAgent("devin", "Devin", host.command, {}, host.environment, host.directory.path);

    Assert.isUndefined(host.createAcpAdapter(agent).askIsolated);
  }

  @TestMethod
  public async failsATurnWithAReasonWhenItsSessionsModesCantBeRead(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new GeneralAcpAgent("devin", "Devin", host.command, {}, { ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify("plan") }, host.directory.path);

    const turn = await host.createAcpAdapter(agent).runTurn(host.request("hello"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.isTrue((turn.error ?? "").length > 0);
  }

  @TestMethod
  public async readsAsSignedInWhenItsSessionStartsAndFailsATurnItRefusesWithWordsNamingSignIn(): Promise<void> {
    await using host = new GrokTestHost();
    const agent = new GeneralAcpAgent("devin", "Devin", host.command, { TEAMRUN_FAKE_ACP_PROMPT_AUTH: "1" }, host.environment, host.directory.path);
    const adapter = host.createAcpAdapter(agent);
    const provider = new Provider("a1", "devin", "Work", host.directory.resolve("profile"), AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");

    const check = await adapter.checkSignIn(provider);
    const turn = await adapter.runTurn(host.request("hello"), new RecordingTurnListener(), new AbortController().signal);

    Assert.areEqual(AuthStatus.LoggedIn, check.authStatus, check.error ?? "");
    Assert.areEqual(TurnOutcome.Failed, turn.outcome);
    Assert.areEqual(Resources.formatGeneralAcpSignIn("Devin"), turn.error);
  }

  @TestMethod
  public async listsTheModesItsSignInCheckSessionNamesAndRunsATurnInTheOneChosen(): Promise<void> {
    await using host = new GrokTestHost();
    const session = { currentModeId: "code", availableModes: [{ id: "code", name: "Code" }, { id: "plan", name: "Plan" }] };
    const agent = new GeneralAcpAgent("devin", "Devin", host.command, {}, { ...host.environment, TEAMRUN_FAKE_ACP_MODES: JSON.stringify(session) }, host.directory.path);
    const adapter = host.createAcpAdapter(agent);

    const listed = await adapter.listModels(null);
    const listener = new RecordingTurnListener();
    const turn = await adapter.runTurn(host.request("methods", null, null, null, null, "plan"), listener, new AbortController().signal);

    Assert.areEqual("true|code:Code,plan:Plan|code", [listed.signedIn, listed.modes.map(t => `${t.id}:${t.name}`).join(","), listed.defaultMode].join("|"));
    Assert.areEqual(TurnOutcome.Completed, turn.outcome, turn.error ?? "");
    const echoed = JsonReader.parse(listener.texts.find(t => t.startsWith("{\"methods\""))!);
    Assert.areEqual("mode=plan", echoed.readStringArray("sets").join(","));
  }

  @TestMethod
  public readsTheServerAndToolFromGeminiClisMetaAndNothingWithoutIt(): void {
    const agent = new GeneralAcpAgent("gemini", "Gemini CLI", COMMAND, {}, {}, "home");
    const of = (meta: JsonValue | undefined): string =>
      JSON.stringify(agent.mcpToolOf(JsonReader.fromValue(Object.isUndefined(meta) ? { toolCallId: "t" } : { toolCallId: "t", _meta: meta })));
    const mcp = (value: JsonValue): JsonObject => ({ "gemini-cli": { mcp: value } });

    Assert.areEqual(JSON.stringify({ server: "teamrun", tool: "teamrun_list_chats" }), of(mcp({ server_name: "teamrun", tool_name: "teamrun_list_chats" })));
    for (const meta of [undefined, [], {}, { "gemini-cli": [] }, mcp("teamrun"), mcp({ server_name: 1, tool_name: "teamrun_list_chats" })])
      Assert.areEqual("null", of(meta), JSON.stringify(meta));
  }

  @TestMethod
  public readsAnUntrustedFolderOnlyForGeminiCliWithTheEnvironmentFolderAndArgumentsItLaunchesWith(): void {
    using directory = new TemporaryDirectory();
    const project = directory.resolve("project");
    mkdirSync(project);
    const paths = { GEMINI_CLI_HOME: directory.resolve("home"), GEMINI_CLI_SYSTEM_SETTINGS_PATH: directory.resolve("system", "settings.json") };
    const gemini = { agentInfo: { name: "gemini-cli", title: "Gemini CLI", version: "0.67.0" } };
    const read = (variables: Readonly<Record<string, string>>, args: readonly string[] = ["--experimental-acp"], environment: NodeJS.ProcessEnv = {},
      initialized: JsonValue = gemini, folder: string | null = project): string | null =>
      new GeneralAcpAgent("gemini", "Gemini CLI", new ProcessCommand("gemini", args), { ...paths, ...variables }, environment, project)
        .readUntrustedFolder(JsonReader.fromValue(initialized), environment, folder);

    Assert.areEqual("Gemini CLI connects no MCP server in a folder it doesn't trust. To trust this chat's folder, run gemini in it and choose Trust folder, "
      + "then send again.", read({}));
    Assert.areEqual(Resources.geminiCliUntrustedFolder, read({}, undefined, { GEMINI_CLI_TRUST_WORKSPACE: "true" }), "a variable the launch leaves out");
    Assert.areEqual(Resources.geminiCliUntrustedFolder, read({}, undefined, {}, gemini, null), "the agent's own folder");
    Assert.isNull(read({ GEMINI_CLI_TRUST_WORKSPACE: "true" }), "the agent's own variable");
    Assert.isNull(read({}, ["--experimental-acp", "--skip-trust"]), "its argument");
    const settings = join(paths.GEMINI_CLI_HOME, ".gemini");
    mkdirSync(settings, { recursive: true });
    writeFileSync(join(settings, "trustedFolders.json"), JSON.stringify({ [project]: "TRUST_FOLDER" }));
    Assert.isNull(read({}), "a trusted folder");
    Assert.isNull(read({}, undefined, {}, gemini, null), "the agent's own folder, trusted");
    for (const initialized of [{}, { agentInfo: null }, { agentInfo: {} }, { agentInfo: { name: "qwen-code" } }, { agentInfo: { name: 1 } }, { agentInfo: ["gemini-cli"] },
      { agentInfo: "gemini-cli" }])
      Assert.isNull(read({}, undefined, {}, initialized, directory.resolve("elsewhere")), JSON.stringify(initialized));
  }

  @TestMethod
  public listsToolsBeforeTheSessionsAnswerOnlyForGeminiCliFrom0Point67(): void {
    const agent = new GeneralAcpAgent("gemini", "Gemini CLI", COMMAND, {}, {}, "home");
    const of = (name: string, version?: string): boolean =>
      agent.listsToolsBeforeSession(JsonReader.fromValue({ agentInfo: Object.isUndefined(version) ? { name } : { name, version } }));

    Assert.areEqual("true,true,true,true", [of("gemini-cli", "0.67.0"), of("gemini-cli", "0.68.0-nightly.20261101"), of("gemini-cli", "1.0.0"),
      of("gemini-cli", "0.70")].join(","));
    Assert.areEqual("false,false,false,false,false", [of("gemini-cli", "0.66.9"), of("gemini-cli"), of("gemini-cli", "beta"), of("gemini-cli", "0"),
      of("qwen-code", "0.67.0")].join(","));
  }

  @TestMethod
  public givesGeminiCliWhatCanLeaveTeamRunsToolsOutAndNoReasonForAnyOtherAgent(): void {
    const agent = new GeneralAcpAgent("gemini", "Gemini CLI", COMMAND, {}, {}, "home");
    const read = (initialized: JsonValue): string | null => agent.readMissingTools(JsonReader.fromValue(initialized));

    Assert.areEqual("Gemini CLI didn't list TeamRun's tools to this turn. Its settings can leave TeamRun's server out or turn MCP servers off, and TeamRun's "
      + "endpoint may have failed.", read({ agentInfo: { name: "gemini-cli" } }));
    for (const initialized of [{}, { agentInfo: { name: "qwen-code" } }, { agentInfo: ["gemini-cli"] }])
      Assert.isNull(read(initialized), JSON.stringify(initialized));
  }
}
