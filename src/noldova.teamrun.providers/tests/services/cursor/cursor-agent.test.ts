/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { AcpRequestException, CursorAgent, ExecutableNotFoundException, ProcessCommand, Resources } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CursorAgentTests {
  @TestMethod
  public tellsItsTeammatesTheirBackgroundSubAgentsEndWithTheirTurn(): void {
    using directory = new TemporaryDirectory();
    Assert.areEqual(Resources.acpBackgroundSubAgentsNote, new CursorAgent(new ProcessCommand("cursor-agent", []), {}, directory.resolve("usual")).backgroundSubAgentsNote);
  }

  @TestMethod
  public readsTheRefusalsCursorSendsAsItsAnswerInPlaceOfAnError(): void {
    using directory = new TemporaryDirectory();
    const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), {}, directory.resolve("usual"));

    const plan = agent.readRefusal("\n\nUpgrade your plan to continue");
    const signIn = agent.readRefusal("\n\nPlease sign in to continue");
    const settings = agent.readRefusal("\n\nCheck your settings to continue");

    Assert.areEqual("ProviderRefusedException,Cursor refused the turn: Upgrade your plan to continue.", `${plan?.name},${plan?.message}`);
    Assert.isInstanceOf(signIn, AcpRequestException);
    Assert.areEqual(-32000, signIn instanceof AcpRequestException ? signIn.code : null);
    Assert.areEqual("ProviderRefusedException,Cursor refused the turn: Check your settings to continue.", `${settings?.name},${settings?.message}`);
    Assert.areEqual("null,null,null", [agent.readRefusal("Upgrade your plan to continue"), agent.readRefusal("\n\nUpgrade your plan to continue."),
      agent.readRefusal("\n\nHello")].map(String).join(","));
  }

  @TestMethod
  public launchesWithTheModelBeforeAcpInTheUsualProfileKeepingATurnsApprovedToolsOutsideATurnUntilATurnRevokesThem(): void {
    using directory = new TemporaryDirectory();
    const usual = directory.resolve("usual");
    const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), {}, usual);
    const allowed = (): readonly string[] =>
      (JSON.parse(readFileSync(directory.resolve("usual", "cli-config.json"), "utf8")) as { permissions: { allow: readonly string[] } }).permissions.allow;

    const chosen = agent.launch(null, new RequestedSettings("cursor", "gpt-5", null, null, "ask"), null, ["open_panel"]);
    const kept = agent.launch(null, null, null, null);
    const keptTools = allowed().join(",");
    agent.launch(null, null, null, []);
    const revoked = allowed().join(",");
    agent.launch(null, null, null);

    Assert.areEqual("cursor-agent --model gpt-5 --disable-project-configs acp", [chosen.command.executable, ...chosen.command.arguments].join(" "));
    Assert.areEqual("cursor-agent --disable-project-configs acp", [kept.command.executable, ...kept.command.arguments].join(" "));
    Assert.areEqual(usual, kept.directory);
    Assert.areEqual(usual, kept.environment["CURSOR_CONFIG_DIR"]);
    Assert.areEqual("Mcp(teamrun:open_panel)", keptTools);
    Assert.areEqual("", revoked);
    Assert.areEqual("", allowed().join(","));
    Assert.areEqual(Resources.formatCursorSignIn(usual, process.platform === "darwin"), agent.formatSignIn(null));
    const signIn = (platform: string): string => new CursorAgent(null, {}, usual, () => null, platform).formatSignIn(null);
    Assert.areEqual(`Cursor isn't signed in. Choose Sign in in the provider's menu to run cursor-agent login for the TeamRun profile at ${usual}; ` +
      "on this Mac, Cursor keeps its sign-in in the keychain, shared with your own Cursor CLI, so signing in replaces your Cursor CLI's sign-in.", signIn("darwin"));
    Assert.areEqual(`Cursor isn't signed in. Choose Sign in in the provider's menu to run cursor-agent login for the TeamRun profile at ${usual}; ` +
      "your own Cursor setup is separate.", signIn("linux"));
    Assert.areEqual(signIn("linux"), signIn("win32"));
    Assert.areEqual(Resources.cursorNotFound, Assert.throws(() => new CursorAgent(null, {}, usual).launch(null, null, null), ExecutableNotFoundException).message);
  }

  @TestMethod
  public leavesTheRulesToCursorStartedInTheTurnsFolderWithThePersonsHomeInAChatTurnAndInItsProfileWithAnEmptyHomeOutsideOne(): void {
    using directory = new TemporaryDirectory();
    const usual = directory.resolve("usual");
    const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), { PATH: "/bin", HOME: directory.resolve("person") }, usual, () => null, "linux");

    const chat = agent.launch(null, null, null, null, agent.baseEnvironment, true);
    const title = agent.launch(null, null, null);
    const inProject = agent.launch(null, null, directory.resolve("project"), null, agent.baseEnvironment, true);
    const titleInFolder = agent.launch(null, null, directory.resolve("titles"), null, agent.baseEnvironment, false);

    Assert.areEqual("cursor-agent --disable-project-configs acp", [chat.command.executable, ...chat.command.arguments].join(" "));
    Assert.areEqual(JSON.stringify([usual, directory.resolve("project"), usual]), JSON.stringify([chat.directory, inProject.directory, titleInFolder.directory]));
    Assert.areEqual(JSON.stringify([directory.resolve("person"), usual]), JSON.stringify([chat.environment["HOME"], chat.environment["CURSOR_CONFIG_DIR"]]));
    Assert.areEqual(JSON.stringify([join(usual, "title-home"), usual]), JSON.stringify([title.environment["HOME"], title.environment["CURSOR_CONFIG_DIR"]]));
    Assert.isFalse("readHomeInstructions" in agent);
  }

  @TestMethod
  public leavesThePersonsOwnMcpJsonToCursorInTheirHomeInAChatTurnAndPointsALaunchOutsideOneAtAHomeWithoutItOffMacOs(): void {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("person");
    mkdirSync(join(person, ".cursor"), { recursive: true });
    writeFileSync(join(person, ".cursor", "mcp.json"), JSON.stringify({ mcpServers: { docs: { command: "docs" } } }));
    const homesOf = (platform: string): string[][] => {
      const usual = directory.resolve(platform);
      const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), { PATH: "/bin", HOME: person, USERPROFILE: person }, usual, () => null, platform);
      const chat = agent.launch(null, null, null, null, agent.baseEnvironment, true);
      const title = agent.launch(null, null, null);
      Assert.isFalse(existsSync(join(usual, "mcp.json")) || existsSync(join(usual, "title-home", ".cursor", "mcp.json")));
      return [chat, title].map(t => [t.environment["HOME"] ?? "", t.environment["USERPROFILE"] ?? ""]);
    };

    const homes = { linux: homesOf("linux"), win32: homesOf("win32") };

    const titleHome = (platform: string): string => join(directory.resolve(platform), "title-home");
    Assert.areEqual(JSON.stringify({ linux: [[person, person], [titleHome("linux"), person]], win32: [[person, person], [titleHome("win32"), titleHome("win32")]] }),
      JSON.stringify(homes));
  }

  @TestMethod
  public startsEveryAcpLaunchIgnoringTheProjectsCliJsonBeforeAcpWithOrWithoutAModel(): void {
    using directory = new TemporaryDirectory();
    const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), { PATH: "/bin", HOME: directory.resolve("person") }, directory.resolve("usual"), () => null, "linux");

    const launches = [agent.launch(null, null, directory.resolve("project"), null, agent.baseEnvironment, true),
      agent.launch(null, new RequestedSettings("cursor", "gpt-5", null, null, null), directory.resolve("project"), null, agent.baseEnvironment, true),
      agent.launch(null, null, null)];

    Assert.areEqual(JSON.stringify([["--disable-project-configs", "acp"], ["--model", "gpt-5", "--disable-project-configs", "acp"], ["--disable-project-configs", "acp"]]),
      JSON.stringify(launches.map(t => t.command.arguments)));
  }

  @TestMethod
  public takesThePersonsRulesInAChatTurnFromTheirConfigFolderOrHomeAndOnlyTheirDenyRulesOutsideOne(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const own = directory.resolve("own");
    const usual = directory.resolve("usual");
    mkdirSync(join(home, ".cursor"), { recursive: true });
    mkdirSync(own);
    writeFileSync(join(home, ".cursor", "cli-config.json"), JSON.stringify({ permissions: { allow: ["Shell(ls)"], deny: ["Shell(rm)"] } }));
    writeFileSync(join(own, "cli-config.json"), JSON.stringify({ permissions: { allow: ["Shell(git)"], deny: [] } }));
    const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), { HOME: home }, usual, () => null, "linux");
    const rules = (): string => JSON.stringify((JSON.parse(readFileSync(join(usual, "cli-config.json"), "utf8")) as { permissions: unknown }).permissions);

    agent.launch(null, null, null, ["open_panel"], agent.baseEnvironment, true);
    const fromHome = rules();
    agent.launch(null, null, null);
    const keptOutside = rules();
    agent.launch(null, null, null, null, { HOME: home, CURSOR_CONFIG_DIR: own }, true);
    const fromConfigFolder = rules();
    agent.launch(null, null, null, null, { HOME: home, CURSOR_CONFIG_DIR: usual }, true);
    const fromItsOwnProfile = rules();

    Assert.areEqual(JSON.stringify({ allow: ["Shell(ls)", "Mcp(teamrun:open_panel)"], deny: ["Shell(rm)"] }), fromHome);
    Assert.areEqual(JSON.stringify({ allow: ["Mcp(teamrun:open_panel)"], deny: ["Shell(rm)"] }), keptOutside);
    Assert.areEqual(JSON.stringify({ allow: ["Shell(git)", "Mcp(teamrun:open_panel)"], deny: [] }), fromConfigFolder);
    Assert.areEqual(JSON.stringify({ allow: ["Mcp(teamrun:open_panel)"], deny: [] }), fromItsOwnProfile);
  }

  @TestMethod
  public takesNoRulesFromItsOwnProfileFolderNamedInAnotherCaseOnWindows(): void {
    using directory = new TemporaryDirectory();
    const usual = directory.resolve("usual");
    const named = directory.resolve("USUAL");
    const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), { HOME: directory.resolve("home") }, usual, () => null, "win32");
    agent.launch(null, null, null, ["open_panel"], agent.baseEnvironment, true);
    mkdirSync(named, { recursive: true });
    writeFileSync(join(named, "cli-config.json"), JSON.stringify({ permissions: { allow: ["Shell(ls)"], deny: [] } }));

    agent.launch(null, null, null, null, { HOME: directory.resolve("home"), CURSOR_CONFIG_DIR: named }, true);

    Assert.areEqual(JSON.stringify({ allow: ["Mcp(teamrun:open_panel)"], deny: [] }),
      JSON.stringify((JSON.parse(readFileSync(join(usual, "cli-config.json"), "utf8")) as { permissions: unknown }).permissions));
  }

  @TestMethod
  public refusesAChatTurnWhoseRulesCantBeReadNamingTheFileButNotALaunchOutsideOne(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const usual = directory.resolve("usual");
    mkdirSync(join(home, ".cursor"), { recursive: true });
    writeFileSync(join(home, ".cursor", "cli-config.json"), "{ not json");
    const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), { HOME: home }, usual, () => null, "linux");

    const refusal = Assert.throws(() => agent.launch(null, null, null, null, agent.baseEnvironment, true), Error).message;
    const title = agent.launch(null, null, null);

    Assert.areEqual(Resources.formatCursorConfigUnreadable(join(home, ".cursor", "cli-config.json")), refusal);
    Assert.areEqual(join(usual, "title-home"), title.environment["HOME"]);
  }

  @TestMethod
  public readiesANewProfileForItsSignInTerminalSoTheFirstLaunchAfterTheSignInTakesIt(): void {
    using directory = new TemporaryDirectory();
    const work = directory.resolve("work");
    mkdirSync(work);
    const provider = new Provider("c", "cursor", "Work", work, AuthStatus.Unknown, null, null, null, null, "t");
    const agent = new CursorAgent(null, {}, directory.resolve("usual"));

    const profile = agent.descriptor.profile;
    Assert.isNotNull(profile);
    agent.prepareProfile(provider);
    const missing = Object.values(profile.signInVariables).filter(t => !existsSync(join(work, ...t.split("/"))));
    writeFileSync(join(work, "signed-in.fixture"), "signed in");
    const launched = new CursorAgent(new ProcessCommand("cursor-agent", []), {}, directory.resolve("usual")).launch(provider, null, null);

    Assert.areEqual("", missing.join(","));
    Assert.areEqual(work, launched.environment["CURSOR_CONFIG_DIR"]);
    Assert.areEqual("signed in", readFileSync(join(work, "signed-in.fixture"), "utf8"));
  }

  @TestMethod
  public signsOutWithCursorsOwnLogoutInTheProvidersProfile(): void {
    using directory = new TemporaryDirectory();
    const agent = new CursorAgent(new ProcessCommand("cursor-agent", []), {}, directory.resolve("usual"));
    const provider = new Provider("c", "cursor", "Work", directory.resolve("work"), AuthStatus.LoggedIn, null, null, null, null, "t");

    const launch = agent.signOutLaunch(provider, agent.baseEnvironment);

    Assert.areEqual("cursor-agent logout", [launch.command.executable, ...launch.command.arguments].join(" "));
    Assert.areEqual(directory.resolve("work"), launch.environment["CURSOR_CONFIG_DIR"]);
    Assert.areEqual(join(directory.resolve("work"), "data"), launch.environment["CURSOR_DATA_DIR"]);
  }

  @TestMethod
  public takesOneProviderPerMacWhereTheKeychainHoldsTheSignInAndSeveralElsewhere(): void {
    const kind = (platform: string): string | null => new CursorAgent(null, {}, "/work", undefined, platform).descriptor.singleAccount;

    Assert.areEqual(Resources.cursorOneAccountPerMac, kind("darwin"));
    Assert.isNull(kind("linux"));
    Assert.isNull(kind("win32"));
  }

  @TestMethod
  public readsNoVersionFromInitializeAndLeavesTheRestToItsSession(): void {
    const agent = new CursorAgent(null, {}, "/work");
    const initialized = JsonReader.fromValue({ protocolVersion: 1, authMethods: [{ id: "cursor_login", name: "Cursor Login" }] });

    Assert.isNull(agent.readVersion(initialized));
    Assert.isNull(agent.isSignedIn(null));
    Assert.isNull(agent.readModels(initialized));
    Assert.isNull(agent.readSignInMethod(initialized));
    Assert.isNull(agent.readEffort(initialized));
    Assert.isNull(agent.memberOf("gpt-5", "GPT-5"));
    Assert.isNull(agent.sessionMeta());
    Assert.isNull(agent.formatUnsupported(null));
    Assert.isFalse(agent.authenticates);
    Assert.isTrue(agent.modelAtLaunch);
    Assert.isFalse(agent.compacts);
    Assert.areEqual(0, agent.forkMethods.length);
    Assert.areEqual(Resources.formatCursorStopped("max_tokens"), agent.formatStopped("max_tokens"));
  }

  @TestMethod
  public async listsThePersonsOwnServersFromTheMcpFileInTheirHomeWhateverTheConfigFolderOrProfile(): Promise<void> {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const config = directory.resolve("config");
    const profile = directory.resolve("profile");
    for (const [folder, name] of [[join(home, ".cursor"), "docs"], [config, "inConfig"], [profile, "inProfile"]] as const) {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "mcp.json"), JSON.stringify({ mcpServers: { [name]: { command: name }, teamrun: { url: "http://127.0.0.1:1/mcp" } } }));
    }
    const agent = new CursorAgent(null, { HOME: home, CURSOR_CONFIG_DIR: config }, profile, () => null, "linux");
    const provider = new Provider("c", "cursor", "Work", profile, AuthStatus.Unknown, null, null, null, null, "t");

    Assert.areEqual(JSON.stringify([{ name: "docs", state: "Configured" }]), JSON.stringify((await agent.listOwnMcpServers(provider)).map(t => t.toJson())));
    Assert.areEqual(JSON.stringify([{ name: "docs", state: "Configured" }]), JSON.stringify((await agent.listOwnMcpServers(null)).map(t => t.toJson())));
    Assert.areEqual(0, (await new CursorAgent(null, { HOME: directory.resolve("nobody") }, profile, () => null, "linux").listOwnMcpServers(null)).length);
  }
}
