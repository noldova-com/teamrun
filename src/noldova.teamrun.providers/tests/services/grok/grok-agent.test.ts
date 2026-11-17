/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { GrokAgent, GrokShortHome, ProcessCommand, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class GrokAgentTests {
  @TestMethod
  public namesTheShortHomeForAChatFolderTooDeepForGrokOnWindowsAndKeepsATitleSessionsOwnHome(): void {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("a-person-folder-deep-enough-that-its-grok-home-is-longer-than-the-short-one");
    const local = directory.resolve("local");
    mkdirSync(join(person, ".grok"), { recursive: true });
    mkdirSync(local);
    const agent = new GrokAgent(new ProcessCommand("grok", []), { HOME: person, USERPROFILE: person, LOCALAPPDATA: local }, directory.resolve("profile"), undefined, undefined,
      new GrokShortHome("win32"));

    const near = agent.launch(null, new RequestedSettings("grok", null, null), "C:\\p");
    const deep = agent.launch(null, new RequestedSettings("grok", null, null), `C:\\${"x".repeat(200)}`);
    const title = agent.launch(null, new RequestedSettings("grok", null, null), `C:\\${"x".repeat(200)}`, null, undefined, false, true);

    Assert.areEqual(join(person, ".grok"), near.environment[Resources.grokHomeVariable]);
    Assert.areNotEqual(join(person, ".grok"), deep.environment[Resources.grokHomeVariable]);
    Assert.areEqual(realpathSync(join(person, ".grok")), realpathSync(deep.environment[Resources.grokHomeVariable]!));
    Assert.areEqual(directory.resolve("title-home"), title.environment[Resources.grokHomeVariable]);
  }

  @TestMethod
  public launchesGrokWithTheSearchAndUseToolsThatReachItsMcpTools(): void {
    using directory = new TemporaryDirectory();
    const agent = new GrokAgent(new ProcessCommand("grok", []), {}, directory.resolve("profile"));

    const launch = agent.launch(null, new RequestedSettings("grok", "grok-4", "high"));

    Assert.areEqual("--no-auto-update,--permission-mode,default,--model,grok-4,--reasoning-effort,high,agent,--no-leader,stdio",
      launch.command.arguments.join(","));
    Assert.areEqual("_x.ai/auth/logout,x.ai/auth/logout", agent.signOut.methods.join(","));
    Assert.isFalse(agent.logsOut);
  }

  @TestMethod
  public writesNothingInAGrokHomeAndLeavesTheApprovedToolsToTheTurn(): void {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("person");
    mkdirSync(join(person, ".grok"), { recursive: true });
    const agent = new GrokAgent(new ProcessCommand("grok", []), { HOME: person, USERPROFILE: person }, directory.resolve("profile"));
    const added = new Provider("a", "grok", "Work", directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t");

    const launched = agent.launch(null, new RequestedSettings("grok", null, null), null, ["teamrun_create_chat"]).command.arguments.join(",");
    agent.launch(added, null, null, ["teamrun_create_chat"]);

    Assert.areEqual("--no-auto-update,--permission-mode,default,agent,--no-leader,stdio", launched);
    Assert.areEqual(".grok", readdirSync(directory.path).filter(t => t !== "person").concat(readdirSync(person)).join(","));
    Assert.areEqual(0, readdirSync(join(person, ".grok")).length);
  }

  @TestMethod
  public readsTheBlockOfTeamRunsServerFromTheProvidersOwnGrokHomeOrThePersons(): void {
    using directory = new TemporaryDirectory();
    const block = (home: string, reason: string): void => {
      mkdirSync(join(home, "logs"), { recursive: true });
      writeFileSync(join(home, "logs", "unified.jsonl"),
        `${JSON.stringify({ ts: "2026-10-25T18:36:40.000Z", msg: Resources.grokMcpBlockedMessage, ctx: { server: "teamrun", reason } })}\n`);
    };
    const person = directory.resolve("person");
    block(join(person, ".grok"), "person's home");
    block(directory.resolve("own"), "own home");
    block(directory.resolve("former"), "former profile");
    const agent = new GrokAgent(new ProcessCommand("grok", []), { HOME: person, USERPROFILE: person }, directory.resolve("former"));
    const provider = (folder: string): Provider => new Provider("a", "grok", "Work", directory.resolve(folder), AuthStatus.Unknown, null, null, null, null, "t");

    Assert.areEqual("own home", agent.readMcpBlocks(provider("own"), "2026-10-25T18:36:30.000Z").get("teamrun"));
    Assert.areEqual("person's home", agent.readMcpBlocks(null, "2026-10-25T18:36:30.000Z").get("teamrun"));
    Assert.areEqual("person's home", agent.readMcpBlocks(provider("former"), "2026-10-25T18:36:30.000Z").get("teamrun"));
  }

  @TestMethod
  public launchesGrokWithoutItsOwnSubAgentsForATurnInPlanOrAskMode(): void {
    using directory = new TemporaryDirectory();
    const agent = new GrokAgent(new ProcessCommand("grok", []), {}, directory.resolve("profile"));

    const launched = ["default", "plan", "ask", "bypassPermissions", "unknown", null].map(t => `${t}:${agent.launch(null, new RequestedSettings("grok", null, null, null, t)).command
      .arguments.includes(Resources.grokNoSubAgentsArgument)}`);

    Assert.areEqual("default:false,plan:true,ask:true,bypassPermissions:false,unknown:false,null:false", launched.join(","));
  }

  @TestMethod
  public launchesGrokInItsBypassPermissionsModeOnlyForAlwaysApproveAndInItsDefaultOneOtherwise(): void {
    using directory = new TemporaryDirectory();
    const agent = new GrokAgent(new ProcessCommand("grok", []), {}, directory.resolve("profile"));

    const launched = ["bypassPermissions", "plan", "unknown", null].map(t => {
      const args = agent.launch(null, new RequestedSettings("grok", null, null, null, t)).command.arguments;
      return `${t}:${args[args.indexOf("--permission-mode") + 1]}`;
    });

    Assert.areEqual("bypassPermissions:bypassPermissions,plan:default,unknown:default,null:default", launched.join(","));
    Assert.areEqual("bypassPermissions", agent.launchMode);
    Assert.areEqual("plan,ask", agent.modes.filter(t => t.readOnly).map(t => t.id).join(","));
  }

  @TestMethod
  public listsGroksOwnSessionModesBesidesItsLaunchModeAndRunsThemThoughItsSessionListsNone(): void {
    using directory = new TemporaryDirectory();
    const agent = new GrokAgent(new ProcessCommand("grok", []), {}, directory.resolve("profile"));

    Assert.areEqual("default,plan,ask", agent.modes.filter(t => t.id !== agent.launchMode).map(t => t.id).join(","));
    Assert.areEqual("plan", agent.planMode);
    Assert.isTrue(agent.takesUnlistedModes);
  }

  @TestMethod
  public launchesAChatTurnInThePersonsOwnGrokHomeWithTheirVariablesAndOnlyFolderTrustAdded(): void {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("person");
    const environment = { HOME: person, USERPROFILE: person, PATH: "bin", XAI_API_KEY: "fixture", GROK_MEMORY: "1", GROK_CLAUDE_MCPS_ENABLED: "1",
      OPENAI_API_KEY: "fixture", COPILOT_HOME: "fixture", GIT_ASKPASS: "fixture", XAUTHORITY: "fixture" };
    const agent = new GrokAgent(new ProcessCommand("grok", []), environment, directory.resolve("profile"));

    const launch = agent.launch(null, new RequestedSettings("grok", null, null));
    const moved = new GrokAgent(new ProcessCommand("grok", []), { ...environment, GROK_HOME: directory.resolve("moved") }, directory.resolve("profile"))
      .launch(null, new RequestedSettings("grok", null, null));

    Assert.areEqual(JSON.stringify({ ...environment, GROK_HOME: join(person, ".grok"), GROK_FOLDER_TRUST: "1", OPENAI_API_KEY: undefined, COPILOT_HOME: undefined,
      GIT_ASKPASS: undefined }), JSON.stringify(launch.environment));
    Assert.areEqual(person, launch.directory);
    Assert.areEqual(directory.resolve("moved"), moved.environment[Resources.grokHomeVariable]);
    Assert.areEqual(join(person, ".grok"), agent.descriptor.profile?.usualFolder);
    Assert.areEqual(JSON.stringify([join(person, ".grok"), directory.resolve("profile")]), JSON.stringify(agent.descriptor.profile?.personFolders));
    Assert.areEqual(`${agent.descriptor.displayName} can't switch on its own MCP servers here: ${Resources.grokOwnServersSwitchAbility}.`, agent.descriptor.ownMcpServersUnavailable);
    Assert.isTrue(agent.formatSignIn(null).includes(join(person, ".grok")));
  }

  @TestMethod
  public findsThePersonsOwnGrokHomeAndTheOneGrokHomeNamesBesideTeamRunsOwnProfilesByTheFilesGrokWrites(): void {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("person");
    const environment = { HOME: person, USERPROFILE: person };

    const agent = new GrokAgent(null, environment, directory.resolve("profile"));
    const moved = new GrokAgent(null, { ...environment, GROK_HOME: directory.resolve("moved") }, directory.resolve("profile"));
    const relative = new GrokAgent(null, { ...environment, GROK_HOME: "moved" }, directory.resolve("profile"));

    Assert.areEqual(join(person, ".grok"), agent.profileSearch.folders.join());
    Assert.areEqual([join(person, ".grok"), directory.resolve("moved")].join(), moved.profileSearch.folders.join());
    Assert.areEqual(join(person, ".grok"), relative.profileSearch.folders.join());
    Assert.areEqual(`auth.json,config.toml,${Resources.profileMarker}`, agent.profileSearch.entries.join());
  }

  @TestMethod
  public leavesTheTitleHomeBesideTeamRunsOwnGrokProfilesOutOfTheFoundList(): void {
    using directory = new TemporaryDirectory();
    const agent = new GrokAgent(null, { HOME: directory.resolve("person") }, directory.resolve("profiles", "work"));

    Assert.isTrue(agent.profileSearch.skipped.includes(directory.resolve("profiles", "title-home")));
  }

  @TestMethod
  public leavesTeamRunsFormerDefaultGrokProfileWhichRunsInThePersonsOwnHomeOutOfTheFoundList(): void {
    using directory = new TemporaryDirectory();
    const agent = new GrokAgent(null, { HOME: directory.resolve("person") }, directory.resolve("profiles", "default"));

    Assert.isTrue(agent.profileSearch.skipped.includes(directory.resolve("profiles", "default")));
  }

  @TestMethod
  public keepsThePersonsMemorySettingInAChatTurnAndTurnsMemoryOffForALaunchOutsideOne(): void {
    using directory = new TemporaryDirectory();
    const memory = (requested: RequestedSettings | null, environment: NodeJS.ProcessEnv = {}): string | undefined =>
      new GrokAgent(new ProcessCommand("grok", []), environment, directory.resolve("profile")).launch(null, requested).environment["GROK_MEMORY"];

    Assert.areEqual("0", memory(null));
    Assert.areEqual("0", memory(null, { GROK_MEMORY: "1" }));
    Assert.isUndefined(memory(new RequestedSettings("grok", null, null)));
    Assert.areEqual("1", memory(new RequestedSettings("grok", null, null), { GROK_MEMORY: "1" }));
  }

  @TestMethod
  public leavesThePersonsClaudeAndCursorCompatibilityFilesToGrokInAChatTurnAndTurnsThemOffForATitleSession(): void {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("person");
    const environment = { HOME: person, USERPROFILE: person, GROK_CLAUDE_RULES_ENABLED: "1" };
    const agent = new GrokAgent(new ProcessCommand("grok", []), environment, directory.resolve("profile"));
    const requested = new RequestedSettings("grok", null, null);
    const compatibility = ["GROK_CLAUDE_RULES_ENABLED", "GROK_CURSOR_RULES_ENABLED", "GROK_CLAUDE_SKILLS_ENABLED", "GROK_CURSOR_SKILLS_ENABLED",
      "GROK_CLAUDE_AGENTS_ENABLED", "GROK_CURSOR_AGENTS_ENABLED"];

    const chat = agent.launch(null, requested).environment;
    const title = agent.launch(null, requested, null, null, environment, false, true).environment;

    Assert.areEqual(JSON.stringify([person, person]), JSON.stringify([chat["HOME"], chat["USERPROFILE"]]));
    Assert.areEqual(JSON.stringify(["1", null, null, null, null, null]), JSON.stringify(compatibility.map(t => chat[t] ?? null)));
    Assert.areEqual(compatibility.map(() => "0").join(), compatibility.map(t => title[t]).join());
  }

  @TestMethod
  public runsATitleSessionInTeamRunsTitleHomeSignedInThroughTheProvidersHomeWithThePersonsSetupOff(): void {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("person");
    const environment = { HOME: person, USERPROFILE: person, XAI_API_KEY: "fixture", GROK_MEMORY: "1", GROK_CONFIG: "fixture", GROK_CONFIG_PATH: "fixture",
      GROK_CLAUDE_RULES_ENABLED: "1", GROK_CODEX_AGENTS_ENABLED: "1" };
    const agent = new GrokAgent(new ProcessCommand("grok", []), environment, directory.resolve("profiles", "default"));
    const requested = new RequestedSettings("grok", null, null);
    const titled = (provider: Provider | null, base: NodeJS.ProcessEnv = environment): NodeJS.ProcessEnv =>
      agent.launch(provider, requested, null, null, base, false, true).environment;

    const own = titled(null);
    const moved = titled(null, { ...environment, GROK_AUTH_PATH: directory.resolve("moved.json") });
    const added = titled(new Provider("a", "grok", "Work", directory.resolve("added"), AuthStatus.Unknown, null, null, null, null, "t"),
      { ...environment, GROK_AUTH_PATH: directory.resolve("moved.json") });
    const forked = agent.launch(null, requested, null, null, environment, false, false).environment;

    const title = directory.resolve("profiles", "title-home");
    Assert.areEqual(JSON.stringify([title, join(person, ".grok", "auth.json"), "fixture", null, null]), JSON.stringify([own["GROK_HOME"], own["GROK_AUTH_PATH"],
      own["XAI_API_KEY"], own["GROK_CONFIG"] ?? null, own["GROK_CONFIG_PATH"] ?? null]));
    Assert.areEqual(Resources.grokTitleOffVariables.map(() => "0").join(), Resources.grokTitleOffVariables.map(t => own[t]).join());
    Assert.isTrue(["GROK_CLAUDE_RULES_ENABLED", "GROK_CODEX_AGENTS_ENABLED", "GROK_MEMORY"].every(t => Resources.grokTitleOffVariables.includes(t)));
    Assert.areEqual(1, readdirSync(directory.resolve("profiles")).filter(t => t === "title-home").length);
    Assert.areEqual(directory.resolve("moved.json"), moved["GROK_AUTH_PATH"]);
    Assert.areEqual(JSON.stringify([title, join(directory.resolve("added"), "auth.json"), null]), JSON.stringify([added["GROK_HOME"], added["GROK_AUTH_PATH"],
      added["XAI_API_KEY"] ?? null]));
    Assert.areEqual(JSON.stringify([join(person, ".grok"), null, "1", "fixture"]), JSON.stringify([forked["GROK_HOME"], forked["GROK_AUTH_PATH"] ?? null,
      forked["GROK_MEMORY"], forked["GROK_CONFIG_PATH"]]));
  }

  @TestMethod
  public runsAnAddedProviderInItsOwnGrokHomeWithoutGroksKeysAndAProviderInTheFormerProfileInThePersonsHome(): void {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("person");
    const environment = { HOME: person, USERPROFILE: person, XAI_API_KEY: "fixture", GROK_AUTH_TOKEN: "fixture", GROK_MEMORY: "1" };
    const agent = new GrokAgent(new ProcessCommand("grok", []), environment, directory.resolve("former"));
    const launched = (folder: string): NodeJS.ProcessEnv => agent.launch(new Provider("a", "grok", "Work", directory.resolve(folder), AuthStatus.Unknown, null, null,
      null, null, "t"), new RequestedSettings("grok", null, null)).environment;

    const added = launched("added");
    const former = launched("former");

    Assert.areEqual(JSON.stringify([directory.resolve("added"), null, null, "1"]), JSON.stringify([added["GROK_HOME"], added["XAI_API_KEY"] ?? null,
      added["GROK_AUTH_TOKEN"] ?? null, added["GROK_MEMORY"]]));
    Assert.areEqual(JSON.stringify([join(person, ".grok"), "fixture", "fixture"]), JSON.stringify([former["GROK_HOME"], former["XAI_API_KEY"], former["GROK_AUTH_TOKEN"]]));
  }
}
