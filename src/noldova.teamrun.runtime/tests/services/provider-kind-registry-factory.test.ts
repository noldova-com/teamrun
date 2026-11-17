/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AcpStoredAgent, type ISharedMcpSecrets, TurnOutcome, TurnRequest } from "@noldova/teamrun.core";
import { ProviderAbilities, ProviderAbility, RequestedSettings } from "@noldova/teamrun.protocol";
import { AcpAgentCatalog, ExecutableLocator, ExecutableNotFoundException, GeneralAcpAdapter, type IProcessStarter, NodeProcessStarter, type ProcessCommand, ProcessTerminator, Resources, StartedProcess } from "@noldova/teamrun.providers";
import { ProviderKindRegistryFactory } from "@noldova/teamrun.runtime";

import { FakeGrokStarter } from "../fixtures/fake-grok-starter.fixture.js";
import { FakeVersionStarter } from "../fixtures/fake-version-starter.fixture.js";
import { QuietTurnListener } from "../fixtures/quiet-turn-listener.fixture.js";
import { TemporaryDirectory } from "../fixtures/temporary-directory.fixture.js";

@TestClass
export class ProviderKindRegistryFactoryTests {
  @TestMethod
  public async makesACatalogThatKeepsItsAgentsInAFolderOfTheirOwnAndOpensThemAsGeneralAdapters(): Promise<void> {
    using directory = new TemporaryDirectory();
    const secrets = {} as ISharedMcpSecrets;
    const factory = new ProviderKindRegistryFactory({}, new ExecutableLocator("linux", "x64", [directory.path], directory.path));
    const stored = new AcpStoredAgent("droid", "Droid", { id: "droid", name: "Droid", version: "1.0.0", distribution: { npx: { package: "droid@1.0.0" } } });
    mkdirSync(directory.resolve("acp-agents", "agents", "droid"), { recursive: true });

    const catalog = factory.createAcpCatalog("1.0.0", directory.path, {} as IProcessStarter, secrets);
    const adapter = await catalog.openAsync(stored, () => Promise.resolve());
    await catalog.removeFilesAsync(stored);

    Assert.isInstanceOf(catalog, AcpAgentCatalog);
    Assert.isInstanceOf(adapter, GeneralAcpAdapter);
    Assert.areEqual("droid", adapter.descriptor.id);
    Assert.isFalse(adapter.installation!.isInstalled);
    Assert.isFalse(existsSync(directory.resolve("acp-agents", "agents", "droid")));
  }

  @TestMethod
  public registersAdaptersWithFixtureExecutables(): void {
    using directory = new TemporaryDirectory();
    writeFileSync(directory.resolve("codex"), "fixture");
    writeFileSync(directory.resolve("claude"), "fixture");
    writeFileSync(directory.resolve("grok"), "fixture");
    mkdirSync(directory.resolve("providers", "antigravity", "1.3.0"), { recursive: true });
    writeFileSync(directory.resolve("providers", "antigravity", "1.3.0", process.platform === "win32" ? "agy_acp_server.exe" : "agy_acp_server.par"), "fixture");
    writeFileSync(directory.resolve("providers", "antigravity", "1.3.0", process.platform === "win32" ? "localharness_external.exe" : "localharness_external"), "fixture");
    mkdirSync(directory.resolve("providers", "cursor", "2026.10.22-27dcf5f", "dist-package"), { recursive: true });
    for (const name of process.platform === "win32" ? ["cursor-agent.cmd", "node.exe", "index.js"] : ["cursor-agent"])
      writeFileSync(directory.resolve("providers", "cursor", "2026.10.22-27dcf5f", "dist-package", name), "fixture");
    const locator = new ExecutableLocator(process.platform, process.arch, [directory.path], directory.path);
    Assert.isNotNull(locator.locateCodex(null));
    Assert.isNotNull(locator.locateClaude(null));
    Assert.isNotNull(locator.locateAntigravity(directory.resolve("providers", "antigravity")));

    const registry = new ProviderKindRegistryFactory({}, locator).create("1.0.0", directory.path, {} as IProcessStarter);

    Assert.areEqual("codex,claude,grok,copilot,opencode,cursor,fx,antigravity,pi,muse", registry.all().map(t => t.descriptor.id).join(","));
    Assert.isTrue(registry.get("antigravity").installation!.isInstalled);
    Assert.isTrue(registry.get("claude").installation!.isInstalled);
    Assert.isTrue(registry.get("codex").installation!.isInstalled);
    Assert.isFalse(registry.get("copilot").installation!.isInstalled);
    Assert.isTrue(registry.get("grok").installation!.isInstalled);
    Assert.isUndefined(registry.get("opencode").installation);
    Assert.isTrue(registry.get("cursor").installation!.isInstalled);
  }

