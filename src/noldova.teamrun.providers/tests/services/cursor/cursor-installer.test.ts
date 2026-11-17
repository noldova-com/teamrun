/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { chmodSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ProviderKindVersions } from "@noldova/teamrun.core";
import {
  type CommandResult,
  CommandRunner,
  CursorInstaller,
  CursorRelease,
  ExecutableLocator,
  ExecutableSource,
  ExecutableVersionReader,
  InstallFailedException, InstallHeldException,
  InstallRename,
  LocatedExecutable,
  NodeProcessStarter,
  ProcessCommand,
  ProcessTerminator,
  ReleaseFile,
  Resources
} from "@noldova/teamrun.providers";

import { FakeTar } from "../../fixtures/fake-tar.fixture.js";
import { FolderRefusal } from "../../fixtures/folder-refusal.fixture.js";
import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { RecordedDelayTimer } from "../../fixtures/recorded-delay-timer.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { ZipArchive } from "../../fixtures/zip-archive.fixture.js";

@TestClass
export class CursorInstallerTests {
  private static readonly VERSION: string = "2026.10.22-27dcf5f";
  private static readonly PROGRAM: string = "console.log(\"2026.10.22-27dcf5f\");\n";
  private static readonly NODE: string = "node fixture\n";
  private static readonly SLEEP: string = "setTimeout(() => {}, 60000)";

  @TestMethod
  public async installsThePinnedLinuxBuildInItsVersionsFolderOnceItPassesItsChecks(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const installer = CursorInstallerTests.installer(CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive), directory);
    const installs = directory.resolve("data", "providers", "cursor");
    const progress: number[][] = [];
    Assert.isNull(installer.unavailable);
    Assert.isNull(installer.missingTool);
    Assert.isFalse(installer.isInstalled);
    Assert.areEqual("null null", CursorInstallerTests.versions(await installer.readVersions()));
    mkdirSync(join(installs, ".teamrun-staging-left-by-a-stopped-install"), { recursive: true });

    const path = await installer.install((received, total) => progress.push([received, total]), new AbortController().signal);

