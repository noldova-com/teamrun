/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { JsonReader, type JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, Provider, ProviderModel } from "@noldova/teamrun.protocol";
import { AntigravityAgent, AntigravityProfile, AntigravityQuestionReader, AntigravityServer, ExecutableNotFoundException, ExecutableSource, ProcessCommand, ProfileFolderException, Resources } from "@noldova/teamrun.providers";

import { RecordingLog } from "../../fixtures/recording-log.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class AntigravityAgentTests {
  @TestMethod
  public readsTheServerAndToolFromItsMcpMetaAndNothingWithoutIt(): void {
    const agent = new AntigravityAgent(() => null, "linux", {}, "/data/default", "/data/tmp");
    const of = (meta: JsonValue | undefined): string =>
      JSON.stringify(agent.mcpToolOf(JsonReader.fromValue(Object.isUndefined(meta) ? { toolCallId: "t" } : { toolCallId: "t", _meta: meta })));

    Assert.areEqual(JSON.stringify({ server: "teamrun", tool: "teamrun_list_chats" }),
      of({ mcp: { tool: "teamrun_list_chats", server: "teamrun" }, is_mcp_tool_call: true }));
    for (const meta of [undefined, null, [], "mcp", { is_mcp_tool_call: true }, { mcp: null }, { mcp: [] }, { mcp: { tool: "teamrun_list_chats" } }])
      Assert.areEqual("null", of(meta), JSON.stringify(meta));
  }

  @TestMethod
  public tellsItsTeammatesTheirBackgroundSubAgentsEndWithTheirTurn(): void {
    Assert.areEqual(Resources.acpBackgroundSubAgentsNote, new AntigravityAgent(() => null, "linux", {}, "/data/default", "/data/tmp").backgroundSubAgentsNote);
  }

  @TestMethod
  public readsItsQuestionsWithAntigravitysQuestionReader(): void {
    Assert.isInstanceOf(new AntigravityAgent(() => null, "linux", {}, "/data/default", "/data/tmp").questions, AntigravityQuestionReader);
  }

  @TestMethod
  public startsATitleSessionInItsDefaultModeWhichAsksBeforeEditsAndCommands(): void {
    const agent = new AntigravityAgent(() => null, "linux", {}, "/data/default", "/data/tmp");
    Assert.areEqual(Resources.antigravityDefaultMode, agent.isolatedMode);
    Assert.areEqual(agent.defaultMode, agent.isolatedMode);
  }

  @TestMethod
  public worksWithAnyPatchOfThePinnedServersMajorAndMinorOnly(): void {
    const agent = new AntigravityAgent(() => null, "linux", {}, "/data/default", "/data/tmp");
    for (const version of ["1.3.0", "1.3.1", "1.3.12"])
      Assert.isNull(agent.formatUnsupported(version), version);
    for (const version of ["1.4.0", "1.4.1", "1.2.9", "2.3.0", "1.3", "1.3.0-beta", "11.3.0", null])
      Assert.areEqual(Resources.formatAntigravityUnsupported(version), agent.formatUnsupported(version), String(version));
    Assert.isTrue(agent.formatUnsupported(null)!.includes("of an unknown version"));
  }

  @TestMethod
  public signsInInteractivelyAndKeepsEachProfilesModelsInItsOwnFile(): void {
    using directory = new TemporaryDirectory();
    const agent = new AntigravityAgent(() => null, "linux", {}, directory.resolve("default"), directory.resolve("tmp"));
    const provider = AntigravityAgentTests.provider(directory.resolve("work"));
    for (const profile of [directory.resolve("default"), directory.resolve("work")])
      new AntigravityProfile(profile, directory.resolve("tmp")).prepare();
    const models = [new ProviderModel("gemini-pro", "Gemini Pro", "", [], true, null, true), new ProviderModel("partner-large", "Partner Large", "", [], false, null, true)];
    const file = join(directory.resolve("work"), ".teamrun-models.json");

    agent.turnModels.keep(provider, models);
    const kept = agent.turnModels.read(provider);

    Assert.isTrue(agent.interactiveSignIn);
    Assert.areEqual(JSON.stringify(models.map(t => t.toJson())), JSON.stringify(kept?.map(t => t.toJson())));
    Assert.isTrue(kept?.every(t => t instanceof ProviderModel) ?? false);
    Assert.isNull(agent.turnModels.read(null));
    agent.turnModels.keep(null, models.slice(1));
    Assert.areEqual("partner-large", agent.turnModels.read(null)?.map(t => t.id).join(","));
    Assert.areEqual("gemini-pro,partner-large", agent.turnModels.read(provider)?.map(t => t.id).join(","));
    writeFileSync(file, JSON.stringify({ models: [{ id: 5 }] }));
    Assert.isNull(agent.turnModels.read(provider));
    writeFileSync(file, "not json");
    Assert.isNull(agent.turnModels.read(provider));
  }

  @TestMethod
  public forgetsOnlyTheSignedOutProfilesTokenAndLeavesAFolderTeamRunDoesntManage(): void {
    using directory = new TemporaryDirectory();
    const agent = new AntigravityAgent(() => null, "linux", {}, directory.resolve("default"), directory.resolve("tmp"));
    const token = (profile: string): string => join(profile, ...Resources.antigravityTokenSegments);
    for (const profile of [directory.resolve("default"), directory.resolve("work"), directory.resolve("own")]) {
      mkdirSync(dirname(token(profile)), { recursive: true });
      writeFileSync(token(profile), "");
    }
    for (const profile of [directory.resolve("default"), directory.resolve("work")])
      writeFileSync(join(profile, Resources.profileMarker), Resources.antigravityProfileMarkerValue);
    const work = AntigravityAgentTests.provider(directory.resolve("work"));

    agent.forgetSignIn(work);
    const afterWork = [agent.isSignedIn(work), agent.isSignedIn(null)].join(",");
    agent.forgetSignIn(work);
    const refused = Assert.throws(() => agent.forgetSignIn(AntigravityAgentTests.provider(directory.resolve("own"))), Error);

    Assert.areEqual("false,true", afterWork);
    Assert.areEqual(Resources.antigravityProfileNotManaged, refused.message);
    Assert.isTrue(existsSync(token(directory.resolve("own"))));
    Assert.isTrue(existsSync(join(directory.resolve("work"), Resources.profileMarker)));
  }

  @TestMethod
  public startsTheServerInTheProvidersProfileWithItsOwnHomeTokenFileHarnessAndTemporaryFolder(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const tempRoot = directory.resolve("tmp");
    AntigravityAgentTests.signIn(profile);
    const base = { PATH: "/bin", HOME: "/people/person-1", GEMINI_API_KEY: "fixture", GOOGLE_CLOUD_PROJECT: "p", GEMINI_HOME: "/people/person-1/.gemini", AGY_ACP_ENABLE_OAUTH: "1",
      ANTIGRAVITY_HARNESS_PATH: "/x", BROWSER: "firefox", TMPDIR: "/tmp", TEMP: "C:/Temp", GITHUB_TOKEN: "fixture", ELECTRON_RUN_AS_NODE: "1" };
    const server = new ProcessCommand("/data/providers/antigravity/1.3.0/agy_acp_server.par", []);
    const linux = new AntigravityAgent(() => new AntigravityServer(server, "/data/providers/antigravity/1.3.0/localharness_external"), "linux", base, "/data/default", tempRoot)
      .launch(AntigravityAgentTests.provider(profile), null, null, null, base, true);
    const temporary = new AntigravityProfile(profile, tempRoot).tempDirectory;
    Assert.areEqual(server.executable, linux.command.executable);
    Assert.areEqual("--uid=", linux.command.arguments.join(" "));
    Assert.areEqual(profile, linux.directory);
    Assert.areEqual(JSON.stringify({
      PATH: "/bin", HOME: "/people/person-1", GEMINI_HOME: profile, AGY_ACP_FORCE_FILE_STORAGE: "1", ANTIGRAVITY_HARNESS_PATH: "/data/providers/antigravity/1.3.0/localharness_external",
      PYTHONUNBUFFERED: "1", TMPDIR: temporary
    }), JSON.stringify(linux.environment));
    Assert.areEqual(tempRoot, dirname(temporary));
    Assert.areEqual(12, temporary.slice(tempRoot.length + 1).length);
    Assert.isTrue(existsSync(temporary));
    const windows = new AntigravityAgent(() => new AntigravityServer(server, "C:/agy/localharness_external.exe"), "win32", base, "/data/default", tempRoot)
      .launch(AntigravityAgentTests.provider(profile));
    Assert.areEqual(0, windows.command.arguments.length);
    Assert.areEqual(join(profile, ".teamrun-hidden-home"), windows.environment["GEMINI_HOME"]);
    Assert.areEqual(temporary, windows.environment["TEMP"]);
    Assert.areEqual(temporary, windows.environment["TMP"]);
    Assert.isUndefined(windows.environment["TMPDIR"]);
    Assert.areNotEqual(temporary, new AntigravityProfile(directory.resolve("other"), tempRoot).tempDirectory);
  }

  @TestMethod
  public clearsWhatEarlierServersLeftInItsTemporaryRootAtItsFirstLaunchOnly(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const tempRoot = directory.resolve("tmp");
    const left = join(tempRoot, "left-by-a-stopped-server", "payload.bin");
    AntigravityAgentTests.signIn(profile);
    mkdirSync(dirname(left), { recursive: true });
    writeFileSync(left, "x");
    Assert.throws(() => new AntigravityAgent(() => null, "darwin", {}, profile, tempRoot).launch(null), Error);
    Assert.isTrue(existsSync(left));
    const agent = new AntigravityAgent(() => new AntigravityServer(new ProcessCommand("/agy/agy_acp_server.par", []), "/agy/localharness_external"), "darwin", {},
      profile, tempRoot);

    agent.launch(null);
    Assert.isFalse(existsSync(left));
    Assert.isTrue(existsSync(new AntigravityProfile(profile, tempRoot).tempDirectory));
    mkdirSync(dirname(left), { recursive: true });
    writeFileSync(left, "x");
    agent.launch(null);
    Assert.isTrue(existsSync(left));
  }

  @TestMethod
  public usesTheDefaultProfileForTheTeammateWithoutAProvider(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("default");
    AntigravityAgentTests.signIn(profile);
    const agent = new AntigravityAgent(() => new AntigravityServer(new ProcessCommand("/agy/agy_acp_server.par", []), "/agy/localharness_external"), "darwin", {}, profile,
      directory.resolve("tmp"));
    const launch = agent.launch(null);
    Assert.areEqual(profile, launch.directory);
    Assert.areEqual(0, launch.command.arguments.length);
    Assert.areEqual(Resources.formatAntigravitySignIn(profile), agent.formatSignIn(null));
  }

  @TestMethod
  public refusesToStartWithoutTheServerOrAProfileTeamRunManagesAndKnowsASignInByItsTokenFile(): void {
    using directory = new TemporaryDirectory();
    const server = new ProcessCommand("/agy/agy_acp_server.par", []);
    Assert.areEqual(Resources.antigravityNotFound,
      Assert.throws(() => new AntigravityAgent(() => null, "linux", {}, directory.resolve("default"), directory.resolve("tmp")).launch(null), Error).message);
    const fresh = directory.resolve("fresh");
    const agent = new AntigravityAgent(() => new AntigravityServer(server, "/agy/localharness_external"), "linux", {}, directory.resolve("default"), directory.resolve("tmp"));
    Assert.isFalse(agent.isSignedIn(AntigravityAgentTests.provider(fresh)));
    Assert.areEqual(fresh, agent.launch(AntigravityAgentTests.provider(fresh)).directory);
    Assert.isTrue(existsSync(join(fresh, ".teamrun-managed-profile")));
    Assert.isFalse(new AntigravityProfile(fresh, directory.resolve("tmp")).hasToken());
    AntigravityAgentTests.signIn(fresh);
    Assert.isTrue(agent.isSignedIn(AntigravityAgentTests.provider(fresh)));
    Assert.isFalse(agent.isSignedIn(null));
    const existing = directory.resolve("existing");
    mkdirSync(existing);
    writeFileSync(join(existing, "settings.json"), "{}");
    Assert.areEqual(Resources.antigravityProfileNotManaged, Assert.throws(() => agent.launch(AntigravityAgentTests.provider(existing)), Error).message);
  }

  @TestMethod
  public runsTheServerItsProviderChoseAndSaysSoWhenItIsMissing(): void {
    using directory = new TemporaryDirectory();
    const asked: (string | null)[] = [];
    const chosen = "/opt/agy/agy_acp_server";
    const server = new AntigravityServer(new ProcessCommand(chosen, []), "/opt/agy/localharness_external", ExecutableSource.Override);
    const agent = new AntigravityAgent(t => {
      asked.push(t);
      return Object.isNull(t) ? null : server;
    }, "darwin", {}, directory.resolve("default"), directory.resolve("tmp"));
    const provider = new Provider("a1", "antigravity", "Work", directory.resolve("work"), AuthStatus.Unknown, null, null, null, null, "t", true, false, chosen);
    const missing = new Provider("a2", "antigravity", "Home", directory.resolve("home"), AuthStatus.Unknown, null, null, null, null, "t", true, false, null);

    Assert.areEqual(chosen, agent.launch(provider).command.executable);
    Assert.areEqual(Resources.antigravityNotFound, Assert.throws(() => agent.launch(missing), ExecutableNotFoundException).message);
    Assert.areEqual(Resources.formatAntigravityChosenNotFound("/elsewhere/agy"),
      Assert.throws(() => new AntigravityAgent(() => null, "darwin", {}, directory.resolve("default"), directory.resolve("tmp"))
        .launch(provider.withBinaryPath("/elsewhere/agy")), Error).message);
    Assert.areEqual(JSON.stringify([chosen, null]), JSON.stringify(asked));
    Assert.isTrue(agent.descriptor.choosesServerPath);
  }

  @TestMethod
  public readsItsVersionFromAgentInfoAndLeavesModelsAndEffortToTheSession(): void {
    const agent = new AntigravityAgent(() => null, "linux", {}, "/data/default", "/data/tmp");
    Assert.areEqual("1.3.0", agent.readVersion(JsonReader.fromValue({ agentInfo: { name: "antigravity-acp", version: "1.3.0" } })));
    Assert.isNull(agent.readVersion(JsonReader.fromValue({ agentInfo: null })));
    Assert.isNull(agent.readVersion(JsonReader.fromValue({})));
    const initialized = JsonReader.fromValue({ authMethods: [{ id: "oauth-personal", name: "Google" }] });
    Assert.isNull(agent.readModels(initialized));
    Assert.areEqual("oauth-personal", agent.readSignInMethod(initialized));
    Assert.isNull(agent.readEffort(JsonReader.fromValue({ sessionId: "s-1" })));
    Assert.isNull(agent.sessionMeta());
    Assert.areEqual("oauth-personal", agent.authMethod);
    Assert.isNull(agent.authMeta);
    Assert.areEqual("refusal", agent.stopReasons.join(","));
    Assert.isTrue(agent.prefersResume);
    Assert.isFalse(agent.sendsResourceLinks);
    Assert.areEqual("antigravity:Antigravity:true:true:false:true", [agent.descriptor.id, agent.descriptor.displayName, agent.descriptor.supportsResume,
      agent.descriptor.supportsSignInCheck, agent.descriptor.supportsFork, agent.descriptor.supportsSignIn].join(":"));
    Assert.areEqual(JSON.stringify({ variable: "GEMINI_HOME", signInCommand: null, usualFolder: "/data/default", toolCommand: null, signInVariables: {}, signInValues: {}, personFolders: [] }),
      JSON.stringify(agent.descriptor.profile?.toJson()));
    Assert.areEqual(`0 ${Resources.profileMarker}`, `${agent.profileSearch.folders.length} ${agent.profileSearch.entries.join()}`);
    Assert.areEqual(`${agent.descriptor.displayName} can't switch on its own MCP servers here: ${Resources.antigravityOwnServersSwitchAbility}.`, agent.descriptor.ownMcpServersUnavailable);
    Assert.areEqual("Antigravity tool", agent.toolTitle);
    Assert.areEqual(Resources.antigravitySignInUnavailable, agent.signInUnavailable);
    Assert.areEqual("true:null:null:true", [agent.descriptor.supportsSignOut, agent.descriptor.signOutCommand ?? "null", agent.signOut ?? "null", agent.logsOut]
      .join(":"));
    Assert.areEqual("Antigravity stopped before completing the turn: refusal.", agent.formatStopped("refusal"));
    Assert.isTrue(agent.formatSignIn(AntigravityAgentTests.provider("/data/profiles/antigravity/a1")).includes("/data/profiles/antigravity/a1"));
  }

  @TestMethod
  public readsThePersonsInstructionFilesForTheTurnWhileTheirSettingsStayOutsideTheProfileItLaunchesIn(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const gemini = directory.resolve("person", ".gemini");
    AntigravityAgentTests.signIn(profile);
    mkdirSync(gemini, { recursive: true });
    writeFileSync(join(gemini, "GEMINI.md"), "person-rule-fixture");
    writeFileSync(join(gemini, "settings.json"), "{\"mcpServers\":{\"person-server-fixture\":{}},\"hooks\":{\"person-hook-fixture\":[]}}");
    const agent = new AntigravityAgent(() => new AntigravityServer(new ProcessCommand("/agy/agy_acp_server.par", []), "/agy/localharness_external"), "linux",
      { HOME: directory.resolve("person"), GEMINI_HOME: gemini }, directory.resolve("default"), directory.resolve("tmp"));

    const launch = agent.launch(AntigravityAgentTests.provider(profile), null, null, null, agent.baseEnvironment, true);
    const instructions = agent.readHomeInstructions(agent.baseEnvironment) ?? "";

    Assert.isTrue(instructions.includes(`Contents of ${join(gemini, "GEMINI.md")}:\n\nperson-rule-fixture`));
    Assert.areEqual(JSON.stringify({ home: profile, settings: false, server: false }), JSON.stringify({
      home: launch.environment[Resources.antigravityHomeVariable], settings: existsSync(join(profile, "settings.json")), server: instructions.includes("person-server-fixture") }));
  }

  @TestMethod
  public readsThePersonsInstructionFilesFromThePassedEnvironmentAndNotTheOneItWasBuiltWith(): void {
    using directory = new TemporaryDirectory();
    const built = directory.resolve("built");
    const passed = directory.resolve("passed");
    mkdirSync(built, { recursive: true });
    mkdirSync(passed, { recursive: true });
    writeFileSync(join(built, "GEMINI.md"), "built-rule-fixture");
    writeFileSync(join(passed, "GEMINI.md"), "passed-rule-fixture");
    const agent = new AntigravityAgent(() => new AntigravityServer(new ProcessCommand("/agy/agy_acp_server.par", []), "/agy/localharness_external"), "linux",
      { HOME: directory.resolve("person"), GEMINI_HOME: built }, directory.resolve("default"), directory.resolve("tmp"));

    const instructions = agent.readHomeInstructions({ HOME: directory.resolve("person"), GEMINI_HOME: passed }) ?? "";

    Assert.isTrue(instructions.includes(`Contents of ${join(passed, "GEMINI.md")}:\n\npassed-rule-fixture`), instructions);
    Assert.isFalse(instructions.includes("built-rule-fixture"), instructions);
  }

  @TestMethod
  public linksThePersonsSkillFoldersIntoTheProfileAndReadsTheirSkillsThroughThemWithoutWritingInTheirHome(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const gemini = directory.resolve("person", ".gemini");
    AntigravityAgentTests.signIn(profile);
    mkdirSync(join(gemini, "config", "skills", "review"), { recursive: true });
    mkdirSync(join(gemini, "antigravity-cli", "skills", "deploy"), { recursive: true });
    writeFileSync(join(gemini, "config", "skills", "review", "SKILL.md"), "review-skill-fixture");
    writeFileSync(join(gemini, "antigravity-cli", "skills", "deploy", "SKILL.md"), "deploy-skill-fixture");
    const before = AntigravityAgentTests.listing(gemini);
    const log = new RecordingLog();

    AntigravityAgentTests.chat(AntigravityAgentTests.agent(directory, gemini, log), profile);

    Assert.areEqual(JSON.stringify([true, true, "review-skill-fixture", "deploy-skill-fixture"]), JSON.stringify([
      lstatSync(join(profile, "config", "skills")).isSymbolicLink(), lstatSync(join(profile, "antigravity-cli", "skills")).isSymbolicLink(),
      readFileSync(join(profile, "config", "skills", "review", "SKILL.md"), "utf8"), readFileSync(join(profile, "antigravity-cli", "skills", "deploy", "SKILL.md"), "utf8")]));
    Assert.areEqual(before, AntigravityAgentTests.listing(gemini));
    Assert.areEqual(0, log.lines.length, log.lines.join(" | "));
  }

  @TestMethod
  public linksTheSkillFoldersOnEitherPlatformAndPassesThePersonsAndTheProjectsFilesAsText(): void {
    for (const platform of ["linux", "win32"]) {
      using directory = new TemporaryDirectory();
      const profile = directory.resolve("profile");
      const gemini = directory.resolve("person", ".gemini");
      const work = directory.resolve("work");
      AntigravityAgentTests.signIn(profile);
      mkdirSync(join(gemini, "config", "skills"), { recursive: true });
      mkdirSync(join(work, ".agents", "skills", "local"), { recursive: true });
      writeFileSync(join(gemini, "GEMINI.md"), "person-gemini-fixture");
      writeFileSync(join(gemini, "AGENTS.md"), "person-agents-fixture");
      writeFileSync(join(work, "GEMINI.md"), "project-gemini-fixture");
      const log = new RecordingLog();
      const agent = AntigravityAgentTests.agent(directory, gemini, log, platform);

      AntigravityAgentTests.chat(agent, profile, work);
      const instructions = agent.readHomeInstructions(agent.baseEnvironment, work) ?? "";

      Assert.areEqual(JSON.stringify({ skills: realpathSync(join(gemini, "config", "skills")), notes: 0, gemini: true, agents: true, project: true,
        profile: [".teamrun-managed-profile", "antigravity-acp", "config"] }), JSON.stringify({ skills: realpathSync(join(profile, "config", "skills")),
        notes: log.lines.length, gemini: instructions.includes("person-gemini-fixture"), agents: instructions.includes("person-agents-fixture"),
        project: instructions.includes("project-gemini-fixture"), profile: readdirSync(profile).sort() }), `${platform}: ${log.lines.join(" | ")}`);
    }
  }

  @TestMethod
  public skipsAMissingSourceRemovesTheLinkAnEarlierLaunchLeftForItAndRelinksAMovedOne(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const first = directory.resolve("first", ".gemini");
    const second = directory.resolve("second", ".gemini");
    AntigravityAgentTests.signIn(profile);
    mkdirSync(join(first, "config", "skills"), { recursive: true });
    mkdirSync(join(first, "antigravity-cli", "skills"), { recursive: true });
    mkdirSync(join(second, "antigravity-cli", "skills"), { recursive: true });
    const log = new RecordingLog();
    const agent = AntigravityAgentTests.agent(directory, first, log);

    AntigravityAgentTests.chat(agent, profile);
    const linked = [realpathSync(join(profile, "config", "skills")), realpathSync(join(profile, "antigravity-cli", "skills"))];
    AntigravityAgentTests.chat(agent, profile, null, { HOME: directory.resolve("second"), USERPROFILE: directory.resolve("second"), GEMINI_HOME: second });

    Assert.areEqual(JSON.stringify([realpathSync(join(first, "config", "skills")), realpathSync(join(first, "antigravity-cli", "skills"))]), JSON.stringify(linked));
    Assert.areEqual(JSON.stringify([false, realpathSync(join(second, "antigravity-cli", "skills"))]),
      JSON.stringify([existsSync(join(profile, "config", "skills")), realpathSync(join(profile, "antigravity-cli", "skills"))]));
    Assert.isTrue(existsSync(join(first, "config", "skills")));
    Assert.areEqual(0, log.lines.length, log.lines.join(" | "));
  }

  @TestMethod
  public keepsALinkAlreadyThereReplacesAnEmptyFolderAndNotesAnythingElseWithoutFailingTheLaunch(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const gemini = directory.resolve("person", ".gemini");
    AntigravityAgentTests.signIn(profile);
    mkdirSync(join(gemini, "config", "skills"), { recursive: true });
    mkdirSync(join(gemini, "antigravity-cli", "skills"), { recursive: true });
    writeFileSync(join(gemini, "GEMINI.md"), "person-gemini-fixture");
    mkdirSync(join(profile, "antigravity-cli", "skills"), { recursive: true });
    mkdirSync(join(profile, "config", "skills", "own"), { recursive: true });
    const log = new RecordingLog();
    const agent = AntigravityAgentTests.agent(directory, gemini, log);

    AntigravityAgentTests.chat(agent, profile);
    const linked = realpathSync(join(profile, "antigravity-cli", "skills"));
    AntigravityAgentTests.chat(agent, profile);

    Assert.areEqual(JSON.stringify([true, realpathSync(join(gemini, "antigravity-cli", "skills")), false, true]), JSON.stringify([
      lstatSync(join(profile, "antigravity-cli", "skills")).isSymbolicLink(), linked, lstatSync(join(profile, "config", "skills")).isSymbolicLink(),
      existsSync(join(profile, "config", "skills", "own"))]));
    const note = Resources.formatAntigravityNotLinked(join(profile, "config", "skills"), join(gemini, "config", "skills"), Resources.antigravityNotALink);
    Assert.areEqual(JSON.stringify([note, note]), JSON.stringify(log.lines));
    Assert.isTrue((agent.readHomeInstructions(agent.baseEnvironment) ?? "").includes("person-gemini-fixture"));
  }

  @TestMethod
  public runsAnyLaunchButAChatTurnInAHiddenHomeThatSharesTheSignInButNoneOfThePersonsSkills(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const gemini = directory.resolve("person", ".gemini");
    const hidden = join(profile, ".teamrun-hidden-home");
    AntigravityAgentTests.signIn(profile);
    mkdirSync(join(gemini, "config", "skills", "review"), { recursive: true });
    const log = new RecordingLog();
    const agent = AntigravityAgentTests.agent(directory, gemini, log);

    const first = agent.launch(AntigravityAgentTests.provider(profile));
    const skipped = existsSync(join(profile, "config", "skills"));
    AntigravityAgentTests.chat(agent, profile);
    const title = agent.launch(AntigravityAgentTests.provider(profile));

    Assert.areEqual(JSON.stringify([hidden, hidden, false, ["antigravity-acp"], true, true, true, profile]), JSON.stringify([first.environment["GEMINI_HOME"],
      title.environment["GEMINI_HOME"], skipped, readdirSync(hidden), lstatSync(join(hidden, "antigravity-acp")).isSymbolicLink(),
      existsSync(join(hidden, "antigravity-acp", "acp_token.json")), existsSync(join(profile, "config", "skills", "review")), title.directory]));
    Assert.areEqual(0, log.lines.length, log.lines.join(" | "));
  }

  @TestMethod
  public makesTheSignInFolderForAHiddenLaunchBeforeASignInAndRefusesOneWithSomethingElseInTheLinksPlace(): void {
    using directory = new TemporaryDirectory();
    const fresh = directory.resolve("fresh");
    const blocked = directory.resolve("blocked");
    const agent = AntigravityAgentTests.agent(directory, directory.resolve("person", ".gemini"), new RecordingLog());
    AntigravityAgentTests.signIn(blocked);
    mkdirSync(join(blocked, ".teamrun-hidden-home", "antigravity-acp", "own"), { recursive: true });

    agent.launch(AntigravityAgentTests.provider(fresh));
    writeFileSync(join(fresh, ".teamrun-hidden-home", "antigravity-acp", "acp_token.json"), "");

    Assert.isTrue(new AntigravityProfile(fresh, directory.resolve("tmp")).hasToken());
    Assert.areEqual(Resources.antigravityNotALink, Assert.throws(() => agent.launch(AntigravityAgentTests.provider(blocked)), ProfileFolderException).message);
    Assert.isTrue(existsSync(join(blocked, ".teamrun-hidden-home", "antigravity-acp", "own")));
  }

  @TestMethod
  public linksNothingWhenThePersonsGeminiHomeIsTheProfileItself(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    AntigravityAgentTests.signIn(profile);
    mkdirSync(join(profile, "config", "skills"), { recursive: true });
    const log = new RecordingLog();

    AntigravityAgentTests.chat(AntigravityAgentTests.agent(directory, profile, log), profile);

    Assert.isFalse(lstatSync(join(profile, "config", "skills")).isSymbolicLink());
    Assert.areEqual(0, log.lines.length, log.lines.join(" | "));
  }

  private static agent(directory: TemporaryDirectory, gemini: string, log: RecordingLog, platform: string = process.platform): AntigravityAgent {
    return new AntigravityAgent(() => new AntigravityServer(new ProcessCommand("/agy/agy_acp_server.par", []), "/agy/localharness_external"), platform,
      { HOME: directory.resolve("person"), USERPROFILE: directory.resolve("person"), GEMINI_HOME: gemini }, directory.resolve("default"), directory.resolve("tmp"), log);
  }

  private static chat(agent: AntigravityAgent, profile: string, work: string | null = null, environment: NodeJS.ProcessEnv = agent.baseEnvironment): void {
    agent.launch(AntigravityAgentTests.provider(profile), null, work, null, environment, true);
  }

  private static listing(folder: string): string {
    return JSON.stringify(readdirSync(folder, { recursive: true }).map(String).sort());
  }

  private static signIn(profile: string): void {
    const token = join(profile, "antigravity-acp", "acp_token.json");
    mkdirSync(dirname(token), { recursive: true });
    writeFileSync(join(profile, ".teamrun-managed-profile"), Resources.antigravityProfileMarkerValue);
    writeFileSync(token, "");
  }

  private static provider(directory: string): Provider {
    return new Provider("a1", "antigravity", "Work", directory, AuthStatus.Unknown, null, null, null, null, "2026-09-09T00:00:00.000Z");
  }
}