  @TestMethod
  public registersAdaptersEvenWithoutExecutables(): void {
    using directory = new TemporaryDirectory();
    const locator = new ExecutableLocator(process.platform, process.arch, [], directory.path, undefined, directory.resolve("Windows"), directory.resolve("usr", "bin", "tar"));

    const registry = new ProviderKindRegistryFactory({}, locator).create("1.0.0", directory.path, {} as IProcessStarter);

    Assert.areEqual("codex,claude,grok,copilot,opencode,cursor,fx,antigravity,pi,muse", registry.all().map(t => t.descriptor.id).join(","));
    Assert.isFalse(registry.get("antigravity").installation!.isInstalled);
    Assert.isFalse(registry.get("claude").installation!.isInstalled);
    Assert.isNull(registry.get("claude").installation!.unavailable);
    Assert.isFalse(registry.get("codex").installation!.isInstalled);
    Assert.areEqual(Resources.codexNoTar, registry.get("codex").installation!.unavailable);
    Assert.isFalse(registry.get("copilot").installation!.isInstalled);
    Assert.areEqual(Resources.copilotNoExtractor, registry.get("copilot").installation!.unavailable);
    Assert.isFalse(registry.get("grok").installation!.isInstalled);
    Assert.isNull(registry.get("grok").installation!.unavailable);
    Assert.isUndefined(registry.get("opencode").installation);
    Assert.isFalse(registry.get("cursor").installation!.isInstalled);
    Assert.areEqual(Resources.cursorNoExtractor, registry.get("cursor").installation!.unavailable);
    Assert.isUndefined(registry.get("fx").installation);
    Assert.isTrue(registry.has("codex"));
  }

  @TestMethod
  public async readsOpencodesVersionInThePersonsOwnEnvironmentAndMakesNoFolderForIt(): Promise<void> {
    using directory = new TemporaryDirectory();
    writeFileSync(directory.resolve(process.platform === "win32" ? "opencode.exe" : "opencode"), "fixture");
    const locator = new ExecutableLocator(process.platform, process.arch, [directory.path], directory.path);
    const starter = new FakeVersionStarter(new ProcessTerminator(process.platform), "1.19.5");
    const person = { HOME: directory.resolve("person"), USERPROFILE: directory.resolve("person"), XDG_DATA_HOME: directory.resolve("person-data") };
    const registry = new ProviderKindRegistryFactory(person, locator).create("1.0.0", directory.path, starter);
    const tools = await Promise.all(registry.tools().map(t => t.check()));
    const reads = starter.started.filter(t => t.command.executable === directory.resolve(process.platform === "win32" ? "opencode.exe" : "opencode"));
    Assert.areEqual("1.19.5", tools.find(t => t.kind === "opencode")?.version);
    Assert.areEqual(1, reads.length);
    Assert.areEqual(person.XDG_DATA_HOME, reads[0]!.environment["XDG_DATA_HOME"]);
    Assert.isFalse(existsSync(directory.resolve("profiles", "opencode-version")));
    Assert.isFalse(existsSync(directory.resolve("providers", "opencode")));
  }

