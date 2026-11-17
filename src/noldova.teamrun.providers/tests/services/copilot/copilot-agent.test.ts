/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { CopilotAgent, CopilotHooks, ExecutableNotFoundException, ProcessCommand, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class CopilotAgentTests {
  @TestMethod
  public launchesInItsWorkFolderWithoutOtherProvidersSettingsOrAnAllowAllOverrideAndAProfileWithoutThePersonsGitHubTokens(): void {
    using directory = new TemporaryDirectory();
    const work = directory.resolve("work");
    const base = { PATH: "/bin", HOME: "/people/person-1", OPENAI_API_KEY: "fixture", GROK_HOME: "/g", ANTHROPIC_API_KEY: "fixture", COPILOT_HOME: "/elsewhere",
      COPILOT_ALLOW_ALL: "true", COPILOT_MODEL: "fixture-model", GH_TOKEN: "fixture-gh", GITHUB_TOKEN: "fixture-github", copilot_github_token: "fixture-copilot" };
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), base, work, () => null, directory.resolve("home"));
    const provider = new Provider("a", "copilot", "Work", "/profiles/copilot", AuthStatus.Unknown, null, null, null, null, "t");

    const launched = agent.launch(provider, new RequestedSettings("copilot", null, "high"), null);
    const native = agent.launch(null, null, null);

    Assert.areEqual("/bin/copilot --acp --stdio --no-auto-update --reasoning-effort high --disable-builtin-mcps",
      [launched.command.executable, ...launched.command.arguments].join(" "));
    Assert.areEqual(work, launched.directory);
    Assert.isTrue(existsSync(work));
    Assert.areEqual(JSON.stringify({ PATH: "/bin", HOME: "/people/person-1", COPILOT_MODEL: "fixture-model", COPILOT_HOME: "/profiles/copilot" }),
      JSON.stringify(launched.environment));
    Assert.areEqual("--acp --stdio --no-auto-update --disable-builtin-mcps", native.command.arguments.join(" "));
    Assert.isUndefined(native.environment["COPILOT_HOME"]);
    Assert.areEqual(JSON.stringify(["fixture-gh", "fixture-github", "fixture-copilot"]),
      JSON.stringify([native.environment["GH_TOKEN"], native.environment["GITHUB_TOKEN"], native.environment["copilot_github_token"]]));
    Assert.areEqual(Resources.copilotNotFound, Assert.throws(() => new CopilotAgent(null, base, work).launch(null, null, null), ExecutableNotFoundException).message);
  }

  @TestMethod
  public launchesCopilotAllowingEachApprovedTeamRunToolOnTeamRunsServerByNameAndNoneThatCouldWidenTheRule(): void {
    using directory = new TemporaryDirectory();
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), {}, directory.resolve("work"), () => null, directory.resolve("home"));

    const approved = agent.launch(null, null, null, ["teamrun_create_chat", "terminal_run", "teamrun_*", "a(b)", "x,y", ""]);
    const widening = agent.launch(null, null, null, ["*", "teamrun"]);
    const none = agent.launch(null, null, null, []);

    Assert.areEqual("--acp --stdio --no-auto-update --allow-tool=teamrun(teamrun_create_chat),teamrun(terminal_run) --disable-builtin-mcps",
      approved.command.arguments.join(" "));
    Assert.areEqual("--acp --stdio --no-auto-update --allow-tool=teamrun(teamrun) --disable-builtin-mcps", widening.command.arguments.join(" "));
    Assert.areEqual("--acp --stdio --no-auto-update --disable-builtin-mcps", none.command.arguments.join(" "));
  }

  @TestMethod
  public leavesItsInstructionFilesToCopilotInItsHomeWithNoFlagThatTurnsThemOffAndReadsNoneItself(): void {
    using directory = new TemporaryDirectory();
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), { PATH: "/bin", HOME: "/people/person-1" }, directory.resolve("work"), () => null,
      directory.resolve("home"));
    const provider = new Provider("a", "copilot", "Work", "/profiles/copilot", AuthStatus.Unknown, null, null, null, null, "t");

    const launches = [agent.launch(provider, null, null), agent.launch(null, null, null)];

    Assert.areEqual("/profiles/copilot,", launches.map(t => t.environment["COPILOT_HOME"] ?? "").join(","));
    Assert.areEqual("/people/person-1,/people/person-1", launches.map(t => t.environment["HOME"]).join(","));
    Assert.isFalse(launches.some(t => t.command.arguments.includes("--no-custom-instructions")));
    Assert.isFalse("readHomeInstructions" in agent);
  }

  @TestMethod
  public leavesCopilotMemoryToThePersonsAccountInAChatTurnAndGivesATitleSessionNoToolThatCouldSaveToIt(): void {
    using directory = new TemporaryDirectory();
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), { PATH: "/bin", HOME: "/people/person-1" }, directory.resolve("work"), () => null,
      directory.resolve("home"));
    const provider = new Provider("a", "copilot", "Work", "/profiles/copilot", AuthStatus.Unknown, null, null, null, null, "t");

    const chats = [agent.launch(provider, null, null, ["open_panel"], agent.baseEnvironment, true), agent.launch(null, null, null, null, agent.baseEnvironment, true)];

    Assert.areEqual("/profiles/copilot,", chats.map(t => t.environment["COPILOT_HOME"] ?? "").join(","));
    Assert.isFalse(chats.some(t => t.command.arguments.some(a => /^--(available-tools|excluded-tools|deny-tool)|memory/u.test(a))));
    Assert.isTrue(agent.titleSessionArguments.includes("--available-tools=none"));
  }

  @TestMethod
  public async turnsOffItsBuiltInServersAndEachServerItsProfileItsPluginsAndTheTurnsFolderUpToItsRepositoryNameUnlessAChatTurnKeepsThem(): Promise<void> {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const profile = directory.resolve("profile");
    const repository = directory.resolve("repository");
    const folder = join(repository, "app");
    const loose = directory.resolve("loose", "inner");
    mkdirSync(join(home, ".copilot"), { recursive: true });
    mkdirSync(join(profile, "installed-plugins", "_direct", "notes-plugin"), { recursive: true });
    mkdirSync(join(profile, "installed-plugins", "awesome-copilot", "empty-plugin"), { recursive: true });
    mkdirSync(join(repository, ".git"), { recursive: true });
    mkdirSync(join(repository, ".github"), { recursive: true });
    mkdirSync(join(folder, ".github"), { recursive: true });
    mkdirSync(loose, { recursive: true });
    writeFileSync(join(home, ".copilot", "mcp-config.json"), `// Copilot writes comments
${JSON.stringify({ mcpServers: { docs: { command: "docs" } } })}`);
    writeFileSync(join(profile, "mcp-config.json"), JSON.stringify({ mcpServers: { github: { url: "https://example.com/mcp" }, notes: { command: "notes" } } }));
    writeFileSync(join(profile, "installed-plugins", "README.md"), "plugins");
    writeFileSync(join(profile, "settings.json"), JSON.stringify({ enabledPlugins: { "browser-use": true, "old-plugin": false } }));
    writeFileSync(join(profile, "installed-plugins", "_direct", "notes-plugin", ".mcp.json"), JSON.stringify({ mcpServers: { "plugin-notes": {}, notes: {} } }));
    writeFileSync(join(repository, ".mcp.json"), JSON.stringify({ mcpServers: { "root-dot": {} } }));
    writeFileSync(join(repository, ".github", "mcp.json"), JSON.stringify({ mcpServers: { "root-github": {} } }));
    writeFileSync(join(folder, ".github", "mcp.json"), JSON.stringify({ mcpServers: { "app-github": {} } }));
    writeFileSync(directory.resolve(".mcp.json"), JSON.stringify({ mcpServers: { outside: {} } }));
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), {}, directory.resolve("work"), () => null, home);
    const provider = new Provider("a", "copilot", "Work", profile, AuthStatus.Unknown, null, null, null, null, "t");
    const args = (launch: { command: { arguments: readonly string[] } }): string => launch.command.arguments.slice(3).join(" ");

    const named = args(agent.launch(provider, null, folder));
    const native = args(agent.launch(null, null, null));
    const switched = args(agent.launch(provider.withOwnMcpServers(true), null, folder));
    const kept = args(agent.launch(provider.withOwnMcpServers(true), null, folder, null, undefined, true));
    const chatOff = args(agent.launch(provider, null, folder, null, undefined, true));
    const headless = args(agent.headlessLaunch(provider));
    const outside = args(agent.launch(null, null, loose));
    writeFileSync(join(profile, "mcp-config.json"), JSON.stringify({ servers: {} }));
    const unnamed = args(agent.launch(provider, null, null));

    Assert.areEqual(["--disable-builtin-mcps", "--disable-mcp-server=github", "--disable-mcp-server=notes", "--disable-mcp-server=app-github",
      "--disable-mcp-server=root-dot", "--disable-mcp-server=root-github", "--disable-mcp-server=plugin-notes", "--disable-mcp-server=browser-use"].join(" "), named);
    Assert.areEqual(JSON.stringify([{ name: "docs", state: "Configured" }]), JSON.stringify((await agent.listOwnMcpServers(null)).map(t => t.toJson())));
    Assert.areEqual("--disable-builtin-mcps --disable-mcp-server=docs", native);
    Assert.areEqual(named, switched);
    Assert.areEqual("", kept);
    Assert.areEqual(named, chatOff);
    Assert.areEqual("--disable-builtin-mcps --disable-mcp-server=github --disable-mcp-server=notes --disable-mcp-server=plugin-notes --disable-mcp-server=browser-use",
      headless);
    Assert.areEqual("--disable-builtin-mcps --disable-mcp-server=docs --disable-mcp-server=outside", outside);
    Assert.areEqual("--disable-builtin-mcps --disable-mcp-server=plugin-notes --disable-mcp-server=notes --disable-mcp-server=browser-use", unnamed);
    Assert.isFalse(named.includes("example.com"));
  }

  @TestMethod
  public async refusesToStartNamingTheFileWhenAFileNamingMcpServersExistsButCantBeReadOrIsTooLarge(): Promise<void> {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const repository = directory.resolve("repository");
    mkdirSync(join(repository, ".git"), { recursive: true });
    mkdirSync(profile, { recursive: true });
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), {}, directory.resolve("work"), () => null, directory.resolve("home"));
    const provider = new Provider("a", "copilot", "Work", profile, AuthStatus.Unknown, null, null, null, null, "t");
    const refusal = (launch: () => unknown): string => Assert.throws(launch, Error).message;

    writeFileSync(join(profile, "mcp-config.json"), "{ not json");
    const malformed = refusal(() => agent.launch(provider, null, null));
    const listing = (await Assert.throwsAsync(() => agent.listOwnMcpServers(provider), Error)).message;
    const headless = refusal(() => agent.headlessLaunch(provider));
    writeFileSync(join(profile, "mcp-config.json"), JSON.stringify({ mcpServers: ["notes"] }));
    const notAnObject = refusal(() => agent.launch(provider, null, null));
    writeFileSync(join(profile, "mcp-config.json"), JSON.stringify({ mcpServers: {} }));
    mkdirSync(join(repository, ".mcp.json"));
    const unreadable = refusal(() => agent.launch(provider, null, repository));
    truncateSync(join(profile, "mcp-config.json"), Resources.maximumConfigurationBytes + 1);
    const tooLarge = refusal(() => agent.launch(provider, null, null));
    const tooLargeListing = (await Assert.throwsAsync(() => agent.listOwnMcpServers(provider), Error)).message;
    const folderProfile = directory.resolve("folder-profile");
    mkdirSync(join(folderProfile, "mcp-config.json"), { recursive: true });
    const folderListing = (await Assert.throwsAsync(() => agent.listOwnMcpServers(new Provider("b", "copilot", "Folder", folderProfile, AuthStatus.Unknown, null, null,
      null, null, "t")), Error)).message;
    writeFileSync(join(profile, "mcp-config.json"), JSON.stringify({ mcpServers: {} }));
    writeFileSync(join(profile, "installed-plugins"), "not a folder");
    const plugins = refusal(() => agent.launch(provider, null, null));

    Assert.areEqual(Resources.formatCopilotMcpConfigUnreadable(join(profile, "mcp-config.json")), malformed);
    Assert.areEqual(malformed, listing);
    Assert.areEqual(malformed, headless);
    Assert.areEqual(malformed, notAnObject);
    Assert.areEqual(Resources.formatCopilotMcpConfigUnreadable(join(repository, ".mcp.json")), unreadable);
    Assert.areEqual(Resources.formatCopilotMcpConfigTooLarge(join(profile, "mcp-config.json")), tooLarge);
    Assert.areEqual(tooLarge, tooLargeListing);
    Assert.areEqual(Resources.formatCopilotMcpConfigUnreadable(join(folderProfile, "mcp-config.json")), folderListing);
    Assert.areEqual(Resources.formatCopilotMcpConfigUnreadable(join(profile, "installed-plugins")), plugins);
  }

  @TestMethod
  public async refusesToStartNamingTheFileAndItsSourceWhenAFileItReadsNamesATeamRunServer(): Promise<void> {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const profile = directory.resolve("profile");
    const repository = directory.resolve("repository");
    const plugin = join(profile, "installed-plugins", "_direct", "notes-plugin");
    mkdirSync(join(home, ".copilot"), { recursive: true });
    mkdirSync(join(repository, ".git"), { recursive: true });
    mkdirSync(join(repository, ".github"), { recursive: true });
    mkdirSync(plugin, { recursive: true });
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), {}, directory.resolve("work"), () => null, home);
    const provider = new Provider("a", "copilot", "Work", profile, AuthStatus.Unknown, null, null, null, null, "t");
    const kept = new Provider("a", "copilot", "Work", profile, AuthStatus.Unknown, null, null, null, null, "t", true, true);
    const refusal = (launch: () => unknown): string => Assert.throws(launch, Error).message;
    const keptRefusal = (folder: string | null): string => refusal(() => agent.launch(kept, null, folder, null, undefined, true));
    const servers = (names: readonly string[]): string => JSON.stringify({ mcpServers: Object.fromEntries(names.map(t => [t, { command: t }])) });

    writeFileSync(join(home, ".copilot", "mcp-config.json"), servers(["docs", "teamrun"]));
    const native = refusal(() => agent.launch(null, null, null));
    const nativeListing = await agent.listOwnMcpServers(null);
    writeFileSync(join(profile, "mcp-config.json"), servers(["teamrun"]));
    const user = refusal(() => agent.launch(provider, null, null));
    const keptUser = keptRefusal(null);
    const headless = refusal(() => agent.headlessLaunch(provider));
    writeFileSync(join(profile, "mcp-config.json"), servers([]));
    writeFileSync(join(repository, ".mcp.json"), servers(["notes", "teamrun"]));
    const project = refusal(() => agent.launch(provider, null, repository));
    const keptProject = keptRefusal(repository);
    const projectless = agent.launch(provider, null, null).command.arguments.slice(3).join(" ");
    writeFileSync(join(repository, ".mcp.json"), servers([]));
    writeFileSync(join(repository, ".github", "mcp.json"), servers(["teamrun"]));
    const github = refusal(() => agent.launch(provider, null, repository));
    const keptGithub = keptRefusal(repository);
    writeFileSync(join(plugin, ".mcp.json"), servers(["teamrun"]));
    const fromPlugin = refusal(() => agent.launch(provider, null, null));
    const keptPlugin = keptRefusal(null);
    writeFileSync(join(plugin, ".mcp.json"), servers([]));
    writeFileSync(join(profile, "settings.json"), JSON.stringify({ enabledPlugins: { teamrun: true } }));
    const enabledPlugin = refusal(() => agent.launch(provider, null, null));
    const keptEnabledPlugin = keptRefusal(null);
    writeFileSync(join(profile, "settings.json"), JSON.stringify({ enabledPlugins: { teamrun: false } }));
    const disabledPlugin = agent.launch(provider, null, null).command.arguments.slice(3).join(" ");

    Assert.areEqual(Resources.formatCopilotTeamRunServerNamed("user", join(home, ".copilot", "mcp-config.json")), native);
    Assert.areEqual(`GitHub Copilot didn't start: the user MCP servers in ${join(home, ".copilot", "mcp-config.json")} include one named teamrun, which Copilot `
      + "could use in place of TeamRun's own. Rename that server, then try again.", native);
    Assert.areEqual(JSON.stringify([{ name: "docs", state: "Configured" }]), JSON.stringify(nativeListing.map(t => t.toJson())));
    Assert.areEqual(Resources.formatCopilotTeamRunServerNamed("user", join(profile, "mcp-config.json")), user);
    Assert.areEqual(user, headless);
    Assert.areEqual(Resources.formatCopilotTeamRunServerNamed("project", join(repository, ".mcp.json")), project);
    Assert.areEqual("--disable-builtin-mcps", projectless);
    Assert.areEqual(Resources.formatCopilotTeamRunServerNamed("project", join(repository, ".github", "mcp.json")), github);
    Assert.areEqual(Resources.formatCopilotTeamRunServerNamed("plugin", join(plugin, ".mcp.json")), fromPlugin);
    Assert.areEqual(Resources.formatCopilotTeamRunServerNamed("plugin", join(profile, "settings.json")), enabledPlugin);
    Assert.areEqual("--disable-builtin-mcps", disabledPlugin);
    Assert.areEqual(JSON.stringify([user, project, github, fromPlugin, enabledPlugin]),
      JSON.stringify([keptUser, keptProject, keptGithub, keptPlugin, keptEnabledPlugin]));
  }

  @TestMethod
  public takesTheTitleFromTheOpeningWhenTheMachinesPolicyFolderHasHookFilesOnEveryPlatform(): void {
    using directory = new TemporaryDirectory();
    const policy = directory.resolve("policy.d");
    mkdirSync(policy, { recursive: true });
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), {}, directory.resolve("work"), () => null, directory.resolve("home"), policy);

    writeFileSync(join(policy, "README.txt"), "not a policy file");
    const none = agent.hasNoIsolatedAsk(null);
    writeFileSync(join(policy, "audit.json"), "{}");
    const policyFile = agent.hasNoIsolatedAsk(null);

    Assert.areEqual("false,true", [none, policyFile].join());
    Assert.areEqual(JSON.stringify(["/etc/github-copilot/policy.d", "/etc/github-copilot/policy.d", join("D:\\Data", "GitHub", "Copilot", "policy.d"),
      join("C:\\ProgramData", "GitHub", "Copilot", "policy.d")]), JSON.stringify([CopilotHooks.policyFolder("linux", { ProgramData: "D:\\Data" }),
      CopilotHooks.policyFolder("darwin", {}), CopilotHooks.policyFolder("win32", { ProgramData: "D:\\Data" }), CopilotHooks.policyFolder("win32", { ProgramData: " " })]));
  }

  @TestMethod
  public takesTheTitleFromTheOpeningWhenThePersonsCopilotHasHooksInAnySourceOrOneCantBeRead(): void {
    using directory = new TemporaryDirectory();
    const profile = directory.resolve("profile");
    const plugin = join(profile, "installed-plugins", "_direct", "notes-plugin");
    mkdirSync(join(profile, "hooks", "notes"), { recursive: true });
    mkdirSync(join(plugin, "hooks"), { recursive: true });
    const agent = new CopilotAgent(new ProcessCommand("/bin/copilot", []), {}, directory.resolve("work"), () => null, directory.resolve("home"),
      directory.resolve("policy.d"));
    const provider = new Provider("a", "copilot", "Work", profile, AuthStatus.Unknown, null, null, null, null, "t");
    const settings = join(profile, "settings.json");

    writeFileSync(join(profile, "hooks", "notes.txt"), "not a hook file");
    writeFileSync(settings, `// the person's settings\n${JSON.stringify({ hooks: {}, enabledPlugins: {} })}`);
    const none = agent.hasNoIsolatedAsk(provider);
    writeFileSync(join(profile, "hooks", "check.json"), "{}");
    const hookFile = agent.hasNoIsolatedAsk(provider);
    rmSync(join(profile, "hooks", "check.json"));
    writeFileSync(settings, JSON.stringify({ hooks: { preToolUse: [] } }));
    const inSettings = agent.hasNoIsolatedAsk(provider);
    writeFileSync(settings, "{");
    const unreadable = agent.hasNoIsolatedAsk(provider);
    truncateSync(settings, Resources.maximumConfigurationBytes + 1);
    const tooLarge = agent.hasNoIsolatedAsk(provider);
    rmSync(settings);
    mkdirSync(settings);
    const notAFile = agent.hasNoIsolatedAsk(provider);
    rmSync(settings, { recursive: true });
    writeFileSync(join(plugin, "hooks.json"), "{}");
    const pluginFile = agent.hasNoIsolatedAsk(provider);
    rmSync(join(plugin, "hooks.json"));
    writeFileSync(join(plugin, "hooks", "hooks.json"), "{}");
    const pluginFolder = agent.hasNoIsolatedAsk(provider);
    const usualHome = agent.hasNoIsolatedAsk(null);
    const other = directory.resolve("other");
    mkdirSync(other);
    writeFileSync(join(other, "hooks"), "a file where the folder belongs");
    const unlisted = agent.hasNoIsolatedAsk(new Provider("b", "copilot", "Other", other, AuthStatus.Unknown, null, null, null, null, "t"));

    Assert.areEqual(JSON.stringify([false, true, true, true, true, true, true, true, false, true]),
      JSON.stringify([none, hookFile, inSettings, unreadable, tooLarge, notAFile, pluginFile, pluginFolder, usualHome, unlisted]));
  }

  @TestMethod
  public looksForCopilotAgainWhileItIsNotFoundAndKeepsItOnceFound(): void {
    using directory = new TemporaryDirectory();
    let found: ProcessCommand | null = null;
    let looks = 0;
    const agent = new CopilotAgent(null, {}, directory.resolve("work"), () => {
      looks++;
      return found;
    });

    Assert.areEqual(Resources.copilotNotFound, Assert.throws(() => agent.launch(null, null, null), ExecutableNotFoundException).message);
    found = new ProcessCommand("/opt/tools/bin/copilot", []);
    const launched = agent.launch(null, null, null);
    found = null;
    const headless = agent.headlessLaunch(null);

    Assert.areEqual("/opt/tools/bin/copilot /opt/tools/bin/copilot 2", `${launched.command.executable} ${headless.command.executable} ${looks}`);
  }

  @TestMethod
  public readsOnlyItsVersionFromInitializeAndLeavesSignInAndModelsToItsSession(): void {
    const agent = new CopilotAgent(null, {}, "/work");
    const version = (value: object): string | null => agent.readVersion(JsonReader.fromValue(value));
    const initialized = JsonReader.fromValue({ agentInfo: { version: "1.0.100" } });

    Assert.areEqual("1.0.100", version({ agentInfo: { name: "Copilot", version: "1.0.100" } }));
    Assert.isNull(version({ agentInfo: { name: "Copilot" } }));
    Assert.isNull(version({ agentInfo: null }));
    Assert.isNull(version({}));
    Assert.isNull(agent.isSignedIn(null));
    Assert.isNull(agent.readModels(initialized));
    Assert.isNull(agent.readSignInMethod(initialized));
    Assert.isNull(agent.readEffort(initialized));
    Assert.isNull(agent.sessionMeta());
    Assert.isNull(agent.formatUnsupported("1.0.100"));
    Assert.areEqual(Resources.formatCopilotStopped("max_tokens"), agent.formatStopped("max_tokens"));
    Assert.isFalse(agent.authenticates);
    Assert.isTrue(agent.effortAtLaunch);
    Assert.isTrue(agent.modelAtLaunch);
    Assert.isFalse(agent.prefersResume);
    Assert.areEqual("Auto", agent.descriptor.defaultModelName);
    Assert.areEqual(JSON.stringify({ variable: "COPILOT_HOME", signInCommand: "copilot login", usualFolder: join(homedir(), ".copilot"), toolCommand: "copilot", signInVariables: {}, signInValues: {}, personFolders: [] }),
      JSON.stringify(agent.descriptor.profile?.toJson()));
    Assert.areEqual(join(homedir(), ".copilot"), new CopilotAgent(null, { COPILOT_HOME: "/work/copilot-home" }, "/work").descriptor.profile?.usualFolder);
    Assert.areEqual([join(homedir(), ".copilot"), "/work/copilot-home"].join(),
      new CopilotAgent(null, { COPILOT_HOME: "/work/copilot-home" }, "/work").profileSearch.folders.join());
    Assert.areEqual("config.json,session-state,history-session-state,logs", agent.profileSearch.entries.join());
    Assert.isNull(agent.descriptor.ownMcpServersUnavailable);
    Assert.areEqual("false:/logout:null:false", [agent.descriptor.supportsSignOut, agent.descriptor.signOutCommand, agent.signOut ?? "null", agent.logsOut]
      .join(":"));
  }
}
