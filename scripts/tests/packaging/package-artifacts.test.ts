/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import PackageArtifacts from "../../packaging/package-artifacts.ts";
import PackageException from "../../packaging/package.exception.ts";
import PackageOptions from "../../packaging/package-options.ts";

class PackageArtifactsTests {
  public static register(): void {
    test("reports the expected formats, file hashes, and declared revision for all six targets", async t => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "teamrun-artifacts-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      for (const [platform, host, suffixes] of [
        ["windows", "win32", ["-setup.exe", ".zip"]],
        ["linux", "linux", [".AppImage"]],
        ["mac", "darwin", [".dmg", ".zip"]]
      ] as const) {
        for (const architecture of ["x64", "arm64"]) {
          const targetDirectory = path.join(directory, platform + "-" + architecture);
          await mkdir(targetDirectory);
          const names = suffixes.map(suffix => "TeamRun-1.2.3-" + platform + "-" + architecture + suffix).sort();
          for (const name of names)
            await writeFile(path.join(targetDirectory, name), "fixture");
          const options = new PackageOptions(["--arch", architecture], host, architecture);
          await new PackageArtifacts(options, "1.2.3", targetDirectory).writeReport("fixture-revision");
          const report: unknown = JSON.parse(await readFile(path.join(targetDirectory, "package-report-" + platform + "-" + architecture + ".json"), "utf8"));
          assert.deepEqual(report, {
            version: "1.2.3", targetPlatform: platform, targetArchitecture: architecture, signingRequested: false,
            sourceRevision: "fixture-revision", nodeVersion: process.version, hostPlatform: process.platform, hostArchitecture: process.arch,
            files: names.map(name => ({ name, size: 7, sha256: createHash("sha256").update("fixture").digest("hex") }))
          });
        }
      }
    });

    test("rejects a missing required ZIP instead of accepting a partial Windows build", async t => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "teamrun-artifacts-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      await writeFile(path.join(directory, "TeamRun-1.2.3-windows-x64-setup.exe"), "fixture");
      const options = new PackageOptions([], "win32", "x64");
      await assert.rejects(new PackageArtifacts(options, "1.2.3", directory).writeReport(), { code: "ENOENT" });
    });

    test("rejects empty files, directories, and another target's installers", async t => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "teamrun-artifacts-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const filename = path.join(directory, "TeamRun-1.2.3-linux-x64.AppImage");
      const artifacts = new PackageArtifacts(new PackageOptions([], "linux", "x64"), "1.2.3", directory);
      await writeFile(filename, "");
      await assert.rejects(artifacts.writeReport(), PackageException);
      await rm(filename);
      await mkdir(filename);
      await assert.rejects(artifacts.writeReport(), PackageException);
      await rm(filename, { recursive: true });
      await writeFile(filename, "fixture");
      await writeFile(path.join(directory, "TeamRun-1.2.3-linux-arm64.AppImage"), "fixture");
      await assert.rejects(artifacts.writeReport(), /Unexpected installer artifact/);
    });
    
    test("includes update companions but excludes builder diagnostics and unpacked content", async t => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "teamrun-artifacts-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const filename = "TeamRun-1.2.3-mac-arm64.zip";
      const names = ["TeamRun-1.2.3-mac-arm64.dmg", filename, filename + ".blockmap", "latest-mac.yml"];
      for (const name of [...names, "builder-debug.yml", "builder-effective-config.yaml"])
        await writeFile(path.join(directory, name), "fixture");
      await mkdir(path.join(directory, "mac-arm64"));
      const options = new PackageOptions(["--signed"], "darwin", "arm64");
      await new PackageArtifacts(options, "1.2.3", directory).writeReport();
      const report: unknown = JSON.parse(await readFile(path.join(directory, "package-report-mac-arm64.json"), "utf8"));
      assert.deepEqual(report, {
        version: "1.2.3", targetPlatform: "mac", targetArchitecture: "arm64", signingRequested: true,
        sourceRevision: null, nodeVersion: process.version, hostPlatform: process.platform, hostArchitecture: process.arch,
        files: names.sort().map(name => ({ name, size: 7, sha256: createHash("sha256").update("fixture").digest("hex") }))
      });
    });
  }
}

PackageArtifactsTests.register();