  @TestMethod
  public async findsEachCommandLineToolAfreshWithItsInstallCommandAndPage(): Promise<void> {
    using directory = new TemporaryDirectory();
    const locator = new ExecutableLocator(process.platform, process.arch, [directory.path], directory.path);
    const registry = new ProviderKindRegistryFactory({}, locator).create("1.0.0", directory.path, {} as IProcessStarter);
    const windows = process.platform === "win32";

    const before = await Promise.all(registry.tools().map(t => t.check()));
    writeFileSync(directory.resolve(windows ? "grok.exe" : "grok"), "fixture");
    writeFileSync(directory.resolve(windows ? "opencode.exe" : "opencode"), "fixture");
    for (const name of windows ? ["cursor-agent.cmd", "cursor-agent.ps1", "node.exe", "index.js"] : ["cursor-agent"])
      writeFileSync(directory.resolve(name), "fixture");
    writeFileSync(directory.resolve(windows ? "fx.exe" : "fx"), "fixture");
    const codex = windows ? [directory.path, "AppData", "Local", "Programs", "OpenAI", "Codex", "bin", "codex.exe"] : [directory.path, ".local", "bin", "codex"];
    mkdirSync(dirname(join(...codex)), { recursive: true });
    writeFileSync(join(...codex), "fixture");
    const pi = windows ? [directory.path, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"] : [directory.path, "pi"];
    mkdirSync(dirname(join(...pi)), { recursive: true });
    writeFileSync(join(...pi), "fixture");
    writeFileSync(directory.resolve(windows ? "pi.cmd" : "pi"), "fixture");
    writeFileSync(directory.resolve(windows ? "muse.exe" : "muse"), "fixture");
    const after = await Promise.all(registry.tools().map(t => t.check()));

    Assert.areEqual("codex false,claude false,grok false,copilot false,opencode false,cursor false,fx false,pi false,muse false",
      before.map(t => `${t.kind} ${t.found}`).join(","));
    Assert.areEqual("codex true,claude false,grok true,copilot false,opencode true,cursor true,fx true,pi true,muse true", after.map(t => `${t.kind} ${t.found}`).join(","));
    Assert.areEqual(`${windows ? null : Resources.fxInstallCommand} https://fx.sh`, after.slice(6, 7).map(t => `${t.installCommand} ${t.subscribeUrl}`).join(","));
    Assert.areEqual(windows ? Resources.grokWindowsInstallCommand : Resources.grokPosixInstallCommand, after[2]!.installCommand);
    Assert.areEqual(windows ? Resources.copilotWindowsInstallCommand : Resources.copilotPosixInstallCommand, after[3]!.installCommand);
    Assert.areEqual(windows ? Resources.opencodeWindowsInstallCommand : Resources.opencodePosixInstallCommand, after[4]!.installCommand);
    Assert.areEqual(windows ? Resources.cursorWindowsInstallCommand : Resources.cursorPosixInstallCommand, after[5]!.installCommand);
    Assert.areEqual(JSON.stringify([windows ? Resources.piWindowsInstallCommand : Resources.piPosixInstallCommand, null]), JSON.stringify([after[7]!.installCommand, after[7]!.subscribeUrl]));
    Assert.areEqual("https://claude.com/pricing,https://x.ai/grok,https://opencode.ai,https://cursor.com/pricing",
      [after[1]!.subscribeUrl, after[2]!.subscribeUrl, after[4]!.subscribeUrl, after[5]!.subscribeUrl].join(","));
  }

  @TestMethod
  public async looksForEachMissingCommandAgainWhenItsProviderIsUsed(): Promise<void> {
    using directory = new TemporaryDirectory();
    const locator = new ExecutableLocator(process.platform, process.arch, [directory.path], directory.path);
    const registry = new ProviderKindRegistryFactory({}, locator).create("1.0.0", directory.path, new NodeProcessStarter(new ProcessTerminator(process.platform)));
    const codex = await Assert.throwsAsync(() => registry.get("codex").listModels(null), Error);
    const claude = await Assert.throwsAsync(() => registry.get("claude").listModels(null), Error);
    await Assert.throwsAsync(() => registry.get("grok").listModels(null), Error);
    const opencode = await Assert.throwsAsync(() => registry.get("opencode").listModels(null), Error);
    const cursor = await Assert.throwsAsync(() => registry.get("cursor").listModels(null), Error);
    const fx = await Assert.throwsAsync(() => registry.get("fx").listModels(null), Error);
    const pi = await Assert.throwsAsync(() => registry.get("pi").listModels(null), Error);
    const muse = await Assert.throwsAsync(() => registry.get("muse").listModels(null), Error);

    Assert.areEqual([Resources.codexNotFound, Resources.claudeNotFound, Resources.opencodeNotFound, Resources.cursorNotFound, process.platform === "win32" ? Resources.fxWindowsNotFound : Resources.fxNotFound, Resources.piNotFound, Resources.formatGeneralAcpNotFound("Muse Code")].join("\n"),
      [codex.message, claude.message, opencode.message, cursor.message, fx.message, pi.message, muse.message].join("\n"));
  }

  @TestMethod
  public async findsMuseInTheInstallFolderTheEnvironmentNames(): Promise<void> {
    using directory = new TemporaryDirectory();
    const folder = directory.resolve("muse-install");
    const binary = process.platform === "win32" ? "muse-bin-1.4.14-R1.exe" : "muse-bin-1.4.14-R1";
    mkdirSync(folder);
    writeFileSync(join(folder, ".muse-version"), "1.4.14-R1");
    writeFileSync(join(folder, binary), "fixture");
    const locator = new ExecutableLocator(process.platform, process.arch, [], directory.path);
    const registry = new ProviderKindRegistryFactory({ MUSE_INSTALL_DIR: folder }, locator).create("1.0.0", directory.path,
      new NodeProcessStarter(new ProcessTerminator(process.platform)));

    const found = (await Promise.all(registry.tools().map(t => t.check()))).find(t => t.kind === "muse");

    Assert.areEqual("muse:true", [found?.kind, found?.found].join(":"));
  }

  @TestMethod
  public async findsMuseAgainAtEachLaunchSoAnUpdateThatRemovedTheBinaryItFoundIsNotStarted(): Promise<void> {
    using directory = new TemporaryDirectory();
    const folder = directory.resolve("muse-install");
    const suffix = process.platform === "win32" ? ".exe" : "";
    mkdirSync(folder);
    writeFileSync(join(folder, ".muse-version"), "1.4.14-R1");
    writeFileSync(join(folder, `muse-bin-1.4.14-R1${suffix}`), "fixture");
    const locator = new ExecutableLocator(process.platform, process.arch, [], directory.path);
    const registry = new ProviderKindRegistryFactory({ MUSE_INSTALL_DIR: folder }, locator).create("1.0.0", directory.path,
      new NodeProcessStarter(new ProcessTerminator(process.platform)));

    renameSync(join(folder, `muse-bin-1.4.14-R1${suffix}`), directory.resolve(`gone${suffix}`));
    writeFileSync(join(folder, ".muse-version"), "1.4.15-R1");
    const missing = await Assert.throwsAsync(() => registry.get("muse").listModels(null), Error);

    Assert.areEqual(Resources.formatGeneralAcpNotFound("Muse Code"), missing.message);
  }

  @TestMethod
  public async givesCopilotTheLogForModelListingsThatFail(): Promise<void> {
    using directory = new TemporaryDirectory();
    const lines: string[] = [];
    const locator = new ExecutableLocator(process.platform, process.arch, [], directory.path);

    const registry = new ProviderKindRegistryFactory({}, locator).create("1.0.0", directory.path, new NodeProcessStarter(new ProcessTerminator(process.platform)), { write: t => { lines.push(t); } });
    await Assert.throwsAsync(() => registry.get("copilot").listModels(null), ExecutableNotFoundException);

    Assert.areEqual(Resources.formatCopilotListingsFailed(null, "ExecutableNotFoundException", "ExecutableNotFoundException"), lines.join("\n"));
  }

  @TestMethod
  public async givesGrokTheLogForItsSessionLines(): Promise<void> {
    using directory = new TemporaryDirectory();
    writeFileSync(directory.resolve("grok"), "fixture");
    const lines: string[] = [];
    const starter = new FakeGrokStarter(new ProcessTerminator(process.platform));
    const locator = new ExecutableLocator(process.platform, process.arch, [directory.path], directory.path);
    const registry = new ProviderKindRegistryFactory({}, locator).create("1.0.0", directory.path, starter, { write: t => { lines.push(t); } });
    const grok = registry.get("grok");

    try {
      const result = await grok.runTurn(new TurnRequest(null, directory.path, "Hi", new RequestedSettings("grok", null, null), null), new QuietTurnListener(),
        new AbortController().signal);
      Assert.areEqual(TurnOutcome.Completed, result.outcome, result.error ?? "");
    }
    finally {
      await grok.shutdown();
    }

    Assert.areEqual(1, starter.started.length);
    Assert.isTrue(lines.some(t => t.startsWith(Resources.formatAcpModelOptions("grok", ""))), lines.join("\n"));
  }

  @TestMethod
  public listsEveryKindAmongTheProvidersTheAcpRegistryLeavesOut(): void {
    using directory = new TemporaryDirectory();

    const registry = ProviderKindRegistryFactory.fromProcess().create("1.0.0", directory.path, {} as IProcessStarter);

    Assert.areEqual("", registry.all().map(t => t.descriptor.id).filter(t => !Resources.acpRegistryOwnProviderIds.includes(t)).join(","));
  }

  @TestMethod
  public readsThisProcesssEnvironmentAndPath(): void {
    using directory = new TemporaryDirectory();

    const registry = ProviderKindRegistryFactory.fromProcess().create("1.0.0", directory.path, {} as IProcessStarter);

    Assert.areEqual(10, registry.all().length);
  }

  @TestMethod
  public async answersEveryAbilityForEveryRegisteredProviderAndAnAddedAcpAgent(): Promise<void> {
    const columns = await ProviderKindRegistryFactoryTests.columnsAsync();

    Assert.areEqual(String.empty, columns.filter(t => Object.isNull(t[1])).map(t => t[0]).join(","));
    for (const [, row] of columns)
      Assert.areEqual(JSON.stringify(Object.values(ProviderAbility)), JSON.stringify(Object.keys(row?.cells ?? {})));
  }

  @TestMethod
  public async showsTheSameTablesInTheArchitectureDocument(): Promise<void> {
    const columns = await ProviderKindRegistryFactoryTests.columnsAsync();
    const document = readFileSync(ProviderKindRegistryFactoryTests.findArchitecture(dirname(fileURLToPath(import.meta.url))), "utf8").replaceAll("\r\n", "\n");
    const abilities = Object.values(ProviderAbility).filter(t => !ProviderAbilities.commands.includes(t));

    for (const [title, rows] of [["Ability", abilities], ["Command", ProviderAbilities.commands]] as const) {
      const head = `| ${title} | ${columns.map(t => t[0]).join(" | ")} |`;
      const start = document.indexOf(head);
      Assert.isTrue(start >= 0, head);
      const lines = [head, `|${"---|".repeat(columns.length + 1)}`];
      for (const ability of rows)
        lines.push(`| ${ProviderAbilities.names[ability]} | ${columns.map(t => t[1]?.cellOf(ability).label ?? "No row").join(" | ")} |`);
      Assert.areEqual(`${lines.join("\n")}\n`, document.slice(start, document.indexOf("\n\n", start) + 1));
    }
  }

  private static async columnsAsync(): Promise<readonly (readonly [string, ProviderAbilities | null])[]> {
    using directory = new TemporaryDirectory();
    const locator = new ExecutableLocator(process.platform, process.arch, [], directory.path, undefined, directory.resolve("Windows"), directory.resolve("usr", "bin", "tar"));
    const factory = new ProviderKindRegistryFactory({}, locator);
    const registry = factory.create("1.0.0", directory.path, new IdleStarter());
    const stored = new AcpStoredAgent("droid", "Droid", { id: "droid", name: "Droid", version: "1.0.0", distribution: { npx: { package: "droid@1.0.0" } } });
    mkdirSync(directory.resolve("acp-agents", "agents", "droid"), { recursive: true });
    const added = await factory.createAcpCatalog("1.0.0", directory.path, new IdleStarter(), new NoSecrets()).openAsync(stored, () => Promise.resolve());
    const registered = registry.all().map((t): readonly [string, ProviderAbilities | null] => [t.descriptor.displayName, t.descriptor.abilities]);
    return [...registered, ["Added ACP agent", added.descriptor.abilities]];
  }

  private static findArchitecture(folder: string): string {
    const path = join(folder, "documents", "ARCHITECTURE.md");
    if (existsSync(path))
      return path;
    Assert.areNotEqual(folder, dirname(folder));
    return ProviderKindRegistryFactoryTests.findArchitecture(dirname(folder));
  }
}

class IdleStarter implements IProcessStarter {
  public start(_command: ProcessCommand, _environment: NodeJS.ProcessEnv, _directory: string | null): StartedProcess {
    return new StartedProcess();
  }

  public readEnvironmentAsync(own: NodeJS.ProcessEnv): Promise<NodeJS.ProcessEnv> {
    return Promise.resolve(own);
  }
}

class NoSecrets implements ISharedMcpSecrets {
  public readAsync(_name: string): Promise<string | null> {
    return Promise.resolve(null);
  }

  public removeAsync(_name: string): Promise<void> {
    return Promise.resolve();
  }

  public isSetAsync(_name: string): Promise<boolean> {
    return Promise.resolve(false);
  }
}
