/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, truncateSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, Provider } from "@noldova/teamrun.protocol";
import { ExecutableNotFoundException, OpencodeAgent, ProcessCommand, Resources } from "@noldova/teamrun.providers";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class OpencodeAgentTests {
  @TestMethod
  public tellsItsTeammatesTheirBackgroundSubAgentsEndWithTheirTurn(): void {
    using directory = new TemporaryDirectory();
    Assert.areEqual(Resources.acpBackgroundSubAgentsNote, new OpencodeAgent(new ProcessCommand("opencode", []), {}, directory.resolve("usual")).backgroundSubAgentsNote);
  }

  @TestMethod
  public launchesInThePersonsHomeKeepingATurnsApprovedToolsOutsideATurnUntilATurnRevokesThem(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("person");
    const environment = { HOME: home, USERPROFILE: home, XDG_DATA_HOME: directory.resolve("data") };
    const agent = new OpencodeAgent(new ProcessCommand("opencode", []), environment, directory.resolve("former"));
    const rules = (launch: { readonly environment: NodeJS.ProcessEnv }): Record<string, string> => JSON.parse(launch.environment["OPENCODE_PERMISSION"]!) as Record<string, string>;

    const approved = agent.launch(null, null, null, ["open_panel"]);
    const kept = agent.launch(null, null, null, null);
    const revoked = agent.launch(null, null, null, []);
    const after = agent.launch(null, null, null);

    Assert.areEqual("opencode acp", [approved.command.executable, ...approved.command.arguments].join(" "));
    Assert.areEqual(home, kept.directory);
    Assert.areEqual(directory.resolve("data"), kept.environment["XDG_DATA_HOME"]);
    Assert.areEqual("allow", rules(approved)["teamrun_open_panel"]);
    Assert.areEqual("allow", rules(kept)["teamrun_open_panel"]);
    Assert.isUndefined(rules(revoked)["teamrun_open_panel"]);
    Assert.isUndefined(rules(after)["teamrun_open_panel"]);
    Assert.areEqual(Resources.opencodeSignInHint, agent.formatSignIn(null));
    Assert.areEqual(Resources.opencodeNotFound, Assert.throws(() => new OpencodeAgent(null, environment, directory.resolve("former")).launch(null, null, null), ExecutableNotFoundException).message);
    Assert.isFalse(existsSync(directory.resolve("data")));
    Assert.isFalse(existsSync(directory.resolve("former")));
  }

  @TestMethod
  public runsTheFolderTeamRunOnceMadeInThePersonsOwnAndAnAddedFolderWithItsOwnSignIn(): void {
    using directory = new TemporaryDirectory();
    const environment = { HOME: directory.resolve("person"), USERPROFILE: directory.resolve("person"), XDG_DATA_HOME: directory.resolve("data"), OPENAI_API_KEY: "fixture" };
    const agent = new OpencodeAgent(new ProcessCommand("opencode", []), environment, directory.resolve("former"));
    const provider = (folder: string): Provider => new Provider("o", "opencode", "Work", directory.resolve(folder), AuthStatus.Unknown, null, null, null, null, "t");

    const former = agent.launch(provider("former"), null).environment;
    const own = agent.launch(provider("data"), null).environment;
    const added = agent.launch(provider("work"), null).environment;
    const moved = agent.launch(provider("former"), null, null, null, { ...environment, XDG_DATA_HOME: directory.resolve("moved") }).environment;

    Assert.areEqual(`${directory.resolve("data")}:fixture`, `${former["XDG_DATA_HOME"]}:${former["OPENAI_API_KEY"]}`);
    Assert.areEqual(`${directory.resolve("data")}:fixture`, `${own["XDG_DATA_HOME"]}:${own["OPENAI_API_KEY"]}`);
    Assert.areEqual(directory.resolve("work"), added["XDG_DATA_HOME"]);
    Assert.isUndefined(added["OPENAI_API_KEY"]);
    Assert.areEqual(directory.resolve("moved"), moved["XDG_DATA_HOME"]);
  }

  @TestMethod
  public asksForThePersonsOwnToolsOnlyInAChatTurnWhileTheProvidersOwnMcpServersAreOnAndRefusesThemOtherwiseAndInItsLevelList(): void {
    using directory = new TemporaryDirectory();
    const environment = { HOME: directory.resolve("person"), USERPROFILE: directory.resolve("person"), XDG_DATA_HOME: directory.resolve("data") };
    const agent = new OpencodeAgent(new ProcessCommand("opencode", []), environment, directory.resolve("former"));
    const provider = (own: boolean): Provider => new Provider("o", "opencode", "Work", directory.resolve("data"), AuthStatus.Unknown, null, null, null, null, "t", true, own);
    const rule = (launch: { readonly environment: NodeJS.ProcessEnv }): string | undefined => (JSON.parse(launch.environment["OPENCODE_PERMISSION"]!) as Record<string, string>)["*"];

    const chat = (own: Provider | null): string | undefined => rule(agent.launch(own, null, null, null, environment, true));

    Assert.areEqual("deny,deny,ask,deny,deny", [chat(null), chat(provider(false)), chat(provider(true)), rule(agent.launch(provider(true), null)),
      rule(agent.levels.launch(provider(true), environment))].join(","));
  }

  @TestMethod
  public loadsNoneOfThePersonsPluginsOutsideAChatTurnAndKeepsThemInOne(): void {
    using directory = new TemporaryDirectory();
    const environment = { HOME: directory.resolve("person"), USERPROFILE: directory.resolve("person"), XDG_DATA_HOME: directory.resolve("data") };
    const agent = new OpencodeAgent(new ProcessCommand("opencode", []), environment, directory.resolve("former"));
    const pure = (launch: { readonly environment: NodeJS.ProcessEnv }): string => launch.environment["OPENCODE_PURE"] ?? "unset";

    Assert.areEqual("1,1,unset", [pure(agent.launch(null, null)), pure(agent.levels.launch(null, environment)),
      pure(agent.launch(null, null, null, null, environment, true))].join(","));
  }

  @TestMethod
  public describesThePersonsFoldersAndFindsTheOnesWithASignInAndHasNoProfileOfItsOwnToPrepare(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("person");
    const named = new OpencodeAgent(null, { HOME: home, USERPROFILE: home, XDG_DATA_HOME: directory.resolve("data") }, directory.resolve("former"));
    const usual = new OpencodeAgent(null, { HOME: home, USERPROFILE: home }, directory.resolve("former"));

    Assert.areEqual(directory.resolve("data"), named.descriptor.profile?.usualFolder);
    Assert.areEqual(join(home, ".local", "share"), usual.descriptor.profile?.usualFolder);
    Assert.areEqual([directory.resolve("data"), directory.resolve("former")].join("|"), named.descriptor.profile?.personFolders.join("|"));
    Assert.areEqual("{}", JSON.stringify(named.descriptor.profile?.signInVariables));
    Assert.areEqual("{}", JSON.stringify(named.descriptor.profile?.signInValues));
    Assert.areEqual([join(home, ".local", "share"), directory.resolve("data")].join("|"), named.profileSearch.folders.join("|"));
    Assert.areEqual("opencode/auth.json", named.profileSearch.entries.join("|"));
    Assert.isUndefined((named as { readonly prepareProfile?: unknown }).prepareProfile);
    Assert.isNull(named.descriptor.ownMcpServersUnavailable);
    Assert.areEqual(Resources.opencodeOwnMcpServersNote, named.descriptor.ownMcpServersNote);
  }

  @TestMethod
  public readsOnlyItsVersionFromInitializeAndLeavesTheRestToItsSession(): void {
    const agent = new OpencodeAgent(null, { HOME: "/home/person", USERPROFILE: "/home/person" }, "/former");
    const version = (value: object): string | null => agent.readVersion(JsonReader.fromValue(value));
    const initialized = JsonReader.fromValue({ agentInfo: { version: "1.19.4" } });

    Assert.areEqual("1.19.4", version({ agentInfo: { name: "OpenCode", version: "1.19.4" } }));
    Assert.isNull(version({ agentInfo: { name: "OpenCode" } }));
    Assert.isNull(version({ agentInfo: null }));
    Assert.isNull(version({}));
    Assert.isNull(agent.isSignedIn(null));
    Assert.isNull(agent.readModels(initialized));
    Assert.isNull(agent.readSignInMethod(initialized));
    Assert.isNull(agent.readEffort(initialized));
    Assert.isNull(agent.memberOf("anthropic/claude-sonnet-4-5", "Claude Sonnet 4.5"));
    Assert.isNull(agent.sessionMeta());
    Assert.isNull(agent.formatUnsupported(null));
    Assert.isNull(agent.formatUnsupported("dev"));
    Assert.areEqual(Resources.formatOpencodeStopped("max_tokens"), agent.formatStopped("max_tokens"));
  }

  @TestMethod
  public turnsOffEveryMcpServerThePersonsConfigFilesNameOnALaunchOutsideAChatTurnAndLeavesThemOnInOne(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("person");
    const global = directory.resolve("config", "opencode");
    mkdirSync(join(home, ".git"), { recursive: true });
    mkdirSync(join(home, ".opencode"), { recursive: true });
    mkdirSync(join(directory.resolve("other"), ".git"), { recursive: true });
    mkdirSync(directory.resolve("folder"), { recursive: true });
    mkdirSync(global, { recursive: true });
    writeFileSync(join(global, "opencode.jsonc"), `// the person's servers
{
  "mcp": {
    "docs": { "type": "remote", "url": "https://example.com/a//b", /* a comment */ },
    "quoted": { "type": "local", "command": ["say \\"hi\\" // not a comment"], },
  },
}
/* left open`);
    writeFileSync(join(global, "config.json"), `{ "mcp": { "legacy": {} } } // last line`);
    writeFileSync(join(global, "opencode.json"), JSON.stringify({ model: "a/b" }));
    writeFileSync(directory.resolve("named.json"), JSON.stringify({ mcp: { named: {} } }));
    writeFileSync(join(home, "opencode.json"), JSON.stringify({ mcp: { project: {} } }));
    writeFileSync(join(home, ".opencode", "opencode.json"), JSON.stringify({ mcp: { dot: {} } }));
    writeFileSync(join(directory.resolve("folder"), "opencode.jsonc"), JSON.stringify({ mcp: { folder: { enabled: true } } }));
    writeFileSync(directory.resolve("opencode.json"), JSON.stringify({ mcp: { outside: {} } }));
    const environment = { HOME: home, USERPROFILE: home, XDG_DATA_HOME: directory.resolve("data"), XDG_CONFIG_HOME: directory.resolve("config"),
      OPENCODE_CONFIG: directory.resolve("named.json"), OPENCODE_CONFIG_DIR: directory.resolve("folder"),
      OPENCODE_CONFIG_CONTENT: JSON.stringify({ mcp: { own: { type: "local", command: ["own"] } } }) };
    const agent = new OpencodeAgent(new ProcessCommand("opencode", []), environment, directory.resolve("former"));
    const servers = (launch: { readonly environment: NodeJS.ProcessEnv }): string => {
      const reader = JsonReader.parse(launch.environment[Resources.opencodeConfigContentVariable] ?? "{}");
      if (!reader.hasField("mcp"))
        return "none";
      const all = reader.readObject("mcp").toJson();
      return Object.keys(all).sort().map(t => `${t}:${JSON.stringify(all[t])}`).join(" ");
    };
    const off = (...names: readonly string[]): string => names.map(t => `${t}:{"enabled":false}`).join(" ");
    const own = `own:{"type":"local","command":["own"],"enabled":false}`;

    Assert.areEqual(`${off("docs", "dot", "folder", "legacy", "named")} ${own} ${off("project", "quoted")}`, servers(agent.launch(null, null, null)));
    Assert.areEqual(`own:{"type":"local","command":["own"]}`, servers(agent.launch(null, null, null, null, environment, true)));
    Assert.areEqual(`${off("docs", "dot", "folder", "legacy", "named")} ${own} ${off("quoted")}`,
      servers(agent.launch(null, null, null, null, { ...environment, OPENCODE_DISABLE_PROJECT_CONFIG: "TRUE" })));
    const other = directory.resolve("other");
    Assert.areEqual("none", servers(agent.launch(null, null, null, null, { HOME: other, USERPROFILE: other, XDG_DATA_HOME: directory.resolve("data"),
      XDG_CONFIG_HOME: directory.resolve("empty"), OPENCODE_CONFIG: " ", OPENCODE_CONFIG_DIR: "" })));
    const loose = directory.resolve("loose");
    Assert.areEqual(off("outside"), servers(agent.launch(null, null, null, null, { HOME: loose, USERPROFILE: loose, XDG_DATA_HOME: directory.resolve("data"),
      XDG_CONFIG_HOME: directory.resolve("empty") })));
  }

  @TestMethod
  public refusesALaunchOutsideAChatTurnNamingTheFileWhenAConfigFileExistsButCantBeReadOrIsTooLarge(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("person");
    const file = join(directory.resolve("config", "opencode"), "opencode.json");
    mkdirSync(join(home, ".git"), { recursive: true });
    mkdirSync(directory.resolve("config", "opencode"), { recursive: true });
    const environment = { HOME: home, USERPROFILE: home, XDG_DATA_HOME: directory.resolve("data"), XDG_CONFIG_HOME: directory.resolve("config") };
    const agent = new OpencodeAgent(new ProcessCommand("opencode", []), environment, directory.resolve("former"));
    const refusal = (): string => Assert.throws(() => agent.launch(null, null, null), Error).message;

    writeFileSync(file, "{ not json");
    const malformed = refusal();
    const chat = agent.launch(null, null, null, null, environment, true);
    writeFileSync(file, JSON.stringify({ mcp: ["notes"] }));
    const notAnObject = refusal();
    writeFileSync(file, `{ "mcp": { "notes`);
    const openString = refusal();
    truncateSync(file, Resources.maximumConfigurationBytes + 1);
    const tooLarge = refusal();
    writeFileSync(file, JSON.stringify({ mcp: {} }));
    mkdirSync(join(home, "opencode.json"));
    const folder = refusal();

    Assert.areEqual(Resources.formatOpencodeMcpConfigUnreadable(file), malformed);
    Assert.areEqual(home, chat.directory);
    Assert.areEqual(Resources.formatOpencodeMcpConfigUnreadable(file), notAnObject);
    Assert.areEqual(Resources.formatOpencodeMcpConfigUnreadable(file), openString);
    Assert.areEqual(Resources.formatOpencodeMcpConfigTooLarge(file), tooLarge);
    Assert.areEqual(Resources.formatOpencodeMcpConfigUnreadable(join(home, "opencode.json")), folder);
  }
}
