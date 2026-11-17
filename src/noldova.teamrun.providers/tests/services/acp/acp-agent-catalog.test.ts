/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { JsonReader, type JsonObject } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpStoredAgent, type IProviderAdapter, type IProviderKindInstallation, type ISharedMcpSecrets } from "@noldova/teamrun.core";
import { AcpLocalCommandAddParams, SharedMcpSecret } from "@noldova/teamrun.protocol";
import {
  AcpAgentCatalog,
  AcpInstallTools,
  AcpRegistryIcons,
  AcpRegistrySource,
  AgentLaunchException, CommandRunner,
  ExecutableNotFoundException, type GeneralAcpAgent,
  LocalAcpCommand,
  NodeProcessStarter,
  ProcessTerminator,
  Resources
} from "@noldova/teamrun.providers";

import { FakeNpm } from "../../fixtures/fake-npm.fixture.js";
import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

const HOUR = 3_600_000;
const TARGET = "linux-x86_64";
const SHA256 = "ab".repeat(32);
const KEY = `teamrun.mcpSecret${"a".repeat(32)}`;
const OTHER_KEY = `teamrun.mcpSecret${"b".repeat(32)}`;

const binary = (id: string, target: string, sha256?: string): object => ({ id, name: `Agent ${id}`, version: "1.0.0", description: `About ${id}`, website: `https://example.com/${id}`,
  distribution: { binary: { [target]: { archive: "https://example.com/a.tar.gz", cmd: "./agent", ...sha256 === undefined ? {} : { sha256 } } } } });
const npx = (id: string, name: string = `${id}@1.0.0`): object => ({ id, name: `Agent ${id}`, version: "1.0.0", distribution: { npx: { package: name } } });
const uvx = (id: string): object => ({ id, name: `Agent ${id}`, version: "1.0.0", distribution: { uvx: { package: `${id}==1.0.0` } } });

class Opened {
  public readonly agents: GeneralAcpAgent[] = [];
  public readonly installations: (IProviderKindInstallation | null)[] = [];
  public readonly adapterOf = (agent: GeneralAcpAgent, installation: IProviderKindInstallation | null): IProviderAdapter => {
    this.agents.push(agent);
    this.installations.push(installation);
    return { descriptor: agent.descriptor } as IProviderAdapter;
  };
}

