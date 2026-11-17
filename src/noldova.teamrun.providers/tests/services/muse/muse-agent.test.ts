/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AuthStatus, Provider, RequestedSettings } from "@noldova/teamrun.protocol";
import { ConfigurationUnreadableException, ExecutableNotFoundException, MuseAgent, ProcessCommand, ProviderAbilityTable, Resources } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

const COMMAND = new ProcessCommand("muse", []);
const PROVIDER = new Provider("m", "muse", "Work", "profile", AuthStatus.Unknown, null, null, null, null, "t");
const REQUESTED = new RequestedSettings("muse", null, null, null, null);

@TestClass
export class MuseAgentTests {
  @TestMethod
  public opensTheExperimentalGateInTheChatsFolderOnTheProfilesConfigForAChatsOwnRun(): void {
    const person = { PATH: "path", XDG_CONFIG_HOME: "person", MUSE_EXPERIMENTAL_SDK_ENABLED: "off", OPENAI_API_KEY: "fixture" };

    const launch = new MuseAgent(COMMAND, person, "home").launch(PROVIDER, REQUESTED, "chat");

    Assert.areEqual("muse|acp|chat", [launch.command.executable, launch.command.arguments.join(" "), launch.directory].join("|"));
    Assert.areEqual("on|profile|path", [launch.environment["MUSE_EXPERIMENTAL_ACP"], launch.environment["XDG_CONFIG_HOME"], launch.environment["PATH"]].join("|"));
    Assert.isUndefined(launch.environment["MUSE_EXPERIMENTAL_SDK_ENABLED"]);
    Assert.isUndefined(launch.environment["OPENAI_API_KEY"]);
    Assert.isFalse("MUSE_EXPERIMENTAL_ACP" in person);
  }

  @TestMethod
  public leavesTheConfigVariableAsThePersonHasItForAProfileInTheirOwnFolder(): void {
    const person = resolve("person-config");
    const usual = new MuseAgent(COMMAND, { PATH: "path" }, "home").launch(new Provider("m", "muse", "Work", join("home", ".config"), AuthStatus.Unknown, null, null, null, null, "t"),
      REQUESTED, "chat");
    const named = new MuseAgent(COMMAND, { XDG_CONFIG_HOME: person }, "home").launch(new Provider("m", "muse", "Work", person, AuthStatus.Unknown, null, null, null, null, "t"),
      REQUESTED, "chat");

    Assert.isUndefined(usual.environment["XDG_CONFIG_HOME"]);
    Assert.areEqual(person, named.environment["XDG_CONFIG_HOME"]);
    Assert.areEqual("profile", new MuseAgent(COMMAND, { XDG_CONFIG_HOME: person }, "home").launch(PROVIDER, REQUESTED, "chat").environment["XDG_CONFIG_HOME"]);
  }

  @TestMethod
  public takesOneProviderPerMacSinceMuseCodeKeepsItsSignInInTheKeychain(): void {
    Assert.areEqual(Resources.museOneAccountPerMac, new MuseAgent(COMMAND, {}, "home", undefined, "darwin").descriptor.singleAccount);
    Assert.isNull(new MuseAgent(COMMAND, {}, "home", undefined, "linux").descriptor.singleAccount);
    Assert.isNull(new MuseAgent(COMMAND, {}, "home", undefined, "win32").descriptor.singleAccount);
  }

  @TestMethod
  public answersItsAbilitiesFromTheTable(): void {
    Assert.isTrue(new MuseAgent(COMMAND, {}, "home").descriptor.abilities === ProviderAbilityTable.muse);
  }

  @TestMethod
  public tellsTheModelNothingAboutBackgroundSubAgentsSinceItOffersNone(): void {
    Assert.isNull(new MuseAgent(COMMAND, {}, "home").backgroundSubAgentsNote);
  }

  @TestMethod
  public readsMuseCodesSignInRefusalBeforeASessionAsSignedOutWhateverItsCode(): void {
    const agent = new MuseAgent(COMMAND, {}, "home");

    Assert.isTrue(agent.isSignedOutRefusal(-32603, "Please log in to Muse before opening a session."));
    Assert.isTrue(agent.isSignedOutRefusal(null, "LOG IN TO MUSE BEFORE OPENING A SESSION"));
    Assert.isFalse(agent.isSignedOutRefusal(-32000, "Session refused"));
  }

  @TestMethod
  public leavesNoSessionBehindForACheckAndKeepsThePersonsConfigWithoutAProvider(): void {
    const launch = new MuseAgent(COMMAND, { XDG_CONFIG_HOME: "/person" }, "home").launch(null, null);

    Assert.areEqual("acp --no-session-log|home", [launch.command.arguments.join(" "), launch.directory].join("|"));
    Assert.areNotEqual("profile", launch.environment["XDG_CONFIG_HOME"]);
  }

