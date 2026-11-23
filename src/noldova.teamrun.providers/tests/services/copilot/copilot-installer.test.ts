/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ProviderKindVersions } from "@noldova/teamrun.core";
import {
  CommandRunner,
  CopilotInstaller,
  ExecutableLocator,
  ExecutableSource,
  ExecutableVersionReader,
  InstallCancelledException, InstallFailedException, InstallHeldException,
  InstallRename,
  LocatedExecutable,
  NodeProcessStarter,
  ProcessCommand,
  ProcessTerminator,
  Resources
} from "@noldova/teamrun.providers";

import { FakeTar } from "../../fixtures/fake-tar.fixture.js";
import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { RecordedDelayTimer } from "../../fixtures/recorded-delay-timer.fixture.js";
import { RecordingCommandRunner } from "../../fixtures/recording-command-runner.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class CopilotInstallerTests {
  private static readonly SLEEP: string = "setTimeout(() => {}, 60000)";
  private static readonly TARGETS: Readonly<Record<string, string>> = { linux: "linux-x64", darwin: "darwin-arm64", win32: "win32-x64" };

  @TestMethod
  public installsTheLatestBuildWhereCopilotsInstallerDoesOnceItReportsItsVersion(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      const archive = CopilotInstallerTests.publish(server, "/c", "1.0.103", "linux");
      const installer = CopilotInstallerTests.installer(server.url("/c"), directory);
      const progress: number[][] = [];
      Assert.isNull(installer.unavailable);
      Assert.isNull(installer.missingTool);
      Assert.isFalse(installer.isInstalled);
      Assert.isNull(installer.foundPath);
      Assert.areEqual("null null", CopilotInstallerTests.versions(await installer.readVersions(true)));

      const path = await installer.install((received, total) => progress.push([received, total]), new AbortController().signal);

      const bin = directory.resolve("home", ".local", "bin");
      Assert.areEqual(process.execPath, path);
      Assert.isTrue(installer.isInstalled);
      Assert.areEqual("1.0.103 1.0.103", CopilotInstallerTests.versions(await installer.readVersions(true)));
      Assert.areEqual(JSON.stringify([archive.length, archive.length]), JSON.stringify(progress.at(-1)));
      Assert.areEqual("copilot", readdirSync(bin).join(","));
      if (process.platform !== "win32")
        Assert.isTrue((statSync(join(bin, "copilot")).mode & 0o111) !== 0);
      Assert.areEqual("/c,/releases/1.0.103/copilot-linux-x64.tar.gz,/c", CopilotInstallerTests.paths(server));
      Assert.areEqual("/releases/1.0.103/copilot-linux-x64.tar.gz identity", server.requests[1]);
    });
  }

  @TestMethod
  public removesOnlyTeamRunsOwnLeftStagingFoldersFromTheSharedCommandFolder(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "linux");
      const bin = directory.resolve("home", ".local", "bin");
      mkdirSync(join(bin, ".staging-other", "kept"), { recursive: true });
      mkdirSync(join(bin, ".teamrun-staging-left"), { recursive: true });

      await CopilotInstallerTests.installer(server.url("/c"), directory).install(() => undefined, new AbortController().signal);

      Assert.areEqual(".staging-other,copilot", readdirSync(bin).sort().join(","));
      Assert.isTrue(existsSync(join(bin, ".staging-other", "kept")));
    });
  }

  @TestMethod
  public updatesByReplacingTheCommandWhereCopilotsInstallerPutIt(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/old", "1.0.102", "darwin");
      CopilotInstallerTests.publish(server, "/new", "1.0.103", "darwin");
      await CopilotInstallerTests.installer(server.url("/old"), directory, "darwin").install(() => undefined, new AbortController().signal);
      const runner = new RecordingCommandRunner();
      const installer = CopilotInstallerTests.installer(server.url("/new"), directory, "darwin", undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, runner);
      Assert.areEqual("1.0.102 1.0.103", CopilotInstallerTests.versions(await installer.readVersions(true)), runner.runs.join("\n"));

      await installer.install(() => undefined, new AbortController().signal);

      Assert.areEqual("copilot", readdirSync(directory.resolve("home", ".local", "bin")).join(","));
      Assert.areEqual("1.0.103 1.0.103", CopilotInstallerTests.versions(await installer.readVersions(true)), runner.runs.join("\n"));
      Assert.isTrue(server.requests.some(t => t.startsWith("/releases/1.0.103/copilot-darwin-arm64.tar.gz ")));
    });
  }

  @TestMethod
  public async recordsEachVersionRunWithNodeTheTempFolderAndUserFoldersAsPlaceholders(): Promise<void> {
    using directory = new TemporaryDirectory();
    const script = directory.resolve("print.js");
    const printed = [homedir(), process.execPath, "C:/Users/someone/x", "/home/someone/x"].join("|");
    writeFileSync(script, `process.stdout.write(process.argv[1]); process.stderr.write(${JSON.stringify(printed)}); process.exitCode = 3;`);
    const runner = new RecordingCommandRunner();

    const result = await runner.run(new ProcessCommand(process.execPath, [script]), process.env, 60_000);
    await Assert.throwsAsync(() => runner.run(new ProcessCommand(directory.resolve("missing"), []), process.env, 60_000), Error);

    const [ran, threw] = runner.runs;
    const leaked = [tmpdir(), homedir(), process.execPath].flatMap(t => [t, realpathSync.native(t)]).flatMap(t => [t, t.replaceAll("\\", "/"), JSON.stringify(t).slice(1, -1)])
      .filter(t => runner.runs.some(u => u.includes(t)));
    Assert.areEqual(3, result.exitCode);
    Assert.areEqual(2, runner.runs.length);
    Assert.areEqual("", leaked.join(), runner.runs.join("\n"));
    Assert.isTrue(ran!.startsWith("<node> <temp>"), ran);
    Assert.isTrue(ran!.includes(": exit 3, signal null, timed out false, stdout \"<temp>"), ran);
    Assert.isTrue(ran!.endsWith(", stderr \"<home>|<node>|C:/Users/<user>/x|/home/<user>/x\""), ran);
    Assert.isTrue(threw!.startsWith("<temp>") && threw!.includes(": threw Error:"), threw);
  }

  @TestMethod
  public installsEachVersionInItsOwnFolderInTeamRunsFolderOnWindowsAndKeepsTheEarlierOne(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/old", "1.0.102", "win32");
      CopilotInstallerTests.publish(server, "/new", "1.0.103", "win32");
      await CopilotInstallerTests.installer(server.url("/old"), directory, "win32").install(() => undefined, new AbortController().signal);
      const installer = CopilotInstallerTests.installer(server.url("/new"), directory, "win32");
      Assert.areEqual("1.0.102 1.0.103", CopilotInstallerTests.versions(await installer.readVersions(true)));

      await installer.install(() => undefined, new AbortController().signal);

      const installs = directory.resolve("data", "providers", "copilot");
      Assert.areEqual("1.0.102,1.0.103", readdirSync(installs).sort().join(","));
      Assert.isTrue(existsSync(join(installs, "1.0.103", "copilot.exe")));
      Assert.areEqual("1.0.103 1.0.103", CopilotInstallerTests.versions(await installer.readVersions(true)));
      Assert.isTrue(server.requests.some(t => t.startsWith("/releases/1.0.103/copilot-win32-x64.zip ")));
      await installer.install(() => undefined, new AbortController().signal);
      Assert.areEqual("1.0.102,1.0.103", readdirSync(installs).sort().join(","));
    });
  }

  @TestMethod
  public keepsTheInstalledVersionInPlaceWhileWindowsRefusesToMoveTheNewBuildItJustRanAndReplacesItOnceTheMovePasses(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "win32");
      const folder = CopilotInstallerTests.installedVersion(directory);
      const whileRefused: string[] = [];
      const swaps: string[] = [];
      const settle = new InstallRename("win32", (from, to) => {
        if (whileRefused.length < 2) {
          whileRefused.push(readFileSync(join(folder, "copilot.exe"), "utf8"));
          throw Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
        }
        renameSync(from, to);
      }, new RecordedDelayTimer());
      const installer = CopilotInstallerTests.installer(server.url("/c"), directory, "win32", undefined, undefined, undefined, undefined, undefined, (from, to) => {
        swaps.push(`${from.endsWith("ready") ? "ready" : from === folder ? "installed" : "previous"} -> ${to === folder ? "installed" : "aside"}`);
        renameSync(from, to);
      }, settle.moveAsync.bind(settle));

      await installer.install(() => undefined, new AbortController().signal);

      Assert.areEqual("held,held", whileRefused.join(","));
      Assert.areEqual("installed -> aside,ready -> installed", swaps.join(","));
      Assert.areNotEqual("held", readFileSync(join(folder, "copilot.exe"), "utf8"));
      Assert.areEqual("1.0.103", readdirSync(directory.resolve("data", "providers", "copilot")).join(","));
    });
  }

  @TestMethod
  public keepsTheInstalledVersionAndSaysWhyWhenWindowsRefusesToMoveTheNewBuildUntilTheLimit(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "win32");
      const folder = CopilotInstallerTests.installedVersion(directory);
      const refused = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      const swaps: string[] = [];
      const settle = new InstallRename("win32", () => {
        throw refused;
      }, new RecordedDelayTimer());
      const installer = CopilotInstallerTests.installer(server.url("/c"), directory, "win32", undefined, undefined, undefined, undefined, undefined, (from, to) => {
        swaps.push(`${from} -> ${to}`);
        renameSync(from, to);
      }, settle.moveAsync.bind(settle));

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), InstallFailedException);

      Assert.areEqual(Resources.formatCopilotNotReady("1.0.103", folder, "EPERM", true), failure.message);
      Assert.isInstanceOf(failure.cause, InstallHeldException);
      Assert.areEqual(refused, failure.cause.cause);
      Assert.areEqual(0, swaps.length);
      Assert.areEqual("held", readFileSync(join(folder, "copilot.exe"), "utf8"));
      Assert.areEqual("1.0.103", readdirSync(directory.resolve("data", "providers", "copilot")).join(","));
    });
  }

  @TestMethod
  public keepsAnInstalledVersionWholeAndSaysWhyWhenItCantBeMovedAsideOnWindows(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "win32");
      const folder = CopilotInstallerTests.installedVersion(directory);
      const refused = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
      const installer = CopilotInstallerTests.installer(server.url("/c"), directory, "win32", undefined, undefined, undefined, undefined, undefined, (from, to) => {
        if (from === folder)
          throw refused;
        renameSync(from, to);
      });

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(refused, failure.cause);
      Assert.areEqual("held", readFileSync(join(folder, "copilot.exe"), "utf8"));
      Assert.areEqual("1.0.103", readdirSync(directory.resolve("data", "providers", "copilot")).join(","));
      Assert.areEqual(`TeamRun couldn't move GitHub Copilot 1.0.103 in ${folder} aside to replace it (EBUSY), so it was kept as it was. `
        + "Close what runs GitHub Copilot from it and install again.", failure.message);
    });
  }

  @TestMethod
  public movesAnInstalledVersionBackAndKeepsItWholeWhenTheNewOneCantBeRenamedInOnWindows(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "win32");
      const folder = CopilotInstallerTests.installedVersion(directory);
      const refused = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      const installer = CopilotInstallerTests.installer(server.url("/c"), directory, "win32", undefined, undefined, undefined, undefined, undefined, (from, to) => {
        if (to === folder && basename(from) === "ready")
          throw refused;
        renameSync(from, to);
      });

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(refused, failure.cause);
      Assert.areEqual("held", readFileSync(join(folder, "copilot.exe"), "utf8"));
      Assert.areEqual("1.0.103", readdirSync(directory.resolve("data", "providers", "copilot")).join(","));
      Assert.areEqual(`TeamRun couldn't put the new GitHub Copilot 1.0.103 download in place of the one in ${folder} (EPERM), so the one there was kept as it was. `
        + "Close what runs GitHub Copilot from it and install again.", failure.message);
    });
  }

  @TestMethod
  public keepsAnInstalledVersionInTheStagingFolderAndNamesItWhenNeitherRenameWorksUntilAnInstallSucceedsOnWindows(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "win32");
      const installs = directory.resolve("data", "providers", "copilot");
      const folder = CopilotInstallerTests.installedVersion(directory);
      const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
      const denied = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      const refusing = (from: string, to: string): void => {
        if (to === folder)
          throw basename(from) === "previous" ? denied : busy;
        renameSync(from, to);
      };

      const failure = await Assert.throwsAsync(() => CopilotInstallerTests.installer(server.url("/c"), directory, "win32", undefined, undefined, undefined, undefined, undefined,
        refusing).install(() => undefined, new AbortController().signal), Error);
      const [staging] = readdirSync(installs);
      Assert.isDefined(staging);
      const aside = join(installs, staging, "previous");
      const again = await Assert.throwsAsync(() => CopilotInstallerTests.installer(server.url("/c"), directory, "win32", undefined, undefined, undefined, undefined, undefined,
        refusing).install(() => undefined, new AbortController().signal), Error);
      const afterAgain = readdirSync(installs).join(",");
      const keptAgain = readFileSync(join(aside, "copilot.exe"), "utf8");
      await CopilotInstallerTests.installer(server.url("/c"), directory, "win32").install(() => undefined, new AbortController().signal);

      Assert.isTrue(staging.startsWith(".teamrun-staging-"), staging);
      Assert.areEqual(Resources.formatCopilotReleaseSetAside("1.0.103", folder, aside, "EBUSY", "EPERM"), failure.message);
      Assert.areEqual(denied, failure.cause);
      Assert.areEqual(busy, again);
      Assert.areEqual(staging, afterAgain);
      Assert.areEqual("held", keptAgain);
      Assert.areEqual("1.0.103", readdirSync(installs).join(","));
      Assert.areEqual("TeamRun couldn't put the new GitHub Copilot 1.0.103 download in place of the one in /c/1.0.103 (EBUSY), nor move that one back (EPERM). "
        + "It is kept in /c/s/previous until GitHub Copilot installs: move it back to /c/1.0.103, or install GitHub Copilot again.",
      Resources.formatCopilotReleaseSetAside("1.0.103", "/c/1.0.103", "/c/s/previous", "EBUSY", "EPERM"));
    });
  }

  @TestMethod
  public movesAnInstalledVersionBackOnceAMomentsHoldOnItEndsWhenTheNewOneCantTakeItsPlaceOnWindows(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "win32");
      const installs = directory.resolve("data", "providers", "copilot");
      const folder = CopilotInstallerTests.installedVersion(directory);
      const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
      let holds = 1;
      const timer = new RecordedDelayTimer();
      const settle = new InstallRename("win32", (from, to) => {
        if (to === folder && holds-- > 0)
          throw busy;
        renameSync(from, to);
      }, timer);

      const failure = await Assert.throwsAsync(() => CopilotInstallerTests.installer(server.url("/c"), directory, "win32", undefined, undefined, undefined, undefined, undefined,
        (from, to) => {
          if (to === folder)
            throw busy;
          renameSync(from, to);
        }, settle.moveAsync.bind(settle)).install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(Resources.formatCopilotReleaseNotReplaced("1.0.103", folder, "EBUSY"), failure.message);
      Assert.areEqual(busy, failure.cause);
      Assert.areEqual("held", readFileSync(join(folder, "copilot.exe"), "utf8"));
      Assert.areEqual("1.0.103", readdirSync(installs).join(","));
      Assert.areEqual(1, timer.delays.length);
    });
  }

  @TestMethod
  public changesNothingWhenItsFolderCantBeWrittenAndNamesTheFolder(): Promise<void> {
    if (process.platform === "win32" || process.getuid?.() === 0)
      return Promise.resolve();
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "linux");
      const local = directory.resolve("home", ".local");
      mkdirSync(local, { recursive: true });
      chmodSync(local, 0o555);
      const installer = CopilotInstallerTests.installer(server.url("/c"), directory);
      let failure: Error;
      try {
        failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);
      }
      finally {
        chmodSync(local, 0o755);
      }

      const bin = join(local, "bin");
      Assert.areEqual("EACCES", (failure.cause as NodeJS.ErrnoException).code);
      Assert.areEqual(String.empty, readdirSync(local).join(","));
      Assert.areEqual(String.empty, CopilotInstallerTests.paths(server));
      Assert.areEqual(`TeamRun can't write to ${bin}, where GitHub Copilot goes. Nothing was installed.`, failure.message);
    });
  }

  @TestMethod
  public installsNothingWhenNoReleaseCanBeReadOrItsBuildFailsItsCheck(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      const archive = CopilotInstallerTests.build("1.0.103", "linux");
      const digest = `sha256:${createHash("sha256").update(archive).digest("hex")}`;
      const name = "copilot-linux-x64.tar.gz";
      const release = (assets: unknown, tag: unknown = "v1.0.103"): Buffer => Buffer.from(JSON.stringify({ tag_name: tag, assets }));
      const asset = (fields: Record<string, unknown>): unknown => ({ name, digest, browser_download_url: server.url("/archive"), ...fields });
      server.serve("/archive", archive).serve("/wrong", Buffer.from("other")).cut("/cut-archive", archive);
      const bodies: readonly [string, Buffer][] = [["/not-json", Buffer.from("{")], ["/null", Buffer.from("null")], ["/no-tag", release([], 103)],
        ["/other-tag", release([], "1.0.103")], ["/bad-version", release([], "vlatest")], ["/no-assets", release({})],
        ["/no-build", release([null, asset({ name: "SHA256SUMS.txt" })])], ["/no-digest", release([asset({ digest: 7 })])],
        ["/bare-digest", release([asset({ digest: digest.slice(7) })])], ["/short-digest", release([asset({ digest: "sha256:abc" })])],
        ["/no-url", release([asset({ browser_download_url: null })])], ["/mismatch", release([asset({ browser_download_url: server.url("/wrong") })])],
        ["/missing", release([asset({ browser_download_url: server.url("/gone") })])], ["/oversize", release([asset({ size: archive.length - 1 })])],
        ["/cut", release([asset({ browser_download_url: server.url("/cut-archive") })])]];
      for (const [path, body] of bodies)
        server.serve(path, body);
      const cases: readonly [string, string][] = [
        ["/gone", Resources.formatReleaseChannelFailed("GitHub Copilot", 404)],
        ...["/not-json", "/null", "/no-tag", "/other-tag", "/bad-version"].map((t): [string, string] => [t, Resources.formatReleaseChannelUnreadable("GitHub Copilot")]),
        ...["/no-assets", "/no-build", "/no-digest", "/bare-digest", "/short-digest", "/no-url"].map((t): [string, string] => [t, Resources.formatCopilotArchiveMissing("1.0.103")]),
        ["/mismatch", Resources.formatDownloadMismatch("GitHub Copilot")],
        ["/missing", Resources.formatDownloadFailed("GitHub Copilot", 404)],
        ["/oversize", Resources.formatDownloadMismatch("GitHub Copilot")],
        ["http://localhost:1/c", Resources.formatReleasesUnreachable("GitHub Copilot")],
        ["/cut", Resources.formatReleasesUnreachable("GitHub Copilot")]
      ];

      for (const [channel, message] of cases) {
        const installer = CopilotInstallerTests.installer(channel.startsWith("http") ? channel : server.url(channel), directory);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, channel);
        Assert.isFalse(installer.isInstalled, channel);
        Assert.areEqual(String.empty, readdirSync(directory.resolve("home", ".local", "bin")).join(","), channel);
      }
      Assert.areEqual("GitHub Copilot 1.0.103 lists no build for this computer with its SHA-256. Nothing was installed.", Resources.formatCopilotArchiveMissing("1.0.103"));
    });
  }

  @TestMethod
  public saysWhyTarFailedDidntFinishOrLeftNoCopilotThatReportsTheVersion(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      const sleepingTar = new LocatedExecutable(process.execPath, ExecutableSource.Path, ["-e", CopilotInstallerTests.SLEEP, "--"]);
      const cases: readonly [string, Buffer, LocatedExecutable | null, number, string][] = [
        ["/broken", Buffer.from("not an archive"), null, 60_000, Resources.formatCopilotUnpackFailed(9)],
        ["/hangs", CopilotInstallerTests.build("1.0.103", "linux"), sleepingTar, 200, Resources.formatCopilotUnpackFailed(null)],
        ["/empty", FakeTar.archive({ "README.md": String.empty }), null, 60_000, Resources.formatCopilotIncomplete("1.0.103")],
        ["/other-version", CopilotInstallerTests.build("1.0.103", "linux", "GitHub Copilot CLI 1.0.90"), null, 60_000, Resources.formatCopilotIncomplete("1.0.103")]
      ];

      for (const [channel, archive, extractor, timeout, message] of cases) {
        CopilotInstallerTests.publish(server, channel, "1.0.103", "linux", archive);
        const root = directory.resolve(channel.slice(1));
        const installer = CopilotInstallerTests.installer(server.url(channel), root, "linux", extractor ?? undefined, timeout);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, channel);
        Assert.isFalse(installer.isInstalled, channel);
        Assert.areEqual(String.empty, readdirSync(join(root, "home", ".local", "bin")).join(","), channel);
      }
      Assert.areEqual("Unpacking the GitHub Copilot download was stopped. Nothing was installed.", Resources.formatCopilotUnpackFailed(null));
      Assert.areEqual("Unpacking the GitHub Copilot download failed with exit code 9. Nothing was installed.", Resources.formatCopilotUnpackFailed(9));
      Assert.areEqual("The GitHub Copilot 1.0.103 download has no copilot that reports 1.0.103. Nothing was installed.", Resources.formatCopilotIncomplete("1.0.103"));
    });
  }

  @TestMethod
  public saysWhenTheCopilotItFindsAfterwardsIsAnotherOneOrNone(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "win32");
      const other = directory.resolve("other.cjs");
      writeFileSync(other, "console.log(\"GitHub Copilot CLI 1.0.90\");");
      const silent = directory.resolve("silent.cjs");
      writeFileSync(silent, String.empty);
      const installs = directory.resolve("data", "providers", "copilot");
      const cases: readonly [string, (() => LocatedExecutable | null), string][] = [
        ["other", () => new LocatedExecutable(process.execPath, ExecutableSource.Path, [other]), Resources.formatCopilotShadowed("1.0.103", installs, process.execPath, "1.0.90")],
        ["silent", () => new LocatedExecutable(process.execPath, ExecutableSource.Path, [silent]), Resources.formatCopilotShadowed("1.0.103", installs, process.execPath, null)],
        ["none", () => null, Resources.formatCopilotNotFoundAfterInstall(installs)]
      ];

      for (const [name, locate, message] of cases) {
        const installer = CopilotInstallerTests.installer(server.url("/c"), directory, "win32", undefined, undefined, undefined, locate);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, name);
      }
      Assert.areEqual(`GitHub Copilot 1.0.103 was installed in ${installs}, but TeamRun runs /usr/bin/copilot, GitHub Copilot 1.0.90, which it finds first. Remove that one, then restart TeamRun.`,
        Resources.formatCopilotShadowed("1.0.103", installs, "/usr/bin/copilot", "1.0.90"));
      Assert.areEqual(`GitHub Copilot 1.0.103 was installed in ${installs}, but TeamRun runs /usr/bin/copilot which it finds first. Remove that one, then restart TeamRun.`,
        Resources.formatCopilotShadowed("1.0.103", installs, "/usr/bin/copilot", null));
      Assert.areEqual(`GitHub Copilot was installed in ${installs}, but TeamRun can't find it there. Restart TeamRun, then install it again.`,
        Resources.formatCopilotNotFoundAfterInstall(installs));
    });
  }

  @TestMethod
  public stopsUntilTheBuildIsCheckedAndThenFinishesWithItsOwnOutcome(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "win32");
      const early = new AbortController();
      early.abort();
      const during = new AbortController();
      const unpacking = new AbortController();
      const checking = new AbortController();
      const started = directory.resolve("tar-started");
      const sleepingTar = new LocatedExecutable(process.execPath, ExecutableSource.Path,
        ["-e", `require("node:fs").writeFileSync(${JSON.stringify(started)}, "");${CopilotInstallerTests.SLEEP}`, "--"]);
      const cases: readonly [string, AbortController, CopilotInstaller, () => void][] = [
        ["before", early, CopilotInstallerTests.installer(server.url("/c"), directory.resolve("before"), "win32"), () => undefined],
        ["during the download", during, CopilotInstallerTests.installer(server.url("/c"), directory.resolve("during"), "win32"), () => during.abort()],
        ["while unpacking", unpacking, CopilotInstallerTests.installer(server.url("/c"), directory.resolve("unpacking"), "win32", sleepingTar), () => {
          void Wait.until(() => existsSync(started), "The installer did not start.").then(() => unpacking.abort());
        }],
        ["while checking", checking, CopilotInstallerTests.installer(server.url("/c"), directory.resolve("checking"), "win32", undefined, undefined, path => {
          checking.abort();
          return new ProcessCommand(process.execPath, [path]);
        }), () => undefined]
      ];

      for (const [step, controller, installer, progress] of cases) {
        Assert.areEqual(Resources.formatInstallCancelled("GitHub Copilot"), (await Assert.throwsAsync(() => installer.install(progress, controller.signal), InstallCancelledException)).message, step);
        Assert.isFalse(installer.isInstalled, step);
      }
      const switching = new AbortController();
      const steps: string[] = [];
      const finishing = CopilotInstallerTests.installer(server.url("/c"), directory.resolve("finishing"), "win32", undefined, undefined, path => {
        steps.push("version");
        return new ProcessCommand(process.execPath, [path]);
      });

      Assert.areEqual(process.execPath, await finishing.install(() => undefined, switching.signal, () => {
        steps.push("commit");
        switching.abort();
      }));
      Assert.isTrue(finishing.isInstalled);
      Assert.areEqual("version,commit", steps.join(","));
      const failing = new AbortController();
      const other = directory.resolve("other.cjs");
      writeFileSync(other, "console.log(\"GitHub Copilot CLI 1.0.90\");");
      const failed = CopilotInstallerTests.installer(server.url("/c"), directory.resolve("failing"), "win32", undefined, undefined, undefined,
        () => new LocatedExecutable(process.execPath, ExecutableSource.Path, [other]));
      Assert.areEqual(Resources.formatCopilotShadowed("1.0.103", directory.resolve("failing", "data", "providers", "copilot"), process.execPath, "1.0.90"),
        (await Assert.throwsAsync(() => failed.install(() => undefined, failing.signal, () => failing.abort()), Error)).message);
    });
  }

  @TestMethod
  public saysWhyAComputerWithNoBuildOrNoTarCantInstallAndReadsNoVersionWithoutABuild(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      const noBuild = CopilotInstallerTests.installer(server.url("/c"), directory, "linux", undefined, undefined, undefined, undefined, null);
      const noTar = CopilotInstallerTests.installer(server.url("/c"), directory, "linux", null);

      Assert.areEqual(Resources.copilotNoBuild, noBuild.unavailable);
      Assert.areEqual(Resources.copilotNoExtractor, noTar.unavailable);
      Assert.isNull(noBuild.missingTool);
      Assert.areEqual("tar", noTar.missingTool);
      Assert.areEqual(Resources.copilotNoBuild, (await Assert.throwsAsync(() => noBuild.install(() => undefined, new AbortController().signal), InstallFailedException)).message);
      Assert.areEqual(Resources.copilotNoExtractor, (await Assert.throwsAsync(() => noTar.install(() => undefined, new AbortController().signal), InstallFailedException)).message);
      CopilotInstallerTests.installedHere(directory, "linux", "GitHub Copilot CLI 1.0.102");
      Assert.areEqual("1.0.102 null", CopilotInstallerTests.versions(await noBuild.readVersions(true)));
      Assert.areEqual(0, server.requests.length);
    });
  }

  @TestMethod
  public offersUpdatesOnlyToTheCopilotItInstallsAndReadsNoReleaseForAnother(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "linux");
      CopilotInstallerTests.publish(server, "/w", "1.0.103", "win32");
      const script = directory.resolve("copilot.cjs");
      writeFileSync(script, "console.log(\"GitHub Copilot CLI 1.0.102\");");
      const found = (source: ExecutableSource) => (): LocatedExecutable => new LocatedExecutable(process.execPath, source, [script]);
      const cases: readonly [string, ExecutableSource, string][] = [
        ["linux", ExecutableSource.Path, "1.0.102 null"], ["linux", ExecutableSource.GlobalNpm, "1.0.102 null"], ["linux", ExecutableSource.Override, "1.0.102 null"],
        ["win32", ExecutableSource.LocalBin, "1.0.102 null"], ["win32", ExecutableSource.Path, "1.0.102 null"]
      ];

      for (const [platform, source, versions] of cases) {
        const installer = CopilotInstallerTests.installer(server.url("/c"), directory, platform, undefined, undefined, undefined, found(source));
        Assert.isTrue(installer.isInstalled, `${platform} ${source}`);
        Assert.areEqual(process.execPath, installer.foundPath, `${platform} ${source}`);
        Assert.areEqual(versions, CopilotInstallerTests.versions(await installer.readVersions(true)), `${platform} ${source}`);
      }
      Assert.isNull(CopilotInstallerTests.installer(server.url("/c"), directory, "linux", undefined, undefined, undefined, found(ExecutableSource.LocalBin)).foundPath);
      Assert.isNull(CopilotInstallerTests.installer(server.url("/w"), directory, "win32", undefined, undefined, undefined, found(ExecutableSource.Managed)).foundPath);
      Assert.areEqual(0, server.requests.length);
      Assert.areEqual("1.0.102 1.0.103", CopilotInstallerTests.versions(await CopilotInstallerTests.installer(server.url("/c"), directory, "linux", undefined,
        undefined, undefined, found(ExecutableSource.LocalBin)).readVersions(true)));
      Assert.areEqual("1.0.102 1.0.103", CopilotInstallerTests.versions(await CopilotInstallerTests.installer(server.url("/w"), directory, "win32", undefined,
        undefined, undefined, found(ExecutableSource.Managed)).readVersions(true)));
    });
  }

  @TestMethod
  public readsNoLatestVersionWhenNoReleaseCanBeReadAndTheLatestForItsOwnCopilotThatCantTellItsVersion(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      server.serve("/down", Buffer.from("busy"), 503);
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "linux");
      CopilotInstallerTests.installedHere(directory, "linux", "GitHub Copilot CLI 1.0.102");

      Assert.areEqual("1.0.102 null", CopilotInstallerTests.versions(await CopilotInstallerTests.installer(server.url("/down"), directory).readVersions(true)));
      Assert.areEqual("1.0.102 null", CopilotInstallerTests.versions(await CopilotInstallerTests.installer("http://localhost:1/c", directory).readVersions(true)));
      writeFileSync(directory.resolve("home", ".local", "bin", "copilot"), "process.exit(1);\n");
      const versions = await CopilotInstallerTests.installer(server.url("/c"), directory).readVersions(true);
      Assert.areEqual("null 1.0.103", CopilotInstallerTests.versions(versions));
      Assert.areEqual("1.0.103", versions.update);
    });
  }

  @TestMethod
  public readsNoReleaseWhenTheLatestIsntChecked(): Promise<void> {
    return CopilotInstallerTests.withReleases(async (server, directory) => {
      CopilotInstallerTests.publish(server, "/c", "1.0.103", "linux");
      CopilotInstallerTests.installedHere(directory, "linux", "GitHub Copilot CLI 1.0.102");
      const installer = CopilotInstallerTests.installer(server.url("/c"), directory);

      Assert.areEqual("1.0.102 null", CopilotInstallerTests.versions(await installer.readVersions(false)));
      Assert.areEqual(0, server.requests.length);
      Assert.areEqual("1.0.102 1.0.103", CopilotInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public runsABuildsProgramByItsPathWithNoArguments(): void {
    const command = CopilotInstaller.programOf("/s/copilot");

    Assert.areEqual("/s/copilot", command.executable);
    Assert.areEqual(0, command.arguments.length);
  }

  @TestMethod
  public namesTheBuildForEachSupportedComputerWithMuslLinuxApart(): void {
    const cases: readonly [string, string, boolean, string | null][] = [
      ["darwin", "arm64", false, "darwin-arm64"], ["darwin", "x64", true, "darwin-x64"], ["linux", "x64", false, "linux-x64"], ["linux", "arm64", false, "linux-arm64"],
      ["linux", "x64", true, "linuxmusl-x64"], ["linux", "arm64", true, "linuxmusl-arm64"], ["win32", "x64", false, "win32-x64"], ["win32", "arm64", false, "win32-arm64"],
      ["win32", "ia32", false, null], ["freebsd", "x64", false, null]
    ];

    for (const [platform, architecture, isMusl, target] of cases)
      Assert.areEqual(target, CopilotInstaller.targetOf(platform, architecture, isMusl), `${platform} ${architecture} ${isMusl}`);
  }

  private static async withReleases(test: (server: LocalHttpServer, directory: TemporaryDirectory) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = await LocalHttpServer.start();
    await test(server, directory);
  }

  private static publish(server: LocalHttpServer, path: string, version: string, platform: string,
    archive: Buffer = CopilotInstallerTests.build(version, platform)): Buffer {
    const name = `copilot-${CopilotInstallerTests.TARGETS[platform]}${platform === "win32" ? ".zip" : ".tar.gz"}`;
    const digest = `sha256:${createHash("sha256").update(archive).digest("hex")}`;
    const other = { name: "SHA256SUMS.txt", digest: `sha256:${"0".repeat(64)}`, browser_download_url: server.url("/sums") };
    server.serve(path, Buffer.from(JSON.stringify({ tag_name: `v${version}`,
      assets: [other, { name, digest, size: archive.length, browser_download_url: server.url(`/releases/${version}/${name}`) }] })))
      .serve(`/releases/${version}/${name}`, archive, 200, false);
    return archive;
  }

  private static build(version: string, platform: string, output: string = `GitHub Copilot CLI ${version}`): Buffer {
    return FakeTar.archive({ [platform === "win32" ? "copilot.exe" : "copilot"]: `console.log(${JSON.stringify(output)});\n` });
  }

  private static installer(channel: string, directory: TemporaryDirectory | string, platform: string = "linux",
    extractor: LocatedExecutable | null | undefined = undefined, unpackTimeout: number = 60_000,
    program: (path: string) => ProcessCommand = path => new ProcessCommand(process.execPath, [path]),
    locate: (() => LocatedExecutable | null) | undefined = undefined, target: string | null = CopilotInstallerTests.TARGETS[platform]!,
    rename: (from: string, to: string) => void = renameSync, settle: (from: string, to: string) => Promise<void> = async (from, to) => rename(from, to),
    runner: CommandRunner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)))): CopilotInstaller {
    const root = typeof directory === "string" ? directory : directory.path;
    mkdirSync(root, { recursive: true });
    const installs = CopilotInstallerTests.installs(root, platform);
    const locator = new ExecutableLocator(platform, "x64", [], join(root, "home"), join(root, "local"));
    const found = (): LocatedExecutable | null => {
      const located = locator.locateCopilot(null, installs);
      return Object.isNull(located) ? null : new LocatedExecutable(process.execPath, located.source, [located.path]);
    };
    return new CopilotInstaller(locate ?? found, new ExecutableVersionReader(runner, 60_000), process.env, channel, installs, target, platform,
      Object.isUndefined(extractor) ? FakeTar.create(root) : extractor, runner, program, rename, settle, unpackTimeout, 60_000);
  }

  private static installs(root: string, platform: string): string {
    return platform === "win32" ? join(root, "data", "providers", "copilot") : join(root, "home", ".local", "bin");
  }

  private static installedVersion(directory: TemporaryDirectory): string {
    const folder = directory.resolve("data", "providers", "copilot", "1.0.103");
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "copilot.exe"), "held");
    return folder;
  }

  private static installedHere(directory: TemporaryDirectory, platform: string, output: string): void {
    const installs = CopilotInstallerTests.installs(directory.path, platform);
    mkdirSync(installs, { recursive: true });
    writeFileSync(join(installs, "copilot"), `console.log(${JSON.stringify(output)});\n`);
  }

  private static paths(server: LocalHttpServer): string {
    return server.requests.map(t => t.split(" ")[0]).join(",");
  }

  private static versions(versions: ProviderKindVersions): string {
    return `${versions.installed} ${versions.latest}`;
  }
}
