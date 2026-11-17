/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  AcpAgentInstaller,
  AcpInstallTools,
  AcpRegistryAgent,
  AcpRegistryBinary,
  AcpRegistryPackage,
  CommandResult,
  CommandRunner,
  ExecutableSource,
  InstallCancelledException, InstallFailedException, InstallHeldException,
  LocatedExecutable,
  NodeProcessStarter,
  type ProcessCommand,
  ProcessTerminator,
  ReleaseSourceException, Resources
} from "@noldova/teamrun.providers";

import { AnsweringCommandRunner } from "../../fixtures/answering-command-runner.fixture.js";
import { FakeNpm } from "../../fixtures/fake-npm.fixture.js";
import { FakeTar } from "../../fixtures/fake-tar.fixture.js";
import { FakeUnzip } from "../../fixtures/fake-unzip.fixture.js";
import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { ZipArchive } from "../../fixtures/zip-archive.fixture.js";

const TARGET = "linux-x86_64";
const TOOL = new LocatedExecutable("tool", ExecutableSource.Path);
const REAL_RUNNER = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));
const hashOf = (body: Buffer): string => createHash("sha256").update(body).digest("hex");

class LinkingCommandRunner extends CommandRunner {
  private readonly outside: string;

  public constructor(outside: string) {
    super(new NodeProcessStarter(new ProcessTerminator(process.platform)));
    this.outside = outside;
  }

  public override run(command: ProcessCommand): Promise<CommandResult> {
    symlinkSync(this.outside, join(command.arguments.at(-1)!, "bin"), "junction");
    return Promise.resolve(new CommandResult(0, null, "", "", false));
  }
}

class Install {
  public readonly directory: string;
  public readonly saved: AcpRegistryAgent[] = [];
  public readonly installer: AcpAgentInstaller;

  public constructor(agent: AcpRegistryAgent, directory: string, tools: AcpInstallTools, options: { readonly platform?: string; readonly runner?: CommandRunner;
    readonly rename?: (from: string, to: string) => void; readonly settle?: (from: string, to: string) => Promise<void>; readonly latest?: AcpRegistryAgent | null;
    readonly environment?: NodeJS.ProcessEnv; readonly target?: string | null } = {}) {
    this.directory = directory;
    const rename = options.rename ?? renameSync;
    this.installer = new AcpAgentInstaller(agent, directory, options.target === undefined ? TARGET : options.target, options.platform ?? "linux", options.environment ?? process.env,
      tools, options.runner ?? REAL_RUNNER, rename, options.settle ?? (async (from, to) => rename(from, to)), () => Promise.resolve(options.latest === undefined ? null : options.latest),
      async t => { this.saved.push(t); });
  }

  public run(signal: AbortSignal = new AbortController().signal, commit: () => void = () => undefined): Promise<string> {
    return this.installer.install(() => undefined, signal, commit);
  }
}

@TestClass
export class AcpAgentInstallerTests {
  private static agent(url: string, sha256: string | null, version: string = "1.0.0", command: readonly string[] = ["bin", "agent"]): AcpRegistryAgent {
    return new AcpRegistryAgent("agent", "Agent", version, "", null, new Map([[TARGET, new AcpRegistryBinary(url, command, ["acp"], { AGENT_MODE: "acp" }, sha256)]]), null, null);
  }

  private static npx(name: string = "agent-cli@1.0.0", version: string = "1.0.0"): AcpRegistryAgent {
    return new AcpRegistryAgent("agent", "Agent", version, "", null, new Map(), new AcpRegistryPackage(name, ["--acp"], { AGENT_SECRET: "from-the-entry" }), null);
  }

  private static uvx(): AcpRegistryAgent {
    return new AcpRegistryAgent("agent", "Agent", "1.0.0", "", null, new Map(), null, new AcpRegistryPackage("agent@1.0.0", [], {}));
  }

  private static binaryOnly(archive: string): AcpRegistryAgent {
    return AcpAgentInstallerTests.agent(`https://example.com/${archive}`, null);
  }

