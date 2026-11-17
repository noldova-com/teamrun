/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmodSync, existsSync, linkSync, mkdirSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, join } from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ExecutableLocator, ExecutableSource } from "@noldova/teamrun.providers";

import { TemporaryDirectory } from "../../fixtures/temporary-directory.fixture.js";

@TestClass
export class ExecutableLocatorTests {
  @TestMethod
  public locatesTheNativeGrokExecutableAndHonoursOverrides(): void {
    using directory = new TemporaryDirectory();
    const local = ExecutableLocatorTests.touch(directory.path, ".grok", "bin", "grok.exe");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "grok");
    const windows = new ExecutableLocator("win32", "x64", [], directory.path);
    Assert.areEqual(local, windows.locateGrok(null)?.path);
    Assert.areEqual(ExecutableSource.Override, windows.locateGrok(local)?.source);
    Assert.isNull(windows.locateGrok(directory.resolve("missing")));
    Assert.areEqual(onPath, new ExecutableLocator("linux", "arm64", [directory.resolve("bin")], directory.path).locateGrok(null)?.path);
    Assert.isNull(new ExecutableLocator("linux", "x64", [], directory.path).locateGrok(null));
  }

  @TestMethod
  public locatesOpencodeOnThePathThenItsOwnInstallAndOnWindowsTheNativeBinaryBehindNpmsShim(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const own = ExecutableLocatorTests.touch(home, ".opencode", "bin", "opencode");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "opencode");
    const npm = directory.resolve("npm");
    ExecutableLocatorTests.touch(npm, "opencode.cmd");
    const hoisted = ExecutableLocatorTests.touch(npm, "node_modules", "opencode-windows-x64-baseline", "bin", "opencode.exe");
    const nested = ExecutableLocatorTests.touch(npm, "node_modules", "opencode-ai", "node_modules", "opencode-windows-arm64", "bin", "opencode.exe");
    const ownWindows = ExecutableLocatorTests.touch(home, ".opencode", "bin", "opencode.exe");
    const nativeOnPath = ExecutableLocatorTests.touch(directory.resolve("scoop"), "opencode.exe");

    const found = (platform: string, architecture: string, path: readonly string[]): string =>
      `${new ExecutableLocator(platform, architecture, path, home).locateOpencode(null)?.path ?? null}:${new ExecutableLocator(platform, architecture, path, home)
        .locateOpencode(null)?.source ?? null}`;

    Assert.areEqual(`${onPath}:${ExecutableSource.Path}`, found("darwin", "arm64", [directory.resolve("bin")]));
    Assert.areEqual(`${own}:${ExecutableSource.LocalBin}`, found("linux", "x64", [npm]));
    Assert.areEqual(`${nativeOnPath}:${ExecutableSource.Path}`, found("win32", "x64", [directory.resolve("scoop"), npm]));
    Assert.areEqual(`${hoisted}:${ExecutableSource.GlobalNpm}`, found("win32", "x64", [npm]));
    Assert.areEqual(`${nested}:${ExecutableSource.GlobalNpm}`, found("win32", "arm64", [npm]));
    Assert.areEqual(`${ownWindows}:${ExecutableSource.LocalBin}`, found("win32", "x64", []));
    Assert.areEqual(ExecutableSource.Override, new ExecutableLocator("linux", "x64", [], home).locateOpencode(onPath)?.source);
    Assert.isNull(new ExecutableLocator("linux", "x64", [], directory.resolve("nobody")).locateOpencode(null));
  }

  @TestMethod
  public runsTheMuseLauncherOnMacOsAndLinuxAndOnWindowsTheBinaryTheVersionFileNamesInTheInstallFolderBesideTheShimOrInTheInstallersFolder(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const local = directory.resolve("appdata");
    const installed = (folder: string, name: string): string => {
      ExecutableLocatorTests.touch(folder, ".muse-version");
      writeFileSync(join(folder, ".muse-version"), "1.4.14-R5\n");
      return ExecutableLocatorTests.touch(folder, name);
    };
    const usual = installed(join(home, ".local", "bin"), "muse-bin-1.4.14-R5");
    const usualWindows = installed(join(local, "Programs", "muse"), "muse-bin-1.4.14-R5.exe");
    const named = installed(directory.resolve("named"), "muse-bin-1.4.14-R5");
    installed(directory.resolve("bin"), "muse-bin-1.4.14-R5");
    const launcher = ExecutableLocatorTests.touch(directory.resolve("bin"), "muse");
    const besideWindows = installed(directory.resolve("cmd"), "muse-bin-1.4.14-R5.exe");
    ExecutableLocatorTests.touch(directory.resolve("cmd"), "muse.cmd");
    const found = (platform: string, path: readonly string[], installDirectory: string | null = null): string => {
      const located = new ExecutableLocator(platform, "x64", path, home, local).locateMuse(null, installDirectory);
      return `${located?.path ?? null}:${located?.source ?? null}`;
    };

    Assert.areEqual(`${usual}:${ExecutableSource.LocalBin}`, found("linux", []));
    Assert.areEqual(`${usualWindows}:${ExecutableSource.LocalBin}`, found("win32", []));
    Assert.areEqual(`${launcher}:${ExecutableSource.Path}`, found("darwin", [directory.resolve("bin")]));
    Assert.areEqual(`${launcher}:${ExecutableSource.Path}`, found("linux", [directory.resolve("bin")], directory.resolve("named")));
    Assert.areEqual(`${besideWindows}:${ExecutableSource.LocalBin}`, found("win32", [directory.resolve("cmd")]));
    Assert.areEqual(`${named}:${ExecutableSource.LocalBin}`, found("linux", [], directory.resolve("named")));
  }

  @TestMethod
  public readsTheMuseVersionFileAgainOnWindowsOnceAnUpdateReplacedTheBinary(): void {
    using directory = new TemporaryDirectory();
    const folder = directory.resolve("muse");
    const locator = new ExecutableLocator("win32", "x64", [], directory.resolve("home"), directory.resolve("appdata"));
    ExecutableLocatorTests.touch(folder, "muse-bin-1.4.14-R5.exe");
    writeFileSync(join(folder, ".muse-version"), "1.4.14-R5");
    const first = locator.locateMuse(null, folder)?.path;

    renameSync(join(folder, "muse-bin-1.4.14-R5.exe"), directory.resolve("gone.exe"));
    writeFileSync(join(folder, ".muse-version"), "1.4.15-R1");
    const missing = locator.locateMuse(null, folder);
    const updated = ExecutableLocatorTests.touch(folder, "muse-bin-1.4.15-R1.exe");

    Assert.areEqual(join(folder, "muse-bin-1.4.14-R5.exe"), first);
    Assert.isNull(missing);
    Assert.areEqual(updated, locator.locateMuse(null, folder)?.path);
  }

  @TestMethod
  public fallsBackToTheMuseLauncherOrAnExeWhenNoVersionFileNamesABinary(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const local = directory.resolve("appdata");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "muse");
    const launcher = ExecutableLocatorTests.touch(home, ".local", "bin", "muse");
    const exe = ExecutableLocatorTests.touch(directory.resolve("scoop"), "muse.exe");
    ExecutableLocatorTests.touch(directory.resolve("cmd"), "muse.cmd");
    ExecutableLocatorTests.touch(directory.resolve("stale"), ".muse-version");
    writeFileSync(directory.resolve("stale", ".muse-version"), "1.4.14-R5");
    mkdirSync(directory.resolve("odd", ".muse-version"), { recursive: true });
    const found = (platform: string, path: readonly string[], who: string = home, installDirectory: string | null = null): string | null =>
      new ExecutableLocator(platform, "x64", path, who, local).locateMuse(null, installDirectory)?.path ?? null;

    Assert.areEqual(onPath, found("linux", [directory.resolve("bin")]));
    Assert.areEqual(launcher, found("linux", []));
    Assert.areEqual(launcher, found("linux", [], home, directory.resolve("stale")));
    Assert.areEqual(launcher, found("linux", [], home, directory.resolve("odd")));
    Assert.areEqual(exe, found("win32", [directory.resolve("scoop")]));
    Assert.isNull(found("win32", [directory.resolve("cmd")]));
    Assert.isNull(found("linux", [], directory.resolve("nobody")));
  }

  @TestMethod
  public followsAMuseOverrideOnlyWhenItExists(): void {
    using directory = new TemporaryDirectory();
    const override = ExecutableLocatorTests.touch(directory.resolve("own"), "muse");
    const locator = new ExecutableLocator("linux", "x64", [], directory.path);

    Assert.areEqual(`${override}:${ExecutableSource.Override}`, `${locator.locateMuse(override)?.path}:${locator.locateMuse(override)?.source}`);
    Assert.isNull(locator.locateMuse(directory.resolve("missing")));
  }

  @TestMethod
  public locatesFxOnThePathThenInItsInstallFolderThenInLocalBinAsFxExeOnWindows(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const own = ExecutableLocatorTests.touch(home, ".local", "bin", "fx");
    const chosen = ExecutableLocatorTests.touch(directory.resolve("tools"), "fx");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "fx");

    const found = (platform: string, path: readonly string[], installDirectory: string | null = null): string => {
      const located = new ExecutableLocator(platform, "x64", path, home).locateFx(null, installDirectory);
      return `${located?.path ?? null}:${located?.source ?? null}`;
    };

    Assert.areEqual(`${onPath}:${ExecutableSource.Path}`, found("darwin", [directory.resolve("bin")], directory.resolve("tools")));
    Assert.areEqual(`${chosen}:${ExecutableSource.LocalBin}`, found("linux", [], directory.resolve("tools")));
    Assert.areEqual(`${own}:${ExecutableSource.LocalBin}`, found("linux", [], " "));
    Assert.areEqual(`${own}:${ExecutableSource.LocalBin}`, found("linux", [], directory.resolve("empty")));
    Assert.areEqual("null:null", found("win32", [directory.resolve("bin")], directory.resolve("tools")));
    const windows = ExecutableLocatorTests.touch(directory.resolve("bin"), "fx.exe");
    Assert.areEqual(`${windows}:${ExecutableSource.Path}`, found("win32", [directory.resolve("bin")], directory.resolve("tools")));
    Assert.areEqual(ExecutableSource.Override, new ExecutableLocator("win32", "x64", [], home).locateFx(onPath)?.source);
    Assert.isNull(new ExecutableLocator("linux", "x64", [], directory.resolve("nobody")).locateFx(null));
  }

  @TestMethod
  public locatesCursorOnThePathThenInItsOwnInstallFolder(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const own = ExecutableLocatorTests.touch(home, ".local", "bin", "cursor-agent");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "cursor-agent");

    const found = (platform: string, path: readonly string[]): string => {
      const located = new ExecutableLocator(platform, "x64", path, home).locateCursor(null);
      return `${located?.path ?? null}:${located?.source ?? null}`;
    };

    Assert.areEqual(`${onPath}:${ExecutableSource.Path}`, found("darwin", [directory.resolve("bin")]));
    Assert.areEqual(`${own}:${ExecutableSource.LocalBin}`, found("linux", []));
    Assert.areEqual(ExecutableSource.Override, new ExecutableLocator("linux", "x64", [], home).locateCursor(onPath)?.source);
    Assert.isNull(new ExecutableLocator("linux", "x64", [], directory.resolve("nobody")).locateCursor(null));
  }

  @TestMethod
  public startsTheNodeBehindCursorsWindowsLauncherBesideItOrInItsNewestVersionFolder(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const installed = join(home, "AppData", "Local", "cursor-agent");
    const versions = join(installed, "versions");
    for (const name of ["cursor-agent.cmd", "cursor-agent.ps1", "CURSOR-AGENT.CMD"])
      ExecutableLocatorTests.touch(installed, name);
    for (const version of ["2026.9.30-0a1b2c3", "2026.10.4-4d5e6f7", "2026.10.22-27dcf5f", "2026.10.22-0a0a0a0", "2026.10.22-09-15-00-fafafaf",
      "2026.10.22-18-40-00-0c0c0c0", "2026.10.22-not-a-version"])
      for (const name of ["cursor-agent.cmd", "cursor-agent.ps1", "node.exe", "index.js"])
        ExecutableLocatorTests.touch(versions, version, name);
    const unpacked = directory.resolve("unpacked", "dist-package");
    for (const name of ["cursor-agent.cmd", "cursor-agent.ps1", "node.exe", "index.js"])
      ExecutableLocatorTests.touch(unpacked, name);
    const empty = directory.resolve("empty");
    ExecutableLocatorTests.touch(empty, "cursor-agent.cmd");

    const command = (located: { path: string; source: string; arguments: readonly string[] } | null): string =>
      Object.isNull(located) ? "null" : [located.path, ...located.arguments, located.source].join(delimiter);
    const found = (path: readonly string[], override: string | null = null, user: string = home): string =>
      command(new ExecutableLocator("win32", "x64", path, user).locateCursor(override));
    const newest = join(versions, "2026.10.22-18-40-00-0c0c0c0");

    Assert.areEqual(command({ path: join(unpacked, "node.exe"), source: ExecutableSource.Path, arguments: [join(unpacked, "index.js")] }), found([unpacked]));
    Assert.areEqual(command({ path: join(newest, "node.exe"), source: ExecutableSource.LocalBin, arguments: [join(newest, "index.js")] }), found([]));
    Assert.areEqual(command({ path: join(newest, "node.exe"), source: ExecutableSource.LocalBin, arguments: [join(newest, "index.js")] }), found([empty]));
    Assert.areEqual(command({ path: join(newest, "node.exe"), source: ExecutableSource.Override, arguments: [join(newest, "index.js")] }),
      found([], join(installed, "CURSOR-AGENT.CMD")));
    Assert.areEqual(command({ path: join(unpacked, "node.exe"), source: ExecutableSource.Override, arguments: [] }), found([], join(unpacked, "node.exe")));
    Assert.areEqual("null", found([empty], join(empty, "cursor-agent.cmd")));
    Assert.areEqual("null", found([empty], null, directory.resolve("nobody")));
  }

  @TestMethod
  public locatesTheCursorTeamRunInstalledLastAndOnlyAtThePinnedVersion(): void {
    using directory = new TemporaryDirectory();
    const installs = directory.resolve("providers", "cursor");
    const managed = ExecutableLocatorTests.touch(installs, "2026.10.22-27dcf5f", "dist-package", "cursor-agent");
    const managedWindows = join(installs, "2026.10.22-27dcf5f", "dist-package");
    for (const name of ["cursor-agent.cmd", "cursor-agent.ps1", "node.exe", "index.js"])
      ExecutableLocatorTests.touch(managedWindows, name);
    ExecutableLocatorTests.touch(installs, "2026.10.21-0a1b2c3", "dist-package", "cursor-agent");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "cursor-agent");
    const own = ExecutableLocatorTests.touch(directory.resolve("home"), ".local", "bin", "cursor-agent");
    const found = (home: string, path: readonly string[], platform: string = "linux", folder: string | null = installs): string => {
      const located = new ExecutableLocator(platform, "x64", path, home).locateCursor(null, folder);
      return Object.isNull(located) ? "null" : [located.path, ...located.arguments, located.source].join(" ");
    };

    Assert.areEqual(`${onPath} ${ExecutableSource.Path}`, found(directory.resolve("nobody"), [directory.resolve("bin")]));
    Assert.areEqual(`${own} ${ExecutableSource.LocalBin}`, found(directory.resolve("home"), []));
    Assert.areEqual(`${managed} ${ExecutableSource.Managed}`, found(directory.resolve("nobody"), []));
    Assert.areEqual(`${join(managedWindows, "node.exe")} ${join(managedWindows, "index.js")} ${ExecutableSource.Managed}`, found(directory.resolve("nobody"), [], "win32"));
    Assert.areEqual("null", found(directory.resolve("nobody"), [], "linux", null));
    Assert.areEqual("null", found(directory.resolve("nobody"), [], "linux", directory.resolve("providers", "elsewhere")));
  }

  @TestMethod
  public marksTheGrokInItsInstallFolderAsThatInstallAlsoWhenThePathFindsIt(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve(".grok", "bin");
    const local = ExecutableLocatorTests.touch(bin, "grok");
    const other = ExecutableLocatorTests.touch(directory.resolve("other"), "grok");
    const throughPath = new ExecutableLocator("linux", "x64", [bin, directory.resolve("other")], directory.path).locateGrok(null);
    const another = new ExecutableLocator("linux", "x64", [directory.resolve("other"), bin], directory.path).locateGrok(null);

    Assert.areEqual(local, throughPath?.path);
    Assert.areEqual(ExecutableSource.LocalBin, throughPath?.source);
    Assert.areEqual(other, another?.path);
    Assert.areEqual(ExecutableSource.Path, another?.source);
    Assert.areEqual(directory.resolve(".grok"), new ExecutableLocator("linux", "x64", [], directory.path).grokInstallDirectory());
  }

  @TestMethod
  public marksTheGrokInItsInstallFolderAsThatInstallWhenThePathReachesTheSameFileByAnotherCaseOrALink(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve(".grok", "bin");
    const files = [ExecutableLocatorTests.touch(bin, "grok.exe"), ExecutableLocatorTests.touch(bin, "grok")];
    const link = directory.resolve("link");
    symlinkSync(bin, link, "junction");

    for (const [platform, local] of [["win32", files[0]!], ["linux", files[1]!]] as const) {
      const linked = new ExecutableLocator(platform, "x64", [link], directory.path).locateGrok(null);

      for (const spelling of [bin.toUpperCase(), bin.toLowerCase()]) {
        const anotherCase = new ExecutableLocator(platform, "x64", [spelling], directory.path).locateGrok(null);

        Assert.areEqual(`${local.toLowerCase()} LocalBin`, `${anotherCase?.path.toLowerCase()} ${anotherCase?.source}`, `${platform} ${spelling}`);
      }
      Assert.areEqual(`${join(link, basename(local))} LocalBin`, `${linked?.path} ${linked?.source}`, platform);
    }
  }

  @TestMethod
  public takesThePathsCopilotAndGrokAsTheirOwnWhenTheirInstallFoldersCantBeRead(): void {
    if (process.platform === "win32" || process.getuid?.() === 0)
      return;
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    ExecutableLocatorTests.touch(home, ".grok", "bin", "grok");
    ExecutableLocatorTests.touch(home, ".local", "bin", "copilot");
    const otherGrok = ExecutableLocatorTests.touch(directory.resolve("other"), "grok");
    const otherCopilot = ExecutableLocatorTests.touch(directory.resolve("other"), "copilot");
    const locator = new ExecutableLocator("linux", "x64", [directory.resolve("other")], home);
    chmodSync(join(home, ".grok"), 0o000);
    chmodSync(join(home, ".local"), 0o000);
    try {
      Assert.areEqual(`${otherGrok} Path|${otherCopilot} Path`,
        [locator.locateGrok(null), locator.locateCopilot(null)].map(t => `${t?.path} ${t?.source}`).join("|"));
    }
    finally {
      chmodSync(join(home, ".grok"), 0o755);
      chmodSync(join(home, ".local"), 0o755);
    }
  }

  @TestMethod
  public takesAHardLinkToTheInstalledCopilotOrGrokAsAnotherInstall(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const grok = ExecutableLocatorTests.touch(home, ".grok", "bin", "grok");
    const copilot = ExecutableLocatorTests.touch(home, ".local", "bin", "copilot");
    mkdirSync(directory.resolve("other"));
    linkSync(grok, directory.resolve("other", "grok"));
    linkSync(copilot, directory.resolve("other", "copilot"));
    const locator = new ExecutableLocator("linux", "x64", [directory.resolve("other")], home);

    Assert.areEqual(`${directory.resolve("other", "grok")} Path|${directory.resolve("other", "copilot")} Path`,
      [locator.locateGrok(null), locator.locateCopilot(null)].map(t => `${t?.path} ${t?.source}`).join("|"));
  }

  @TestMethod
  public marksTheCopilotInTheLocalBinAsThatInstallWhenThePathReachesTheSameFileByAnotherCaseOrALink(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("home", ".local", "bin");
    const local = ExecutableLocatorTests.touch(bin, "copilot");
    const link = directory.resolve("link");
    symlinkSync(bin, link, "junction");

    const anotherCase = new ExecutableLocator("darwin", "arm64", [bin.toUpperCase()], directory.resolve("home")).locateCopilot(null);
    const linked = new ExecutableLocator("darwin", "arm64", [link], directory.resolve("home")).locateCopilot(null);

    Assert.areEqual(`${local} LocalBin`, `${anotherCase?.path} ${anotherCase?.source}`);
    Assert.areEqual(`${local} LocalBin`, `${linked?.path} ${linked?.source}`);
  }

  @TestMethod
  public locatesTheAntigravityServerTeamRunInstalledOnlyWithItsHarness(): void {
    using directory = new TemporaryDirectory();
    const install = directory.resolve("antigravity");
    const linux = new ExecutableLocator("linux", "x64", [], directory.path);
    const windows = new ExecutableLocator("win32", "arm64", [], directory.path);
    const server = ExecutableLocatorTests.touch(install, "1.3.0", "agy_acp_server.par");
    Assert.isNull(linux.locateAntigravity(install));
    Assert.isNull(linux.locateAntigravityServer(install));
    ExecutableLocatorTests.touch(install, "1.3.0", "localharness_external");
    const found = linux.locateAntigravityServer(install)!;
    Assert.areEqual(`${server} ${join(install, "1.3.0", "localharness_external")}`, `${found.command.executable} ${found.harnessPath}`);
    Assert.areEqual(server, linux.locateAntigravity(install)?.path);
    Assert.areEqual(ExecutableSource.Managed, linux.locateAntigravity(install)?.source);
    Assert.areEqual(join(install, "1.3.0", "localharness_external"), linux.antigravityHarness(server));
    ExecutableLocatorTests.touch(install, "1.4.1", "agy_acp_server.exe");
    ExecutableLocatorTests.touch(install, "1.4.1", "localharness_external.exe");
    Assert.isNull(windows.locateAntigravity(install));
    const exe = ExecutableLocatorTests.touch(install, "1.3.0", "agy_acp_server.exe");
    ExecutableLocatorTests.touch(install, "1.3.0", "localharness_external.exe");
    Assert.areEqual(exe, windows.locateAntigravity(install)?.path);
    Assert.areEqual(join(install, "1.3.0", "localharness_external.exe"), windows.antigravityHarness(exe));
  }

  @TestMethod
  public locatesAChosenAntigravityServerElseTheInstalledOneElseOneOnPathEachWithItsHarness(): void {
    using directory = new TemporaryDirectory();
    const install = directory.resolve("antigravity");
    const bare = directory.resolve("bare");
    const bin = directory.resolve("bin");
    const linux = new ExecutableLocator("linux", "x64", [bare, bin], directory.path);
    const windows = new ExecutableLocator("win32", "x64", [bin], directory.path);
    ExecutableLocatorTests.touch(bare, "agy_acp_server.par");
    const onPath = ExecutableLocatorTests.touch(bin, "agy_acp_server.par");
    chmodSync(join(bare, "agy_acp_server.par"), 0o755);
    chmodSync(onPath, 0o755);
    Assert.isNull(linux.locateAntigravityServer(install));
    ExecutableLocatorTests.touch(bin, "localharness_external");
    const found = linux.locateAntigravityServer(install);
    Assert.areEqual(`${onPath} ${join(bin, "localharness_external")} Path`, `${found?.command.executable} ${found?.harnessPath} ${found?.source}`);
    Assert.isNull(windows.locateAntigravityServer(install));
    const installed = ExecutableLocatorTests.touch(install, "1.3.0", "agy_acp_server.par");
    ExecutableLocatorTests.touch(install, "1.3.0", "localharness_external");
    const managed = linux.locateAntigravityServer(install);
    Assert.areEqual(`${installed} Managed`, `${managed?.command.executable} ${managed?.source}`);
    const chosen = ExecutableLocatorTests.touch(directory.resolve("chosen"), "agy_acp_server");
    chmodSync(chosen, 0o755);
    Assert.isNull(linux.locateAntigravityServer(install, chosen));
    Assert.isNull(linux.locateAntigravityServer(install, directory.resolve("missing", "agy_acp_server")));
    ExecutableLocatorTests.touch(directory.resolve("chosen"), "localharness_external");
    const picked = linux.locateAntigravityServer(install, chosen);
    Assert.areEqual(`${chosen} ${join(directory.resolve("chosen"), "localharness_external")} Override`,
      `${picked?.command.executable} ${picked?.harnessPath} ${picked?.source}`);
  }

  @TestMethod
  public findsNoAntigravityServerThatIsAFolderOrThatCannotRunAndTakesAnyFileOnWindows(): void {
    using directory = new TemporaryDirectory();
    const install = directory.resolve("antigravity");
    const bin = directory.resolve("bin");
    const chosen = directory.resolve("chosen");
    const linux = new ExecutableLocator("linux", "x64", [bin], directory.path);
    const windows = new ExecutableLocator("win32", "x64", [bin], directory.path);
    mkdirSync(join(bin, "agy_acp_server.par"), { recursive: true });
    mkdirSync(join(bin, "agy_acp_server.exe"), { recursive: true });
    ExecutableLocatorTests.touch(bin, "localharness_external");
    ExecutableLocatorTests.touch(bin, "localharness_external.exe");
    const exe = ExecutableLocatorTests.touch(chosen, "agy_acp_server.exe");
    ExecutableLocatorTests.touch(chosen, "localharness_external.exe");

    Assert.isNull(linux.locateAntigravityServer(install));
    Assert.isNull(windows.locateAntigravityServer(install));
    Assert.isNull(linux.locateAntigravityServer(install, join(bin, "agy_acp_server.par")));
    Assert.isNull(windows.locateAntigravityServer(install, join(bin, "agy_acp_server.exe")));
    Assert.areEqual(`${exe} Override`, `${windows.locateAntigravityServer(install, exe)?.command.executable} ${windows.locateAntigravityServer(install, exe)?.source}`);
    if (process.platform === "win32")
      return;
    const plain = ExecutableLocatorTests.touch(chosen, "agy_acp_server");
    ExecutableLocatorTests.touch(chosen, "localharness_external");
    Assert.isNull(linux.locateAntigravityServer(install, plain));
    chmodSync(plain, 0o755);
    Assert.areEqual(plain, linux.locateAntigravityServer(install, plain)?.command.executable);
  }

  @TestMethod
  public locatesThePersonsNpmOnPathByEachSystemsName(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("bin");
    const linux = new ExecutableLocator("linux", "x64", [bin], directory.path);
    const windows = new ExecutableLocator("win32", "x64", [bin], directory.path);
    Assert.isNull(linux.locateNpm());
    Assert.isNull(windows.locateNpm());
    mkdirSync(bin);
    writeFileSync(join(bin, "npm"), "");
    writeFileSync(join(bin, "npm.cmd"), "");
    chmodSync(join(bin, "npm"), 0o755);

    Assert.areEqual(join(bin, "npm"), linux.locateNpm()?.path);
    Assert.areEqual(join(bin, "npm.cmd"), windows.locateNpm()?.path);
  }

  @TestMethod
  public locatesUnzipOnPathAndOnWindowsFallsBackToWindowsOwnTarNeverOneOnThePath(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("bin");
    const windows = new ExecutableLocator("win32", "x64", [bin], directory.path, directory.resolve("local"), directory.resolve("Windows"));
    Assert.isNull(new ExecutableLocator("linux", "x64", [bin], directory.path).locateUnzip());
    ExecutableLocatorTests.touch(bin, "tar.exe");
    Assert.isNull(windows.locateUnzip());
    const tar = ExecutableLocatorTests.touch(directory.resolve("Windows"), "System32", "tar.exe");
    Assert.areEqual(tar, windows.locateUnzip()?.path);
    Assert.areEqual(ExecutableSource.LocalBin, windows.locateUnzip()?.source);
    const unzipExe = ExecutableLocatorTests.touch(bin, "unzip.exe");
    Assert.areEqual(unzipExe, windows.locateUnzip()?.path);
    const unzip = ExecutableLocatorTests.touch(bin, "unzip");
    Assert.areEqual(unzip, new ExecutableLocator("darwin", "arm64", [bin], directory.path).locateUnzip()?.path);
    Assert.areEqual(ExecutableSource.Path, windows.locateUnzip()?.source);
  }

  @TestMethod
  public prefersTheNativeCodexBinaryBehindTheWindowsShim(): void {
    using directory = new TemporaryDirectory();
    const prefix = directory.resolve("npm");
    const shim = ExecutableLocatorTests.touch(prefix, "codex.cmd");
    const native = ExecutableLocatorTests.touch(prefix, "node_modules", "@openai", "codex", "node_modules", "@openai", "codex-win32-x64", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe");
    const locator = new ExecutableLocator("win32", "x64", [directory.resolve("empty"), prefix], directory.resolve("home"));

    const located = locator.locateCodex(null);
    const unknownArchitecture = new ExecutableLocator("win32", "mips", [prefix], directory.path).locateCodex(null);

    Assert.areEqual(native, located?.path);
    Assert.areEqual(ExecutableSource.GlobalNpm, located?.source);
    Assert.areEqual(shim, unknownArchitecture?.path);
    Assert.areEqual(ExecutableSource.Path, unknownArchitecture?.source);
  }

  @TestMethod
  public locatesCopilotOnThePathInTheLocalBinOrBehindItsWindowsShim(): void {
    using directory = new TemporaryDirectory();
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "copilot");
    const local = ExecutableLocatorTests.touch(directory.resolve("home"), ".local", "bin", "copilot");
    const windowsOnPath = ExecutableLocatorTests.touch(directory.resolve("exe"), "copilot.exe");
    const nested = directory.resolve("nested");
    ExecutableLocatorTests.touch(nested, "copilot.cmd");
    const nestedNative = ExecutableLocatorTests.touch(nested, "node_modules", "@github", "copilot", "node_modules", "@github", "copilot-win32-x64", "copilot.exe");
    const flat = directory.resolve("flat");
    ExecutableLocatorTests.touch(flat, "copilot.cmd");
    const flatNative = ExecutableLocatorTests.touch(flat, "node_modules", "@github", "copilot-win32-arm64", "copilot.exe");
    const posix = (path: readonly string[], home: string): string | null => new ExecutableLocator("linux", "x64", path, home).locateCopilot(null)?.path ?? null;
    const windows = (path: readonly string[], architecture: string = "x64"): ExecutableLocator => new ExecutableLocator("win32", architecture, path, directory.path);

    Assert.areEqual(onPath, posix([directory.resolve("bin")], directory.resolve("home")));
    Assert.areEqual(local, posix([], directory.resolve("home")));
    Assert.areEqual(ExecutableSource.LocalBin, new ExecutableLocator("linux", "x64", [directory.resolve("home", ".local", "bin"), directory.resolve("bin")],
      directory.resolve("home")).locateCopilot(null)?.source);
    Assert.areEqual(ExecutableSource.Path, new ExecutableLocator("linux", "x64", [directory.resolve("bin")], directory.resolve("home")).locateCopilot(null)?.source);
    Assert.isNull(posix([], directory.path));
    Assert.areEqual(windowsOnPath, windows([directory.resolve("exe"), nested]).locateCopilot(null)?.path);
    Assert.areEqual(nestedNative, windows([nested]).locateCopilot(null)?.path);
    Assert.areEqual(ExecutableSource.GlobalNpm, windows([nested]).locateCopilot(null)?.source);
    Assert.areEqual(flatNative, windows([flat], "arm64").locateCopilot(null)?.path);
    Assert.isNull(windows([flat]).locateCopilot(null));
    Assert.isNull(windows([directory.resolve("bin")]).locateCopilot(null));
    Assert.areEqual(ExecutableSource.Override, windows([]).locateCopilot(onPath)?.source);
  }

  @TestMethod
  public findsTheNewestCopilotTeamRunInstalledOnWindowsOnlyWhenNoOtherIsFoundAndNamesItsFolders(): void {
    using directory = new TemporaryDirectory();
    const installs = directory.resolve("installs");
    ExecutableLocatorTests.touch(installs, "1.0.9", "copilot.exe");
    const newest = ExecutableLocatorTests.touch(installs, "1.0.103", "copilot.exe");
    ExecutableLocatorTests.touch(installs, "1.0.20", "copilot.exe");
    ExecutableLocatorTests.touch(installs, "2.0.0", "notes.txt");
    ExecutableLocatorTests.touch(installs, ".teamrun-staging-left", "copilot.exe");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("exe"), "copilot.exe");
    const windows = new ExecutableLocator("win32", "x64", [], directory.path);
    const posix = new ExecutableLocator("linux", "x64", [], directory.resolve("home"));

    Assert.areEqual(newest, windows.locateCopilot(null, installs)?.path);
    Assert.areEqual(ExecutableSource.Managed, windows.locateCopilot(null, installs)?.source);
    Assert.areEqual(onPath, new ExecutableLocator("win32", "x64", [directory.resolve("exe")], directory.path).locateCopilot(null, installs)?.path);
    Assert.isNull(windows.locateCopilot(null));
    Assert.isNull(windows.locateCopilot(null, directory.resolve("none")));
    Assert.isNull(windows.locateCopilot(null, directory.resolve("exe")));
    Assert.isNull(posix.locateCopilot(null, installs));
    Assert.areEqual(installs, windows.copilotInstallDirectory(installs));
    Assert.areEqual(join(directory.resolve("home"), ".local", "bin"), posix.copilotInstallDirectory(installs));
  }

  @TestMethod
  public searchesTheAlternativeNpmLayoutsOnOtherPlatforms(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("usr", "bin");
    ExecutableLocatorTests.touch(bin, "codex");
    const flat = ExecutableLocatorTests.touch(directory.resolve("usr", "lib"), "node_modules", "@openai", "codex-linux-x64", "vendor", "x86_64-unknown-linux-musl", "bin", "codex");
    const direct = ExecutableLocatorTests.touch(bin, "node_modules", "@openai", "codex", "vendor", "x86_64-unknown-linux-musl", "bin", "codex");
    const shimOnly = directory.resolve("shim-only");
    const shim = ExecutableLocatorTests.touch(shimOnly, "codex");

    const located = new ExecutableLocator("linux", "x64", [bin], directory.path).locateCodex(null);
    const shimLocated = new ExecutableLocator("linux", "x64", [shimOnly], directory.path).locateCodex(null);
    const missing = new ExecutableLocator("linux", "x64", [directory.resolve("nowhere")], directory.path).locateCodex(null);

    Assert.areEqual(direct, located?.path);
    Assert.isTrue(flat.length > 0);
    Assert.areEqual(shim, shimLocated?.path);
    Assert.isNull(missing);
  }

  @TestMethod
  public locatesClaudeInTheLocalBinThenOnThePath(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const local = ExecutableLocatorTests.touch(home, ".local", "bin", "claude.exe");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "claude.cmd");
    const posix = ExecutableLocatorTests.touch(directory.resolve("posix"), "claude");

    const fromLocal = new ExecutableLocator("win32", "x64", [directory.resolve("bin")], home).locateClaude(null);
    const fromPath = new ExecutableLocator("win32", "x64", [directory.resolve("bin")], directory.resolve("other")).locateClaude(null);
    const fromPosixPath = new ExecutableLocator("linux", "x64", [directory.resolve("posix")], directory.resolve("other")).locateClaude(null);
    const missing = new ExecutableLocator("linux", "x64", [], directory.resolve("other")).locateClaude(null);

    Assert.areEqual(local, fromLocal?.path);
    Assert.areEqual(ExecutableSource.LocalBin, fromLocal?.source);
    Assert.areEqual(onPath, fromPath?.path);
    Assert.areEqual(posix, fromPosixPath?.path);
    Assert.isNull(missing);
  }

  @TestMethod
  public honoursAnOverrideOnlyWhenItExists(): void {
    using directory = new TemporaryDirectory();
    const existing = ExecutableLocatorTests.touch(directory.path, "custom-codex.exe");
    const locator = new ExecutableLocator("win32", "x64", [], directory.path);

    Assert.areEqual(ExecutableSource.Override, locator.locateCodex(existing)?.source);
    Assert.areEqual(ExecutableSource.Override, locator.locateClaude(existing)?.source);
    Assert.isNull(locator.locateCodex(directory.resolve("missing.exe")));
    Assert.isNull(locator.locateClaude(directory.resolve("missing.exe")));
  }

  @TestMethod
  public locatesTarOnThePathAndOnWindowsOnlyWindowsOwnNeverOneOnThePath(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("bin");
    const windows = new ExecutableLocator("win32", "x64", [bin], directory.path, directory.resolve("local"), directory.resolve("Windows"));
    const linux = new ExecutableLocator("linux", "x64", [bin], directory.path);
    Assert.isNull(linux.locateTar());
    ExecutableLocatorTests.touch(bin, "tar.exe");
    Assert.isNull(linux.locateTar());
    Assert.isNull(windows.locateTar());
    const tarExe = ExecutableLocatorTests.touch(directory.resolve("Windows"), "System32", "tar.exe");
    const tar = ExecutableLocatorTests.touch(bin, "tar");

    Assert.areEqual([tarExe, tar].join("\n"), [windows.locateTar()?.path, linux.locateTar()?.path].join("\n"));
    Assert.areEqual(ExecutableSource.Path, linux.locateTar()?.source);
  }

  @TestMethod
  public locatesOnlyTheSystemsOwnTarOnMacOsNeverOneOnThePathAndNoneWithoutIt(): void {
    using directory = new TemporaryDirectory();
    const bin = directory.resolve("bin");
    ExecutableLocatorTests.touch(bin, "tar");
    const mac = new ExecutableLocator("darwin", "arm64", [bin], directory.path);
    const system = directory.resolve("usr", "bin", "tar");
    const missing = new ExecutableLocator("darwin", "arm64", [bin], directory.path, undefined, undefined, system);
    const missingPath = missing.locateTar();
    ExecutableLocatorTests.touch(directory.resolve("usr", "bin"), "tar");
    const own = new ExecutableLocator("darwin", "arm64", [bin], directory.path, undefined, undefined, system);

    Assert.areEqual(existsSync("/usr/bin/tar") ? "/usr/bin/tar" : "", mac.locateTar()?.path ?? "");
    Assert.isNull(missingPath);
    Assert.areEqual([system, ExecutableSource.LocalBin].join("\n"), [own.locateTar()?.path, own.locateTar()?.source].join("\n"));
  }

  @TestMethod
  public namesTheFolderCodexsInstallerPutsItsCommandIn(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");

    Assert.areEqual([join(home, ".local", "bin"), join(home, "AppData", "Local", "Programs", "OpenAI", "Codex", "bin"),
      join(directory.resolve("local"), "Programs", "OpenAI", "Codex", "bin")].join("\n"),
    [new ExecutableLocator("darwin", "arm64", [], home).codexInstallDirectory(), new ExecutableLocator("win32", "x64", [], home).codexInstallDirectory(),
      new ExecutableLocator("win32", "x64", [], home, directory.resolve("local")).codexInstallDirectory()].join("\n"));
  }

  @TestMethod
  public findsCodexAndWingetsCopilotInTheirInstallersFoldersWhenTheyAreNotOnThePath(): void {
    using directory = new TemporaryDirectory();
    const home = directory.resolve("home");
    const posixCodex = ExecutableLocatorTests.touch(home, ".local", "bin", "codex");
    const windowsCodex = ExecutableLocatorTests.touch(home, "AppData", "Local", "Programs", "OpenAI", "Codex", "bin", "codex.exe");
    const movedCodex = ExecutableLocatorTests.touch(directory.resolve("local"), "Programs", "OpenAI", "Codex", "bin", "codex.exe");
    const wingetCopilot = ExecutableLocatorTests.touch(directory.resolve("local"), "Microsoft", "WinGet", "Links", "copilot.exe");
    const posix = new ExecutableLocator("linux", "x64", [], home);
    const windows = new ExecutableLocator("win32", "x64", [], home);
    const moved = new ExecutableLocator("win32", "x64", [], home, directory.resolve("local"));
    const elsewhere = new ExecutableLocator("win32", "x64", [], directory.resolve("other"));

    Assert.areEqual([posixCodex, windowsCodex, movedCodex, wingetCopilot].join("\n"),
      [posix.locateCodex(null)?.path, windows.locateCodex(null)?.path, moved.locateCodex(null)?.path, moved.locateCopilot(null)?.path].join("\n"));
    Assert.areEqual([ExecutableSource.LocalBin, ExecutableSource.LocalBin].join(","), [moved.locateCodex(null)?.source, moved.locateCopilot(null)?.source].join(","));
    Assert.isNull(windows.locateCopilot(null));
    Assert.isNull(elsewhere.locateCodex(null));
    Assert.isNull(new ExecutableLocator("darwin", "arm64", [], directory.resolve("other")).locateCodex(null));
  }

  @TestMethod
  public locatesPiAtTheLauncherItsOwnInstallerWritesInTheHomeFolderWhenItIsNotOnThePath(): void {
    using directory = new TemporaryDirectory();
    const launcher = ExecutableLocatorTests.touch(directory.path, ".pi", "agent", "bin", "pi");
    const onPath = ExecutableLocatorTests.touch(directory.resolve("bin"), "pi");
    const found = (platform: string, path: readonly string[], home: string = directory.path): string => {
      const located = new ExecutableLocator(platform, "x64", path, home).locatePi(null);
      return Object.isNull(located) ? "null" : [located.path, ...located.arguments, located.source].join(delimiter);
    };

    Assert.areEqual([launcher, ExecutableSource.LocalBin].join(delimiter), found("linux", []));
    Assert.areEqual([launcher, ExecutableSource.LocalBin].join(delimiter), found("darwin", []));
    Assert.areEqual([onPath, ExecutableSource.Path].join(delimiter), found("linux", [directory.resolve("bin")]));
    Assert.areEqual("null", found("linux", [], directory.resolve("other")));
    Assert.areEqual("null", found("win32", []));
  }

  @TestMethod
  public locatesPiOnThePathAndTheNodeScriptBehindItsWindowsShim(): void {
    using directory = new TemporaryDirectory();
    const script = ["node_modules", "@earendil-works", "pi-coding-agent", "dist", "bundle", "cli.js"];
    const posix = ExecutableLocatorTests.touch(directory.resolve("bin"), "pi");
    const beside = directory.resolve("beside");
    ExecutableLocatorTests.touch(beside, "pi.cmd");
    ExecutableLocatorTests.touch(beside, "node.exe");
    ExecutableLocatorTests.touch(beside, ...script);
    const apart = directory.resolve("apart");
    ExecutableLocatorTests.touch(apart, "pi.cmd");
    ExecutableLocatorTests.touch(apart, ...script);
    const node = ExecutableLocatorTests.touch(directory.resolve("node"), "node.exe");
    const broken = directory.resolve("broken");
    ExecutableLocatorTests.touch(broken, "pi.cmd");

    const found = (platform: string, path: readonly string[], override: string | null = null): string => {
      const located = new ExecutableLocator(platform, "x64", path, directory.path).locatePi(override);
      return Object.isNull(located) ? "null" : [located.path, ...located.arguments, located.source].join(delimiter);
    };

    Assert.areEqual([posix, ExecutableSource.Path].join(delimiter), found("linux", [directory.resolve("bin")]));
    Assert.areEqual([posix, ExecutableSource.Override].join(delimiter), found("darwin", [], posix));
    Assert.areEqual("null", found("linux", [], directory.resolve("missing")));
    Assert.areEqual("null", found("linux", [beside]));
    Assert.areEqual([join(beside, "node.exe"), join(beside, ...script), ExecutableSource.GlobalNpm].join(delimiter), found("win32", [beside, dirname(node)]));
    Assert.areEqual([node, join(apart, ...script), ExecutableSource.GlobalNpm].join(delimiter), found("win32", [apart, dirname(node)]));
    Assert.areEqual("null", found("win32", [apart]));
    Assert.areEqual("null", found("win32", [broken, dirname(node)]));
    Assert.areEqual("null", found("win32", [directory.resolve("bin")]));
  }

  @TestMethod
  public readsTheProcessEnvironment(): void {
    const locator = ExecutableLocator.fromProcess();

    Assert.isInstanceOf(locator, ExecutableLocator);
    Assert.areEqual(0, ExecutableLocator.splitPath(undefined).length);
    Assert.areEqual("a,b", ExecutableLocator.splitPath(["a", " ", "b", ""].join(delimiter)).join(","));
  }

  private static touch(...segments: readonly string[]): string {
    const path = join(...segments);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, "");

    return path;
  }
}
