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
import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { ProviderKindVersions } from "@noldova/teamrun.core";
import {
  CodexInstaller,
  CommandRunner,
  ExecutableSource,
  ExecutableVersionReader,
  InstallCancelledException, InstallFailedException, InstallRename,
  LocatedExecutable,
  NodeProcessStarter,
  ProcessCommand,
  ProcessTerminator,
  Resources
} from "@noldova/teamrun.providers";

import { FakeTar } from "../../fixtures/fake-tar.fixture.js";
import { LocalHttpServer } from "../../fixtures/local-http-server.fixture.js";
import { RecordedDelayTimer } from "../../fixtures/recorded-delay-timer.fixture.js";
import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";
import { Wait } from "../../fixtures/wait.fixture.js";

@TestClass
export class CodexInstallerTests {
  private static readonly SLEEP: string = "setTimeout(() => {}, 60000)";
  private static readonly TARGETS: Readonly<Record<string, string>> = {
    linux: "x86_64-unknown-linux-musl", darwin: "aarch64-apple-darwin", win32: "x86_64-pc-windows-msvc"
  };

  @TestMethod
  public installsTheLatestPackageOnceItPassesItsCheckAndLinksItWhereCodexsInstallerDoes(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      const archive = CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const installer = CodexInstallerTests.installer([server.url("/c")], directory);
      const progress: number[][] = [];
      Assert.isNull(installer.unavailable);
      Assert.isNull(installer.missingTool);
      Assert.isFalse(installer.isInstalled);
      Assert.isNull(installer.foundPath);
      Assert.areEqual("null null", CodexInstallerTests.versions(await installer.readVersions(true)));

      const path = await installer.install((received, total) => progress.push([received, total]), new AbortController().signal);

      const root = directory.resolve("home", "packages", "standalone");
      const release = join(root, "releases", "0.164.0-x86_64-unknown-linux-musl");
      Assert.areEqual(process.execPath, path);
      Assert.isTrue(installer.isInstalled);
      Assert.areEqual("0.164.0 0.164.0", CodexInstallerTests.versions(await installer.readVersions(true)));
      Assert.areEqual(JSON.stringify([archive.length, archive.length]), JSON.stringify(progress.at(-1)));
      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readdirSync(join(root, "releases")).join(","));
      Assert.isTrue(Resources.codexPosixMembers.concat(Resources.codexLinuxMembers).every(t => existsSync(join(release, t))));
      Assert.areEqual(realpathSync(release), realpathSync(join(root, "current")));
      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readFileSync(join(root, "auto-update-version"), "utf8"));
      Assert.areEqual("auto-update-version,current,releases", readdirSync(root).sort().join(","));
      Assert.isFalse(existsSync(directory.resolve("bin", "codex-code-mode-host")));
      if (process.platform !== "win32")
        Assert.isTrue(["bin/codex", "bin/codex-code-mode-host", "codex-path/rg", "codex-resources/bwrap"].every(t => (statSync(join(release, t)).mode & 0o111) !== 0));
      Assert.areEqual("/c,/packages/0.164.0/codex-package-x86_64-unknown-linux-musl.tar.gz,/c", CodexInstallerTests.paths(server));
      Assert.areEqual("/packages/0.164.0/codex-package-x86_64-unknown-linux-musl.tar.gz identity", server.requests[1]);
    });
  }

  @TestMethod
  public linksTheCodeModeHostBesideCodexOnAMac(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "darwin");

      await CodexInstallerTests.installer([server.url("/c")], directory, "darwin").install(() => undefined, new AbortController().signal);

      Assert.isTrue(existsSync(directory.resolve("bin", "codex-code-mode-host")));
      Assert.isTrue(existsSync(directory.resolve("home", "packages", "standalone", "releases", "0.164.0-aarch64-apple-darwin", "codex")));
      Assert.isFalse(existsSync(directory.resolve("home", "packages", "standalone", "releases", "0.164.0-aarch64-apple-darwin", "codex-resources", "bwrap")));
    });
  }

  @TestMethod
  public updatesByRelinkingTheNewReleaseAndKeepsTheEarlierOne(): Promise<void> {
    if (process.platform === "win32")
      return Promise.resolve();
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/old", "0.163.0", "linux");
      CodexInstallerTests.publish(server, "/new", "0.164.0", "linux");
      await CodexInstallerTests.installer([server.url("/old")], directory).install(() => undefined, new AbortController().signal);
      const installer = CodexInstallerTests.installer([server.url("/new")], directory);
      Assert.areEqual("0.163.0 0.164.0", CodexInstallerTests.versions(await installer.readVersions(true)));

      await installer.install(() => undefined, new AbortController().signal);

      const root = directory.resolve("home", "packages", "standalone");
      Assert.areEqual("0.163.0-x86_64-unknown-linux-musl,0.164.0-x86_64-unknown-linux-musl", readdirSync(join(root, "releases")).sort().join(","));
      Assert.areEqual(realpathSync(join(root, "releases", "0.164.0-x86_64-unknown-linux-musl")), realpathSync(join(root, "current")));
      Assert.areEqual("0.164.0 0.164.0", CodexInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public junctionsTheCurrentReleaseAndTheCommandsFolderOnWindowsAndRetargetsThemOnAnUpdate(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/old", "0.163.0", "win32");
      CodexInstallerTests.publish(server, "/new", "0.164.0", "win32");
      const root = directory.resolve("home", "packages", "standalone");

      await CodexInstallerTests.installer([server.url("/old")], directory, "win32").install(() => undefined, new AbortController().signal);
      const installer = CodexInstallerTests.installer([server.url("/new")], directory, "win32");
      await installer.install(() => undefined, new AbortController().signal);

      const release = join(root, "releases", "0.164.0-x86_64-pc-windows-msvc");
      Assert.isTrue(Resources.codexWindowsMembers.every(t => existsSync(join(release, t))));
      Assert.isTrue(lstatSync(join(root, "current")).isSymbolicLink());
      Assert.isTrue(lstatSync(directory.resolve("bin")).isSymbolicLink());
      Assert.areEqual(realpathSync(release), realpathSync(join(root, "current")));
      Assert.areEqual(realpathSync(join(release, "bin")), realpathSync(directory.resolve("bin")));
      Assert.areEqual("0.164.0-x86_64-pc-windows-msvc", readFileSync(join(root, "auto-update-version"), "utf8"));
      Assert.areEqual("0.164.0 0.164.0", CodexInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public replacesAnEmptyCommandsFolderButNotOneWithFilesOrAFile(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "win32");
      mkdirSync(directory.resolve("empty", "bin"), { recursive: true });
      mkdirSync(directory.resolve("full", "bin"), { recursive: true });
      writeFileSync(directory.resolve("full", "bin", "codex.exe"), "older");
      mkdirSync(directory.resolve("file"));
      writeFileSync(directory.resolve("file", "bin"), "");

      await CodexInstallerTests.installer([server.url("/c")], directory, "win32", undefined, undefined, undefined, directory.resolve("empty", "bin"))
        .install(() => undefined, new AbortController().signal);
      for (const folder of ["full", "file"]) {
        const bin = directory.resolve(folder, "bin");
        const installer = CodexInstallerTests.installer([server.url("/c")], directory, "win32", undefined, undefined, undefined, bin);
        Assert.areEqual(Resources.formatCodexNotReplaced(bin), (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), InstallFailedException)).message);
      }

      Assert.isTrue(lstatSync(directory.resolve("empty", "bin")).isSymbolicLink());
      Assert.areEqual("older", readFileSync(directory.resolve("full", "bin", "codex.exe"), "utf8"));
      Assert.areEqual("Codex wasn't switched to the new version, because /bin is a file or a folder with files in it, not a link Codex's installer made.",
        Resources.formatCodexNotReplaced("/bin"));
    });
  }

  @TestMethod
  public replacesAReleaseOfTheVersionMissingFilesByMovingItAsideFirst(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const releases = directory.resolve("home", "packages", "standalone", "releases");
      const release = CodexInstallerTests.broken(releases);
      const installer = CodexInstallerTests.installer([server.url("/c")], directory);

      await installer.install(() => undefined, new AbortController().signal);

      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readdirSync(releases).join(","));
      Assert.isTrue(Resources.codexPosixMembers.concat(Resources.codexLinuxMembers).every(t => existsSync(join(release, t))));
      Assert.areEqual("0.164.0 0.164.0", CodexInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public keepsAReleaseMissingFilesWholeAndSaysWhyWhenItCantBeMovedAside(): Promise<void> {
    if (process.getuid?.() === 0)
      return Promise.resolve();
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const root = directory.resolve("home", "packages", "standalone");
      const release = CodexInstallerTests.broken(join(root, "releases"));
      const installer = CodexInstallerTests.installer([server.url("/c")], directory);
      const holder = process.platform === "win32" ? spawn(process.execPath, ["-e", CodexInstallerTests.SLEEP], { cwd: release, stdio: "ignore" }) : null;
      if (Object.isNull(holder))
        chmodSync(release, 0o555);
      else
        await once(holder, "spawn");
      let failure: Error;
      try {
        failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);
      }
      finally {
        if (Object.isNull(holder))
          chmodSync(release, 0o755);
        else {
          holder.kill();
          await once(holder, "exit");
        }
      }

      const code = String((failure.cause as NodeJS.ErrnoException).code);
      Assert.areEqual(Resources.formatCodexReleaseKept("0.164.0", release, code), failure.message);
      Assert.isTrue(["EACCES", "EBUSY", "EPERM"].includes(code), code);
      Assert.areEqual("half,bin", `${readFileSync(join(release, "bin", "codex"), "utf8")},${readdirSync(release).join(",")}`);
      Assert.areEqual("releases", readdirSync(root).join(","));
      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readdirSync(join(root, "releases")).join(","));
      Assert.areEqual(`Codex 0.164.0 in ${release} is missing some of its files, and TeamRun couldn't move it aside to replace it (EBUSY), so it was kept as it was. `
        + "Close what runs Codex from it and install again.", Resources.formatCodexReleaseKept("0.164.0", release, "EBUSY"));
    });
  }

  @TestMethod
  public movesTheReleaseMissingFilesBackAndKeepsItWholeWhenTheNewOneCantBeRenamedIn(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const root = directory.resolve("home", "packages", "standalone");
      const release = CodexInstallerTests.broken(join(root, "releases"));
      const refused = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      const installer = CodexInstallerTests.installer([server.url("/c")], directory, "linux", undefined, undefined, undefined, undefined, undefined, undefined,
        undefined, (from, to) => {
          if (to === release && basename(from) === basename(release))
            throw refused;
          renameSync(from, to);
        });

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(refused, failure.cause);
      Assert.areEqual("half,bin", `${readFileSync(join(release, "bin", "codex"), "utf8")},${readdirSync(release).join(",")}`);
      Assert.areEqual("releases", readdirSync(root).join(","));
      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readdirSync(join(root, "releases")).join(","));
      Assert.areEqual(`Codex 0.164.0 in ${release} is missing some of its files, and TeamRun couldn't put the new download in its place (EPERM), so the old one was kept as it was. `
        + "Close what runs Codex from it and install again.", failure.message);
    });
  }

  @TestMethod
  public keepsTheReleaseMissingFilesInTheStagingFolderAndNamesItWhenNeitherRenameWorksUntilAnInstallSucceeds(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const releases = directory.resolve("home", "packages", "standalone", "releases");
      const release = CodexInstallerTests.broken(releases);
      const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
      const denied = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      const refusing = (from: string, to: string): void => {
        if (to === release)
          throw basename(from) === "previous" ? denied : busy;
        renameSync(from, to);
      };

      const failure = await Assert.throwsAsync(() => CodexInstallerTests.installer([server.url("/c")], directory, "linux", undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, refusing).install(() => undefined, new AbortController().signal), Error);
      const [staging] = readdirSync(releases);
      Assert.isDefined(staging);
      const aside = join(releases, staging, "previous");
      const again = await Assert.throwsAsync(() => CodexInstallerTests.installer([server.url("/c")], directory, "linux", undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, refusing).install(() => undefined, new AbortController().signal), Error);
      const afterAgain = readdirSync(releases).join(",");
      const keptAgain = readFileSync(join(aside, "bin", "codex"), "utf8");
      await CodexInstallerTests.installer([server.url("/c")], directory).install(() => undefined, new AbortController().signal);

      Assert.isTrue(staging.startsWith(".teamrun-staging-"), staging);
      Assert.areEqual(Resources.formatCodexReleaseSetAside("0.164.0", release, aside, "EBUSY", "EPERM"), failure.message);
      Assert.areEqual(denied, failure.cause);
      Assert.areEqual(busy, again);
      Assert.areEqual(staging, afterAgain);
      Assert.areEqual("half", keptAgain);
      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readdirSync(releases).join(","));
      Assert.areEqual("Codex 0.164.0 in /r/0.164.0 is missing some of its files, and TeamRun couldn't put the new download in its place (EBUSY), "
        + "nor move the old one back (EPERM). It is kept in /r/s/previous until Codex installs: move it back to /r/0.164.0, or install Codex again.",
      Resources.formatCodexReleaseSetAside("0.164.0", "/r/0.164.0", "/r/s/previous", "EBUSY", "EPERM"));
    });
  }

  @TestMethod
  public movesTheReleaseMissingFilesBackOnceAMomentsHoldOnItEndsWhenTheNewOneCantTakeItsPlace(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const releases = directory.resolve("home", "packages", "standalone", "releases");
      const release = CodexInstallerTests.broken(releases);
      const busy = Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
      let holds = 1;
      const timer = new RecordedDelayTimer();
      const settle = new InstallRename("win32", (from, to) => {
        if (to === release && holds-- > 0)
          throw busy;
        renameSync(from, to);
      }, timer);

      const failure = await Assert.throwsAsync(() => CodexInstallerTests.installer([server.url("/c")], directory, "linux", undefined, undefined, undefined, undefined,
        undefined, undefined, undefined, (from, to) => {
          if (to === release)
            throw busy;
          renameSync(from, to);
        }, settle.moveAsync.bind(settle)).install(() => undefined, new AbortController().signal), Error);

      Assert.areEqual(Resources.formatCodexReleaseNotReplaced("0.164.0", release, "EBUSY"), failure.message);
      Assert.areEqual(busy, failure.cause);
      Assert.areEqual("half,bin", `${readFileSync(join(release, "bin", "codex"), "utf8")},${readdirSync(release).join(",")}`);
      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readdirSync(releases).join(","));
      Assert.areEqual(1, timer.delays.length);
    });
  }

  @TestMethod
  public failsAsItselfWithoutNamingTheStandaloneFolderWhenALeftStagingFolderCantBeRemoved(): Promise<void> {
    if (process.platform === "win32" || process.getuid?.() === 0)
      return Promise.resolve();
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const releases = directory.resolve("home", "packages", "standalone", "releases");
      mkdirSync(join(releases, ".teamrun-staging-left", "bin"), { recursive: true });
      chmodSync(join(releases, ".teamrun-staging-left"), 0o555);
      const installer = CodexInstallerTests.installer([server.url("/c")], directory);
      let failure: NodeJS.ErrnoException;
      try {
        failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);
      }
      finally {
        chmodSync(join(releases, ".teamrun-staging-left"), 0o755);
      }

      Assert.areEqual(process.platform === "darwin" ? "ENOTEMPTY" : "EACCES", failure.code);
      Assert.areNotEqual(Resources.formatCodexFolderNotWritable(directory.resolve("home", "packages", "standalone")), failure.message);
      Assert.areEqual(".teamrun-staging-left", readdirSync(releases).join(","));
      Assert.areEqual(String.empty, CodexInstallerTests.paths(server));
    });
  }

  @TestMethod
  public changesNothingWhenItsStandaloneFolderCantBeWrittenAndNamesTheFolder(): Promise<void> {
    if (process.platform === "win32" || process.getuid?.() === 0)
      return Promise.resolve();
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const packages = directory.resolve("home", "packages");
      mkdirSync(packages, { recursive: true });
      chmodSync(packages, 0o555);
      const installer = CodexInstallerTests.installer([server.url("/c")], directory);
      let failure: Error;
      try {
        failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);
      }
      finally {
        chmodSync(packages, 0o755);
      }

      const root = join(packages, "standalone");
      Assert.areEqual(Resources.formatCodexFolderNotWritable(root), failure.message);
      Assert.areEqual("EACCES", (failure.cause as NodeJS.ErrnoException).code);
      Assert.areEqual(String.empty, readdirSync(packages).join(","));
      Assert.areEqual(String.empty, CodexInstallerTests.paths(server));
      Assert.isFalse(installer.isInstalled);
      Assert.isNull(installer.foundPath);
      Assert.areEqual(`TeamRun can't write to ${root}, where Codex's releases go. Nothing was installed.`, failure.message);
    });
  }

  @TestMethod
  public saysTheReleaseIsInPlaceButItsCommandFolderCantBeWrittenAndNamesTheFolder(): Promise<void> {
    if (process.platform === "win32" || process.getuid?.() === 0)
      return Promise.resolve();
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const bin = directory.resolve("bin");
      mkdirSync(bin, { recursive: true });
      chmodSync(bin, 0o555);
      const installer = CodexInstallerTests.installer([server.url("/c")], directory);
      let failure: Error;
      try {
        failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);
      }
      finally {
        chmodSync(bin, 0o755);
      }

      const root = directory.resolve("home", "packages", "standalone");
      const release = join(root, "releases", "0.164.0-x86_64-unknown-linux-musl");
      Assert.areEqual(Resources.formatCodexCommandNotWritable("0.164.0", root, bin), failure.message);
      Assert.areEqual("EACCES", (failure.cause as NodeJS.ErrnoException).code);
      Assert.areEqual(realpathSync(release), realpathSync(join(root, "current")));
      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readFileSync(join(root, "auto-update-version"), "utf8"));
      Assert.areEqual(String.empty, readdirSync(bin).join(","));
      Assert.areEqual(`Codex 0.164.0 was installed in ${root} and is now its current release, but TeamRun can't write the codex command to ${bin}. `
        + "Make that folder writable and install again.", failure.message);
    });
  }

  @TestMethod
  public saysTheReleaseIsInPlaceButTheCommandCantBeLinkedInItsFolderWhenTheLinkIsRefused(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      const bin = directory.resolve("bin");
      const refused = Object.assign(new Error("EPERM: operation not permitted"), { code: "EPERM" });
      const link = CodexInstallerTests.link;
      const installer = CodexInstallerTests.installer([server.url("/c")], directory, "linux", undefined, undefined, undefined, undefined, undefined, undefined,
        (target, path) => {
          if (dirname(path) === bin)
            throw refused;
          link(target, path);
        });

      const failure = await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error);

      const root = directory.resolve("home", "packages", "standalone");
      Assert.areEqual(Resources.formatCodexCommandNotWritable("0.164.0", root, bin), failure.message);
      Assert.areEqual(refused, failure.cause);
      Assert.areEqual("0.164.0-x86_64-unknown-linux-musl", readFileSync(join(root, "auto-update-version"), "utf8"));
      Assert.isTrue(existsSync(join(root, "current", "bin", "codex")));
      Assert.areEqual(String.empty, readdirSync(bin).join(","));
    });
  }

  @TestMethod
  public reusesACompleteReleaseOfTheVersionWithoutDownloadingItAgain(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "win32");
      const installer = CodexInstallerTests.installer([server.url("/c")], directory, "win32");
      await installer.install(() => undefined, new AbortController().signal);

      await installer.install(() => undefined, new AbortController().signal);

      Assert.areEqual("/c,/packages/0.164.0/codex-package-x86_64-pc-windows-msvc.tar.gz,/c", CodexInstallerTests.paths(server));
      Assert.isTrue(installer.isInstalled);
    });
  }

  @TestMethod
  public readsCodexsGitHubReleasesWhenItsReleaseSiteFails(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      server.serve("/down", Buffer.from("busy"), 503);
      CodexInstallerTests.publish(server, "/github", "0.164.0", "win32");
      const installer = CodexInstallerTests.installer([server.url("/down"), server.url("/github")], directory, "win32");

      await installer.install(() => undefined, new AbortController().signal);

      Assert.isTrue(installer.isInstalled);
      Assert.areEqual("/down,/github,/packages/0.164.0/codex-package-x86_64-pc-windows-msvc.tar.gz", CodexInstallerTests.paths(server));
      Assert.areEqual("0.164.0 0.164.0", CodexInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public installsNothingWhenNoReleaseCanBeReadOrItsPackageFailsItsCheck(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      const archive = CodexInstallerTests.package("0.164.0", "linux");
      const digest = `sha256:${createHash("sha256").update(archive).digest("hex")}`;
      const name = "codex-package-x86_64-unknown-linux-musl.tar.gz";
      const release = (assets: unknown, tag: unknown = "rust-v0.164.0"): Buffer => Buffer.from(JSON.stringify({ tag_name: tag, assets }));
      const asset = (fields: Record<string, unknown>): unknown => ({ name, digest, browser_download_url: server.url("/archive"), ...fields });
      server.serve("/busy", Buffer.from("busy"), 503).serve("/archive", archive).serve("/wrong", Buffer.from("other")).cut("/cut-archive", archive);
      const bodies: readonly [string, Buffer][] = [["/not-json", Buffer.from("{")], ["/null", Buffer.from("null")], ["/no-tag", release([], 164)],
        ["/other-tag", release([], "v0.164.0")], ["/bad-version", release([], "rust-vlatest")], ["/no-assets", release({})],
        ["/no-package", release([null, asset({ name: "codex-package_SHA256SUMS" })])], ["/no-digest", release([asset({ digest: 7 })])],
        ["/bare-digest", release([asset({ digest: digest.slice(7) })])], ["/short-digest", release([asset({ digest: "sha256:abc" })])],
        ["/no-url", release([asset({ browser_download_url: null })])], ["/mismatch", release([asset({ browser_download_url: server.url("/wrong") })])],
        ["/missing", release([asset({ browser_download_url: server.url("/gone") })])], ["/oversize", release([asset({ size: archive.length - 1 })])],
        ["/cut", release([asset({ browser_download_url: server.url("/cut-archive") })])]];
      for (const [path, body] of bodies)
        server.serve(path, body);
      const cases: readonly [readonly string[], string][] = [
        [["/gone", "/busy"], Resources.formatReleaseChannelFailed("Codex", 404)],
        [["/not-json"], Resources.formatReleaseChannelUnreadable("Codex")],
        [["/null"], Resources.formatReleaseChannelUnreadable("Codex")],
        [["/no-tag"], Resources.formatReleaseChannelUnreadable("Codex")],
        [["/other-tag"], Resources.formatReleaseChannelUnreadable("Codex")],
        [["/bad-version"], Resources.formatReleaseChannelUnreadable("Codex")],
        ...["/no-assets", "/no-package", "/no-digest", "/bare-digest", "/short-digest", "/no-url"].map((t): [readonly string[], string] => [[t], Resources.formatCodexPackageMissing("0.164.0")]),
        [["/mismatch"], Resources.formatDownloadMismatch("Codex")],
        [["/missing"], Resources.formatDownloadFailed("Codex", 404)],
        [["/oversize"], Resources.formatDownloadMismatch("Codex")],
        [["http://localhost:1/c", "/busy"], Resources.formatReleasesUnreachable("Codex")],
        [["/cut"], Resources.formatReleasesUnreachable("Codex")]
      ];

      for (const [channels, message] of cases) {
        const installer = CodexInstallerTests.installer(channels.map(t => t.startsWith("http") ? t : server.url(t)), directory);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, channels[0]);
        Assert.isFalse(installer.isInstalled, channels[0]);
        Assert.areEqual(String.empty, readdirSync(directory.resolve("home", "packages", "standalone", "releases")).join(","), channels[0]);
      }
      Assert.areEqual("Codex 0.164.0 lists no package for this computer with its SHA-256. Nothing was installed.", Resources.formatCodexPackageMissing("0.164.0"));
    });
  }

  @TestMethod
  public saysWhyTarFailedDidntFinishOrLeftAReleaseThatIsIncomplete(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      const sleepingTar = new LocatedExecutable(process.execPath, ExecutableSource.Path, ["-e", CodexInstallerTests.SLEEP, "--"]);
      const incomplete = JSON.parse(CodexInstallerTests.package("0.164.0", "linux").toString("utf8")) as Record<string, string>;
      delete incomplete["codex-resources/bwrap"];
      const cases: readonly [string, Buffer, LocatedExecutable | null, number, string][] = [
        ["/broken", Buffer.from("not an archive"), null, 60_000, Resources.formatCodexUnpackFailed(9)],
        ["/hangs", CodexInstallerTests.package("0.164.0", "linux"), sleepingTar, 200, Resources.formatCodexUnpackFailed(null)],
        ["/incomplete", FakeTar.archive(incomplete), null, 60_000, Resources.formatCodexIncomplete("0.164.0")],
        ["/other-version", CodexInstallerTests.package("0.164.0", "linux", "codex-cli 0.150.0"), null, 60_000, Resources.formatCodexIncomplete("0.164.0")]
      ];

      for (const [channel, archive, extractor, timeout, message] of cases) {
        CodexInstallerTests.publish(server, channel, "0.164.0", "linux", archive);
        const installer = CodexInstallerTests.installer([server.url(channel)], directory.resolve(channel.slice(1)), "linux", extractor ?? undefined, timeout);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, channel);
        Assert.isFalse(installer.isInstalled, channel);
        Assert.isFalse(existsSync(join(directory.resolve(channel.slice(1)), "home", "packages", "standalone", "current")), channel);
      }
      Assert.areEqual("Unpacking the Codex download was stopped. Nothing was installed.", Resources.formatCodexUnpackFailed(null));
      Assert.areEqual("Unpacking the Codex download failed with exit code 9. Nothing was installed.", Resources.formatCodexUnpackFailed(9));
      Assert.areEqual("The Codex 0.164.0 package is missing some of its files, or its codex doesn't report 0.164.0. Nothing was installed.",
        Resources.formatCodexIncomplete("0.164.0"));
    });
  }

  @TestMethod
  public saysWhenTheCodexItFindsAfterwardsIsAnotherOneOrNone(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "win32");
      const other = directory.resolve("other.cjs");
      writeFileSync(other, "console.log(\"codex-cli 0.150.0\");");
      const silent = directory.resolve("silent.cjs");
      writeFileSync(silent, "");
      const bin = directory.resolve("bin");
      const cases: readonly [string, (() => LocatedExecutable | null), string][] = [
        ["other", () => new LocatedExecutable(process.execPath, ExecutableSource.Path, [other]), Resources.formatCodexShadowed("0.164.0", bin, process.execPath, "0.150.0")],
        ["silent", () => new LocatedExecutable(process.execPath, ExecutableSource.Path, [silent]), Resources.formatCodexShadowed("0.164.0", bin, process.execPath, null)],
        ["none", () => null, Resources.formatCodexNotFoundAfterInstall(bin)]
      ];

      for (const [name, locate, message] of cases) {
        const installer = CodexInstallerTests.installer([server.url("/c")], directory, "win32", undefined, undefined, undefined, undefined, locate);
        Assert.areEqual(message, (await Assert.throwsAsync(() => installer.install(() => undefined, new AbortController().signal), Error)).message, name);
      }
      Assert.areEqual(`Codex 0.164.0 was installed in ${bin}, but TeamRun runs /usr/bin/codex, Codex 0.150.0, which comes first on the PATH. Remove that one, or put ${bin} first on the PATH, then restart TeamRun.`,
        Resources.formatCodexShadowed("0.164.0", bin, "/usr/bin/codex", "0.150.0"));
      Assert.areEqual(`Codex 0.164.0 was installed in ${bin}, but TeamRun runs /usr/bin/codex which comes first on the PATH. Remove that one, or put ${bin} first on the PATH, then restart TeamRun.`,
        Resources.formatCodexShadowed("0.164.0", bin, "/usr/bin/codex", null));
      Assert.areEqual(`Codex was installed in ${bin}, but TeamRun can't find it there. Restart TeamRun, then install it again.`, Resources.formatCodexNotFoundAfterInstall(bin));
    });
  }

  @TestMethod
  public stopsWhileItReadsDownloadsOrUnpacksButFinishesTheSwitchOnceTheReleaseIsInPlace(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "win32");
      const early = new AbortController();
      early.abort();
      const during = new AbortController();
      const unpacking = new AbortController();
      const started = directory.resolve("tar-started");
      const sleepingTar = new LocatedExecutable(process.execPath, ExecutableSource.Path,
        ["-e", `require("node:fs").writeFileSync(${JSON.stringify(started)}, "");${CodexInstallerTests.SLEEP}`, "--"]);
      const cases: readonly [string, AbortController, CodexInstaller, () => void][] = [
        ["before", early, CodexInstallerTests.installer([server.url("/c")], directory.resolve("before"), "win32"), () => undefined],
        ["during the download", during, CodexInstallerTests.installer([server.url("/c")], directory.resolve("during"), "win32"), () => during.abort()],
        ["while unpacking", unpacking, CodexInstallerTests.installer([server.url("/c")], directory.resolve("unpacking"), "win32", sleepingTar), () => {
          void Wait.until(() => existsSync(started), "The installer did not start.").then(() => unpacking.abort());
        }]
      ];

      for (const [step, controller, installer, progress] of cases) {
        Assert.areEqual(Resources.formatInstallCancelled("Codex"), (await Assert.throwsAsync(() => installer.install(progress, controller.signal), InstallCancelledException)).message, step);
        Assert.isFalse(installer.isInstalled, step);
      }
      const switching = new AbortController();
      const steps: string[] = [];
      const finishing = CodexInstallerTests.installer([server.url("/c")], directory.resolve("finishing"), "win32", undefined, undefined, path => {
        steps.push("version");
        switching.abort();
        return new ProcessCommand(process.execPath, [path]);
      });

      Assert.areEqual(process.execPath, await finishing.install(() => undefined, switching.signal, () => steps.push("commit")));
      Assert.isTrue(finishing.isInstalled);
      Assert.areEqual("commit,version", steps.join(","));
      const failing = new AbortController();
      const failed = CodexInstallerTests.installer([server.url("/c")], directory.resolve("failing"), "win32", undefined, undefined, () => {
        failing.abort();
        return new ProcessCommand(process.execPath, ["-e", "console.log('codex-cli 0.150.0')"]);
      });
      Assert.areEqual(Resources.formatCodexIncomplete("0.164.0"), (await Assert.throwsAsync(() => failed.install(() => undefined, failing.signal), InstallFailedException)).message);
    });
  }

  @TestMethod
  public saysWhyAComputerWithNoPackageOrNoTarCantInstallAndReadsNoVersionWithoutAPackage(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      const noPackage = CodexInstallerTests.installer([server.url("/c")], directory, "linux", undefined, undefined, undefined, undefined, undefined, null);
      const noTar = CodexInstallerTests.installer([server.url("/c")], directory, "linux", null);

      Assert.areEqual(Resources.codexNoBuild, noPackage.unavailable);
      Assert.areEqual(Resources.codexNoTar, noTar.unavailable);
      Assert.isNull(noPackage.missingTool);
      Assert.areEqual("tar", noTar.missingTool);
      Assert.areEqual(Resources.codexNoBuild, (await Assert.throwsAsync(() => noPackage.install(() => undefined, new AbortController().signal), InstallFailedException)).message);
      Assert.areEqual(Resources.codexNoTar, (await Assert.throwsAsync(() => noTar.install(() => undefined, new AbortController().signal), Error)).message);
      Assert.areEqual("null null", CodexInstallerTests.versions(await noPackage.readVersions(true)));
      Assert.areEqual(0, server.requests.length);
    });
  }

  @TestMethod
  public readsNoLatestVersionWhenNoReleaseCanBeRead(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      server.serve("/down", Buffer.from("busy"), 503);
      CodexInstallerTests.installedElsewhere(directory, "0.163.0");
      mkdirSync(directory.resolve("home", "packages", "standalone", "current"), { recursive: true });

      Assert.areEqual("0.163.0 null", CodexInstallerTests.versions(await CodexInstallerTests.installer([server.url("/down")], directory).readVersions(true)));
      Assert.areEqual("0.163.0 null", CodexInstallerTests.versions(await CodexInstallerTests.installer(["http://localhost:1/c"], directory).readVersions(true)));
      Assert.areEqual("/down", CodexInstallerTests.paths(server));
    });
  }

  @TestMethod
  public offersTheLatestReleaseToAStandaloneCodexThatCantTellItsVersion(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      CodexInstallerTests.installedElsewhere(directory, "0.163.0");
      writeFileSync(directory.resolve("bin", "codex"), "process.exit(1);\n");
      mkdirSync(directory.resolve("home", "packages", "standalone", "current"), { recursive: true });

      const versions = await CodexInstallerTests.installer([server.url("/c")], directory).readVersions(true);

      Assert.areEqual("null 0.164.0", CodexInstallerTests.versions(versions));
      Assert.areEqual("0.164.0", versions.update);
    });
  }

  @TestMethod
  public offersNoUpdateForACodexInstalledAnotherWayAndReadsNoReleaseForIt(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      CodexInstallerTests.installedElsewhere(directory, "0.163.0");
      const installer = CodexInstallerTests.installer([server.url("/c")], directory);

      Assert.isTrue(installer.isInstalled);
      Assert.areEqual(process.execPath, installer.foundPath);
      Assert.areEqual("0.163.0 null", CodexInstallerTests.versions(await installer.readVersions(true)));
      Assert.areEqual(0, server.requests.length);
      mkdirSync(directory.resolve("home", "packages", "standalone", "current"), { recursive: true });
      Assert.isNull(installer.foundPath);
      Assert.areEqual("0.163.0 0.164.0", CodexInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public readsNoReleaseWhenTheLatestIsntChecked(): Promise<void> {
    return CodexInstallerTests.withReleases(async (server, directory) => {
      CodexInstallerTests.publish(server, "/c", "0.164.0", "linux");
      CodexInstallerTests.installedElsewhere(directory, "0.163.0");
      mkdirSync(directory.resolve("home", "packages", "standalone", "current"), { recursive: true });
      const installer = CodexInstallerTests.installer([server.url("/c")], directory);

      Assert.areEqual("0.163.0 null", CodexInstallerTests.versions(await installer.readVersions(false)));
      Assert.areEqual(0, server.requests.length);
      Assert.areEqual("0.163.0 0.164.0", CodexInstallerTests.versions(await installer.readVersions(true)));
    });
  }

  @TestMethod
  public runsAReleasesProgramByItsPathWithNoArguments(): void {
    const command = CodexInstaller.programOf("/r/bin/codex");

    Assert.areEqual("/r/bin/codex", command.executable);
    Assert.areEqual(0, command.arguments.length);
  }

  @TestMethod
  public namesThePackageTargetForEachSupportedComputer(): void {
    const cases: readonly [string, string, string | null][] = [
      ["darwin", "arm64", "aarch64-apple-darwin"], ["darwin", "x64", "x86_64-apple-darwin"], ["linux", "x64", "x86_64-unknown-linux-musl"],
      ["linux", "arm64", "aarch64-unknown-linux-musl"], ["win32", "x64", "x86_64-pc-windows-msvc"], ["win32", "arm64", "aarch64-pc-windows-msvc"],
      ["win32", "ia32", null], ["freebsd", "x64", null]
    ];

    for (const [platform, architecture, target] of cases)
      Assert.areEqual(target, CodexInstaller.targetOf(platform, architecture), `${platform} ${architecture}`);
  }

  private static async withReleases(test: (server: LocalHttpServer, directory: TemporaryDirectory) => Promise<void>): Promise<void> {
    using directory = new TemporaryDirectory();
    await using server = await LocalHttpServer.start();
    await test(server, directory);
  }

  private static publish(server: LocalHttpServer, path: string, version: string, platform: string,
    archive: Buffer = CodexInstallerTests.package(version, platform), size: number = archive.length): Buffer {
    const name = `codex-package-${CodexInstallerTests.TARGETS[platform]}.tar.gz`;
    const digest = `sha256:${createHash("sha256").update(archive).digest("hex")}`;
    const other = { name: "codex-package_SHA256SUMS", digest: `sha256:${"0".repeat(64)}`, browser_download_url: server.url("/sums") };
    server.serve(path, Buffer.from(JSON.stringify({ tag_name: `rust-v${version}`,
      assets: [other, { name, digest, size, browser_download_url: server.url(`/packages/${version}/${name}`) }] })))
      .serve(`/packages/${version}/${name}`, archive, 200, false);
    return archive;
  }

  private static package(version: string, platform: string, output: string = `codex-cli ${version}`): Buffer {
    const members = platform === "win32" ? Resources.codexWindowsMembers
      : [...Resources.codexPosixMembers.filter(t => t !== "codex"), ...platform === "linux" ? Resources.codexLinuxMembers : []];
    const program = platform === "win32" ? "bin/codex.exe" : "bin/codex";
    return FakeTar.archive(Object.fromEntries(members.map(t => [t, t === program ? `console.log(${JSON.stringify(output)});\n` : String.empty])));
  }

  private static installer(channels: readonly string[], directory: TemporaryDirectory | string, platform: string = "linux",
    extractor: LocatedExecutable | null | undefined = undefined, unpackTimeout: number = 60_000,
    program: (path: string) => ProcessCommand = path => new ProcessCommand(process.execPath, [path]), bin: string | undefined = undefined,
    locate: (() => LocatedExecutable | null) | undefined = undefined, target: string | null = CodexInstallerTests.TARGETS[platform]!,
    symlink: (target: string, path: string) => void = CodexInstallerTests.link, rename: (from: string, to: string) => void = renameSync,
    settle: (from: string, to: string) => Promise<void> = async (from, to) => rename(from, to)): CodexInstaller {
    const root = typeof directory === "string" ? directory : directory.path;
    mkdirSync(root, { recursive: true });
    const runner = new CommandRunner(new NodeProcessStarter(new ProcessTerminator(process.platform)));
    const binDirectory = bin ?? join(root, "bin");
    const visible = join(binDirectory, platform === "win32" ? "codex.exe" : "codex");
    const found = (): LocatedExecutable | null => existsSync(visible) ? new LocatedExecutable(process.execPath, ExecutableSource.Path, [visible]) : null;
    return new CodexInstaller(locate ?? found, new ExecutableVersionReader(runner, 60_000), process.env, channels, join(root, "home"), binDirectory, target, platform,
      Object.isUndefined(extractor) ? FakeTar.create(root) : extractor, runner, program,
      symlink, rename, settle, unpackTimeout, 60_000);
  }

  private static broken(releases: string): string {
    const release = join(releases, "0.164.0-x86_64-unknown-linux-musl");
    mkdirSync(join(release, "bin"), { recursive: true });
    writeFileSync(join(release, "bin", "codex"), "half");
    return release;
  }

  private static installedElsewhere(directory: TemporaryDirectory, version: string): void {
    mkdirSync(directory.resolve("bin"), { recursive: true });
    writeFileSync(directory.resolve("bin", "codex"), `console.log(${JSON.stringify(`codex-cli ${version}`)});\n`);
  }

  private static link(target: string, path: string): void {
    if (process.platform === "win32")
      CodexInstallerTests.copyLink(target, path);
    else
      symlinkSync(target, path);
  }

  private static copyLink(target: string, path: string): void {
    const source = resolve(dirname(path), target);
    if (statSync(source).isDirectory())
      symlinkSync(source, path, "junction");
    else
      copyFileSync(source, path);
  }

  private static paths(server: LocalHttpServer): string {
    return server.requests.map(t => t.split(" ")[0]).join(",");
  }

  private static versions(versions: ProviderKindVersions): string {
    return `${versions.installed} ${versions.latest}`;
  }
}