  @TestMethod
  public async installsAnArchiveWhoseHashMatchesInAFolderOfItsVersion(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const archive = FakeTar.archive({ "bin/agent": "program" });
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", archive);
    const agent = AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), hashOf(archive));
    const install = new Install(agent, directory.resolve("installs"), new AcpInstallTools(FakeTar.create(tools.path), null, null));
    const progress: number[] = [];
    const commits: boolean[] = [];

    Assert.isFalse(install.installer.isInstalled);
    Assert.isNull(install.installer.program);
    Assert.isNull(install.installer.commandOf());
    Assert.areEqual("null 1.0.0", AcpAgentInstallerTests.versions(await install.installer.readVersions()));
    const folder = await install.installer.install(t => progress.push(t), new AbortController().signal, () => commits.push(existsSync(directory.resolve("installs", "1.0.0"))));

    Assert.areEqual(directory.resolve("installs", "1.0.0"), folder);
    Assert.areEqual("program", readFileSync(join(folder, "bin", "agent"), "utf8"));
    Assert.areEqual(String(archive.length), String(progress.at(-1)));
    Assert.areEqual("false", commits.join(","));
    Assert.areEqual("1.0.0", readdirSync(directory.resolve("installs")).join(","));
    Assert.areEqual("agent", install.saved.map(t => t.id).join(","));
    Assert.isTrue(install.installer.isInstalled);
    Assert.isNull(install.installer.unavailable);
    Assert.areEqual(join(folder, "bin", "agent"), install.installer.program);
    Assert.areEqual(`${join(folder, "bin", "agent")}|acp`, [install.installer.commandOf()!.executable, install.installer.commandOf()!.arguments.join(",")].join("|"));
    Assert.areEqual(JSON.stringify({ AGENT_MODE: "acp" }), JSON.stringify(install.installer.variables));
    Assert.areEqual("1.0.0 1.0.0", AcpAgentInstallerTests.versions(await install.installer.readVersions()));
    if (process.platform !== "win32")
      Assert.areEqual(0o755, statSync(join(folder, "bin", "agent")).mode & 0o777);
  }

  @TestMethod
  public async leavesNothingWhenAnArchivesHashDiffers(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", FakeTar.archive({ "bin/agent": "program" }));
    const install = new Install(AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), "0".repeat(64)), directory.resolve("installs"),
      new AcpInstallTools(FakeTar.create(tools.path), null, null));

    const failure = await Assert.throwsAsync(() => install.run(), ReleaseSourceException);

    Assert.areEqual(Resources.formatDownloadMismatch("Agent"), failure.message);
    Assert.areEqual(String.empty, readdirSync(directory.resolve("installs")).join(","));
    Assert.areEqual(0, install.saved.length);
    Assert.isFalse(install.installer.isInstalled);
  }

  @TestMethod
  public async startsNoDownloadFromAnAddressThatIsntHttpsEvenWithAHash(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const install = new Install(AcpAgentInstallerTests.agent("http://example.com/agent.tar.gz", "0".repeat(64)), directory.resolve("installs"),
      new AcpInstallTools(FakeTar.create(tools.path), null, null));

    const failure = await Assert.throwsAsync(() => install.run(), InstallFailedException);

    Assert.areEqual(Resources.formatAcpAgentArchiveInsecure("Agent"), failure.message);
    Assert.isFalse(install.installer.isInstalled);
    Assert.areEqual(0, install.saved.length);
  }

  @TestMethod
  public async installsAnArchiveThatListsNoHash(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", FakeTar.archive({ "bin/agent": "program" }));
    const install = new Install(AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), null), directory.resolve("installs"),
      new AcpInstallTools(FakeTar.create(tools.path), null, null));

    const folder = await install.run();

    Assert.areEqual("program", readFileSync(join(folder, "bin", "agent"), "utf8"));
  }

  @TestMethod
  public async installsABinaryThatIsNoArchiveAtItsCommandsPath(): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = (await LocalHttpServer.start()).serve("/agent.exe", Buffer.from("program"));
    const install = new Install(AcpAgentInstallerTests.agent(server.url("/agent.exe"), null, "1.0.0", ["tools", "agent.exe"]), directory.resolve("installs"),
      new AcpInstallTools(null, null, null), { platform: "win32" });

    Assert.isNull(install.installer.unavailable);
    const folder = await install.run();

    Assert.areEqual("program", readFileSync(join(folder, "tools", "agent.exe"), "utf8"));
  }

  @TestMethod
  public async unpacksAZipAndRefusesOneWithAPathOutsideItsFolder(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const unzip = new AcpInstallTools(null, FakeUnzip.create(tools.path), null);
    await using server = (await LocalHttpServer.start()).serve("/agent.zip", ZipArchive.stored([{ name: "agent", data: "program" }])).serve("/unsafe.zip", ZipArchive.stored([{ name: "../agent", data: "program" }]));
    const safe = new Install(AcpAgentInstallerTests.agent(server.url("/agent.zip"), null, "1.0.0", ["agent"]), directory.resolve("safe"), unzip);
    const unsafe = new Install(AcpAgentInstallerTests.agent(server.url("/unsafe.zip"), null, "1.0.0", ["agent"]), directory.resolve("unsafe"), unzip);

    const folder = await safe.run();
    const failure = await Assert.throwsAsync(() => unsafe.run(), InstallFailedException);

    Assert.areEqual("program", readFileSync(join(folder, "agent"), "utf8"));
    Assert.areEqual(Resources.formatAcpAgentArchiveUnsafe("Agent"), failure.message);
    Assert.areEqual(String.empty, readdirSync(directory.resolve("unsafe")).join(","));
  }

  @TestMethod
  public async refusesAnArchiveThatWontUnpackOrHasNoProgramOrWhoseProgramIsAFolder(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const tar = new AcpInstallTools(FakeTar.create(tools.path), null, null);
    const none = FakeTar.archive({ "other/file": "text" });
    const folderProgram = FakeTar.archive({ "bin/agent/inner": "text" });
    await using server = (await LocalHttpServer.start()).serve("/broken.tar.gz", Buffer.from("not json")).serve("/none.tar.gz", none).serve("/folder.tar.gz", folderProgram)
      .serve("/stopped.tar.gz", none);
    const runner = new AnsweringCommandRunner(new CommandResult(null, null, "", "", true));
    const cases: readonly [string, Install, string][] = [
      ["broken", new Install(AcpAgentInstallerTests.agent(server.url("/broken.tar.gz"), null), directory.resolve("broken"), tar), Resources.formatAcpAgentUnpackFailed("Agent", 9)],
      ["none", new Install(AcpAgentInstallerTests.agent(server.url("/none.tar.gz"), null), directory.resolve("none"), tar),
        Resources.formatAcpAgentProgramMissing("Agent", join("bin", "agent"))],
      ["folder", new Install(AcpAgentInstallerTests.agent(server.url("/folder.tar.gz"), null), directory.resolve("folder"), tar),
        Resources.formatAcpAgentProgramMissing("Agent", join("bin", "agent"))],
      ["stopped", new Install(AcpAgentInstallerTests.agent(server.url("/stopped.tar.gz"), null), directory.resolve("stopped"), tar, { runner }), Resources.formatAcpAgentUnpackFailed("Agent", null)]
    ];

    for (const [name, install, message] of cases) {
      const failure = await Assert.throwsAsync(() => install.run(), Error);

      Assert.areEqual(message, failure.message, name);
      Assert.areEqual(String.empty, readdirSync(directory.resolve(name)).join(","), name);
    }
    Assert.areEqual("Unpacking Agent took too long.", Resources.formatAcpAgentUnpackFailed("Agent", null));
    Assert.areEqual("Unpacking Agent failed with exit code 9.", Resources.formatAcpAgentUnpackFailed("Agent", 9));
  }

  @TestMethod
  public async refusesAProgramALinkTakesOutsideItsFolder(): Promise<void> {
    using directory = new TemporaryDirectory();
    const outside = directory.resolve("outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "agent"), "elsewhere");
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", FakeTar.archive({}));
    const install = new Install(AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), null), directory.resolve("installs"), new AcpInstallTools(TOOL, null, null),
      { runner: new LinkingCommandRunner(outside) });

    const failure = await Assert.throwsAsync(() => install.run(), InstallFailedException);

    Assert.areEqual(Resources.formatAcpAgentArchiveUnsafe("Agent"), failure.message);
    Assert.areEqual(String.empty, readdirSync(directory.resolve("installs")).join(","));
  }

  @TestMethod
  public async movesToTheListedVersionSavesItAndKeepsTheVersionItReplacesUntilTheNextInstall(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const archive = FakeTar.archive({ "bin/agent": "new" });
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", archive);
    const next = AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), hashOf(archive), "2.0.0");
    const install = new Install(AcpAgentInstallerTests.agent(server.url("/old.tar.gz"), null), directory.resolve("installs"), new AcpInstallTools(FakeTar.create(tools.path), null, null),
      { latest: next });
    mkdirSync(directory.resolve("installs", "0.9.0"), { recursive: true });
    mkdirSync(directory.resolve("installs", "1.0.0"), { recursive: true });

    Assert.areEqual("1.0.0 2.0.0", AcpAgentInstallerTests.versions(await install.installer.readVersions()));
    const folder = await install.run();

    Assert.areEqual(directory.resolve("installs", "2.0.0"), folder);
    Assert.areEqual("1.0.0,2.0.0", readdirSync(directory.resolve("installs")).sort().join(","));
    Assert.areEqual("2.0.0", install.saved.map(t => t.version).join(","));
    Assert.areEqual(join(folder, "bin", "agent"), install.installer.program);
    Assert.areEqual("2.0.0 2.0.0", AcpAgentInstallerTests.versions(await install.installer.readVersions()));
  }

  @TestMethod
  public async keepsAFolderOfTheVersionAlreadyThere(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const archive = FakeTar.archive({ "bin/agent": "new" });
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", archive);
    const install = new Install(AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), hashOf(archive)), directory.resolve("installs"),
      new AcpInstallTools(FakeTar.create(tools.path), null, null));
    mkdirSync(directory.resolve("installs", "1.0.0", "bin"), { recursive: true });
    writeFileSync(directory.resolve("installs", "1.0.0", "bin", "agent"), "earlier");

    const folder = await install.run();

    Assert.areEqual("earlier", readFileSync(join(folder, "bin", "agent"), "utf8"));
    Assert.areEqual("agent", install.saved.map(t => t.id).join(","));
  }

  @TestMethod
  public async keepsAnOldVersionItCantRemoveWithoutFailingTheInstall(): Promise<void> {
    if (process.getuid?.() === 0)
      return;
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const archive = FakeTar.archive({ "bin/agent": "new" });
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", archive);
    const install = new Install(AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), hashOf(archive), "2.0.0"), directory.resolve("installs"),
      new AcpInstallTools(FakeTar.create(tools.path), null, null));
    const old = directory.resolve("installs", "1.0.0");
    mkdirSync(old, { recursive: true });
    writeFileSync(join(old, "kept"), "old");
    AcpAgentInstallerTests.denyRemoval(old);
    let folder: string;
    try {
      folder = await install.run();
    }
    finally {
      AcpAgentInstallerTests.allowRemoval(old);
    }

    Assert.areEqual(directory.resolve("installs", "2.0.0"), folder);
    Assert.areEqual("old", readFileSync(join(old, "kept"), "utf8"));
  }

  @TestMethod
  public async saysWhyAFinishedDownloadCouldntBePlacedAndLeavesNoFolder(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const archive = FakeTar.archive({ "bin/agent": "new" });
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", archive);
    const agent = AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), hashOf(archive));
    const denied = Object.assign(new Error("denied"), { code: "EACCES" });
    const cases: readonly [string, () => Promise<void>, string][] = [
      ["plain", () => Promise.reject(denied), `Agent couldn't be moved to ${directory.resolve("plain", "1.0.0")} (EACCES).`],
      ["held", () => Promise.reject(new InstallHeldException("held", "EBUSY", new Error("held"))), `Agent couldn't be moved to ${directory.resolve("held", "1.0.0")} because another program holds it (EBUSY).`],
      ["bare", () => Promise.reject(new Error("gone")), `Agent couldn't be moved to ${directory.resolve("bare", "1.0.0")}.`]
    ];

    for (const [name, settle, message] of cases) {
      const install = new Install(agent, directory.resolve(name), new AcpInstallTools(FakeTar.create(tools.path), null, null), { settle });

      const failure = await Assert.throwsAsync(() => install.run(), Error);

      Assert.areEqual(message, failure.message, name);
      Assert.isFalse(existsSync(directory.resolve(name, "1.0.0")), name);
      Assert.areEqual(0, install.saved.length, name);
    }
  }

  @TestMethod
  public async saysAnInstallWasCancelledOnlyBeforeItCommits(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const archive = FakeTar.archive({ "bin/agent": "new" });
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", archive);
    const agent = AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), hashOf(archive));
    const stopped = new AbortController();
    stopped.abort();
    const before = new Install(agent, directory.resolve("before"), new AcpInstallTools(FakeTar.create(tools.path), null, null));
    const late = new AbortController();
    const after = new Install(agent, directory.resolve("after"), new AcpInstallTools(FakeTar.create(tools.path), null, null), { settle: () => Promise.reject(new Error("gone")) });

    const cancelled = await Assert.throwsAsync(() => before.run(stopped.signal), InstallCancelledException);
    const placed = await Assert.throwsAsync(() => after.run(late.signal, () => late.abort()), Error);

    Assert.areEqual(Resources.formatInstallCancelled("Agent"), cancelled.message);
    Assert.areEqual(String.empty, readdirSync(directory.resolve("before")).join(","));
    Assert.areEqual(`Agent couldn't be moved to ${directory.resolve("after", "1.0.0")}.`, placed.message);
  }

  @TestMethod
  public async cancelsOnceTheDownloadHasFinished(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const archive = FakeTar.archive({ "bin/agent": "new" });
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", archive);
    const agent = AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), hashOf(archive));
    const stop = new AbortController();
    const install = new AcpAgentInstaller(agent, directory.resolve("installs"), TARGET, "linux", process.env, new AcpInstallTools(FakeTar.create(tools.path), null, null), REAL_RUNNER,
      renameSync, async (from, to) => renameSync(from, to), () => Promise.resolve(null), async () => undefined);

    const failure = await Assert.throwsAsync(() => install.install((received, total) => {
      if (received === total)
        stop.abort();
    }, stop.signal, () => undefined), Error);

    Assert.areEqual(Resources.formatInstallCancelled("Agent"), failure.message);
    Assert.areEqual(String.empty, readdirSync(directory.resolve("installs")).join(","));
  }

  @TestMethod
  public async namesAFolderItCantWriteTo(): Promise<void> {
    if (process.getuid?.() === 0)
      return;
    using directory = new TemporaryDirectory();
    const installs = directory.resolve("installs");
    mkdirSync(installs);
    const install = new Install(AcpAgentInstallerTests.binaryOnly("agent.tar.gz"), installs, new AcpInstallTools(TOOL, null, null));
    AcpAgentInstallerTests.denyWrites(installs);
    let failure: Error;
    try {
      failure = await Assert.throwsAsync(() => install.run(), Error);
    }
    finally {
      AcpAgentInstallerTests.allowWrites(installs);
    }

    Assert.areEqual(Resources.formatAcpAgentFolderNotWritable(installs), failure.message);
  }

  @TestMethod
  public async installsAnNpxPackageThroughTheOwnNpmWithItsScriptsOffAndWithoutItsEntrysVariables(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const npm = new FakeNpm(tools.path, FakeNpm.package("agent-cli", "1.0.0", { "agent-cli": "cli.js" }, ["agent-cli"]));
    const install = new Install(AcpAgentInstallerTests.npx(), directory.resolve("installs"), new AcpInstallTools(null, null, npm.executable),
      { platform: process.platform, environment: { ...process.env, PERSON_SETTING: "kept" } });

    const folder = await install.run();

    Assert.areEqual(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", "--loglevel=error", "--prefix"].join(" "), npm.arguments.slice(0, 7).join(" "));
    Assert.areEqual("agent-cli@1.0.0", npm.arguments.at(-1));
    Assert.areEqual("kept", npm.environment["PERSON_SETTING"]);
    Assert.isUndefined(npm.environment["AGENT_SECRET"]);
    Assert.areEqual(JSON.stringify({ AGENT_SECRET: "from-the-entry" }), JSON.stringify(install.installer.variables));
    const program = join(folder, "node_modules", ".bin", process.platform === "win32" ? "agent-cli.cmd" : "agent-cli");
    Assert.areEqual(program, install.installer.program);
    Assert.isTrue(install.installer.commandOf()!.arguments.join(" ").includes("--acp"));
  }

  @TestMethod
  public async runsNpmAndAnAgentsShimThroughTheShellOnWindowsAndItsProgramNameElsewhere(): Promise<void> {
    using directory = new TemporaryDirectory();
    const files = FakeNpm.package("agent-cli", "1.0.0", "cli.js", ["agent-cli"]);
    const shim = directory.resolve("npm.cmd");
    writeFileSync(shim, "");
    const answering = new AnsweringCommandRunner(new CommandResult(0, null, "", "", false));
    const windows = new Install(AcpAgentInstallerTests.npx(), directory.resolve("windows"), new AcpInstallTools(null, null, new LocatedExecutable(shim, ExecutableSource.Path)),
      { platform: "win32", runner: answering, environment: { COMSPEC: "C:\\Windows\\System32\\cmd.exe", PATH: directory.path } });

    await Assert.throwsAsync(() => windows.run(), Error);
    mkdirSync(directory.resolve("windows", "1.0.0"), { recursive: true });
    for (const [name, text] of Object.entries(files)) {
      mkdirSync(dirname(directory.resolve("windows", "1.0.0", name)), { recursive: true });
      writeFileSync(directory.resolve("windows", "1.0.0", name), text);
    }

    Assert.areEqual("C:\\Windows\\System32\\cmd.exe|true", `${answering.commands[0]!.executable}|${answering.commands[0]!.isVerbatim}`);
    Assert.areEqual(directory.resolve("windows", "1.0.0", "node_modules", ".bin", "agent-cli.cmd"), windows.installer.program);
    Assert.areEqual("C:\\Windows\\System32\\cmd.exe|true", `${windows.installer.commandOf()!.executable}|${windows.installer.commandOf()!.isVerbatim}`);
    const linux = new Install(AcpAgentInstallerTests.npx(), directory.resolve("windows"), new AcpInstallTools(null, null, TOOL), { environment: {} });
    Assert.areEqual(directory.resolve("windows", "1.0.0", "node_modules", ".bin", "agent-cli"), linux.installer.program);
  }

  @TestMethod
  public async saysWhyNpmsWorkFailedAndLeavesNothing(): Promise<void> {
    using directory = new TemporaryDirectory();
    const cases: readonly [string, Readonly<Record<string, string>>, number, string, string][] = [
      ["exit", {}, 7, " no such version \n", Resources.formatAcpAgentNpmFailed("Agent", 7, "no such version")],
      ["quiet", {}, 7, "", Resources.formatAcpAgentNpmFailed("Agent", 7, "")],
      ["nothing", {}, 0, "", Resources.formatAcpAgentPackageIncomplete("Agent", "agent-cli@1.0.0")],
      ["version", FakeNpm.package("agent-cli", "9.9.9", "cli.js", ["agent-cli"]), 0, "", Resources.formatAcpAgentPackageIncomplete("Agent", "agent-cli@1.0.0")],
      ["none", FakeNpm.package("agent-cli", "1.0.0", null), 0, "", Resources.formatAcpAgentNoProgram("agent-cli@1.0.0")],
      ["missing", FakeNpm.package("agent-cli", "1.0.0", "cli.js"), 0, "", Resources.formatAcpAgentProgramMissing("Agent", join("node_modules", ".bin", process.platform === "win32" ? "agent-cli.cmd" : "agent-cli"))]
    ];

    for (const [name, files, exitCode, stderr, message] of cases) {
      mkdirSync(directory.resolve(`${name}-npm`));
      const npm = new FakeNpm(directory.resolve(`${name}-npm`), files, exitCode, stderr);
      const install = new Install(AcpAgentInstallerTests.npx(), directory.resolve(name), new AcpInstallTools(null, null, npm.executable), { platform: process.platform });

      const failure = await Assert.throwsAsync(() => install.run(), Error);

      Assert.areEqual(message, failure.message, name);
      Assert.areEqual(String.empty, readdirSync(directory.resolve(name)).join(","), name);
    }
    const timedOut = new Install(AcpAgentInstallerTests.npx(), directory.resolve("timed"), new AcpInstallTools(null, null, TOOL), { runner: new AnsweringCommandRunner(new CommandResult(null, null, "", "", true)) });
    Assert.areEqual(Resources.formatAcpAgentNpmFailed("Agent", null, ""), (await Assert.throwsAsync(() => timedOut.run(), InstallFailedException)).message);
    Assert.areEqual("npm took too long to install Agent.", Resources.formatAcpAgentNpmFailed("Agent", null, ""));
    Assert.areEqual("npm couldn't install Agent: exit code 7. no such version", Resources.formatAcpAgentNpmFailed("Agent", 7, "no such version"));
  }

  @TestMethod
  public async picksTheOneProgramAPackageNamesAndRefusesWhenItCant(): Promise<void> {
    const cases: readonly [string, string, unknown, string | null][] = [
      ["string", "agent-cli", "cli.js", "agent-cli"],
      ["scoped string", "@acme/agent-cli", "cli.js", "agent-cli"],
      ["single", "agent-cli", { other: "cli.js" }, "other"],
      ["scoped key", "agent-cli", { "@acme/other": "cli.js" }, "other"],
      ["many", "agent-cli", { other: "a.js", "agent-cli": "b.js" }, "agent-cli"],
      ["many, none named", "agent-cli", { one: "a.js", two: "b.js" }, null],
      ["no bin", "agent-cli", undefined, null],
      ["null bin", "agent-cli", null, null],
      ["number", "agent-cli", 7, null],
      ["unsafe name", "agent-cli", { "a b": "cli.js" }, null]
    ];

    for (const [label, name, bin, expected] of cases) {
      using directory = new TemporaryDirectory();
      using tools = new TemporaryDirectory();
      const programs = Object.isNull(expected) ? [] : [expected];
      const npm = new FakeNpm(tools.path, FakeNpm.package(name, "1.0.0", bin, programs));
      const install = new Install(AcpAgentInstallerTests.npx(`${name}@1.0.0`), directory.resolve("installs"), new AcpInstallTools(null, null, npm.executable), { platform: process.platform });

      if (Object.isNull(expected)) {
        Assert.areEqual(Resources.formatAcpAgentNoProgram(`${name}@1.0.0`), (await Assert.throwsAsync(() => install.run(), InstallFailedException)).message, label);
        continue;
      }
      const folder = await install.run();
      Assert.areEqual(join(folder, "node_modules", ".bin", process.platform === "win32" ? `${expected}.cmd` : expected), install.installer.program, label);
    }
  }

  @TestMethod
  public async saysWhyAnAgentCantInstallBeforeItTries(): Promise<void> {
    using directory = new TemporaryDirectory();
    const cases: readonly [string, AcpRegistryAgent, AcpInstallTools, string | null, string | null][] = [
      ["raw", AcpAgentInstallerTests.binaryOnly("agent.exe"), new AcpInstallTools(null, null, null), TARGET, null],
      ["no extension", AcpAgentInstallerTests.binaryOnly("agent"), new AcpInstallTools(null, null, null), TARGET, null],
      ["tar", AcpAgentInstallerTests.binaryOnly("agent.tar.gz"), new AcpInstallTools(TOOL, null, null), TARGET, null],
      ["tar with a query", AcpAgentInstallerTests.binaryOnly("AGENT.TGZ?download=1"), new AcpInstallTools(TOOL, null, null), TARGET, null],
      ["no tar", AcpAgentInstallerTests.binaryOnly("agent.tar.gz"), new AcpInstallTools(null, TOOL, TOOL), TARGET, Resources.formatAcpAgentNoExtractor("Agent")],
      ["zip", AcpAgentInstallerTests.binaryOnly("agent.zip"), new AcpInstallTools(null, TOOL, null), TARGET, null],
      ["no unzip", AcpAgentInstallerTests.binaryOnly("agent.zip"), new AcpInstallTools(TOOL, null, TOOL), TARGET, Resources.formatAcpAgentNoExtractor("Agent")],
      ["npm", AcpAgentInstallerTests.npx(), new AcpInstallTools(null, null, TOOL), TARGET, null],
      ["scoped npm", AcpAgentInstallerTests.npx("@acme/agent@1.2.3-beta.1"), new AcpInstallTools(null, null, TOOL), TARGET, null],
      ["no npm", AcpAgentInstallerTests.npx(), new AcpInstallTools(TOOL, TOOL, null), TARGET, Resources.formatAcpAgentNoNpm("Agent")],
      ["tag", AcpAgentInstallerTests.npx("agent@latest"), new AcpInstallTools(null, null, TOOL), TARGET, Resources.formatAcpAgentPackageRefused("Agent", "agent@latest")],
      ["no version", AcpAgentInstallerTests.npx("agent"), new AcpInstallTools(null, null, TOOL), TARGET, Resources.formatAcpAgentPackageRefused("Agent", "agent")],
      ["flag", AcpAgentInstallerTests.npx("--global@1.0.0"), new AcpInstallTools(null, null, TOOL), TARGET, Resources.formatAcpAgentPackageRefused("Agent", "--global@1.0.0")],
      ["git", AcpAgentInstallerTests.npx("git+https://example.com/agent.git"), new AcpInstallTools(null, null, TOOL), TARGET, Resources.formatAcpAgentPackageRefused("Agent", "git+https://example.com/agent.git")],
      ["too long", AcpAgentInstallerTests.npx(`${"a".repeat(257)}@1.0.0`), new AcpInstallTools(null, null, TOOL), TARGET, Resources.formatAcpAgentPackageRefused("Agent", `${"a".repeat(257)}@1.0.0`)],
      ["uvx", AcpAgentInstallerTests.uvx(), new AcpInstallTools(TOOL, TOOL, TOOL), TARGET, Resources.formatAcpAgentUvx("Agent")],
      ["no build", new AcpRegistryAgent("agent", "Agent", "1.0.0", "", null, new Map(), null, null), new AcpInstallTools(TOOL, TOOL, TOOL), TARGET, Resources.formatAcpAgentNoBuild("Agent")],
      ["another computer", AcpAgentInstallerTests.binaryOnly("agent.exe"), new AcpInstallTools(TOOL, TOOL, TOOL), "windows-aarch64", Resources.formatAcpAgentNoBuild("Agent")],
      ["no target", AcpAgentInstallerTests.binaryOnly("agent.exe"), new AcpInstallTools(TOOL, TOOL, TOOL), null, Resources.formatAcpAgentNoBuild("Agent")]
    ];

    const missing: ReadonlyMap<string, string> = new Map([["no tar", "tar"], ["no unzip", "unzip"], ["no npm", "npm"]]);

    for (const [label, agent, tools, target, reason] of cases) {
      const install = new Install(agent, directory.resolve(label), tools, { target });

      Assert.areEqual(String(missing.get(label) ?? null), String(install.installer.missingTool), label);

      Assert.areEqual(String(reason), String(AcpAgentInstaller.refusalOf(agent, target, tools)), label);
      Assert.areEqual(String(reason), String(install.installer.unavailable), label);
      if (!Object.isNull(reason))
        Assert.areEqual(reason, (await Assert.throwsAsync(() => install.run(), Error)).message, label);
    }
  }

  @TestMethod
  public async hasNoVariablesForAnEntryItCantInstallAndNoUnavailableReasonOrMissingToolOnceInstalled(): Promise<void> {
    using directory = new TemporaryDirectory();
    const install = new Install(AcpAgentInstallerTests.uvx(), directory.resolve("installs"), new AcpInstallTools(null, null, null));
    mkdirSync(directory.resolve("installs", "1.0.0"), { recursive: true });

    Assert.areEqual("{}", JSON.stringify(install.installer.variables));
    Assert.isNull(install.installer.unavailable);
    const zipped = new Install(AcpAgentInstallerTests.binaryOnly("agent.zip"), directory.resolve("zipped"), new AcpInstallTools(null, null, null));
    Assert.areEqual("unzip", zipped.installer.missingTool);
    mkdirSync(directory.resolve("zipped", "1.0.0"), { recursive: true });
    Assert.isNull(zipped.installer.missingTool);
  }

  @TestMethod
  public async installsTheVersionItHasWhenTheListCantBeRead(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const archive = FakeTar.archive({ "bin/agent": "new" });
    await using server = (await LocalHttpServer.start()).serve("/agent.tar.gz", archive);
    const install = new Install(AcpAgentInstallerTests.agent(server.url("/agent.tar.gz"), hashOf(archive)), directory.resolve("installs"), new AcpInstallTools(FakeTar.create(tools.path), null, null),
      { latest: null });

    Assert.areEqual("null 1.0.0", AcpAgentInstallerTests.versions(await install.installer.readVersions()));
    Assert.areEqual(directory.resolve("installs", "1.0.0"), await install.run());
  }

  private static versions(versions: { readonly installed: string | null; readonly latest: string | null }): string {
    return `${versions.installed} ${versions.latest}`;
  }

  private static denyWrites(folder: string): void {
    if (process.platform === "win32")
      execFileSync("icacls", [folder, "/deny", "*S-1-1-0:(WD,AD)"]);
    else
      chmodSync(folder, 0o555);
  }

  private static allowWrites(folder: string): void {
    if (process.platform === "win32")
      execFileSync("icacls", [folder, "/remove:d", "*S-1-1-0"]);
    else
      chmodSync(folder, 0o755);
  }

  private static denyRemoval(folder: string): void {
    if (process.platform === "win32") {
      execFileSync("icacls", [join(folder, "kept"), "/deny", "*S-1-1-0:(DE)"]);
      execFileSync("icacls", [folder, "/deny", "*S-1-1-0:(DC)"]);
    }
    else
      chmodSync(folder, 0o555);
  }

  private static allowRemoval(folder: string): void {
    if (process.platform === "win32") {
      execFileSync("icacls", [folder, "/remove:d", "*S-1-1-0"]);
      execFileSync("icacls", [join(folder, "kept"), "/remove:d", "*S-1-1-0"]);
    }
    else
      chmodSync(folder, 0o755);
  }
}
