/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { NtExecutable, NtExecutableResource, Resource } from "resedit";

import DesktopException from "../../desktop/desktop.exception.ts";
import DevelopmentBinary from "../../desktop/development-binary.ts";
import ProcessResult from "../../processes/process-result.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class InstallingRunnerFixture extends ProcessRunnerFixture {
  private readonly executable: string;

  public constructor(executable: string) {
    super([], [new ProcessResult(0, "", "")]);

    this.executable = executable;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number): Promise<ProcessResult> {
    await mkdir(path.dirname(this.executable), { recursive: true });
    await writeFile(this.executable, "installed executable");
    return super.captureAsync(command, commandArguments, directory, timeout);
  }
}

class DevelopmentBinaryTests {
  private static readonly ICONS: string = path.join(SourceTreeFixture.root, "assets", "icons");
  private static readonly DISTRIBUTION: string = "node_modules/electron/dist";
  private static readonly OUTPUT: string = "_build/development-app";
  private static readonly STAMP: string = "development-app.sha256";
  private static readonly FIXTURE_ICONS: string = "assets/fixture-icons";

  public static register(): void {
    test("Windows gets the product's executable with its version information and icon, and the installed Electron stays as it was", async t => {
      const repository = await DevelopmentBinaryTests.createAsync(t);
      const source = DevelopmentBinaryTests.createWindowsExecutable(true, true);
      await repository.writeAsync({ [`${DevelopmentBinaryTests.DISTRIBUTION}/electron.exe`]: source });
      const report = new TextOutputFixture();

      const binary = await new DevelopmentBinary(repository.directory, new ProcessRunnerFixture(), "win32", "x64").prepareAsync(report);

      assert.equal(binary, path.join(repository.directory, DevelopmentBinaryTests.OUTPUT, "Fixture Studio.exe"));
      const resource = NtExecutableResource.from(NtExecutable.from(await readFile(binary)));
      const [info] = Resource.VersionInfo.fromEntries(resource.entries);
      assert.deepEqual(info?.getStringValues({ lang: 1033, codepage: 1200 }), {
        ProductName: "Fixture Studio",
        FileDescription: "Fixture Studio",
        CompanyName: "Fixture Works",
        InternalName: "Fixture Studio.exe",
        OriginalFilename: "Fixture Studio.exe",
        LegalCopyright: "Copyright (c) Fixture Works.",
        FileVersion: "1.2.3.0",
        ProductVersion: "1.2.3.0"
      });
      assert.deepEqual([info?.fixedInfo.fileVersionMS, info?.fixedInfo.fileVersionLS], [0x10002, 0x30000]);
      assert.ok(resource.entries.some(t => t.type === 14));
      assert.ok(resource.entries.filter(t => t.type === 3).length > 0);
      assert.deepEqual(await readFile(path.join(repository.directory, DevelopmentBinaryTests.DISTRIBUTION, "electron.exe")), source);
      assert.ok(!existsSync(path.join(repository.directory, DevelopmentBinaryTests.OUTPUT, "electron.exe")));
      assert.equal(await readFile(path.join(repository.directory, DevelopmentBinaryTests.OUTPUT, "path.txt"), "utf8"), binary);
      assert.equal(report.text, "Preparing the Fixture Studio development binary...\n");
    });

    test("the copy is reused while its inputs stay the same and rebuilt when any of them changes", async t => {
      const repository = await DevelopmentBinaryTests.createAsync(t);
      await repository.writeAsync({ [`${DevelopmentBinaryTests.DISTRIBUTION}/electron`]: "fixture executable" });
      const output = path.join(repository.directory, DevelopmentBinaryTests.OUTPUT);
      const canary = path.join(output, "canary");
      const prepareAsync = (architecture: string = "x64"): Promise<string> =>
        new DevelopmentBinary(repository.directory, new ProcessRunnerFixture(), "linux", architecture).prepareAsync(new TextOutputFixture());
      const binary = await prepareAsync();
      await writeFile(canary, "kept");
      await rm(path.join(output, "path.txt"));

      assert.equal(await prepareAsync(), binary);
      assert.equal(await readFile(canary, "utf8"), "kept");
      assert.equal(await readFile(path.join(output, "path.txt"), "utf8"), binary);
      assert.equal(path.basename(binary), "fixture-studio");
      assert.equal(await readFile(binary, "utf8"), "fixture executable");
      assert.equal(await readFile(path.join(repository.directory, DevelopmentBinaryTests.DISTRIBUTION, "electron"), "utf8"), "fixture executable");

      const changes: readonly [string, () => Promise<unknown>][] = [
        ["Electron's manifest", () => repository.writeAsync({ "node_modules/electron/package.json": "{ \"version\": \"44.5.2\" }\n" })],
        ["the product version", () => repository.writeAsync({ "package.json": DevelopmentBinaryTests.formatManifest("1.2.4") })],
        ["the product identity", () => repository.writeAsync({ "package.json": DevelopmentBinaryTests.formatManifest("1.2.4", { publisher: "Other Works" }) })],
        ["the icon", async () => repository.writeAsync({ [`${DevelopmentBinaryTests.FIXTURE_ICONS}/icon-dark.ico`]: Buffer.from("another icon") })],
        ["the macOS icon", async () =>
          repository.writeAsync({ [`${DevelopmentBinaryTests.FIXTURE_ICONS}/icon-dock-512.png`]: await readFile(path.join(DevelopmentBinaryTests.ICONS, "icon-dark-512.png")) })],
        ["the CPU", async () => prepareAsync("arm64")],
        ["a stale stamp", () => writeFile(path.join(output, DevelopmentBinaryTests.STAMP), "stale")],
        ["a missing executable", () => rm(binary)]
      ];
      for (const [name, changeAsync] of changes) {
        await writeFile(canary, "discarded");
        await changeAsync();

        assert.equal(await prepareAsync(name === "the CPU" ? "arm64" : "x64"), binary, name);
        assert.ok(!existsSync(canary), name);
      }
    });

    for (const [name, hasStrings, hasVersion] of [["no version strings", false, true], ["no version resource", false, false]] as const)
      test(`a Windows executable with ${name} is refused and no stamp is published`, async t => {
        const repository = await DevelopmentBinaryTests.createAsync(t);
        await repository.writeAsync({ [`${DevelopmentBinaryTests.DISTRIBUTION}/electron.exe`]: DevelopmentBinaryTests.createWindowsExecutable(hasStrings, hasVersion) });

        await assert.rejects(
          new DevelopmentBinary(repository.directory, new ProcessRunnerFixture(), "win32", "x64").prepareAsync(new TextOutputFixture()),
          new DesktopException("Electron's executable carries no version information to relabel."));
        assert.ok(!existsSync(path.join(repository.directory, DevelopmentBinaryTests.OUTPUT, DevelopmentBinaryTests.STAMP)));
      });

    test("macOS gets the product's bundle with its helpers, their development identities, its icon and a new ad-hoc signature", async t => {
      const repository = await DevelopmentBinaryTests.createAsync(t);
      const frameworks = `${DevelopmentBinaryTests.DISTRIBUTION}/Electron.app/Contents/Frameworks`;
      await DevelopmentBinaryTests.writeMacBundleAsync(repository, `${DevelopmentBinaryTests.DISTRIBUTION}/Electron.app`, "Electron");
      await DevelopmentBinaryTests.writeMacBundleAsync(repository, `${frameworks}/Electron Helper.app`, "Electron Helper");
      await DevelopmentBinaryTests.writeMacBundleAsync(repository, `${frameworks}/Electron Helper (Renderer).app`, "Electron Helper (Renderer)");
      await repository.writeAsync({ [`${frameworks}/Electron Framework.framework/Resources/info`]: "kept", [`${frameworks}/Electron Helper.txt`]: "kept" });
      await repository.writeAsync({ [`${DevelopmentBinaryTests.DISTRIBUTION}/Electron.app/Contents/Resources/electron.icns`]: "electron icon" });
      const runner = new ProcessRunnerFixture([], Array.from({ length: 24 }, () => new ProcessResult(0, "", "")));

      const binary = await new DevelopmentBinary(repository.directory, runner, "darwin", "arm64").prepareAsync(new TextOutputFixture());

      const bundle = path.join(repository.directory, DevelopmentBinaryTests.OUTPUT, "Fixture Studio.app");
      const identifier = `org.fixtureworks.studio.development.${createHash("sha256").update(realpathSync(repository.directory)).digest("hex").slice(0, 8)}`;
      const helpers = path.join(bundle, "Contents", "Frameworks");
      assert.equal(binary, path.join(bundle, "Contents", "MacOS", "Fixture Studio"));
      assert.equal(await readFile(binary, "utf8"), "Electron");
      assert.equal(await readFile(path.join(helpers, "Fixture Studio Helper.app", "Contents", "MacOS", "Fixture Studio Helper"), "utf8"), "Electron Helper");
      assert.equal(
        await readFile(path.join(helpers, "Fixture Studio Helper (Renderer).app", "Contents", "MacOS", "Fixture Studio Helper (Renderer)"), "utf8"), "Electron Helper (Renderer)");
      assert.ok(existsSync(path.join(helpers, "Electron Framework.framework")));
      assert.ok(existsSync(path.join(helpers, "Electron Helper.txt")));
      const plist = (name: string): string => path.join(name, "Contents", "Info.plist");
      const replacements = runner.captured.filter(t => t[0] === "plutil").map(t => `${t[3]}=${t[5]} ${path.relative(bundle, String(t[6]))}`);
      assert.deepEqual(new Set(replacements), new Set([
        ...["CFBundleExecutable", "CFBundleName", "CFBundleDisplayName"].map(t => `${t}=Fixture Studio ${plist("")}`),
        `CFBundleIdentifier=${identifier} ${plist("")}`,
        `CFBundleIconFile=fixture-studio.icns ${plist("")}`,
        ...["CFBundleExecutable", "CFBundleName", "CFBundleDisplayName"].map(t =>
          `${t}=Fixture Studio Helper ${plist(path.join("Contents", "Frameworks", "Fixture Studio Helper.app"))}`),
        `CFBundleIdentifier=${identifier}.helper ${plist(path.join("Contents", "Frameworks", "Fixture Studio Helper.app"))}`,
        ...["CFBundleExecutable", "CFBundleName", "CFBundleDisplayName"].map(t =>
          `${t}=Fixture Studio Helper (Renderer) ${plist(path.join("Contents", "Frameworks", "Fixture Studio Helper (Renderer).app"))}`),
        `CFBundleIdentifier=${identifier}.helper.renderer ${plist(path.join("Contents", "Frameworks", "Fixture Studio Helper (Renderer).app"))}`
      ]));
      assert.equal(replacements.length, 13);
      const iconset = path.join(repository.directory, DevelopmentBinaryTests.OUTPUT, "Fixture Studio.iconset");
      const source = path.join(repository.directory, DevelopmentBinaryTests.FIXTURE_ICONS, "icon-dock-512.png");
      assert.deepEqual(runner.captured.filter(t => t[0] === "sips").map(t => t.slice(2)), [
        ["icon_16x16.png", 16], ["icon_16x16@2x.png", 32], ["icon_32x32.png", 32], ["icon_32x32@2x.png", 64], ["icon_128x128.png", 128],
        ["icon_128x128@2x.png", 256], ["icon_256x256.png", 256], ["icon_256x256@2x.png", 512], ["icon_512x512.png", 512]
      ].map(([name, size]) => ["-z", String(size), String(size), source, "--out", path.join(iconset, String(name))]));
      assert.deepEqual(runner.captured.find(t => t[0] === "iconutil"),
        ["iconutil", repository.directory, "--convert", "icns", "--output", path.join(bundle, "Contents", "Resources", "fixture-studio.icns"), iconset]);
      assert.ok(!existsSync(iconset));
      assert.ok(!existsSync(path.join(bundle, "Contents", "Resources", "electron.icns")));
      assert.deepEqual(runner.captured.at(-1), ["codesign", repository.directory, "--force", "--deep", "--sign", "-", bundle]);
      assert.equal(await readFile(path.join(repository.directory, DevelopmentBinaryTests.DISTRIBUTION, "Electron.app", "Contents", "MacOS", "Electron"), "utf8"), "Electron");
    });

    test("a failed plist edit or signature stops the preparation without publishing a stamp", async t => {
      const repository = await DevelopmentBinaryTests.createAsync(t);
      await DevelopmentBinaryTests.writeMacBundleAsync(repository, `${DevelopmentBinaryTests.DISTRIBUTION}/Electron.app`, "Electron");
      await repository.writeAsync({ [`${DevelopmentBinaryTests.DISTRIBUTION}/Electron.app/Contents/Frameworks/notes.txt`]: "kept" });
      const failures: readonly [string, readonly ProcessResult[]][] = [
        ["plutil", [new ProcessResult(1, "", "Info.plist is not a plist\n")]],
        ["codesign", [...Array.from({ length: 15 }, () => new ProcessResult(0, "", "")), new ProcessResult(1, "", "no identity\n")]]
      ];

      for (const [command, results] of failures) {
        const prepared = new DevelopmentBinary(repository.directory, new ProcessRunnerFixture([], results), "darwin", "x64").prepareAsync(new TextOutputFixture());

        await assert.rejects(prepared, (error: unknown) => error instanceof DesktopException && error.message.startsWith(`"${command} `) && error.message.includes("failed with 1"));
        assert.ok(!existsSync(path.join(repository.directory, DevelopmentBinaryTests.OUTPUT, DevelopmentBinaryTests.STAMP)), command);
      }
    });

    test("Electron's binary is installed first when the distribution is missing", async t => {
      const repository = await DevelopmentBinaryTests.createAsync(t);
      const runner = new InstallingRunnerFixture(path.join(repository.directory, DevelopmentBinaryTests.DISTRIBUTION, "electron"));

      const binary = await new DevelopmentBinary(repository.directory, runner, "linux", "x64").prepareAsync(new TextOutputFixture());

      assert.deepEqual(runner.captured, [[process.execPath, repository.directory, path.join(repository.directory, "node_modules", "electron", "install.js")]]);
      assert.equal(await readFile(binary, "utf8"), "installed executable");
    });

    test("an unsupported platform is refused before anything is copied", async t => {
      const repository = await DevelopmentBinaryTests.createAsync(t);

      await assert.rejects(
        new DevelopmentBinary(repository.directory, new ProcessRunnerFixture(), "freebsd", "x64").prepareAsync(new TextOutputFixture()),
        new DesktopException("The development binary is supported on Windows, macOS and Linux only."));
      assert.ok(!existsSync(path.join(repository.directory, DevelopmentBinaryTests.OUTPUT)));
    });

    test("the command prepares the checkout's binary and records its canonical path, also from a link to the checkout", async t => {
      const repository = await DevelopmentBinaryTests.createAsync(t);
      await repository.writeAsync({ [`${DevelopmentBinaryTests.DISTRIBUTION}/electron`]: "fixture executable" });
      const link = path.join(path.dirname(repository.directory), "link");
      await symlink(repository.directory, link, "junction");
      const record = path.join(repository.directory, DevelopmentBinaryTests.OUTPUT, "path.txt");
      const expected = path.join(realpathSync(repository.directory), DevelopmentBinaryTests.OUTPUT, "fixture-studio");
      const run = (directory: string): ReturnType<typeof spawnSync> => spawnSync(process.execPath, [
        "--import", "data:text/javascript,Object.defineProperty(process, \"platform\", { value: \"linux\" });",
        SourceTreeFixture.locateScript(path.join("desktop", "development-binary.ts"))
      ], { cwd: directory, encoding: "utf8", timeout: 30_000 });

      const direct = run(repository.directory);
      const recordedDirectly = await readFile(record, "utf8");
      const linked = run(link);

      assert.equal(direct.status, 0, String(direct.stderr));
      assert.equal(direct.stdout, "Preparing the Fixture Studio development binary...\n");
      assert.equal(recordedDirectly, expected);
      assert.equal(linked.status, 0, String(linked.stderr));
      assert.equal(linked.stdout, "");
      assert.equal(await readFile(record, "utf8"), expected);
    });
  }

