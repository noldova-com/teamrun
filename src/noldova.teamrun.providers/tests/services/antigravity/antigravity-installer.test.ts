/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ProviderKindVersions } from "@noldova/teamrun.core";
import {
  AntigravityInstaller,
  AntigravityRelease,
  CommandRunner,
  ExecutableLocator,
  InstallCancelledException, LocatedExecutable,
  ExecutableSource,
  type IProcessStarter,
  NodeProcessStarter,
  ProcessCommand,
  ProcessTerminator,
  Resources
} from "@noldova/teamrun.providers";

import { FakeCodesign } from "../../fixtures/fake-codesign.fixture.js";
import { FakeUnzip } from "../../fixtures/fake-unzip.fixture.js";
import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { WatchingProcessStarter } from "../../fixtures/watching-process-starter.fixture.js";
import { ZipArchive } from "../../fixtures/zip-archive.fixture.js";

const members = [{ name: "agy_acp_server.par", data: "server" }, { name: "localharness_external", data: "harness!" }];
const archive = ZipArchive.stored(members);
const sha256 = createHash("sha256").update(archive).digest("hex");
const escaping = ZipArchive.stored([...members, { name: "../escaped", data: "outside" }]);

@TestClass
export class AntigravityInstallerTests {
  private static readonly CODESIGN: ProcessCommand = new ProcessCommand("/usr/bin/codesign", []);
  private static readonly SLEEP: string = "setTimeout(() => {}, 60000)";

  @TestMethod
  public async installsTheServerAndHarnessOnceTheDownloadPassesItsChecks(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const extractor = AntigravityInstallerTests.extractor(tools.path);
    await using server = (await LocalHttpServer.start()).serve("/agy.zip", archive);
    const progress: number[][] = [];
    const installer = AntigravityInstallerTests.installer(AntigravityInstallerTests.release(server.url("/agy.zip")), directory.path, extractor);
    Assert.isNull(installer.unavailable);
    Assert.isNull(installer.missingTool);
    Assert.isFalse(installer.isInstalled);
    Assert.areEqual("null 1.3.0", AntigravityInstallerTests.versions(await installer.readVersions()));
    mkdirSync(join(directory.path, ".teamrun-staging-left-by-a-stopped-install", "1.3.0"), { recursive: true });

    const path = await installer.install((received, total) => progress.push([received, total]), new AbortController().signal);
    Assert.isTrue(installer.isInstalled);
    Assert.areEqual("1.3.0 1.3.0", AntigravityInstallerTests.versions(await installer.readVersions()));

    Assert.areEqual(join(directory.path, "1.3.0", "agy_acp_server.par"), path);
    Assert.areEqual("server", readFileSync(path, "utf8"));
    Assert.areEqual("harness!", readFileSync(join(directory.path, "1.3.0", "localharness_external"), "utf8"));
    Assert.areEqual("1.3.0", readdirSync(directory.path).join(","));
    Assert.areEqual(JSON.stringify([archive.length, archive.length]), JSON.stringify(progress.at(-1)));
    Assert.areEqual(`/agy.zip identity`, server.requests.join(","));
    if (process.platform !== "win32")
      Assert.areEqual(0o755, statSync(path).mode & 0o777);
    Assert.areEqual(path, await installer.install(() => undefined, new AbortController().signal));
    Assert.areEqual(1, server.requests.length);
  }

