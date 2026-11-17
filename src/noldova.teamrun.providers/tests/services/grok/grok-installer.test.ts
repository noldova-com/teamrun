/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { gzipSync } from "node:zlib";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ProviderKindVersions } from "@noldova/teamrun.core";
import {
  CommandRunner,
  ExecutableLocator,
  ExecutableSource,
  ExecutableVersionReader,
  GrokInstaller,
  GrokRelease,
  InstallCancelledException, InstallFailedException, InstallHeldException,
  InstallRename,
  LocatedExecutable,
  NodeProcessStarter,
  ProcessCommand,
  ProcessTerminator,
  ReleaseFile,
  Resources
} from "@noldova/teamrun.providers";

import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { RecordedDelayTimer } from "../../fixtures/recorded-delay-timer.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class GrokInstallerTests {
  @TestMethod
  public installsThePinnedBuildWhereGrokInstallerPutsItAndLinksItsCommands(): Promise<void> {
    return GrokInstallerTests.withServer(async (server, directory) => {
      const release = GrokInstallerTests.publish(server, "/grok.gz", "linux");
      const installer = GrokInstallerTests.installer(directory, "linux", release);
      const progress: number[][] = [];
      Assert.isNull(installer.unavailable);
      Assert.isFalse(installer.isInstalled);
      Assert.isNull(installer.foundPath);
      Assert.areEqual("null null", GrokInstallerTests.versions(await installer.readVersions()));

      const path = await installer.install((received, total) => progress.push([received, total]), new AbortController().signal);

      const home = directory.resolve("home", ".grok");
      Assert.areEqual(process.execPath, path);
      Assert.isTrue(installer.isInstalled);
      const versions = await installer.readVersions();
      Assert.areEqual("1.0.70 1.0.70", GrokInstallerTests.versions(versions));
      Assert.isNull(versions.update);
      Assert.areEqual(JSON.stringify([release.archive.bytes, release.archive.bytes]), JSON.stringify(progress.at(-1)));
      Assert.areEqual("grok-linux-x86_64", readdirSync(join(home, "downloads")).join(","));
      Assert.areEqual("agent,grok", readdirSync(join(home, "bin")).sort().join(","));
      if (process.platform !== "win32")
        Assert.areEqual("../downloads/grok-linux-x86_64", readlinkSync(join(home, "bin", "grok")));
      Assert.areEqual("/grok.gz identity", server.requests.join(","));
    });
  }

  @TestMethod
  public copiesTheCommandsOnWindowsMovingWhatIsThereAside(): Promise<void> {
    return GrokInstallerTests.withServer(async (server, directory) => {
      const release = GrokInstallerTests.publish(server, "/grok.gz", "win32");
      const installer = GrokInstallerTests.installer(directory, "win32", release);
      const bin = directory.resolve("home", ".grok", "bin");
      const program = directory.resolve("home", ".grok", "downloads", "grok-windows-x86_64.exe");

      await installer.install(() => undefined, new AbortController().signal);

      Assert.areEqual("agent.exe,grok.exe", readdirSync(bin).sort().join(","));
      Assert.areEqual(readFileSync(program).toString(), readFileSync(join(bin, "grok.exe")).toString());
      Assert.areEqual(readFileSync(program).toString(), readFileSync(join(bin, "agent.exe")).toString());
      GrokInstallerTests.inTheWay(join(bin, "agent.exe.old"));
      await installer.install(() => undefined, new AbortController().signal);
      Assert.areEqual("agent.exe,agent.exe.old,grok.exe", readdirSync(bin).sort().join(","));
      GrokInstallerTests.inTheWay(join(bin, "grok.exe"));
      await installer.install(() => undefined, new AbortController().signal);
      Assert.areEqual(readFileSync(program).toString(), readFileSync(join(bin, "grok.exe")).toString());
      Assert.areEqual("left", readdirSync(join(bin, "grok.exe.old")).join(","));
    });
  }

  @TestMethod
  public async keepsEveryOldGrokCommandWhileWindowsRefusesToMoveANewCommandsCopyAndPutsAllInOnceTheMovePassesOrChangesNothingAtTheLimit(): Promise<void> {
    for (const refusals of [2, Number.POSITIVE_INFINITY])
      await GrokInstallerTests.withServer(async (server, directory) => {
        const old = GrokInstallerTests.publish(server, "/old.gz", "win32", "grok 1.0.60", "1.0.60");
        await GrokInstallerTests.installer(directory, "win32", old).install(() => undefined, new AbortController().signal);
        const home = directory.resolve("home", ".grok");
        const agent = join(home, "bin", "agent.exe");
        const refused = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
        const whileRefused: string[] = [];
        const settle = new InstallRename("win32", (from, to) => {
          if (to.endsWith("agent.exe.ready") && whileRefused.length < refusals) {
            whileRefused.push(GrokInstallerTests.reports(home, ["downloads/grok-windows-x86_64.exe", "bin/grok.exe", "bin/agent.exe"]));
            throw refused;
          }
          renameSync(from, to);
        }, new RecordedDelayTimer());
        const installer = GrokInstallerTests.installer(directory, "win32", GrokInstallerTests.publish(server, "/grok.gz", "win32"), undefined, undefined, renameSync,
          settle.moveAsync.bind(settle));

        const failure = await installer.install(() => undefined, new AbortController().signal).then(() => null, (error: unknown) => error);

        Assert.isTrue(whileRefused.every(t => t === "1.0.60,1.0.60,1.0.60"), whileRefused.join("|"));
        Assert.areEqual("agent.exe,grok.exe|grok-windows-x86_64.exe", GrokInstallerTests.listing(home), String(refusals));
        if (refusals === 2) {
          Assert.isNull(failure);
          Assert.areEqual(2, whileRefused.length);
          Assert.areEqual("1.0.70,1.0.70,1.0.70", GrokInstallerTests.reports(home, ["downloads/grok-windows-x86_64.exe", "bin/grok.exe", "bin/agent.exe"]));
        }
        else {
          Assert.isInstanceOf(failure, Error);
          Assert.areEqual(Resources.formatGrokNotReady(agent, "EPERM", true), failure.message);
          Assert.isInstanceOf(failure.cause, InstallHeldException);
          Assert.areEqual(refused, failure.cause.cause);
          Assert.areEqual(14, whileRefused.length);
          Assert.areEqual("1.0.60,1.0.60,1.0.60", GrokInstallerTests.reports(home, ["downloads/grok-windows-x86_64.exe", "bin/grok.exe", "bin/agent.exe"]));
        }
      });
  }

  @TestMethod
  public keepsTheOldGrokWholeWhenACommandCantBeMovedAsideOnWindows(): Promise<void> {
    return GrokInstallerTests.withOldGrok("win32", async (installer, home, refuse) => {
      const agent = join(home, "bin", "agent.exe");
      const refused = refuse((from, to) => from === agent || to === agent, "EBUSY");

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(refused, failure.cause);
      Assert.areEqual("1.0.60,1.0.60,1.0.60", GrokInstallerTests.reports(home, ["downloads/grok-windows-x86_64.exe", "bin/grok.exe", "bin/agent.exe"]));
      Assert.areEqual("agent.exe,grok.exe|grok-windows-x86_64.exe", GrokInstallerTests.listing(home));
      Assert.areEqual(`TeamRun couldn't move ${agent} aside to update Grok (EBUSY), so Grok was kept as it was. Close what runs Grok and install again.`, failure.message);
    });
  }

  @TestMethod
  public movesTheOldProgramAndEveryCommandBackWhenANewCommandCantBeRenamedInOnWindows(): Promise<void> {
    return GrokInstallerTests.withOldGrok("win32", async (installer, home, refuse) => {
      const agent = join(home, "bin", "agent.exe");
      const refused = refuse((from, to) => to === agent && !from.startsWith(`${agent}.old`), "EPERM");

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(refused, failure.cause);
      Assert.areEqual("1.0.60,1.0.60,1.0.60", GrokInstallerTests.reports(home, ["downloads/grok-windows-x86_64.exe", "bin/grok.exe", "bin/agent.exe"]));
      Assert.areEqual("agent.exe,grok.exe|grok-windows-x86_64.exe", GrokInstallerTests.listing(home));
      Assert.areEqual(`TeamRun couldn't put the new Grok at ${agent} (EPERM), so Grok was kept as it was. Close what runs Grok and install again.`, failure.message);
    });
  }

  @TestMethod
  public movesTheOldProgramBackWhenGrokRefusesItsNewLink(): Promise<void> {
    return GrokInstallerTests.withOldGrok("linux", async (installer, home, refuse) => {
      const grok = join(home, "bin", "grok");
      const refused = refuse((from, to) => to === grok && !from.startsWith(`${grok}.old`), "EACCES");

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(refused, failure.cause);
      Assert.areEqual("1.0.60,1.0.60,1.0.60", GrokInstallerTests.reports(home, ["downloads/grok-linux-x86_64", "bin/grok", "bin/agent"]));
      Assert.areEqual("agent,grok|grok-linux-x86_64", GrokInstallerTests.listing(home));
      Assert.areEqual(Resources.formatGrokNotReplaced(grok, "EACCES"), failure.message);
    });
  }

  @TestMethod
  public leavesNoNewCommandWhenAFirstInstallCantPutOneInPlace(): Promise<void> {
    return GrokInstallerTests.withServer(async (server, directory) => {
      const release = GrokInstallerTests.publish(server, "/grok.gz", "win32");
      const home = directory.resolve("home", ".grok");
      const agent = join(home, "bin", "agent.exe");
      const refused = Object.assign(new Error("EPERM: refused"), { code: "EPERM" });
      const installer = GrokInstallerTests.installer(directory, "win32", release, undefined, undefined, (from, to) => {
        if (to === agent)
          throw refused;
        renameSync(from, to);
      });

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(refused, failure.cause);
      Assert.isFalse(installer.isInstalled);
      Assert.isNull(installer.foundPath);
      Assert.areEqual("|", GrokInstallerTests.listing(home));
    });
  }

  @TestMethod
  public keepsTheStepsReasonAndEachMoveBacksWhenGrokCantBePutBack(): Promise<void> {
    return GrokInstallerTests.withOldGrok("win32", async (installer, home, refuse) => {
      const [grok, agent] = [join(home, "bin", "grok.exe"), join(home, "bin", "agent.exe")];
      const refused = refuse((from, to) => from === agent || (to === grok && from.startsWith(`${grok}.old`)), "EBUSY");

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);
      const errors = (failure.cause as AggregateError).errors as Error[];

      Assert.areEqual(`TeamRun couldn't finish updating Grok in ${home}, nor put back all of the Grok it had replaced. Install Grok again.`, failure.message);
      Assert.areEqual([Resources.formatGrokKept(agent, "EBUSY"), refused.message].join("|"), errors.map(t => t.message).join("|"));
      Assert.areEqual(refused, errors[0]!.cause);
      Assert.areEqual("1.0.60,1.0.60", GrokInstallerTests.reports(home, ["downloads/grok-windows-x86_64.exe", "bin/agent.exe"]));
    });
  }

  @TestMethod
  public changesNothingWhenItsFolderCantBeWrittenAndNamesTheFolder(): Promise<void> {
    if (process.platform === "win32" || process.getuid?.() === 0)
      return Promise.resolve();
    return GrokInstallerTests.withServer(async (server, directory) => {
      const release = GrokInstallerTests.publish(server, "/grok.gz", "linux");
      const home = directory.resolve("home", ".grok");
      mkdirSync(home, { recursive: true });
      chmodSync(home, 0o555);
      const installer = GrokInstallerTests.installer(directory, "linux", release);
      let failure: Error;
      try {
        failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);
      }
      finally {
        chmodSync(home, 0o755);
      }

      Assert.areEqual("EACCES", (failure.cause as NodeJS.ErrnoException).code);
      Assert.areEqual(String.empty, readdirSync(home).join(","));
      Assert.areEqual(String.empty, server.requests.join(","));
      Assert.areEqual(`TeamRun can't write to ${home}, where Grok goes. Nothing was installed.`, failure.message);
    });
  }

  @TestMethod
  public installsNothingWhenTheDownloadFailsItsCheckOrDoesntUnpackToTheVersion(): Promise<void> {
    return GrokInstallerTests.withServer(async (server, directory) => {
      const build = GrokInstallerTests.build("grok 1.0.70");
      const archiveBytes = gzipSync(build).length;
      const pinned = (url: string, archive: Buffer, programBytes: number = build.length): GrokRelease =>
        new GrokRelease("1.0.70", new ReleaseFile(server.url(url), GrokInstallerTests.sha256(archive), archive.length), "grok-linux-x86_64", programBytes);
      server.serve("/good.gz", gzipSync(build)).serve("/plain", build).serve("/other.gz", gzipSync(GrokInstallerTests.build("grok 1.0.69")));
      const cases: readonly [string, GrokRelease, string][] = [
        ["missing", pinned("/gone.gz", gzipSync(build)), Resources.formatDownloadFailed("Grok", 404)],
        ["mismatch", new GrokRelease("1.0.70", new ReleaseFile(server.url("/good.gz"), "0".repeat(64), archiveBytes), "grok-linux-x86_64", build.length),
          Resources.formatDownloadMismatch("Grok")],
        ["not gzip", pinned("/plain", build), Resources.formatGrokIncomplete("1.0.70")],
        ["larger", pinned("/good.gz", gzipSync(build), build.length - 1), Resources.formatGrokIncomplete("1.0.70")],
        ["smaller", pinned("/good.gz", gzipSync(build), build.length + 1), Resources.formatGrokIncomplete("1.0.70")],
        ["other version", pinned("/other.gz", gzipSync(GrokInstallerTests.build("grok 1.0.69")), GrokInstallerTests.build("grok 1.0.69").length),
          Resources.formatGrokIncomplete("1.0.70")]
      ];

      for (const [name, release, message] of cases) {
        const root = directory.resolve(name.replaceAll(" ", "-"));
        const installer = GrokInstallerTests.installer(root, "linux", release);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, name);
        Assert.isFalse(installer.isInstalled, name);
        Assert.areEqual(String.empty, readdirSync(join(root, "home", ".grok", "downloads")).join(","), name);
        Assert.isFalse(existsSync(join(root, "home", ".grok", "bin")), name);
      }
      Assert.areEqual("The Grok 1.0.70 download doesn't unpack to a grok that reports 1.0.70. Nothing was installed.", Resources.formatGrokIncomplete("1.0.70"));
    });
  }

  @TestMethod
  public saysWhenTheGrokItFindsAfterwardsIsAnotherOneOrNone(): Promise<void> {
    return GrokInstallerTests.withServer(async (server, directory) => {
      const release = GrokInstallerTests.publish(server, "/grok.gz", "linux");
      const other = directory.resolve("other.cjs");
      writeFileSync(other, "console.log(\"grok 1.0.80\");");
      const silent = directory.resolve("silent.cjs");
      writeFileSync(silent, String.empty);
      const bin = directory.resolve("home", ".grok", "bin");
      const cases: readonly [string, () => LocatedExecutable | null, string][] = [
        ["other", () => new LocatedExecutable(process.execPath, ExecutableSource.Path, [other]), Resources.formatGrokShadowed("1.0.70", bin, process.execPath, "1.0.80")],
        ["silent", () => new LocatedExecutable(process.execPath, ExecutableSource.Path, [silent]), Resources.formatGrokShadowed("1.0.70", bin, process.execPath, null)],
        ["none", () => null, Resources.formatGrokNotFoundAfterInstall(bin)]
      ];

      for (const [name, locate, message] of cases) {
        const installer = GrokInstallerTests.installer(directory, "linux", release, locate);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, name);
      }
      Assert.areEqual(`Grok 1.0.70 was installed in ${bin}, but TeamRun runs /usr/bin/grok, Grok 1.0.80, which it finds first. Remove that one, then restart TeamRun.`,
        Resources.formatGrokShadowed("1.0.70", bin, "/usr/bin/grok", "1.0.80"));
      Assert.areEqual(`Grok 1.0.70 was installed in ${bin}, but TeamRun runs /usr/bin/grok which it finds first. Remove that one, then restart TeamRun.`,
        Resources.formatGrokShadowed("1.0.70", bin, "/usr/bin/grok", null));
      Assert.areEqual(`Grok was installed in ${bin}, but TeamRun can't find it there. Restart TeamRun, then install it again.`, Resources.formatGrokNotFoundAfterInstall(bin));
    });
  }

  @TestMethod
  public stopsUntilTheBuildIsCheckedAndThenFinishesWithItsOwnOutcome(): Promise<void> {
    return GrokInstallerTests.withServer(async (server, directory) => {
      const release = GrokInstallerTests.publish(server, "/grok.gz", "linux");
      const early = new AbortController();
      early.abort();
      const during = new AbortController();
      const downloaded = new AbortController();
      const checking = new AbortController();
      const cases: readonly [string, AbortController, GrokInstaller, (received: number, total: number) => void][] = [
        ["before", early, GrokInstallerTests.installer(directory.resolve("before"), "linux", release), () => undefined],
        ["during", during, GrokInstallerTests.installer(directory.resolve("during"), "linux", release), () => during.abort()],
        ["downloaded", downloaded, GrokInstallerTests.installer(directory.resolve("downloaded"), "linux", release), (received, total) => {
          if (received === total)
            downloaded.abort();
        }],
        ["checking", checking, GrokInstallerTests.installer(directory.resolve("checking"), "linux", release, undefined, path => {
          checking.abort();
          return new ProcessCommand(process.execPath, [path]);
        }), () => undefined]
      ];

      for (const [step, controller, installer, progress] of cases) {
        Assert.areEqual(Resources.formatInstallCancelled("Grok"), (await Assert.throwsAsync(() => installer.install(progress, controller.signal), InstallCancelledException)).message, step);
        Assert.isFalse(installer.isInstalled, step);
        Assert.areEqual("downloads", readdirSync(directory.resolve(step, "home", ".grok")).join(","), step);
        Assert.areEqual(String.empty, readdirSync(directory.resolve(step, "home", ".grok", "downloads")).join(","), step);
      }
      const switching = new AbortController();
      const steps: string[] = [];
      const finishing = GrokInstallerTests.installer(directory.resolve("finishing"), "linux", release, undefined, path => {
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
      writeFileSync(other, "console.log(\"grok 1.0.80\");");
      const failed = GrokInstallerTests.installer(directory.resolve("failing"), "linux", release,
        () => new LocatedExecutable(process.execPath, ExecutableSource.Path, [other]));
      Assert.areEqual(Resources.formatGrokShadowed("1.0.70", directory.resolve("failing", "home", ".grok", "bin"), process.execPath, "1.0.80"),
        (await Assert.throwsAsync(() => failed.install(() => undefined, failing.signal, () => failing.abort()), Error)).message);
    });
  }

  @TestMethod
  public offersThePinnedVersionOnlyToItsOwnGrokAndNeverADowngrade(): Promise<void> {
    return GrokInstallerTests.withServer(async (server, directory) => {
      const release = GrokInstallerTests.publish(server, "/grok.gz", "linux");
      const script = (name: string, text: string): string => {
        const path = directory.resolve(name);
        writeFileSync(path, text);
        return path;
      };
      const older = script("older.cjs", "console.log(\"grok 1.0.62\");");
      const newer = script("newer.cjs", "console.log(\"grok 1.0.80\");");
      const unknown = script("unknown.cjs", "process.exit(1);");
      const found = (source: ExecutableSource, path: string) => (): LocatedExecutable => new LocatedExecutable(process.execPath, source, [path]);
      const cases: readonly [ExecutableSource, string, string, string | null][] = [
        [ExecutableSource.LocalBin, older, "1.0.62 1.0.70", "1.0.70"], [ExecutableSource.LocalBin, newer, "1.0.80 1.0.70", null],
        [ExecutableSource.LocalBin, unknown, "null 1.0.70", "1.0.70"], [ExecutableSource.Path, older, "1.0.62 null", null],
        [ExecutableSource.GlobalNpm, older, "1.0.62 null", null], [ExecutableSource.Override, older, "1.0.62 null", null]
      ];

      for (const [source, path, versions, update] of cases) {
        const installer = GrokInstallerTests.installer(directory, "linux", release, found(source, path));
        const read = await installer.readVersions();
        Assert.areEqual(versions, GrokInstallerTests.versions(read), `${source} ${path}`);
        Assert.areEqual(source === ExecutableSource.LocalBin ? null : process.execPath, installer.foundPath, `${source} ${path}`);
        Assert.areEqual(update, read.update, `${source} ${path}`);
      }
      const noBuild = GrokInstallerTests.installer(directory, "linux", null, found(ExecutableSource.LocalBin, older));
      Assert.areEqual(Resources.grokNoBuild, noBuild.unavailable);
      Assert.isNull(noBuild.missingTool);
      Assert.areEqual("1.0.62 null", GrokInstallerTests.versions(await noBuild.readVersions()));
      Assert.areEqual(Resources.grokNoBuild, (await Assert.throwsAsync(() => noBuild.install(() => undefined, new AbortController().signal), InstallFailedException)).message);
      Assert.areEqual(0, server.requests.length);
    });
  }

  @TestMethod
  public findsThePinnedBuildForEachSupportedComputer(): void {
    const cases: readonly [string, string, string | null][] = [
      ["darwin", "arm64", "grok-macos-aarch64"], ["darwin", "x64", "grok-macos-x86_64"], ["linux", "x64", "grok-linux-x86_64"], ["linux", "arm64", "grok-linux-aarch64"],
      ["win32", "x64", "grok-windows-x86_64.exe"], ["win32", "arm64", "grok-windows-aarch64.exe"], ["win32", "ia32", null], ["freebsd", "x64", null]
    ];

    for (const [platform, architecture, program] of cases)
      Assert.areEqual(program, GrokRelease.find(platform, architecture)?.programName ?? null, `${platform} ${architecture}`);
    const linux = GrokRelease.find("linux", "x64")!;
    Assert.areEqual("1.0.70", linux.version);
    Assert.areEqual("https://x.ai/cli/grok-1.0.70-linux-x86_64.gz", linux.archive.url);
    Assert.areEqual("11d27a30adfb75c4b9b180072ab27412a1916f054ff5497ab70fb9a77d304bcc", linux.archive.sha256);
    Assert.areEqual(76_760_282, linux.archive.bytes);
    Assert.areEqual(195_700_192, linux.programBytes);
    Assert.areEqual("https://x.ai/cli/grok-1.0.70-windows-x86_64.exe.gz", GrokRelease.find("win32", "x64")!.archive.url);
  }

  @TestMethod
  public runsABuildsProgramByItsPathWithNoArguments(): void {
    const command = GrokInstaller.programOf("/s/grok");

    Assert.areEqual("/s/grok", command.executable);
    Assert.areEqual(0, command.arguments.length);
  }

  private static async withServer(test: (server: LocalHttpServer, directory: TemporaryDirectory) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = await LocalHttpServer.start();
    await test(server, directory);
  }

  private static async withOldGrok(platform: string,
    test: (installer: GrokInstaller, home: string, refuse: (when: (from: string, to: string) => boolean, code: string) => Error) => Promise<void>): Promise<void> {
    await GrokInstallerTests.withServer(async (server, directory) => {
      const old = GrokInstallerTests.publish(server, "/old.gz", platform, "grok 1.0.60", "1.0.60");
      await GrokInstallerTests.installer(directory, platform, old).install(() => undefined, new AbortController().signal);
      const release = GrokInstallerTests.publish(server, "/grok.gz", platform);
      let refusing: (from: string, to: string) => boolean = () => false;
      let refusal = new Error();
      const installer = GrokInstallerTests.installer(directory, platform, release, undefined, undefined, (from, to) => {
        if (refusing(from, to))
          throw refusal;
        renameSync(from, to);
      });
      await test(installer, directory.resolve("home", ".grok"), (when, code) => {
        refusing = when;
        refusal = Object.assign(new Error(`${code}: refused`), { code });
        return refusal;
      });
    });
  }

  private static reports(home: string, paths: readonly string[]): string {
    return paths.map(t => execFileSync(process.execPath, [join(home, ...t.split("/"))], { encoding: "utf8" }).trim().replace("grok ", String.empty)).join(",");
  }

  private static listing(home: string): string {
    return ["bin", "downloads"].map(t => readdirSync(join(home, t)).sort().join(",")).join("|");
  }

  private static publish(server: LocalHttpServer, path: string, platform: string, output: string = "grok 1.0.70", version: string = "1.0.70"): GrokRelease {
    const build = GrokInstallerTests.build(output);
    const archive = gzipSync(build);
    server.serve(path, archive, 200, false);
    return new GrokRelease(version, new ReleaseFile(server.url(path), GrokInstallerTests.sha256(archive), archive.length),
      platform === "win32" ? "grok-windows-x86_64.exe" : "grok-linux-x86_64", build.length);
  }

  private static build(output: string): Buffer {
    return Buffer.from(`console.log(${JSON.stringify(output)});\n`);
  }

  private static sha256(value: Buffer): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private static inTheWay(path: string): void {
    rmSync(path, { force: true });
    mkdirSync(path, { recursive: true });
    writeFileSync(join(path, "left"), String.empty);
  }

  private static installer(directory: TemporaryDirectory | string, platform: string, release: GrokRelease | null,
    locate: (() => LocatedExecutable | null) | undefined = undefined,
    program: (path: string) => ProcessCommand = path => new ProcessCommand(process.execPath, [path]),
    rename: (from: string, to: string) => void = renameSync, settle: (from: string, to: string) => Promise<void> = async (from, to) => rename(from, to)): GrokInstaller {
    const root = typeof directory === "string" ? directory : directory.path;
    const runner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));
    const locator = new ExecutableLocator(platform, "x64", [], join(root, "home"));
    const found = (): LocatedExecutable | null => {
      const located = locator.locateGrok(null);
      return Object.isNull(located) ? null : new LocatedExecutable(process.execPath, located.source, [located.path]);
    };
    const downloads = join(locator.grokInstallDirectory(), "downloads");
    const symlink = (target: string, path: string): void => process.platform === "win32"
      ? writeFileSync(path, `require(${JSON.stringify(join(downloads, posix.basename(target)))});\n`)
      : symlinkSync(target, path);
    return new GrokInstaller(locate ?? found, new ExecutableVersionReader(runner, 60_000), process.env, release, locator.grokInstallDirectory(), platform, program, symlink, rename,
      settle);
  }

  private static versions(versions: ProviderKindVersions): string {
    return `${versions.installed} ${versions.latest}`;
  }
}