  @TestMethod
  public findsMuseAgainOnceItWasInstalledAndNamesItWhenItIsMissing(): void {
    let found: ProcessCommand | null = null;
    const agent = new MuseAgent(null, {}, "home", () => found);

    const missing = Assert.throws(() => agent.launch(null, null), ExecutableNotFoundException);
    found = COMMAND;

    Assert.areEqual(Resources.formatGeneralAcpNotFound("Muse Code"), missing.message);
    Assert.areEqual("muse", agent.launch(null, null).command.executable);
  }

  @TestMethod
  public namesMuseLoginWhenSignedOutAndTakesTheServersItsServerTakes(): void {
    const agent = new MuseAgent(COMMAND, {}, "home");

    Assert.areEqual(Resources.museSignIn, agent.formatSignIn(null));
    Assert.areEqual("false:true:0", [agent.logsOut, agent.compacts, agent.forkMethods.length].join(":"));
    Assert.areEqual(2, agent.sharedServerTransports.length);
  }

  @TestMethod
  public async listsThePersonsOwnServersFromTheSettingsInTheConfigFolderMuseCodeRunsWith(): Promise<void> {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const person = directory.resolve("person");
    const profile = directory.resolve("profile");
    for (const [folder, name] of [[person, "docs"], [profile, "inProfile"], [join(home, ".config"), "inUsual"]] as const) {
      mkdirSync(join(folder, "muse"), { recursive: true });
      writeFileSync(join(folder, "muse", "settings.json"),
        JSON.stringify({ schema_version: 1, mcpServers: { [name]: { command: name }, teamrun: { url: "http://127.0.0.1:1/mcp" } } }));
    }
    const agent = new MuseAgent(COMMAND, { XDG_CONFIG_HOME: person }, home);
    const named = (folder: string): Provider => new Provider("m", "muse", "Work", folder, AuthStatus.Unknown, null, null, null, null, "t");
    const listed = async (listing: MuseAgent, provider: Provider | null): Promise<string> => (await listing.listOwnMcpServers(provider)).map(t => t.name).join();

    Assert.areEqual(JSON.stringify(["docs", "inProfile", "docs", "docs", "inUsual"]), JSON.stringify([await listed(agent, null), await listed(agent, named(profile)),
      await listed(agent, named(person)), await listed(agent, named(join(home, ".config"))), await listed(new MuseAgent(COMMAND, {}, home), null)]));
  }

  @TestMethod
  public async readsTheUsualConfigFolderForARelativeXdgConfigHome(): Promise<void> {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    mkdirSync(join(home, ".config", "muse"), { recursive: true });
    writeFileSync(join(home, ".config", "muse", "settings.json"), JSON.stringify({ schema_version: 1, mcpServers: { docs: { command: "docs" } } }));

    Assert.areEqual("docs", (await new MuseAgent(COMMAND, { XDG_CONFIG_HOME: "config" }, home).listOwnMcpServers(null)).map(t => t.name).join());
  }

  @TestMethod
  public async refusesToListSettingsWhoseSchemaVersionMuseCodeDoesntReadNamingTheFile(): Promise<void> {
    using directory = new TemporaryDirectory();
    const person = directory.resolve("person");
    const file = join(person, "muse", "settings.json");
    mkdirSync(join(person, "muse"), { recursive: true });
    const agent = new MuseAgent(COMMAND, { XDG_CONFIG_HOME: person }, directory.resolve("home"));
    const refusal = async (settings: Readonly<Record<string, unknown>>): Promise<string> => {
      writeFileSync(file, JSON.stringify(settings));
      return (await Assert.throwsAsync(() => agent.listOwnMcpServers(null), Error)).message;
    };

    Assert.areEqual(JSON.stringify([Resources.formatMuseSettingsUnsupported(file), Resources.formatMuseSettingsUnsupported(file), Resources.formatMuseSettingsUnsupported(file)]),
      JSON.stringify([await refusal({ schema_version: 2, mcpServers: { docs: {} } }), await refusal({ schema_version: "1", mcpServers: { docs: {} } }),
        await refusal({ mcpServers: { docs: {} } })]));
    writeFileSync(file, "{ not json");
    Assert.areEqual(Resources.formatOwnMcpConfigUnreadable(file), (await Assert.throwsAsync(() => agent.listOwnMcpServers(null), ConfigurationUnreadableException)).message);
  }
}
