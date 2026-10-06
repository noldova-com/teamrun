/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import RootManifest from "../../packages/root-manifest.ts";
import type InstalledPackage from "../../packaging/installed-package.ts";
import PackageInstaller from "../../packaging/package-installer.ts";
import PackageTarget from "../../packaging/package-target.ts";
import PackagingException from "../../packaging/packaging.exception.ts";
import ProcessTimeoutException from "../../processes/process-timeout.exception.ts";
import ProcessException from "../../processes/process.exception.ts";
import InstallRunnerFixture from "../fixtures/install-runner.fixture.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class PackageInstallerTests {
  private static readonly LIMIT: number = 120_000;
  private static readonly PACKAGES: readonly string[] = ["Fixture Studio-windows-x64.exe", "Fixture Studio-macos-arm64.dmg", "Fixture Studio-linux-x64.AppImage"];
  private static readonly WINDOWS: NodeJS.ProcessEnv = { SystemRoot: "C:\\Windows" };

  public static register(): void {
    test("on Windows the installer runs silently for the user, and the program installed under LOCALAPPDATA is used", async t => {
      const repository = await PackageInstallerTests.createAsync(t);
      const runner = PackageInstallerTests.createRunner(t);
      runner.localAppData = path.join(repository.directory, "local");

      const installed = await PackageInstallerTests.installAsync(repository, runner, "win32", "x64", { LOCALAPPDATA: runner.localAppData, ...PackageInstallerTests.WINDOWS });

      const program = path.join(repository.directory, "local", "Programs", "fixture-studio", "Fixture Studio.exe");
      assert.deepEqual(runner.calls, [["Fixture Studio-windows-x64.exe", "/S"]]);
      assert.deepEqual(runner.limits, [PackageInstallerTests.LIMIT]);
      assert.deepEqual([installed.desktop, installed.program, installed.resources], [program, program, path.join(path.dirname(program), "resources")]);
    });

    test("on Windows the installer's PSModulePath, however it is spelled, starts with Windows PowerShell's own modules, and every other variable is kept", async t => {
      const repository = await PackageInstallerTests.createAsync(t);
      const runner = PackageInstallerTests.createRunner(t);
      runner.localAppData = path.join(repository.directory, "local");
      const environment = { LOCALAPPDATA: runner.localAppData, ...PackageInstallerTests.WINDOWS, Path: "C:\\Tools" };

      for (const name of ["PSModulePath", "PSMODULEPATH"])
        await PackageInstallerTests.installAsync(repository, runner, "win32", "x64", { ...environment, [name]: "C:\\Modules\\az" });
      await PackageInstallerTests.installAsync(repository, runner, "win32", "x64", environment);

      const modules = "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules";
      assert.deepEqual(runner.installerEnvironments, [`${modules};C:\\Modules\\az`, `${modules};C:\\Modules\\az`, modules].map(t => ({ ...environment, PSModulePath: t })));
    });

    test("on Windows a missing LOCALAPPDATA or SystemRoot stops before the installer runs, and an installer that leaves no program fails", async t => {
      const repository = await PackageInstallerTests.createAsync(t);
      const unnamed = PackageInstallerTests.createRunner(t);
      const rootless = PackageInstallerTests.createRunner(t);
      const elsewhere = PackageInstallerTests.createRunner(t);
      elsewhere.localAppData = path.join(repository.directory, "elsewhere");
      const local = path.join(repository.directory, "local");

      await assert.rejects(PackageInstallerTests.installAsync(repository, unnamed, "win32", "x64", PackageInstallerTests.WINDOWS),
        new PackagingException("LOCALAPPDATA must name the folder the installer installs into for the user."));
      await assert.rejects(PackageInstallerTests.installAsync(repository, rootless, "win32", "x64", { LOCALAPPDATA: local }),
        new PackagingException("SystemRoot must name the Windows folder, whose PowerShell modules the installer's checks search first."));
      await assert.rejects(PackageInstallerTests.installAsync(repository, elsewhere, "win32", "x64", { LOCALAPPDATA: local, ...PackageInstallerTests.WINDOWS }),
        new PackagingException(`The installed package has no ${path.join(local, "Programs", "fixture-studio", "Fixture Studio.exe")}.`));
      assert.deepEqual([unnamed.calls, rootless.calls], [[], []]);
    });

    test("on Windows an installer that times out fails with the files it had installed, and any other installer failure is passed on unchanged", async t => {
      const repository = await PackageInstallerTests.createAsync(t);
      const partial = PackageInstallerTests.createRunner(t);
      const empty = PackageInstallerTests.createRunner(t);
      const failing = PackageInstallerTests.createRunner(t, ["/S"]);
      const local = path.join(repository.directory, "local");
      const installFolder = path.join(local, "Programs", "fixture-studio");
      for (const runner of [partial, empty])
        runner.localAppData = local;
      partial.installedBeforeTimeout = ["resources/app.asar", "Fixture Studio.exe"];
      empty.installedBeforeTimeout = [];
      const installer = path.join(repository.directory, "_build", "package", "out", "Fixture Studio-windows-x64.exe");
      const timeout = `"${installer}" did not finish within ${PackageInstallerTests.LIMIT} ms.`;

      await assert.rejects(PackageInstallerTests.installAsync(repository, partial, "win32", "x64", { LOCALAPPDATA: local, ...PackageInstallerTests.WINDOWS }), (error: unknown) =>
        error instanceof PackagingException && error.cause instanceof ProcessTimeoutException && error.message === [
          timeout,
          `${installFolder} held 2 files when the installer was stopped:`,
          "Fixture Studio.exe: 8 bytes",
          `${path.join("resources", "app.asar")}: 8 bytes`
        ].join("\n"));
      await rm(installFolder, { recursive: true, force: true });
      await assert.rejects(PackageInstallerTests.installAsync(repository, empty, "win32", "x64", { LOCALAPPDATA: local, ...PackageInstallerTests.WINDOWS }), (error: unknown) =>
        error instanceof PackagingException && error.message === `${timeout}\nThe installer had not created ${installFolder}.`);
      await assert.rejects(PackageInstallerTests.installAsync(repository, failing, "win32", "x64", { LOCALAPPDATA: local, ...PackageInstallerTests.WINDOWS }),
        new ProcessException("Fixture Studio-windows-x64.exe /S failed with exit code 9:\nFixture Studio-windows-x64.exe broke"));
    });

    test("on macOS the app is copied out of the disk image, which is then detached by force", async t => {
      const repository = await PackageInstallerTests.createAsync(t);
      const runner = PackageInstallerTests.createRunner(t);

      const installed = await PackageInstallerTests.installAsync(repository, runner, "darwin", "arm64");

      const image = path.join(repository.directory, "_build", "package", "out", "Fixture Studio-macos-arm64.dmg");
      const application = path.join(runner.folder, "Fixture Studio.app");
      assert.deepEqual(runner.calls, [
        ["hdiutil", "attach", image, "-nobrowse", "-readonly", "-mountpoint", "mount"],
        ["ditto", path.join("mount", "Fixture Studio.app"), "Fixture Studio.app"],
        ["hdiutil", "detach", "-force", "mount"]
      ]);
      assert.deepEqual(runner.limits, [1, 2, 3].map(() => PackageInstallerTests.LIMIT));
      assert.deepEqual([installed.desktop, installed.resources], [path.join(application, "Contents", "MacOS", "Fixture Studio"), path.join(application, "Contents", "Resources")]);
    });

    test("on macOS a failed copy still detaches the disk image, a detach that fails after it is reported with the copy's reason, and a failed detach after the copy fails", async t => {
      const repository = await PackageInstallerTests.createAsync(t);
      const copy = PackageInstallerTests.createRunner(t, ["ditto"]);
      const both = PackageInstallerTests.createRunner(t, ["ditto", "detach"]);
      const detach = PackageInstallerTests.createRunner(t, ["detach"]);

      await assert.rejects(PackageInstallerTests.installAsync(repository, copy, "darwin", "arm64"), (error: unknown) =>
        error instanceof ProcessException && error.message === `ditto ${path.join(copy.folder, "mount", "Fixture Studio.app")} ${path.join(copy.folder, "Fixture Studio.app")} failed with exit code 9:\nditto broke`);
      await assert.rejects(PackageInstallerTests.installAsync(repository, both, "darwin", "arm64"), (error: unknown) =>
        error instanceof PackagingException && error.cause instanceof ProcessException && error.message === `ProcessException: ditto ${path.join(both.folder, "mount", "Fixture Studio.app")} `
          + `${path.join(both.folder, "Fixture Studio.app")} failed with exit code 9:\nditto broke\nDetaching the disk image after the failed copy failed too: `
          + `ProcessException: hdiutil detach -force ${path.join(both.folder, "mount")} failed with exit code 9:\nhdiutil broke`);
      await assert.rejects(PackageInstallerTests.installAsync(repository, detach, "darwin", "arm64"), (error: unknown) =>
        error instanceof ProcessException && error.message === `hdiutil detach -force ${path.join(detach.folder, "mount")} failed with exit code 9:\nhdiutil broke`);
      for (const runner of [copy, both])
        assert.deepEqual(runner.calls.map(t => t.slice(0, 3)), [["hdiutil", "attach", path.join(repository.directory, "_build", "package", "out", "Fixture Studio-macos-arm64.dmg")],
          ["ditto", path.join("mount", "Fixture Studio.app"), "Fixture Studio.app"], ["hdiutil", "detach", "-force"]]);
    });

    test("on Linux the AppImage is made executable and unpacked, the desktop starts from the AppImage and the command line from the unpacked program", async t => {
      const repository = await PackageInstallerTests.createAsync(t);
      const runner = PackageInstallerTests.createRunner(t);
      const failing = PackageInstallerTests.createRunner(t, ["--appimage-extract"]);

      const installed = await PackageInstallerTests.installAsync(repository, runner, "linux", "x64");

      const appImage = path.join(repository.directory, "_build", "package", "out", "Fixture Studio-linux-x64.AppImage");
      const extracted = path.join(runner.folder, "squashfs-root");
      assert.deepEqual(runner.calls, [["Fixture Studio-linux-x64.AppImage", "--appimage-extract"]]);
      assert.deepEqual([installed.desktop, installed.program, installed.resources], [appImage, path.join(extracted, "fixture-studio"), path.join(extracted, "resources")]);
      if (process.platform !== "win32")
        assert.equal((await stat(appImage)).mode & 0o777, 0o755);
      await assert.rejects(PackageInstallerTests.installAsync(repository, failing, "linux", "x64"),
        new ProcessException("Fixture Studio-linux-x64.AppImage --appimage-extract failed with exit code 9:\nFixture Studio-linux-x64.AppImage broke"));
    });
  }

  private static createRunner(t: TestContext, failing: readonly string[] = []): InstallRunnerFixture {
    const runner = new InstallRunnerFixture(failing);
    t.after(() => runner.disposeAsync());
    return runner;
  }

  private static async installAsync(repository: RepositoryFixture, runner: InstallRunnerFixture, platform: string, architecture: string,
    environment: NodeJS.ProcessEnv = {}): Promise<InstalledPackage> {
    const manifest = await RootManifest.readAsync(repository.directory);
    const folder = await mkdtemp(path.join(repository.directory, "install-"));
    return new PackageInstaller(repository.directory, runner, environment).installAsync(PackageTarget.fromProcess(platform, architecture), manifest.product, folder);
  }

  private static async createAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync(Object.fromEntries([
      ["package.json", JSON.stringify(ProductIdentityFixture.manifest())],
      ...PackageInstallerTests.PACKAGES.map(t => [`_build/package/out/${t}`, "package\n"])
    ]));
    return repository;
  }
}

PackageInstallerTests.register();