  private static async createAsync(t: { after: (action: () => Promise<void>) => void }): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "package.json": DevelopmentBinaryTests.formatManifest(),
      "node_modules/electron/package.json": "{ \"version\": \"44.5.1\" }\n",
      [`${DevelopmentBinaryTests.FIXTURE_ICONS}/icon-dark.ico`]: await readFile(path.join(DevelopmentBinaryTests.ICONS, "icon-dark.ico")),
      [`${DevelopmentBinaryTests.FIXTURE_ICONS}/icon-dock-512.png`]: await readFile(path.join(DevelopmentBinaryTests.ICONS, "icon-dock-512.png"))
    });
    return repository;
  }

  private static formatManifest(version: string = "1.2.3", product: Readonly<Record<string, unknown>> = {}): string {
    return `${JSON.stringify({ ...ProductIdentityFixture.manifest(product), version })}\n`;
  }

  private static createWindowsExecutable(hasStrings: boolean, hasVersion: boolean): Buffer {
    const executable = NtExecutable.createEmpty();
    const resource = NtExecutableResource.from(executable);
    if (hasVersion) {
      const info = Resource.VersionInfo.createEmpty();
      if (hasStrings)
        info.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: "Electron", FileDescription: "Electron" });
      info.outputToResourceEntries(resource.entries);
    }
    resource.outputResource(executable);
    return Buffer.from(executable.generate());
  }

  private static async writeMacBundleAsync(repository: RepositoryFixture, bundle: string, executable: string): Promise<void> {
    await repository.writeAsync({ [`${bundle}/Contents/MacOS/${executable}`]: executable, [`${bundle}/Contents/Info.plist`]: "fixture plist" });
  }
}

DevelopmentBinaryTests.register();