  @TestMethod
  public async installsNothingFromADownloadThatFailsItsChecks(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const extractor = AntigravityInstallerTests.extractor(tools.path);
    await using server = (await LocalHttpServer.start()).serve("/agy.zip", archive).serve("/empty", Buffer.alloc(0), 204)
      .serve("/escaping.zip", escaping);
    const cases: readonly [AntigravityRelease, string][] = [
      [AntigravityInstallerTests.release(server.url("/agy.zip"), "0".repeat(64)), Resources.formatDownloadMismatch("Antigravity")],
      [AntigravityInstallerTests.release(server.url("/agy.zip"), sha256, archive.length - 1), Resources.formatDownloadMismatch("Antigravity")],
      [AntigravityInstallerTests.release(server.url("/agy.zip"), sha256, archive.length + 1), Resources.formatDownloadMismatch("Antigravity")],
      [AntigravityInstallerTests.release(server.url("/missing")), Resources.formatDownloadFailed("Antigravity", 404)],
      [AntigravityInstallerTests.release(server.url("/empty")), Resources.formatDownloadFailed("Antigravity", 204)],
      [AntigravityInstallerTests.release(server.url("/agy.zip"), sha256, archive.length, 9), Resources.antigravityMemberMismatch],
      [AntigravityInstallerTests.release(server.url("/agy.zip"), sha256, archive.length, 6, "agy_acp_server.exe"), Resources.antigravityMemberMismatch],
      [AntigravityInstallerTests.release(server.url("/escaping.zip"), createHash("sha256").update(escaping).digest("hex"), escaping.length),
        Resources.antigravityArchiveUnsafe]
    ];
    for (const [release, message] of cases) {
      const failure = await Assert.throwsAsync(() => AntigravityInstallerTests.installer(release, directory.path, extractor).install(() => undefined,
        new AbortController().signal), Error);
      Assert.areEqual(message, failure.message, release.url);
      Assert.areEqual(0, readdirSync(directory.path).length, release.url);
    }
  }

  @TestMethod
  public async saysWhyAnArchiveCantBeUnpackedOrAnInstallationIsIncomplete(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const extractor = AntigravityInstallerTests.extractor(tools.path);
    const broken = Buffer.from(archive);
    broken.writeUInt32LE(0, 0);
    const notZip = Buffer.from("not a zip archive");
    await using server = (await LocalHttpServer.start()).serve("/broken.zip", broken).serve("/not-zip", notZip);
    const release = AntigravityInstallerTests.release(server.url("/broken.zip"), createHash("sha256").update(broken).digest("hex"), broken.length);
    const failure = await Assert.throwsAsync(() => AntigravityInstallerTests.installer(release, directory.path, extractor).install(() => undefined,
      new AbortController().signal), Error);
    Assert.isTrue(failure.message.startsWith("Unpacking the Antigravity download failed with exit code "), failure.message);
    Assert.areEqual(0, readdirSync(directory.path).length);
    const notZipRelease = AntigravityInstallerTests.release(server.url("/not-zip"), createHash("sha256").update(notZip).digest("hex"), notZip.length);
    Assert.areEqual(Resources.antigravityArchiveUnsafe, (await Assert.throwsAsync(() => AntigravityInstallerTests.installer(notZipRelease, directory.path,
      extractor).install(() => undefined, new AbortController().signal), Error)).message);
    Assert.areEqual(0, readdirSync(directory.path).length);
    Assert.areEqual("Unpacking the Antigravity download was stopped. Nothing was installed.", Resources.formatAntigravityUnpackFailed(null));
    mkdirSync(join(directory.path, "1.3.0"));
    Assert.areEqual(Resources.formatAntigravityIncomplete(join(directory.path, "1.3.0")), (await Assert.throwsAsync(() =>
      AntigravityInstallerTests.installer(release, directory.path, extractor).install(() => undefined, new AbortController().signal), Error)).message);
    const aborted = new AbortController();
    aborted.abort();
    await Assert.throwsAsync(() => AntigravityInstallerTests.installer(AntigravityInstallerTests.release(server.url("/broken.zip")), directory.resolve("other"), extractor)
      .install(() => undefined, aborted.signal), Error);
    Assert.areEqual(0, readdirSync(directory.resolve("other")).length);
  }