    const unpacked = join(installs, CursorInstallerTests.VERSION, "dist-package");
    Assert.areEqual(process.execPath, path);
    Assert.isTrue(installer.isInstalled);
    Assert.areEqual(`${CursorInstallerTests.VERSION} ${CursorInstallerTests.VERSION}`, CursorInstallerTests.versions(await installer.readVersions()));
    Assert.areEqual(CursorInstallerTests.VERSION, readdirSync(installs).join(","));
    Assert.areEqual("dist-package", readdirSync(join(installs, CursorInstallerTests.VERSION)).join(","));
    Assert.areEqual("cursor-agent,index.js,node,rg", readdirSync(unpacked).sort().join(","));
    Assert.areEqual(CursorInstallerTests.NODE, readFileSync(join(unpacked, "node"), "utf8"));
    Assert.areEqual(JSON.stringify([archive.length, archive.length]), JSON.stringify(progress.at(-1)));
    Assert.areEqual("/agent-cli-package.tar.gz identity", server.requests.join(","));
    if (process.platform !== "win32")
      Assert.areEqual("755,755", ["cursor-agent", "node"].map(t => (statSync(join(unpacked, t)).mode & 0o777).toString(8)).join(","));
  }

  @TestMethod
  public async installsTheWindowsZipAndRunsItsNodeWithIndexJsAndReplacesAnEarlierCopyOfTheVersion(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = ZipArchive.stored(Object.entries(CursorInstallerTests.windowsPackage()).map(([name, data]) => ({ name, data })));
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.zip", archive);
    const installs = directory.resolve("data", "providers", "cursor");
    mkdirSync(join(installs, CursorInstallerTests.VERSION), { recursive: true });
    writeFileSync(join(installs, CursorInstallerTests.VERSION, "left"), "earlier");
    const installer = CursorInstallerTests.installer(CursorInstallerTests.release(server, "agent-cli-package.zip", archive, "win32"), directory, "win32");

    const path = await installer.install(() => undefined, new AbortController().signal);

    const unpacked = join(installs, CursorInstallerTests.VERSION, "dist-package");
    Assert.areEqual(process.execPath, path);
    Assert.areEqual("dist-package", readdirSync(join(installs, CursorInstallerTests.VERSION)).join(","));
    Assert.areEqual("cursor-agent.cmd,cursor-agent.ps1,index.js,node.exe", readdirSync(unpacked).sort().join(","));
    Assert.areEqual(CursorInstallerTests.VERSION, readdirSync(installs).join(","));
    const located = new ExecutableLocator("win32", "x64", [], directory.resolve("home")).locateCursor(null, installs);
    Assert.areEqual([join(unpacked, "node.exe"), join(unpacked, "index.js"), ExecutableSource.Managed].join(" "),
      [located?.path, ...located?.arguments ?? [], located?.source].join(" "));
  }

  @TestMethod
  public async installsNothingFromADownloadWithAnotherHashOrSizeOrThatIsMissing(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/a.tar.gz", archive);
    const sha256 = createHash("sha256").update(archive).digest("hex");
    const failures: string[] = [];

    for (const file of [new ReleaseFile(server.url("/a.tar.gz"), "0".repeat(64), archive.length), new ReleaseFile(server.url("/a.tar.gz"), sha256, archive.length + 1),
      new ReleaseFile(server.url("/a.tar.gz"), sha256, archive.length - 1), new ReleaseFile(server.url("/missing.tar.gz"), sha256, archive.length)]) {
      const installer = CursorInstallerTests.installer(CursorInstallerTests.releaseOf(file, "a.tar.gz"), directory);
      failures.push((await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message);
    }

    Assert.areEqual([Resources.formatDownloadMismatch("Cursor"), Resources.formatDownloadMismatch("Cursor"), Resources.formatDownloadMismatch("Cursor"),
      Resources.formatDownloadFailed("Cursor", 404)].join("\n"), failures.join("\n"));
    Assert.areEqual(String.empty, readdirSync(directory.resolve("data", "providers", "cursor")).join(","));
  }

  @TestMethod
  public async installsNothingFromAnArchiveWithoutItsLauncherOrItsNodeAndIndexJsOfThePinnedSizesThatReportTheVersion(): Promise<void> {
    using directory = new TemporaryDirectory();
    const failures: string[] = [];
    const without = (name: string): Readonly<Record<string, string>> =>
      Object.fromEntries(Object.entries(CursorInstallerTests.posixPackage()).filter(([t]) => t !== name));
    const cases: [Readonly<Record<string, string>>, number, number][] = [
      [without("dist-package/cursor-agent"), CursorInstallerTests.NODE.length, CursorInstallerTests.PROGRAM.length],
      [without("dist-package/node"), CursorInstallerTests.NODE.length, CursorInstallerTests.PROGRAM.length],
      [without("dist-package/index.js"), CursorInstallerTests.NODE.length, CursorInstallerTests.PROGRAM.length],
      [CursorInstallerTests.posixPackage(), CursorInstallerTests.NODE.length + 1, CursorInstallerTests.PROGRAM.length],
      [CursorInstallerTests.posixPackage(), CursorInstallerTests.NODE.length, CursorInstallerTests.PROGRAM.length - 1],
      [{ ...CursorInstallerTests.posixPackage(), "dist-package/cursor-agent": "console.log(\"2026.10.21-0a1b2c3\");\n" }, CursorInstallerTests.NODE.length,
        CursorInstallerTests.PROGRAM.length]
    ];

    for (const [files, nodeBytes, scriptBytes] of cases) {
      const archive = FakeTar.archive(files);
      await using server = (await LocalHttpServer.start()).serve("/a.tar.gz", archive);
      const file = new ReleaseFile(server.url("/a.tar.gz"), createHash("sha256").update(archive).digest("hex"), archive.length);
      failures.push((await Assert.throwsAsync(() => CursorInstallerTests.installer(CursorInstallerTests.releaseOf(file, "a.tar.gz", "linux", nodeBytes, scriptBytes),
        directory).install(() => undefined, new AbortController().signal), Error)).message);
    }

    Assert.areEqual(Array.from({ length: 6 }, () => Resources.formatCursorIncomplete(CursorInstallerTests.VERSION)).join("\n"), failures.join("\n"));
    Assert.areEqual(String.empty, readdirSync(directory.resolve("data", "providers", "cursor")).join(","));
  }

  @TestMethod
  public async refusesAZipWithAnEntryOutsideItsFolderAndAnArchiveTarCantUnpack(): Promise<void> {
    using directory = new TemporaryDirectory();
    const unsafe = ZipArchive.stored([{ name: "../dist-package/index.js", data: CursorInstallerTests.PROGRAM }]);
    const broken = Buffer.from("not an archive");
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.zip", unsafe).serve("/agent-cli-package.tar.gz", broken);

    const zip = await Assert.throwsAsync(() => CursorInstallerTests.installer(CursorInstallerTests.release(server, "agent-cli-package.zip", unsafe, "win32"),
      directory, "win32").install(() => undefined, new AbortController().signal), Error);
    const tar = await Assert.throwsAsync(() => CursorInstallerTests.installer(CursorInstallerTests.release(server, "agent-cli-package.tar.gz", broken),
      directory).install(() => undefined, new AbortController().signal), Error);
    const slow = await Assert.throwsAsync(() => CursorInstallerTests.installer(CursorInstallerTests.release(server, "agent-cli-package.tar.gz", broken),
      directory, "linux", new LocatedExecutable(process.execPath, ExecutableSource.Path, ["-e", CursorInstallerTests.SLEEP, "--"]), 200)
      .install(() => undefined, new AbortController().signal), Error);

    Assert.areEqual(Resources.cursorArchiveUnsafe, zip.message);
    Assert.areEqual(Resources.formatCursorUnpackFailed(9), tar.message);
    Assert.areEqual(Resources.formatCursorUnpackFailed(null), slow.message);
    Assert.areEqual(String.empty, readdirSync(directory.resolve("data", "providers", "cursor")).join(","));
  }

  @TestMethod
  public async keepsTheInstalledVersionWhenItCantBeMovedAsideOrTheNewOneCantTakeItsPlace(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const release = CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive);
    const folder = directory.resolve("data", "providers", "cursor", CursorInstallerTests.VERSION);
    mkdirSync(join(folder, "dist-package"), { recursive: true });
    writeFileSync(join(folder, "dist-package", "cursor-agent"), "held");
    const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });

    const kept = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, (from, to) => {
      if (from === folder)
        throw busy;
      renameSync(from, to);
    }).install(() => undefined, new AbortController().signal), Error);
    const back = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, (from, to) => {
      if (to === folder && !from.endsWith("previous"))
        throw busy;
      renameSync(from, to);
    }).install(() => undefined, new AbortController().signal), Error);

    Assert.areEqual(Resources.formatCursorReleaseKept(CursorInstallerTests.VERSION, folder, "EBUSY"), kept.message);
    Assert.areEqual(busy, kept.cause);
    Assert.areEqual(Resources.formatCursorReleaseNotReplaced(CursorInstallerTests.VERSION, folder, "EBUSY"), back.message);
    Assert.areEqual("held", readFileSync(join(folder, "dist-package", "cursor-agent"), "utf8"));
    Assert.areEqual(CursorInstallerTests.VERSION, readdirSync(directory.resolve("data", "providers", "cursor")).join(","));
  }

  @TestMethod
  public async keepsTheInstalledVersionInTheStagingFolderAndNamesItWhenTheNewOneCantTakeItsPlaceNorItMoveBack(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const release = CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive);
    const installs = directory.resolve("data", "providers", "cursor");
    const folder = join(installs, CursorInstallerTests.VERSION);
    mkdirSync(join(folder, "dist-package"), { recursive: true });
    writeFileSync(join(folder, "dist-package", "cursor-agent"), "held");
    const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
    const denied = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });

    const failure = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, (from, to) => {
      if (to === folder)
        throw from.endsWith("previous") ? denied : busy;
      renameSync(from, to);
    }).install(() => undefined, new AbortController().signal), Error);

    const [staging] = readdirSync(installs);
    Assert.isDefined(staging);
    const aside = join(installs, staging, "previous");
    Assert.isTrue(staging.startsWith(".teamrun-staging-"), staging);
    Assert.areEqual(Resources.formatCursorReleaseSetAside(CursorInstallerTests.VERSION, folder, aside, "EBUSY", "EPERM"), failure.message);
    Assert.areEqual(denied, failure.cause);
    Assert.areEqual("held", readFileSync(join(aside, "dist-package", "cursor-agent"), "utf8"));
    Assert.areEqual(1, readdirSync(installs).length);
  }

  @TestMethod
  public async movesTheInstalledVersionBackOnceAMomentsHoldOnItEndsWhenTheNewOneCantTakeItsPlace(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const release = CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive);
    const installs = directory.resolve("data", "providers", "cursor");
    const folder = join(installs, CursorInstallerTests.VERSION);
    mkdirSync(join(folder, "dist-package"), { recursive: true });
    writeFileSync(join(folder, "dist-package", "cursor-agent"), "held");
    const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
    let holds = 1;
    const timer = new RecordedDelayTimer();
    const settle = new InstallRename("win32", (from, to) => {
      if (to === folder && holds-- > 0)
        throw busy;
      renameSync(from, to);
    }, timer);

    const failure = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, (from, to) => {
      if (to === folder)
        throw busy;
      renameSync(from, to);
    }, undefined, settle.moveAsync.bind(settle)).install(() => undefined, new AbortController().signal), Error);

    Assert.areEqual(Resources.formatCursorReleaseNotReplaced(CursorInstallerTests.VERSION, folder, "EBUSY"), failure.message);
    Assert.areEqual(busy, failure.cause);
    Assert.areEqual("held", readFileSync(join(folder, "dist-package", "cursor-agent"), "utf8"));
    Assert.areEqual(CursorInstallerTests.VERSION, readdirSync(installs).join(","));
    Assert.areEqual(1, timer.delays.length);
  }

  @TestMethod
  public async keepsTheSetAsideCopyThroughAnotherFailedInstallAndRemovesItOnceAnInstallSucceeds(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const release = CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive);
    const installs = directory.resolve("data", "providers", "cursor");
    const folder = join(installs, CursorInstallerTests.VERSION);
    mkdirSync(join(folder, "dist-package"), { recursive: true });
    writeFileSync(join(folder, "dist-package", "cursor-agent"), "held");
    const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
    const denied = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
    const refusing = (from: string, to: string): void => {
      if (to === folder)
        throw from.endsWith("previous") ? denied : busy;
      renameSync(from, to);
    };
    await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, refusing)
      .install(() => undefined, new AbortController().signal), Error);
    const [staging] = readdirSync(installs);
    Assert.isDefined(staging);
    const aside = join(installs, staging, "previous");

    const again = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, refusing)
      .install(() => undefined, new AbortController().signal), Error);
    const afterAgain = readdirSync(installs).join(",");
    const keptAgain = readFileSync(join(aside, "dist-package", "cursor-agent"), "utf8");
    const installed = await CursorInstallerTests.installer(release, directory).install(() => undefined, new AbortController().signal);

    Assert.areEqual(Resources.formatCursorNotPlaced(CursorInstallerTests.VERSION, folder, "EBUSY"), again.message);
    Assert.areEqual(`TeamRun couldn't move the new Cursor ${CursorInstallerTests.VERSION} download into ${folder} (EBUSY). Nothing was installed. Install again.`,
      again.message);
    Assert.areEqual(busy, again.cause);
    Assert.areEqual(staging, afterAgain);
    Assert.areEqual("held", keptAgain);
    Assert.areEqual(process.execPath, installed);
    Assert.areEqual(CursorInstallerTests.VERSION, readdirSync(installs).join(","));
  }

  @TestMethod
  public async keepsTheInstalledVersionInPlaceWhileWindowsRefusesToMoveTheNewBuildItJustRanAndReplacesItOnceTheMovePasses(): Promise<void> {
    for (const refusals of [2, Number.POSITIVE_INFINITY]) {
      using directory = new TemporaryDirectory();
      const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
      await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
      const release = CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive);
      const folder = directory.resolve("data", "providers", "cursor", CursorInstallerTests.VERSION);
      const launcher = join(folder, "dist-package", "cursor-agent");
      mkdirSync(dirname(launcher), { recursive: true });
      writeFileSync(launcher, "held");
      const refused = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      const whileRefused: string[] = [];
      const swaps: string[] = [];
      const settle = new InstallRename("win32", (from, to) => {
        if (whileRefused.length < refusals) {
          whileRefused.push(readFileSync(launcher, "utf8"));
          throw refused;
        }
        renameSync(from, to);
      }, new RecordedDelayTimer());
      const installer = CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, (from, to) => {
        swaps.push(`${from.endsWith("ready") ? "ready" : from === folder ? "installed" : "previous"} -> ${to === folder ? "installed" : "aside"}`);
        renameSync(from, to);
      }, undefined, settle.moveAsync.bind(settle));

      const failure = await installer.install(() => undefined, new AbortController().signal).then(() => null, (error: unknown) => error);

      Assert.isTrue(whileRefused.every(t => t === "held"), String(refusals));
      if (refusals === 2) {
        Assert.isNull(failure);
        Assert.areEqual("held,held", whileRefused.join(","));
        Assert.areEqual("installed -> aside,ready -> installed", swaps.join(","));
        Assert.areEqual(CursorInstallerTests.PROGRAM, readFileSync(launcher, "utf8"));
      }
      else {
        Assert.isInstanceOf(failure, Error);
        Assert.areEqual(Resources.formatCursorNotReady(CursorInstallerTests.VERSION, folder, "EPERM", true), failure.message);
        Assert.areEqual(`TeamRun couldn't move the new Cursor ${CursorInstallerTests.VERSION} download into place in ${folder} (EPERM), as something such as a `
          + "virus scanner still held it, so nothing installed was changed. Install again in a moment.", failure.message);
        Assert.isInstanceOf(failure.cause, InstallHeldException);
        Assert.areEqual(refused, failure.cause.cause);
        Assert.areEqual(0, swaps.length);
        Assert.areEqual("held", readFileSync(launcher, "utf8"));
      }
      Assert.areEqual(CursorInstallerTests.VERSION, readdirSync(directory.resolve("data", "providers", "cursor")).join(","), String(refusals));
    }
  }

  @TestMethod
  public async namesTheReasonWithoutAHoldWhenTheNewBuildCantBeMovedForAnotherReason(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const release = CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive);
    const folder = directory.resolve("data", "providers", "cursor", CursorInstallerTests.VERSION);
    const denied = Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" });

    const failure = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, renameSync,
      undefined, () => Promise.reject(denied)).install(() => undefined, new AbortController().signal), Error);

    Assert.areEqual(Resources.formatCursorNotReady(CursorInstallerTests.VERSION, folder, "EACCES", false), failure.message);
    Assert.areEqual(`TeamRun couldn't move the new Cursor ${CursorInstallerTests.VERSION} download into place in ${folder} (EACCES), so nothing installed was changed.`,
      failure.message);
    Assert.areEqual(denied, failure.cause);
    Assert.areEqual(String.empty, readdirSync(directory.resolve("data", "providers", "cursor")).join(","));
  }

  @TestMethod
  public async changesNothingWhenItsFolderCantBeWrittenAndNamesTheFolder(): Promise<void> {
    if (process.getuid?.() === 0 || !FolderRefusal.refusesWrites)
      return;
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const installer = CursorInstallerTests.installer(CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive), directory);
    const installs = directory.resolve("data", "providers", "cursor");
    CursorInstallerTests.denyWrites(installs);
    let failure: Error;
    try {
      failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);
    }
    finally {
      CursorInstallerTests.allowWrites(installs);
    }

    Assert.areEqual(Resources.formatCursorFolderNotWritable(installs), failure.message);
    Assert.areEqual(`TeamRun can't write to ${installs}, where Cursor goes. Nothing was installed.`, failure.message);
    Assert.areEqual(String.empty, readdirSync(installs).join(","));
    Assert.areEqual(String.empty, server.requests.join(","));
  }

  @TestMethod
  public async stopsTarAndLeavesNothingWhenCancelledWhileItUnpacksOrAfterTheVersionCheck(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const release = CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive);
    const installs = directory.resolve("data", "providers", "cursor");
    const sleeping = new LocatedExecutable(process.execPath, ExecutableSource.Path, ["-e", CursorInstallerTests.SLEEP, "--"]);
    const whileUnpacking = new AbortController();
    const afterCheck = new AbortController();
    const unpacking = new AbortingRunner(whileUnpacking, 1, true);
    const checked = new AbortingRunner(afterCheck, 2, false);

    const stopped = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", sleeping, undefined, undefined, renameSync, unpacking)
      .install(() => undefined, whileUnpacking.signal), Error);
    const leftUnpacking = readdirSync(installs).join(",");
    const late = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, undefined, renameSync, checked)
      .install(() => undefined, afterCheck.signal), Error);

    Assert.areEqual(Resources.formatInstallCancelled("Cursor"), stopped.message);
    Assert.areEqual(1, unpacking.calls);
    Assert.areEqual(String.empty, leftUnpacking);
    Assert.areEqual(Resources.formatInstallCancelled("Cursor"), late.message);
    Assert.areEqual(2, checked.calls);
    Assert.areEqual(String.empty, readdirSync(installs).join(","));
  }

  @TestMethod
  public async removesTheVersionFoldersAnEarlierPinLeftOnceItInstallsAndKeepsOneItCantRemove(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const installer = CursorInstallerTests.installer(CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive), directory);
    const installs = directory.resolve("data", "providers", "cursor");
    mkdirSync(join(installs, "2026.9.30-0a1b2c3", "dist-package"), { recursive: true });
    writeFileSync(join(installs, "2026.9.30-0a1b2c3", "dist-package", "cursor-agent"), "old");
    const held = join(installs, "2026.8.1-1a2b3c4", "dist-package");
    mkdirSync(held, { recursive: true });
    writeFileSync(join(held, "cursor-agent"), "held");
    const holder = process.platform === "win32" ? spawn(process.execPath, ["-e", CursorInstallerTests.SLEEP], { cwd: held, stdio: "ignore" }) : null;
    const locks = Object.isNull(holder) && process.getuid?.() !== 0;
    if (locks)
      chmodSync(held, 0o555);
    if (!Object.isNull(holder))
      await once(holder, "spawn");
    try {
      await installer.install(() => undefined, new AbortController().signal);
    }
    finally {
      if (locks)
        chmodSync(held, 0o755);
      if (!Object.isNull(holder)) {
        holder.kill();
        await once(holder, "exit");
      }
    }

    Assert.areEqual((Object.isNull(holder) && !locks ? [CursorInstallerTests.VERSION] : [CursorInstallerTests.VERSION, "2026.8.1-1a2b3c4"]).join(","),
      readdirSync(installs).sort().join(","));
    Assert.isTrue(installer.isInstalled);
  }

  @TestMethod
  public async saysWhenTheInstalledCursorIsntTheOneTeamRunRunsAndWhenTheInstallIsCancelled(): Promise<void> {
    using directory = new TemporaryDirectory();
    const archive = FakeTar.archive(CursorInstallerTests.posixPackage());
    await using server = (await LocalHttpServer.start()).serve("/agent-cli-package.tar.gz", archive);
    const release = CursorInstallerTests.release(server, "agent-cli-package.tar.gz", archive);
    const other = directory.resolve("other.js");
    writeFileSync(other, "console.log(\"2026.9.30-0a1b2c3\");\n");
    const elsewhere = new LocatedExecutable(process.execPath, ExecutableSource.Path, [other]);
    const silent = directory.resolve("silent.js");
    writeFileSync(silent, "process.exit(1);\n");
    const unreadable = new LocatedExecutable(process.execPath, ExecutableSource.Path, [silent]);
    const installs = directory.resolve("data", "providers", "cursor");
    const cancelled = new AbortController();
    cancelled.abort();

    Assert.areEqual(process.execPath, CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, () => elsewhere).foundPath);
    Assert.isNull(CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, () => null).foundPath);
    Assert.isNull(CursorInstallerTests.installer(release, directory, "linux", undefined, undefined,
      () => new LocatedExecutable(process.execPath, ExecutableSource.Managed)).foundPath);
    const shadowed = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, () => elsewhere)
      .install(() => undefined, new AbortController().signal), Error);
    const unknown = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, () => unreadable)
      .install(() => undefined, new AbortController().signal), Error);
    const lost = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, () => null)
      .install(() => undefined, new AbortController().signal), Error);
    const stopped = await Assert.throwsAsync(() => CursorInstallerTests.installer(release, directory).install(() => undefined, cancelled.signal), Error);
    const versions = await CursorInstallerTests.installer(release, directory, "linux", undefined, undefined, () => elsewhere).readVersions();

    Assert.areEqual(Resources.formatCursorShadowed(CursorInstallerTests.VERSION, installs, process.execPath, "2026.9.30-0a1b2c3"), shadowed.message);
    Assert.areEqual(`Cursor ${CursorInstallerTests.VERSION} was installed in ${installs}, but TeamRun runs ${process.execPath} which it finds first. ` +
      "Remove that one, then restart TeamRun.", unknown.message);
    Assert.areEqual(Resources.formatCursorNotFoundAfterInstall(installs), lost.message);
    Assert.areEqual(Resources.formatInstallCancelled("Cursor"), stopped.message);
    Assert.areEqual("2026.9.30-0a1b2c3 null", CursorInstallerTests.versions(versions));
  }

  @TestMethod
  public async isUnavailableWithoutABuildOrTarAndPinsEachPlatformsBuild(): Promise<void> {
    using directory = new TemporaryDirectory();
    const release = CursorRelease.find("linux", "x64");

    const noBuild = CursorInstallerTests.installer(CursorRelease.find("freebsd", "x64"), directory);
    const noTar = CursorInstallerTests.installer(release, directory, "linux", null);

    Assert.areEqual(Resources.cursorNoBuild, noBuild.unavailable);
    Assert.areEqual(Resources.cursorNoExtractor, noTar.unavailable);
    Assert.isNull(noBuild.missingTool);
    Assert.areEqual("tar", noTar.missingTool);
    Assert.areEqual(Resources.cursorNoBuild, (await Assert.throwsAsync(() => noBuild.install(() => undefined, new AbortController().signal), InstallFailedException)).message);
    Assert.areEqual(Resources.cursorNoExtractor, (await Assert.throwsAsync(() => noTar.install(() => undefined, new AbortController().signal), InstallFailedException)).message);
    Assert.areEqual("null null", CursorInstallerTests.versions(await noBuild.readVersions()));
    Assert.areEqual("darwin-arm64,darwin-x64,linux-x64,linux-arm64,win32-x64,win32-arm64", Resources.cursorReleases.map(t => t.target).join(","));
    Assert.areEqual(["https://downloads.cursor.com/lab/2026.10.22-27dcf5f/linux/x64/agent-cli-package.tar.gz", "184859176",
      "85296944e4600a83c4b764f578d1502bf9c416db200d33a593e8f3ecabfdc294", "false", join("dist-package", "cursor-agent"), join("dist-package", "node"), "126879696",
      join("dist-package", "index.js"), "7520482"].join(" "), [release?.archive.url, release?.archive.bytes, release?.archive.sha256, release?.isZip, release?.launcherName,
      release?.nodeName, release?.nodeBytes, release?.scriptName, release?.scriptBytes].join(" "));
    const windows = CursorRelease.find("win32", "arm64");
    Assert.areEqual(["https://downloads.cursor.com/lab/2026.10.22-27dcf5f/windows/arm64/agent-cli-package.zip", "77626713", "true",
      join("dist-package", "cursor-agent.cmd"), join("dist-package", "node.exe"), "82150728", "7702096"].join(" "),
      [windows?.archive.url, windows?.archive.bytes, windows?.isZip, windows?.launcherName, windows?.nodeName, windows?.nodeBytes, windows?.scriptBytes].join(" "));
    Assert.areEqual("https://downloads.cursor.com/lab/2026.10.22-27dcf5f/darwin/arm64/agent-cli-package.tar.gz false",
      [CursorRelease.find("darwin", "arm64")?.archive.url, CursorRelease.find("darwin", "arm64")?.isZip].join(" "));
    Assert.isTrue(Resources.cursorReleases.every(t => /^[0-9a-f]{64}$/.test(t.sha256) && t.nodeBytes > t.scriptBytes && t.archiveBytes > t.scriptBytes));
    const launcher = join("cursor", "dist-package", "cursor-agent");
    const windowsLauncher = join("cursor", "dist-package", "cursor-agent.CMD");
    Assert.areEqual(`${launcher}:`, [CursorInstaller.programOf(launcher).executable, CursorInstaller.programOf(launcher).arguments.join(" ")].join(":"));
    Assert.areEqual(`${join("cursor", "dist-package", "node.exe")}:${join("cursor", "dist-package", "index.js")}`,
      [CursorInstaller.programOf(windowsLauncher).executable, CursorInstaller.programOf(windowsLauncher).arguments.join(" ")].join(":"));
  }

  private static posixPackage(): Readonly<Record<string, string>> {
    return { "dist-package/cursor-agent": CursorInstallerTests.PROGRAM, "dist-package/node": CursorInstallerTests.NODE,
      "dist-package/index.js": CursorInstallerTests.PROGRAM, "dist-package/rg": "rg fixture\n" };
  }

  private static windowsPackage(): Readonly<Record<string, string>> {
    return { "dist-package/cursor-agent.cmd": "@echo off\r\n", "dist-package/cursor-agent.ps1": "exit 0\r\n", "dist-package/node.exe": CursorInstallerTests.NODE,
      "dist-package/index.js": CursorInstallerTests.PROGRAM };
  }

  private static release(server: LocalHttpServer, file: string, archive: Buffer, platform: string = "linux"): CursorRelease {
    return CursorInstallerTests.releaseOf(new ReleaseFile(server.url(`/${file}`), createHash("sha256").update(archive).digest("hex"), archive.length), file, platform);
  }

  private static releaseOf(file: ReleaseFile, archiveName: string, platform: string = "linux", nodeBytes: number = CursorInstallerTests.NODE.length,
    scriptBytes: number = CursorInstallerTests.PROGRAM.length): CursorRelease {
    const isWindows = platform === "win32";
    return new CursorRelease(CursorInstallerTests.VERSION, file, archiveName, join("dist-package", isWindows ? "cursor-agent.cmd" : "cursor-agent"),
      join("dist-package", isWindows ? "node.exe" : "node"), nodeBytes, join("dist-package", "index.js"), scriptBytes);
  }

  private static installer(release: CursorRelease | null, directory: TemporaryDirectory, platform: string = "linux",
    extractor: LocatedExecutable | null | undefined = undefined, unpackTimeout: number = 60_000, locate: (() => LocatedExecutable | null) | undefined = undefined,
    rename: (from: string, to: string) => void = renameSync, runner: CommandRunner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform))),
    settle: (from: string, to: string) => Promise<void> = async (from, to) => rename(from, to)): CursorInstaller {
    const installs = directory.resolve("data", "providers", "cursor");
    mkdirSync(installs, { recursive: true });
    const locator = new ExecutableLocator(platform, "x64", [], directory.resolve("home"));
    const found = (): LocatedExecutable | null => {
      const located = locator.locateCursor(null, installs);
      return Object.isNull(located) ? null : new LocatedExecutable(process.execPath, located.source, [located.arguments[0] ?? located.path]);
    };
    const program = (path: string): ProcessCommand => {
      const command = CursorInstaller.programOf(path);
      return new ProcessCommand(process.execPath, [command.arguments[0] ?? command.executable]);
    };
    return new CursorInstaller(locate ?? found, new ExecutableVersionReader(runner, 60_000), process.env, release, installs, platform,
      Object.isUndefined(extractor) ? FakeTar.create(directory.path) : extractor, runner, program, rename, settle, unpackTimeout);
  }

  private static denyWrites(folder: string): void {
    if (process.platform === "win32")
      FolderRefusal.refuseWrites(folder);
    else
      chmodSync(folder, 0o555);
  }

  private static allowWrites(folder: string): void {
    if (process.platform === "win32")
      FolderRefusal.allowWrites(folder);
    else
      chmodSync(folder, 0o755);
  }

  private static versions(versions: ProviderKindVersions): string {
    return `${versions.installed} ${versions.latest}`;
  }
}

class AbortingRunner extends CommandRunner {
  private readonly controller: AbortController;
  private readonly at: number;
  private readonly during: boolean;
  public calls: number = 0;

  public constructor(controller: AbortController, at: number, during: boolean) {
    super(new NodeProcessStarter(new ProcessTerminator(process.platform)));
    this.controller = controller;
    this.at = at;
    this.during = during;
  }

  public override async run(command: ProcessCommand, environment: NodeJS.ProcessEnv, timeoutMilliseconds: number | null,
    cancel: AbortSignal | null = null): Promise<CommandResult> {
    const call = ++this.calls;
    const running = super.run(command, environment, timeoutMilliseconds, cancel);
    if (call === this.at && this.during)
      this.controller.abort();
    const result = await running;
    if (call === this.at && !this.during)
      this.controller.abort();
    return result;
  }
}
