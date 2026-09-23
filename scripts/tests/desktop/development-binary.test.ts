/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, mock, test } from "node:test";

import { NtExecutable, NtExecutableResource, Resource } from "resedit";

import PlistCommandFixture from "./fixtures/plist-command.fixture.ts";

mock.module("node:child_process", { exports: { execFile: PlistCommandFixture.execute } });
const { default: DevelopmentBinary } = await import("../../desktop/development-binary.ts");

class DevelopmentBinaryTests {
  private static readonly ROOT: string = process.cwd();

  public static register(): void {
    beforeEach(async t => {
      if (!("after" in t))
        throw new Error("A test context is required.");
      const directory = await mkdtemp(path.join(tmpdir(), "teamrun-binary-test-"));
      t.after(async () => {
        process.chdir(DevelopmentBinaryTests.ROOT);
        await rm(directory, { recursive: true, force: true });
      });
      process.chdir(directory);
      PlistCommandFixture.calls.length = 0;
      PlistCommandFixture.fail = false;
      await mkdir("node_modules/electron/dist", { recursive: true });
      await writeFile("node_modules/electron/package.json", '{"version":"44.3.0"}');
      await mkdir("assets/icons", { recursive: true });
      await copyFile(path.join(DevelopmentBinaryTests.ROOT, "assets/icons/icon-dark.ico"), "assets/icons/icon-dark.ico");
    });

    test("brands Windows metadata and icons without modifying the installed Electron", async t => {
      t.mock.property(process, "platform", "win32");
      const source = DevelopmentBinaryTests.windowsExecutable(true);
      await writeFile("node_modules/electron/dist/electron.exe", source);
      const binary = await new DevelopmentBinary().prepare();
      assert.equal(path.basename(binary), "TeamRun.exe");
      const resources = NtExecutableResource.from(NtExecutable.from(await readFile(binary)));
      const info = Resource.VersionInfo.fromEntries(resources.entries)[0];
      assert.ok(info);
      const strings = info.getStringValues({ lang: 1033, codepage: 1200 });
      assert.equal(strings["FileDescription"], "TeamRun");
      assert.equal(strings["ProductName"], "TeamRun");
      assert.equal(strings["CompanyName"], "Noldova");
      assert.equal(strings["OriginalFilename"], "TeamRun.exe");
      assert.ok(resources.entries.some(t => t.type === 14));
      assert.deepEqual(await readFile("node_modules/electron/dist/electron.exe"), source);
      await assert.rejects(readFile("_build/electron-dev/electron.exe"));
      await writeFile("_build/electron-dev/cache-canary", "keep");
      assert.equal(await new DevelopmentBinary().prepare(), binary);
      assert.equal(await readFile("_build/electron-dev/cache-canary", "utf8"), "keep");
    });

    test("rebuilds for changed inputs, a stale stamp or a missing executable", async t => {
      t.mock.property(process, "platform", "linux");
      await writeFile("node_modules/electron/dist/electron", "fixture executable");
      const binary = await new DevelopmentBinary().prepare();
      assert.equal(path.basename(binary), "teamrun");
      assert.equal(await readFile(binary, "utf8"), "fixture executable");
      assert.equal(await readFile("node_modules/electron/dist/electron", "utf8"), "fixture executable");
      for (const change of ["manifest", "icon", "stamp", "missing"]) {
        await writeFile("_build/electron-dev/cache-canary", "discard");
        if (change === "manifest") await writeFile("node_modules/electron/package.json", '{"version":"44.3.1"}');
        if (change === "icon") await copyFile(path.join(DevelopmentBinaryTests.ROOT, "assets/icons/icon-light.ico"), "assets/icons/icon-dark.ico");
        if (change === "stamp") await writeFile("_build/electron-dev/teamrun-dev.sha256", "stale");
        if (change === "missing") await rm(binary);
        assert.equal(await new DevelopmentBinary().prepare(), binary);
        await assert.rejects(readFile("_build/electron-dev/cache-canary"));
      }
    });

    for (const version of [false, true])
      test(`refuses incomplete Windows version resources (${version}) without publishing a cache stamp`, async t => {
        t.mock.property(process, "platform", "win32");
        await writeFile("node_modules/electron/dist/electron.exe", DevelopmentBinaryTests.windowsExecutable(false, version));
        await assert.rejects(new DevelopmentBinary().prepare(), /no version information/);
        await assert.rejects(readFile("_build/electron-dev/teamrun-dev.sha256"));
      });

    test("renames the Mac bundle, generic helper and renderer helper with matching plist identities", async t => {
      t.mock.property(process, "platform", "darwin");
      await DevelopmentBinaryTests.macBundle("node_modules/electron/dist/Electron.app", "Electron");
      const frameworks = "node_modules/electron/dist/Electron.app/Contents/Frameworks";
      await DevelopmentBinaryTests.macBundle(frameworks + "/Electron Helper.app", "Electron Helper");
      await DevelopmentBinaryTests.macBundle(frameworks + "/Electron Helper (Renderer).app", "Electron Helper (Renderer)");
      await mkdir(frameworks + "/Electron Framework.framework", { recursive: true });
      await writeFile(frameworks + "/Electron Helper.txt", "leave");
      const binary = await new DevelopmentBinary().prepare();
      assert.equal(await readFile(binary, "utf8"), "fixture executable");
      assert.ok(binary.includes("TeamRun.app"));
      const calls = PlistCommandFixture.calls;
      assert.equal(calls.length, 12);
      assert.ok(calls.some(t => t[1] === "CFBundleIdentifier" && t[3] === "com.noldova.teamrun.helper.renderer"));
      assert.ok(calls.some(t => t[1] === "CFBundleIdentifier" && t[3] === "com.noldova.teamrun.helper"));
      assert.ok(calls.some(t => t[1] === "CFBundleExecutable" && t[3] === "TeamRun Helper (Renderer)"));
      assert.equal(await readFile("_build/electron-dev/TeamRun.app/Contents/Frameworks/TeamRun Helper.app/Contents/MacOS/TeamRun Helper", "utf8"), "fixture executable");
      assert.equal(await readFile("node_modules/electron/dist/Electron.app/Contents/MacOS/Electron", "utf8"), "fixture executable");
    });

    test("propagates a plist failure and does not cache incomplete preparation", async t => {
      t.mock.property(process, "platform", "darwin");
      await DevelopmentBinaryTests.macBundle("node_modules/electron/dist/Electron.app", "Electron");
      PlistCommandFixture.fail = true;
      await assert.rejects(new DevelopmentBinary().prepare(), /fixture plist failure/);
      await assert.rejects(readFile("_build/electron-dev/teamrun-dev.sha256"));
    });

    test("refuses unsupported hosts before creating a development copy", async t => {
      t.mock.property(process, "platform", "freebsd");
      await assert.rejects(new DevelopmentBinary().prepare(), /supported on Windows, macOS and Linux/);
      await assert.rejects(readFile("_build/electron-dev/teamrun-dev.sha256"));
    });
  }

  private static windowsExecutable(strings: boolean, version: boolean = true): Buffer {
    const executable = NtExecutable.createEmpty();
    const resource = NtExecutableResource.from(executable);
    if (version) {
      const info = Resource.VersionInfo.createEmpty();
      if (strings)
        info.setStringValues({ lang: 1033, codepage: 1200 }, { ProductName: "Electron", FileDescription: "Electron" });
      info.outputToResourceEntries(resource.entries);
    }
    resource.outputResource(executable);
    return Buffer.from(executable.generate());
  }

  private static async macBundle(directory: string, executable: string): Promise<void> {
    await mkdir(path.join(directory, "Contents/MacOS"), { recursive: true });
    await writeFile(path.join(directory, "Contents/MacOS", executable), "fixture executable");
    await writeFile(path.join(directory, "Contents/Info.plist"), "fixture plist");
  }
}

DevelopmentBinaryTests.register();
