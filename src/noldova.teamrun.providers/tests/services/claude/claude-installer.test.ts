/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ProviderKindVersions } from "@noldova/teamrun.core";
import {
  ClaudeInstaller,
  CommandRunner,
  ExecutableSource,
  ExecutableVersionReader,
  InstallCancelledException, InstallFailedException, LocatedExecutable,
  NodeProcessStarter,
  ProcessCommand,
  ProcessTerminator,
  Resources
} from "@noldova/teamrun.providers";

import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { TimedCommandRunner } from "../../fixtures/timed-command-runner.fixture.js";

@TestClass
export class ClaudeInstallerTests {
  @TestMethod
  public installsTheLatestBuildOnceItPassesItsChecksByRunningItsOwnSetupForThatVersion(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      const program = ClaudeInstallerTests.program(directory, "2.1.212");
      ClaudeInstallerTests.publish(server, "/c", "2.1.212", "linux-x64", "claude", program);
      const installer = ClaudeInstallerTests.installer(server.url("/c"), directory);
      const progress: number[][] = [];
      Assert.isNull(installer.unavailable);
      Assert.isFalse(installer.isInstalled);
      Assert.isNull(installer.foundPath);
      Assert.areEqual("null null", ClaudeInstallerTests.versions(await installer.readVersions(true)));
      mkdirSync(directory.resolve("staging", ".teamrun-staging-left-by-a-stopped-install"), { recursive: true });

      const path = await installer.install((received, total) => progress.push([received, total]), new AbortController().signal);

      Assert.areEqual(process.execPath, path);
      Assert.isTrue(installer.isInstalled);
      Assert.areEqual("2.1.212 2.1.212", ClaudeInstallerTests.versions(await installer.readVersions(true)));
      Assert.areEqual(JSON.stringify([program.length, program.length]), JSON.stringify(progress.at(-1)));
      Assert.areEqual(0, readdirSync(directory.resolve("staging")).length);
      Assert.areEqual("/c/latest,/c/2.1.212/manifest.json,/c/2.1.212/linux-x64/claude,/c/latest", ClaudeInstallerTests.paths(server));
      Assert.areEqual("/c/2.1.212/linux-x64/claude identity", server.requests[2]);
    });
  }

  @TestMethod
  public downloadsTheWindowsBuildByItsOwnName(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      ClaudeInstallerTests.publish(server, "/c", "2.1.212", "win32-arm64", "claude.exe", ClaudeInstallerTests.program(directory, "2.1.212"));

      await ClaudeInstallerTests.installer(server.url("/c"), directory, "win32-arm64").install(() => undefined, new AbortController().signal);

      Assert.areEqual("/c/latest,/c/2.1.212/manifest.json,/c/2.1.212/win32-arm64/claude.exe", ClaudeInstallerTests.paths(server));
    });
  }

  @TestMethod
  public installsNothingWhenTheChannelTheManifestOrTheDownloadFailsItsChecks(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      const program = ClaudeInstallerTests.program(directory, "2.1.212");
      const sha256 = createHash("sha256").update(program).digest("hex");
      const manifest = (build: unknown): Buffer => Buffer.from(JSON.stringify({ version: "2.1.212", platforms: { "linux-x64": build } }));
      server.serve("/unreadable/latest", Buffer.from("<html>sign in</html>"));
      const manifests = [new ServedManifest("/no-build", manifest(undefined)), new ServedManifest("/bad-checksum", manifest({ checksum: "ABC", size: program.length })),
        new ServedManifest("/bad-size", manifest({ checksum: sha256, size: "1" })), new ServedManifest("/no-size", manifest({ checksum: sha256, size: 0 })),
        new ServedManifest("/not-json", Buffer.from("{")), new ServedManifest("/no-platforms", Buffer.from("null")),
        new ServedManifest("/mismatch", manifest({ checksum: "0".repeat(64), size: program.length })),
        new ServedManifest("/missing", manifest({ checksum: sha256, size: program.length }))];
      for (const served of manifests) {
        server.serve(`${served.channel}/latest`, Buffer.from("2.1.212\n")).serve(`${served.channel}/2.1.212/manifest.json`, served.body);
        if (served.channel === "/mismatch")
          server.serve(`${served.channel}/2.1.212/linux-x64/claude`, program);
      }
      const cases = [
        new ChannelFailure("/gone", Resources.formatReleaseChannelFailed("Claude Code", 404)),
        new ChannelFailure("/unreadable", Resources.formatReleaseChannelUnreadable("Claude Code")),
        new ChannelFailure("/no-build", Resources.formatClaudeBuildMissing("2.1.212")),
        new ChannelFailure("/bad-checksum", Resources.formatClaudeBuildMissing("2.1.212")),
        new ChannelFailure("/bad-size", Resources.formatClaudeBuildMissing("2.1.212")),
        new ChannelFailure("/no-size", Resources.formatClaudeBuildMissing("2.1.212")),
        new ChannelFailure("/not-json", Resources.formatClaudeBuildMissing("2.1.212")),
        new ChannelFailure("/no-platforms", Resources.formatClaudeBuildMissing("2.1.212")),
        new ChannelFailure("/mismatch", Resources.formatDownloadMismatch("Claude Code")),
        new ChannelFailure("/missing", Resources.formatDownloadFailed("Claude Code", 404))
      ];

      for (const { channel, message } of cases) {
        const installer = ClaudeInstallerTests.installer(server.url(channel), directory);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, channel);
        Assert.isFalse(installer.isInstalled, channel);
        Assert.areEqual(0, readdirSync(directory.resolve("staging")).length, channel);
      }
      Assert.areEqual("Reading the latest Claude Code version failed with HTTP status 404. Nothing was installed.",
        Resources.formatReleaseChannelFailed("Claude Code", 404));
      Assert.areEqual("Claude Code 2.1.212 lists no build for this computer with its size and SHA-256. Nothing was installed.",
        Resources.formatClaudeBuildMissing("2.1.212"));
    });
  }

  @TestMethod
  public saysWhyItsSetupFailedOrLeftNoClaudeCodeToFind(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      const cases = [
        new ChannelFailure("/fails", Resources.formatClaudeSetupFailed("2.1.212", 3), ClaudeInstallerTests.script("process.exit(3);")),
        new ChannelFailure("/vanishes", Resources.claudeNotFoundAfterSetup, ClaudeInstallerTests.script(""))
      ];

      for (const { channel, program, message } of cases) {
        ClaudeInstallerTests.publish(server, channel, "2.1.212", "linux-x64", "claude", program);
        const installer = ClaudeInstallerTests.installer(server.url(channel), directory);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, channel);
        Assert.isFalse(installer.isInstalled, channel);
        Assert.areEqual(0, readdirSync(directory.resolve("staging")).length, channel);
      }
      Assert.areEqual("Setting up Claude Code 2.1.212 was stopped before it finished.", Resources.formatClaudeSetupFailed("2.1.212", null));
      Assert.areEqual("Setting up Claude Code 2.1.212 failed with exit code 3.", Resources.formatClaudeSetupFailed("2.1.212", 3));
    });
  }

  @TestMethod
  public switchesThroughTheInstalledClaudeCodeWhenItsSetupLeavesAnotherVersionRunningBothSetupsWithNoTimeLimit(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      ClaudeInstallerTests.publish(server, "/c", "2.1.212", "linux-x64", "claude", ClaudeInstallerTests.program(directory, "2.1.212", "2.1.211 (Claude Code)", true));
      const runner = new TimedCommandRunner();
      const installer = ClaudeInstallerTests.installer(server.url("/c"), directory, "linux-x64", undefined, undefined, runner);

      Assert.areEqual(process.execPath, await installer.install(() => undefined, new AbortController().signal));
      Assert.areEqual("null,60000,null,60000", runner.timeouts.map(String).join(","));
      Assert.areEqual("2.1.212 2.1.212", ClaudeInstallerTests.versions(await installer.readVersions(true)));
      Assert.areEqual(0, readdirSync(directory.resolve("staging")).length);
    });
  }

  @TestMethod
  public saysWhichVersionIsStillInstalledWhenItsSetupAndTheInstalledClaudeCodeLeaveAnotherOne(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      const cases = [
        new ChannelFailure("/keeps", Resources.formatClaudeSetupKept("2.1.212", "2.1.211"), ClaudeInstallerTests.program(directory, "2.1.212", "2.1.211 (Claude Code)")),
        new ChannelFailure("/unreadable", Resources.formatClaudeSetupKept("2.1.212", null), ClaudeInstallerTests.program(directory, "2.1.212", ""))
      ];

      for (const { channel, program, message } of cases) {
        ClaudeInstallerTests.publish(server, channel, "2.1.212", "linux-x64", "claude", program);
        const installer = ClaudeInstallerTests.installer(server.url(channel), directory);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, channel);
        Assert.areEqual(0, readdirSync(directory.resolve("staging")).length, channel);
      }
      Assert.areEqual("Claude Code 2.1.212 was set up, but Claude Code 2.1.211 is still the one installed.", Resources.formatClaudeSetupKept("2.1.212", "2.1.211"));
      Assert.areEqual("Claude Code 2.1.212 was set up, but TeamRun can't read which version is installed now.", Resources.formatClaudeSetupKept("2.1.212", null));
    });
  }

  @TestMethod
  public stopsOnACancelUntilItsSetupStartsAndThenLetsTheSetupFinishWithItsOwnOutcome(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      ClaudeInstallerTests.publish(server, "/c", "2.1.212", "linux-x64", "claude", ClaudeInstallerTests.program(directory, "2.1.212"));
      const before = new AbortController();
      before.abort();
      const during = new AbortController();
      const cancelled = ClaudeInstallerTests.installer(server.url("/c"), directory);

      Assert.areEqual(Resources.formatInstallCancelled("Claude Code"), (await Assert.throwsAsync(() => cancelled.install(() => undefined, before.signal), InstallCancelledException)).message);
      Assert.areEqual(Resources.formatInstallCancelled("Claude Code"),
        (await Assert.throwsAsync(() => cancelled.install(() => during.abort(), during.signal), Error)).message);
      Assert.isFalse(cancelled.isInstalled);
      Assert.areEqual(0, readdirSync(directory.resolve("staging")).length);
      const setup = new AbortController();
      const commits: string[] = [];
      const finishing = ClaudeInstallerTests.installer(server.url("/c"), directory, "linux-x64", path => {
        commits.push("setup");
        setup.abort();
        return new ProcessCommand(process.execPath, [path]);
      });

      Assert.areEqual(process.execPath, await finishing.install(() => undefined, setup.signal, () => commits.push("commit")));
      Assert.isTrue(finishing.isInstalled);
      Assert.areEqual("commit,setup", commits.join(","));
      ClaudeInstallerTests.publish(server, "/failing", "2.1.213", "linux-x64", "claude", ClaudeInstallerTests.script("process.exit(5);"));
      const failing = new AbortController();
      const failed = ClaudeInstallerTests.installer(server.url("/failing"), directory, "linux-x64", path => {
        failing.abort();
        return new ProcessCommand(process.execPath, [path]);
      });
      Assert.areEqual(Resources.formatClaudeSetupFailed("2.1.213", 5), (await Assert.throwsAsync(() => failed.install(() => undefined, failing.signal), InstallFailedException)).message);
      Assert.areEqual("The Claude Code install was cancelled. Nothing was installed.", Resources.formatInstallCancelled("Claude Code"));
    });
  }

  @TestMethod
  public saysWhyAComputerWithNoBuildCantInstallAndReadsNoVersionForIt(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      const installer = ClaudeInstallerTests.installer(server.url("/c"), directory, null);

      Assert.areEqual(Resources.claudeNoBuild, installer.unavailable);
      Assert.isNull(installer.missingTool);
      Assert.areEqual(Resources.claudeNoBuild, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), InstallFailedException)).message);
      Assert.areEqual("null null", ClaudeInstallerTests.versions(await installer.readVersions(true)));
      Assert.areEqual(0, server.requests.length);
    });
  }

  @TestMethod
  public readsNoLatestVersionWhenTheChannelCantBeRead(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      server.serve("/down/latest", Buffer.from("busy"), 503);
      ClaudeInstallerTests.installed(directory, "2.1.211");

      Assert.areEqual("2.1.211 null", ClaudeInstallerTests.versions(await ClaudeInstallerTests.installer(server.url("/down"), directory).readVersions(true)));
      Assert.areEqual("2.1.211 null", ClaudeInstallerTests.versions(await ClaudeInstallerTests.installer("http://localhost:1/c", directory).readVersions(true)));
      Assert.areEqual("/down/latest", ClaudeInstallerTests.paths(server));
    });
  }

  @TestMethod
  public offersTheLatestVersionToANativeClaudeCodeThatCantTellItsVersionAsASetupAQuitEndedMayLeaveIt(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      ClaudeInstallerTests.publish(server, "/c", "2.1.212", "linux-x64", "claude", ClaudeInstallerTests.program(directory, "2.1.212"));
      ClaudeInstallerTests.installed(directory, "2.1.211");
      writeFileSync(directory.resolve("bin", "claude.cjs"), "process.exit(1);\n");

      const versions = await ClaudeInstallerTests.installer(server.url("/c"), directory).readVersions(true);

      Assert.areEqual("null 2.1.212", ClaudeInstallerTests.versions(versions));
      Assert.areEqual("2.1.212", versions.update);
    });
  }

  @TestMethod
  public replacesAClaudeCodeAQuitLeftHalfWrittenThroughItsSetupsForceAsTheSetupKeepsAVersionsFileAlreadyOnDisk(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      const installed = JSON.stringify(directory.resolve("bin", "claude.cjs"));
      ClaudeInstallerTests.publish(server, "/c", "2.1.212", "linux-x64", "claude", ClaudeInstallerTests.script(`if (process.argv[2] !== "install") process.exit(7);
if (process.argv[4] === "--force") require("node:fs").writeFileSync(${installed}, ${JSON.stringify("console.log(\"2.1.212 (Claude Code)\");")});`));
      ClaudeInstallerTests.installed(directory, "2.1.212");
      writeFileSync(directory.resolve("bin", "claude.cjs"), "console.log(\"error: \\\"/versions/2.1.212\\\" is truncated\"); process.exit(1);");
      const installer = ClaudeInstallerTests.installer(server.url("/c"), directory);

      Assert.areEqual("null 2.1.212", ClaudeInstallerTests.versions(await installer.readVersions(true)));
      Assert.areEqual(process.execPath, await installer.install(() => undefined, new AbortController().signal));
      Assert.areEqual("2.1.212 2.1.212", ClaudeInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public offersNoUpdateForAClaudeCodeThatIsntANativeInstallAndReadsNoChannelForIt(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      ClaudeInstallerTests.publish(server, "/c", "2.1.212", "linux-x64", "claude", ClaudeInstallerTests.program(directory, "2.1.212"));
      ClaudeInstallerTests.installed(directory, "2.1.211");

      for (const source of [ExecutableSource.Path, ExecutableSource.GlobalNpm, ExecutableSource.Override]) {
        const installer = ClaudeInstallerTests.installer(server.url("/c"), directory, "linux-x64", undefined, source);
        Assert.isTrue(installer.isInstalled, source);
        Assert.areEqual(process.execPath, installer.foundPath, source);
        Assert.areEqual("2.1.211 null", ClaudeInstallerTests.versions(await installer.readVersions(true)), source);
      }
      Assert.isNull(ClaudeInstallerTests.installer(server.url("/c"), directory).foundPath);
      Assert.areEqual(0, server.requests.length);
      Assert.areEqual("2.1.211 2.1.212", ClaudeInstallerTests.versions(await ClaudeInstallerTests.installer(server.url("/c"), directory).readVersions(true)));
    });
  }

  @TestMethod
  public readsNoChannelWhenTheLatestIsntChecked(): Promise<void> {
    return ClaudeInstallerTests.withChannel(async (server, directory) => {
      ClaudeInstallerTests.publish(server, "/c", "2.1.212", "linux-x64", "claude", ClaudeInstallerTests.program(directory, "2.1.212"));
      ClaudeInstallerTests.installed(directory, "2.1.211");
      const installer = ClaudeInstallerTests.installer(server.url("/c"), directory);

      Assert.areEqual("2.1.211 null", ClaudeInstallerTests.versions(await installer.readVersions(false)));
      Assert.areEqual(0, server.requests.length);
      Assert.areEqual("2.1.211 2.1.212", ClaudeInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public runsADownloadedBuildByItsPathWithNoArguments(): void {
    const command = ClaudeInstaller.programOf("/s/claude");

    Assert.areEqual("/s/claude", command.executable);
    Assert.areEqual(0, command.arguments.length);
  }

  @TestMethod
  public namesTheBuildForEachSupportedComputerWithMuslLinuxApart(): void {
    const cases = [
      new BuildTarget("darwin", "arm64", false, "darwin-arm64"), new BuildTarget("darwin", "x64", true, "darwin-x64"), new BuildTarget("linux", "x64", false, "linux-x64"),
      new BuildTarget("linux", "arm64", true, "linux-arm64-musl"), new BuildTarget("linux", "x64", true, "linux-x64-musl"), new BuildTarget("win32", "x64", true, "win32-x64"),
      new BuildTarget("win32", "arm64", false, "win32-arm64"), new BuildTarget("win32", "ia32", false, null), new BuildTarget("freebsd", "x64", false, null)
    ];

    for (const { platform, architecture, isMusl, target } of cases)
      Assert.areEqual(target, ClaudeInstaller.targetOf(platform, architecture, isMusl), `${platform} ${architecture} ${isMusl}`);
  }

  private static async withChannel(test: (server: LocalHttpServer, directory: TemporaryDirectory) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = await LocalHttpServer.start();
    await test(server, directory);
  }

  private static publish(server: LocalHttpServer, channel: string, version: string, target: string, name: string, program: Buffer): void {
    const checksum = createHash("sha256").update(program).digest("hex");
    server.serve(`${channel}/latest`, Buffer.from(`${version}\n`))
      .serve(`${channel}/${version}/manifest.json`, Buffer.from(JSON.stringify({ version, platforms: { [target]: { checksum, size: program.length } } })))
      .serve(`${channel}/${version}/${target}/${name}`, program);
  }

  private static program(directory: TemporaryDirectory, version: string, output: string = `${version} (Claude Code)`, switches: boolean = false): Buffer {
    const bin = JSON.stringify(directory.resolve("bin"));
    const switching = switches ? `require("node:fs").writeFileSync(__filename, ${JSON.stringify(`console.log(${JSON.stringify(`${version} (Claude Code)`)});`)});` : "";
    const installed = `if (process.argv[2] === "install") { ${switching} process.exit(0); }
console.log(${JSON.stringify(output)});`;
    return ClaudeInstallerTests.script(`if (process.argv[2] !== "install" || process.argv[3] !== ${JSON.stringify(version)}) process.exit(7);
require("node:fs").mkdirSync(${bin}, { recursive: true });
require("node:fs").writeFileSync(require("node:path").join(${bin}, "claude.cjs"), ${JSON.stringify(installed)});`);
  }

  private static script(text: string): Buffer {
    return Buffer.from(`${text}\n`);
  }

  private static installer(channel: string, directory: TemporaryDirectory, target: string | null = "linux-x64",
    program: (path: string) => ProcessCommand = path => new ProcessCommand(process.execPath, [path]), source: ExecutableSource = ExecutableSource.LocalBin,
    runner: CommandRunner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)))): ClaudeInstaller {
    const installed = directory.resolve("bin", "claude.cjs");
    const locate = (): LocatedExecutable | null => existsSync(installed) ? new LocatedExecutable(process.execPath, source, [installed]) : null;
    return new ClaudeInstaller(locate, new ExecutableVersionReader(runner, 60_000), process.env, channel, join(directory.path, "staging"), target, runner, program,
      60_000);
  }

  private static installed(directory: TemporaryDirectory, version: string): void {
    mkdirSync(directory.resolve("bin"), { recursive: true });
    writeFileSync(directory.resolve("bin", "claude.cjs"), `console.log(${JSON.stringify(`${version} (Claude Code)`)});\n`);
  }

  private static paths(server: LocalHttpServer): string {
    return server.requests.map(t => t.split(" ")[0]).join(",");
  }

  private static versions(versions: ProviderKindVersions): string {
    return `${versions.installed} ${versions.latest}`;
  }
}

class ServedManifest {
  public readonly channel: string;
  public readonly body: Buffer;

  public constructor(channel: string, body: Buffer) {
    this.channel = channel;
    this.body = body;
  }
}

class ChannelFailure {
  public readonly channel: string;
  public readonly message: string;
  public readonly program: Buffer;

  public constructor(channel: string, message: string, program: Buffer = Buffer.alloc(0)) {
    this.channel = channel;
    this.message = message;
    this.program = program;
  }
}

class BuildTarget {
  public readonly platform: string;
  public readonly architecture: string;
  public readonly isMusl: boolean;
  public readonly target: string | null;

  public constructor(platform: string, architecture: string, isMusl: boolean, target: string | null) {
    this.platform = platform;
    this.architecture = architecture;
    this.isMusl = isMusl;
    this.target = target;
  }
}