  @TestMethod
  public async saysWhyItCantInstallWithoutABuildOrUnzip(): Promise<void> {
    const runner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));
    const unzip = new LocatedExecutable("/usr/bin/unzip", ExecutableSource.Path);
    const noBuild = new AntigravityInstaller(null, "/data/antigravity", unzip, "linux", "x64", AntigravityInstallerTests.CODESIGN, runner, 1000, 1000);
    Assert.areEqual(Resources.antigravityNoRelease, noBuild.unavailable);
    Assert.isNull(noBuild.missingTool);
    Assert.isFalse(noBuild.isInstalled);
    Assert.areEqual("null null", AntigravityInstallerTests.versions(await noBuild.readVersions()));
    Assert.areEqual(Resources.antigravityNoRelease, (await Assert.throwsAsync(() => noBuild.install(() => undefined, new AbortController().signal), Error)).message);
    const noUnzip = new AntigravityInstaller(AntigravityRelease.find("linux", "x64"), "/data/antigravity", null, "linux", "x64", AntigravityInstallerTests.CODESIGN,
      runner, 1000, 1000);
    Assert.areEqual(Resources.antigravityNoUnzip, noUnzip.unavailable);
    Assert.areEqual("unzip", noUnzip.missingTool);
  }

  @TestMethod
  public pinsOneReleaseForEachSupportedComputer(): void {
    const targets = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "win32-x64", "win32-arm64"];
    for (const target of targets) {
      const [platform, architecture] = target.split("-") as [string, string];
      const release = AntigravityRelease.find(platform, architecture)!;
      Assert.areEqual("1.3.0", release.version, target);
      Assert.isTrue(release.url.startsWith("https://dl.google.com/agy-extensions/releases/") && release.url.endsWith(".zip"), release.url);
      Assert.isTrue(/^[0-9a-f]{64}$/.test(release.sha256), target);
      Assert.areEqual(platform === "win32" ? "agy_acp_server.exe" : "agy_acp_server.par", release.executableName, target);
      Assert.areEqual(platform === "win32" ? "localharness_external.exe" : "localharness_external", release.harnessName, target);
      Assert.isTrue(release.archiveBytes > 0 && release.executableBytes > 0 && release.harnessBytes > 0, target);
    }
    Assert.isNull(AntigravityRelease.find("linux", "ia32"));
    Assert.isNull(AntigravityRelease.find("freebsd", "x64"));
  }

  @TestMethod
  public async makesTheServerAndItsHarnessExecutableOutsideWindows(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    await using server = (await LocalHttpServer.start()).serve("/agy.zip", archive);
    const installer = AntigravityInstallerTests.installer(AntigravityInstallerTests.release(server.url("/agy.zip")), directory.path,
      AntigravityInstallerTests.extractor(tools.path), "darwin");

    const path = await installer.install(() => undefined, new AbortController().signal);
    const expected = process.platform === "win32" ? 0o666 : 0o755;
    Assert.areEqual(expected, statSync(path).mode & 0o777);
    Assert.areEqual(expected, statSync(join(directory.path, "1.3.0", "localharness_external")).mode & 0o777);
  }

  @TestMethod
  public async reSignsItsCopyOfTheServerOnIntelMacsOnlyAfterTheChecksKeepingTheHardenedRuntimeWithOneEntitlement(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const extractor = AntigravityInstallerTests.extractor(tools.path);
    const codesign = FakeCodesign.create(tools.path);
    await using server = (await LocalHttpServer.start()).serve("/agy.zip", archive);
    const release = AntigravityInstallerTests.release(server.url("/agy.zip"));
    const failing = AntigravityInstallerTests.release(server.url("/agy.zip"), "0".repeat(64));
    await Assert.throwsAsync(() => AntigravityInstallerTests.installer(failing, directory.resolve("failing"), extractor, "darwin", "x64", codesign.command)
      .install(() => undefined, new AbortController().signal), Error);
    for (const [platform, architecture] of [["darwin", "arm64"], ["linux", "x64"], ["win32", "x64"]] as const)
      await AntigravityInstallerTests.installer(release, directory.resolve(`${platform}-${architecture}`), extractor, platform, architecture, codesign.command)
        .install(() => undefined, new AbortController().signal);
    Assert.areEqual(0, codesign.calls.length);

    const path = await AntigravityInstallerTests.installer(release, directory.resolve("intel"), extractor, "darwin", "x64", codesign.command)
      .install(() => undefined, new AbortController().signal);

    Assert.areEqual(1, codesign.calls.length);
    const call = codesign.calls[0]!;
    const staging = dirname(call.args.at(-2)!);
    Assert.areEqual(directory.resolve("intel"), dirname(staging));
    Assert.isTrue(basename(staging).startsWith(".teamrun-staging-"), staging);
    Assert.areEqual(JSON.stringify(["--force", "--sign", "-", "--options", "runtime", "--entitlements", join(staging, "entitlements.plist"),
      join(staging, "1.3.0", "agy_acp_server.par")]), JSON.stringify(call.args));
    Assert.areEqual(1, call.entitlements.split("<key>").length - 1);
    Assert.isTrue(/<key>com\.apple\.security\.cs\.allow-unsigned-executable-memory<\/key>\s*<true\/>/.test(call.entitlements), call.entitlements);
    Assert.areEqual("server", call.server);
    Assert.areEqual("server+signed", readFileSync(path, "utf8"));
    Assert.areEqual("harness!", readFileSync(join(directory.resolve("intel"), "1.3.0", "localharness_external"), "utf8"));
    Assert.areEqual("1.3.0", readdirSync(directory.resolve("intel")).join(","));
  }

  @TestMethod
  public async installsNothingWhenCodesignFailsOrCantRun(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const extractor = AntigravityInstallerTests.extractor(tools.path);
    await using server = (await LocalHttpServer.start()).serve("/agy.zip", archive);
    const release = AntigravityInstallerTests.release(server.url("/agy.zip"));
    const cases: readonly [ProcessCommand, string][] = [
      [FakeCodesign.create(tools.path, 3).command, Resources.formatAntigravitySignFailed(3)],
      [new ProcessCommand(tools.resolve("missing-codesign"), []), Resources.formatAntigravitySignFailed(null)]
    ];
    for (const [codesign, message] of cases) {
      const installer = AntigravityInstallerTests.installer(release, directory.path, extractor, "darwin", "x64", codesign);
      Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message);
      Assert.areEqual(0, readdirSync(directory.path).length, message);
      Assert.isFalse(installer.isInstalled);
    }
    Assert.areEqual("Re-signing Antigravity's server for this Intel Mac with codesign did not finish. Nothing was installed.",
      Resources.formatAntigravitySignFailed(null));
  }

  @TestMethod
  public async stopsAtEveryStepOnCancelEndingTheRunningProgramAndInstallsNothing(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    const extractor = AntigravityInstallerTests.extractor(tools.path);
    const codesign = FakeCodesign.create(tools.path);
    const sleepingUnzip = new LocatedExecutable(process.execPath, ExecutableSource.Path, ["-e", AntigravityInstallerTests.SLEEP, "--"]);
    const sleepingCodesign = new ProcessCommand(process.execPath, ["-e", AntigravityInstallerTests.SLEEP, "--"]);
    await using server = (await LocalHttpServer.start()).serve("/agy.zip", archive);
    const release = AntigravityInstallerTests.release(server.url("/agy.zip"));
    const isCodesign = (command: ProcessCommand): boolean => command.arguments.includes("--sign");
    const cases: readonly [string, LocatedExecutable, ProcessCommand, "start" | "close" | null, (command: ProcessCommand) => boolean, number][] = [
      ["after the download", extractor, codesign.command, null, () => false, 0],
      ["while unpacking", sleepingUnzip, codesign.command, "start", t => !isCodesign(t), 1],
      ["before re-signing", extractor, codesign.command, "close", t => !isCodesign(t), 1],
      ["while re-signing", extractor, sleepingCodesign, "start", isCodesign, 2],
      ["before the rename", extractor, codesign.command, "close", isCodesign, 2]
    ];

    await Promise.all(cases.map(async ([step, unzip, sign, when, matches, started]) => {
      const controller = new AbortController();
      const starter = new WatchingProcessStarter((command, child) => {
        if (when === "start" && matches(command))
          controller.abort();
        else if (when === "close" && matches(command))
          child.once("close", () => controller.abort());
      });
      const folder = directory.resolve(step.replaceAll(" ", "-"));
      const installer = AntigravityInstallerTests.installer(release, folder, unzip, "darwin", "x64", sign, starter);
      const progress = (received: number, total: number): void => {
        if (Object.isNull(when) && received === total)
          controller.abort();
      };

      const failure = await Assert.throwsAsync(() => installer.install(progress, controller.signal), InstallCancelledException);

      Assert.areEqual(Resources.formatInstallCancelled("Antigravity"), failure.message, step);
      Assert.areEqual(started, starter.started.length, step);
      Assert.areEqual(0, readdirSync(folder).length, step);
      Assert.isFalse(installer.isInstalled, step);
    }));
    Assert.areEqual(1, codesign.calls.length);
  }

  @TestMethod
  public async stopsAnUnpackOrAReSignThatTakesLongerThanItsOwnLimit(): Promise<void> {
    using directory = new TemporaryDirectory();
    using tools = new TemporaryDirectory();
    await using server = (await LocalHttpServer.start()).serve("/agy.zip", archive);
    const release = AntigravityInstallerTests.release(server.url("/agy.zip"));
    const sleepingUnzip = new LocatedExecutable(process.execPath, ExecutableSource.Path, ["-e", AntigravityInstallerTests.SLEEP, "--"]);
    const sleepingCodesign = new ProcessCommand(process.execPath, ["-e", AntigravityInstallerTests.SLEEP, "--"]);
    const cases: readonly [string, AntigravityInstaller, string][] = [
      ["unpack", AntigravityInstallerTests.installer(release, directory.resolve("unpack"), sleepingUnzip, "darwin", "x64", AntigravityInstallerTests.CODESIGN,
        undefined, 200), Resources.formatAntigravityUnpackFailed(null)],
      ["re-sign", AntigravityInstallerTests.installer(release, directory.resolve("re-sign"), AntigravityInstallerTests.extractor(tools.path), "darwin", "x64",
        sleepingCodesign, undefined, 60000, 200), Resources.formatAntigravitySignFailed(null)]
    ];

    await Promise.all(cases.map(async ([step, installer, message]) => {
      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(message, failure.message, step);
      Assert.areEqual(0, readdirSync(directory.resolve(step)).length, step);
    }));
  }

  private static versions(versions: ProviderKindVersions): string {
    return `${versions.installed} ${versions.latest}`;
  }

  private static release(url: string, hash: string = sha256, archiveBytes: number = archive.length, executableBytes: number = 6,
    executableName: string = "agy_acp_server.par"): AntigravityRelease {
    return new AntigravityRelease("1.3.0", url, hash, archiveBytes, executableName, executableBytes, "localharness_external", 8);
  }

  private static extractor(directory: string): LocatedExecutable {
    return ExecutableLocator.fromProcess().locateUnzip() ?? FakeUnzip.create(directory);
  }

  private static installer(release: AntigravityRelease, directory: string, extractor: LocatedExecutable, platform: string = process.platform,
    architecture: string = "arm64", codesign: ProcessCommand = AntigravityInstallerTests.CODESIGN,
    starter: IProcessStarter = new NodeProcessStarter(new ProcessTerminator(process.platform)), unpackTimeout: number = 60000,
    signTimeout: number = 60000): AntigravityInstaller {
    return new AntigravityInstaller(release, directory, extractor, platform, architecture, codesign, new CommandRunner(starter), unpackTimeout, signTimeout);
  }
}