@TestClass
export class AcpAgentCatalogTests {
  private static catalog(server: LocalHttpServer, directory: TemporaryDirectory, opened: Opened = new Opened(), tools: AcpInstallTools = new AcpInstallTools(null, null, null),
    secrets: ISharedMcpSecrets = AcpAgentCatalogTests.secrets({}), platform: string = "linux"): AcpAgentCatalog {
    return new AcpAgentCatalog(new AcpRegistrySource(server.url("/registry.json"), directory.resolve("registry.json"), HOUR, 5_000), new AcpRegistryIcons(directory.resolve("icons"), 5_000),
      directory.resolve("agents"), TARGET, platform, process.env, "home", tools, new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))), renameSync,
      async (from, to) => renameSync(from, to), secrets, opened.adapterOf);
  }

  private static secrets(values: Readonly<Record<string, string>>): ISharedMcpSecrets {
    return { readAsync: name => Promise.resolve(values[name] ?? null), removeAsync: () => Promise.resolve(), isSetAsync: name => Promise.resolve(values[name] !== undefined) };
  }

  private static serveRegistry(server: LocalHttpServer, ...agents: readonly object[]): void {
    server.serve("/registry.json", Buffer.from(JSON.stringify({ agents })));
  }

  private static local(id: string, secrets: readonly SharedMcpSecret[] = []): AcpStoredAgent {
    const command = new LocalAcpCommand(id, `Command ${id}`, "node", ["agent.js"], secrets);
    return new AcpStoredAgent(command.kindId, command.name, command.toJson());
  }

  private static async withServer(test: (server: LocalHttpServer, directory: TemporaryDirectory) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = await LocalHttpServer.start();
    await test(server, directory);
  }

  @TestMethod
  public listsTheAgentsThisComputerHasABuildForWithWhyAnyCantInstallAndWhichAreAdded(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      AcpAgentCatalogTests.serveRegistry(server, binary("checked", TARGET, SHA256), binary("hashless", TARGET), binary("elsewhere", "windows-x86_64"), npx("droid"), uvx("fast"));
      const catalog = AcpAgentCatalogTests.catalog(server, directory);
      const added = new AcpStoredAgent("droid", "Agent droid", {});

      const listing = await catalog.listAsync([added, AcpAgentCatalogTests.local("mine")]);

      Assert.areEqual("checked,hashless,droid,fast", listing.agents.map(t => t.id).join(","));
      const of = (id: string) => listing.agents.find(t => t.id === id)!;
      Assert.areEqual("Agent checked|1.0.0|About checked|https://example.com/checked", [of("checked").name, of("checked").version, of("checked").description, of("checked").about].join("|"));
      Assert.areEqual(Resources.formatAcpAgentNoExtractor("Agent checked"), of("checked").unavailable);
      Assert.areEqual("false,true,false,false", ["checked", "hashless", "droid", "fast"].map(t => of(t).notChecked).join(","));
      Assert.areEqual("false,false,true,false", ["checked", "hashless", "droid", "fast"].map(t => of(t).added).join(","));
      Assert.areEqual(Resources.formatAcpAgentNoNpm("Agent droid"), of("droid").unavailable);
      Assert.areEqual(Resources.formatAcpAgentUvx("Agent fast"), of("fast").unavailable);
      Assert.areEqual("local-mine|Command mine|true", [listing.localCommands[0]!.id, listing.localCommands[0]!.name, listing.localCommands[0]!.added].join("|"));
      Assert.isNull(listing.failure);
      Assert.isFalse(Object.isNull(listing.fetchedAt));
    });
  }

  @TestMethod
  public keepsAnAddedAgentTheListNoLongerNames(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      AcpAgentCatalogTests.serveRegistry(server, npx("droid"));

      const listing = await AcpAgentCatalogTests.catalog(server, directory).listAsync([new AcpStoredAgent("gone", "Gone agent", {})]);

      Assert.areEqual("droid,gone", listing.agents.map(t => t.id).join(","));
      const gone = listing.agents[1]!;
      Assert.areEqual("Gone agent|true|false||", [gone.name, gone.added, gone.notChecked, gone.unavailable, gone.about].join("|"));
    });
  }

  @TestMethod
  public listsOnlyWhatIsAddedAndWhyWhenTheListCantBeRead(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      server.serve("/registry.json", Buffer.from("no"), 500);

      const listing = await AcpAgentCatalogTests.catalog(server, directory).listAsync([new AcpStoredAgent("droid", "Agent droid", {}), AcpAgentCatalogTests.local("mine")]);

      Assert.areEqual("droid", listing.agents.map(t => t.id).join(","));
      Assert.areEqual("local-mine", listing.localCommands.map(t => t.id).join(","));
      Assert.areEqual(Resources.formatAcpRegistryFailed(500), listing.failure);
      Assert.isNull(listing.fetchedAt);
    });
  }

  @TestMethod
  public readsAnIconOnlyForAnAgentTheListNames(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      AcpAgentCatalogTests.serveRegistry(server, { ...npx("droid"), icon: "https://localhost.invalid/droid.svg" });
      const catalog = AcpAgentCatalogTests.catalog(server, directory);

      Assert.isNull(await catalog.readIconAsync("missing"));
      mkdirSync(directory.resolve("icons"));
      writeFileSync(directory.resolve("icons", "droid-1.0.0.icon"), "data:image/svg+xml;base64,AA==");
      Assert.areEqual("data:image/svg+xml;base64,AA==", await catalog.readIconAsync("droid"));
    });
  }

  @TestMethod
  public hasNoIconWhenTheListCantBeRead(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      server.serve("/registry.json", Buffer.from("no"), 500);

      Assert.isNull(await AcpAgentCatalogTests.catalog(server, directory).readIconAsync("droid"));
    });
  }

  @TestMethod
  public offersAnAgentWithWhatItStoresAndWhyItCantInstallAndNoneThisComputerCantUse(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      AcpAgentCatalogTests.serveRegistry(server, npx("droid"), binary("elsewhere", "windows-x86_64"));
      using tools = new TemporaryDirectory();
      const refusing = AcpAgentCatalogTests.catalog(server, directory);
      const npm = new FakeNpm(tools.path, {});
      const able = AcpAgentCatalogTests.catalog(server, directory, new Opened(), new AcpInstallTools(null, null, npm.executable));

      const refused = await refusing.readOfferAsync("droid");
      const offered = await able.readOfferAsync("droid");

      Assert.areEqual(Resources.formatAcpAgentNoNpm("Agent droid"), refused?.unavailable);
      Assert.isNull(offered?.unavailable);
      Assert.areEqual("droid|Agent droid", [offered?.stored.kind, offered?.stored.name].join("|"));
      Assert.areEqual("droid@1.0.0", JsonReader.fromValue(offered!.stored.json).readObject("distribution").readObject("npx").readNonBlankString("package"));
      Assert.isNull(await refusing.readOfferAsync("elsewhere"));
      Assert.isNull(await refusing.readOfferAsync("missing"));
    });
  }

  @TestMethod
  public namesALocalCommandFromItsNameAndAvoidsAKindAlreadyTaken(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      const catalog = AcpAgentCatalogTests.catalog(server, directory);
      const of = (name: string, taken: readonly string[] = []): AcpStoredAgent => catalog.localOf(new AcpLocalCommandAddParams(name, "node", ["a.js"], [new SharedMcpSecret("KEY", KEY)]), t => taken.includes(t));

      const stored = of("My Agent!");

      Assert.areEqual("local-my-agent|My Agent!", `${stored.kind}|${stored.name}`);
      Assert.areEqual(JSON.stringify({ id: "my-agent", name: "My Agent!", cmd: "node", args: ["a.js"], secrets: [{ variable: "KEY", reference: KEY, updatedAt: null }] }), JSON.stringify(stored.json));
      Assert.areEqual("local-my-agent-3", of("My Agent", ["local-my-agent", "local-my-agent-2"]).kind);
      Assert.areEqual("local-agent", of("---").kind);
      Assert.areEqual("local-agent", of("1 agent").kind);
      Assert.areEqual(`local-${"a".repeat(60)}`, of("a".repeat(80)).kind);
    });
  }

  @TestMethod
  public opensALocalCommandWithItsSavedValuesAndNoInstall(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      const opened = new Opened();
      const catalog = AcpAgentCatalogTests.catalog(server, directory, opened, undefined, AcpAgentCatalogTests.secrets({ [KEY]: "value" }));

      const adapter = await catalog.openAsync(AcpAgentCatalogTests.local("mine", [new SharedMcpSecret("KEY", KEY)]), async () => undefined);

      Assert.areEqual("local-mine", adapter.descriptor.id);
      Assert.isNull(opened.installations[0]);
      const launch = opened.agents[0]!.launch(null, null);
      Assert.areEqual("value|node|agent.js", [launch.environment["KEY"], launch.command.executable, launch.command.arguments.join(",")].join("|"));
    });
  }

  @TestMethod
  public opensALocalCommandWhoseValueIsGoneAndFailsItsLaunchWithTheReason(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      const missing = new Opened();
      const unreadable = new Opened();
      const stored = AcpAgentCatalogTests.local("mine", [new SharedMcpSecret("KEY", KEY)]);
      const locked: ISharedMcpSecrets = { readAsync: () => Promise.reject(new Error("The store is locked.")), removeAsync: () => Promise.resolve(), isSetAsync: () => Promise.resolve(false) };

      await AcpAgentCatalogTests.catalog(server, directory, missing).openAsync(stored, async () => undefined);
      await AcpAgentCatalogTests.catalog(server, directory, unreadable, undefined, locked).openAsync(stored, async () => undefined);

      Assert.areEqual(Resources.formatLocalAcpSecretMissing("Command mine", "KEY"), Assert.throws(() => missing.agents.at(0)?.launch(null, null), AgentLaunchException).message);
      Assert.areEqual(Resources.formatLocalAcpSecretUnreadable("Command mine", "KEY", "The store is locked."), Assert.throws(() => unreadable.agents.at(0)?.launch(null, null), AgentLaunchException).message);
    });
  }

  @TestMethod
  public opensARegistryAgentWithItsInstallAndSavesTheVersionItMovesTo(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      using tools = new TemporaryDirectory();
      const name = "droid";
      const npm = new FakeNpm(tools.path, FakeNpm.package(name, "2.0.0", "cli.js", [name]));
      const entry = (version: string): object => ({ id: name, name: "Droid", version, distribution: { npx: { package: `${name}@${version}`, args: ["--acp"], env: { DROID_MODE: "acp" } } } });
      AcpAgentCatalogTests.serveRegistry(server, entry("2.0.0"));
      const opened = new Opened();
      const saved: JsonObject[] = [];
      const catalog = AcpAgentCatalogTests.catalog(server, directory, opened, new AcpInstallTools(null, null, npm.executable), undefined, process.platform);

      await catalog.openAsync(new AcpStoredAgent(name, "Droid", entry("1.0.0") as JsonObject), async t => { saved.push(t); });
      const installation = opened.installations[0]!;
      Assert.areEqual(Resources.formatGeneralAcpNotFound("Droid"), Assert.throws(() => opened.agents.at(0)?.launch(null, null), ExecutableNotFoundException).message);
      await installation.install(() => undefined, new AbortController().signal, () => undefined);

      Assert.areEqual("2.0.0", JsonReader.fromValue(saved[0]).readNonBlankString("version"));
      const launch = opened.agents[0]!.launch(null, null);
      Assert.areEqual("acp", launch.environment["DROID_MODE"]);
      Assert.isTrue(launch.command.arguments.join(" ").includes("--acp"));
      Assert.isTrue(existsSync(directory.resolve("agents", name, "2.0.0")));
      const terminal = opened.agents[0]!.readTerminalSignIn(JsonReader.fromValue({ authMethods: [{ type: "terminal", id: "login" }] }));
      Assert.isTrue((terminal?.command ?? "").startsWith(name));
    });
  }

  @TestMethod
  public readsARegistryAgentsVersionsFromWhatItHasWhenTheListCantBeRead(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      server.serve("/registry.json", Buffer.from("no"), 500);
      const opened = new Opened();

      await AcpAgentCatalogTests.catalog(server, directory, opened).openAsync(new AcpStoredAgent("droid", "Droid", npx("droid") as JsonObject), async () => undefined);
      const versions = await opened.installations[0]!.readVersions();

      Assert.areEqual("null 1.0.0", `${versions.installed} ${versions.latest}`);
    });
  }

  @TestMethod
  public namesOnlyALocalCommandsSavedValues(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      const catalog = AcpAgentCatalogTests.catalog(server, directory);

      Assert.areEqual(`${KEY},${OTHER_KEY}`, catalog.referencesOf(AcpAgentCatalogTests.local("mine", [new SharedMcpSecret("A", KEY), new SharedMcpSecret("B", OTHER_KEY)])).join(","));
      Assert.areEqual(0, catalog.referencesOf(new AcpStoredAgent("droid", "Droid", npx("droid") as JsonObject)).length);
    });
  }

  @TestMethod
  public removesARegistryAgentsFolderAndNothingForALocalCommand(): Promise<void> {
    return AcpAgentCatalogTests.withServer(async (server, directory) => {
      const catalog = AcpAgentCatalogTests.catalog(server, directory);
      mkdirSync(directory.resolve("agents", "droid", "1.0.0"), { recursive: true });
      mkdirSync(directory.resolve("agents", "local-mine"), { recursive: true });

      await catalog.removeFilesAsync(AcpAgentCatalogTests.local("mine"));
      await catalog.removeFilesAsync(new AcpStoredAgent("droid", "Droid", {}));
      await catalog.removeFilesAsync(new AcpStoredAgent("never-installed", "Never", {}));

      Assert.areEqual("local-mine", readdirSync(directory.resolve("agents")).join(","));
    });
  }
}
