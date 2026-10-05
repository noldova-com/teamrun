/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { test, type TestContext } from "node:test";

import PackageTarget from "../../packaging/package-target.ts";
import ReleaseException from "../../release/release.exception.ts";
import ReleaseFileSet from "../../release/release-file-set.ts";
import ReleaseFolderFixture from "../fixtures/release-folder.fixture.ts";

class ReleaseFileSetTests {
  public static register(): void {
    test("a release has every target's packages, a checksum for each package and each target's update metadata", () => {
      const names = new ReleaseFileSet("TeamRun").listAll();

      assert.deepEqual(names, [
        "TeamRun-windows-x64.exe", "TeamRun-windows-x64.exe.sha256", "latest-windows-x64.yml",
        "TeamRun-windows-arm64.exe", "TeamRun-windows-arm64.exe.sha256", "latest-windows-arm64.yml",
        "TeamRun-macos-x64.dmg", "TeamRun-macos-x64.zip", "TeamRun-macos-x64.dmg.sha256", "TeamRun-macos-x64.zip.sha256", "latest-macos-x64.yml",
        "TeamRun-macos-arm64.dmg", "TeamRun-macos-arm64.zip", "TeamRun-macos-arm64.dmg.sha256", "TeamRun-macos-arm64.zip.sha256", "latest-macos-arm64.yml",
        "TeamRun-linux-x64.AppImage", "TeamRun-linux-x64.AppImage.sha256", "latest-linux-x64.yml",
        "TeamRun-linux-arm64.AppImage", "TeamRun-linux-arm64.AppImage.sha256", "latest-linux-arm64.yml"
      ]);
    });

    test("a target's checksums and metadata are written beside its packages, with the ZIP as macOS's update", async t => {
      const release = await ReleaseFileSetTests.createAsync(t);
      const zip = "TeamRun-macos-arm64.zip\n";
      const dmg = "TeamRun-macos-arm64.dmg\n";

      const written = await release.files.writeAsync(release.folder, new PackageTarget("macos", "arm64"), "0.0.2", "2026-10-06T00:00:00.000Z");

      assert.deepEqual(written, ["TeamRun-macos-arm64.dmg", "TeamRun-macos-arm64.zip", "TeamRun-macos-arm64.dmg.sha256", "TeamRun-macos-arm64.zip.sha256", "latest-macos-arm64.yml"]);
      assert.equal(await readFile(release.locate("TeamRun-macos-arm64.dmg.sha256"), "utf8"), `${createHash("sha256").update(dmg).digest("hex")}  TeamRun-macos-arm64.dmg\n`);
      const metadata = await readFile(release.locate("latest-macos-arm64.yml"), "utf8");
      assert.ok(metadata.startsWith(`version: 0.0.2\nfiles:\n  - url: 'TeamRun-macos-arm64.zip'\n    sha512: ${createHash("sha512").update(zip).digest("base64")}\n    size: ${zip.length}\n`), metadata);
      assert.ok(metadata.endsWith("path: 'TeamRun-macos-arm64.zip'\n" + `sha512: ${createHash("sha512").update(zip).digest("base64")}\nreleaseDate: '2026-10-06T00:00:00.000Z'\n`), metadata);
    });

    test("a missing package is named", async t => {
      const release = await ReleaseFileSetTests.createAsync(t);
      await rm(release.locate("TeamRun-linux-x64.AppImage"));

      await assert.rejects(release.files.writeAsync(release.folder, new PackageTarget("linux", "x64"), "0.0.2", ReleaseFolderFixture.RELEASE_DATE),
        new ReleaseException(`${release.locate("TeamRun-linux-x64.AppImage")} is missing; npm run package makes it.`));
    });

    test("the check returns every file of the release with its digest, in the release's order", async t => {
      const release = await ReleaseFileSetTests.createAsync(t);
      const exe = "TeamRun-windows-x64.exe\n";

      const files = await release.files.verifyAsync(release.folder, "0.0.2");

      assert.deepEqual(files.map(t => t.name), release.names);
      assert.deepEqual([files[0]?.digest.sha256, files[0]?.digest.size], [createHash("sha256").update(exe).digest("hex"), exe.length]);
    });

    test("a missing folder is named", async t => {
      const release = await ReleaseFileSetTests.createAsync(t);
      const folder = release.locate("missing");

      await assert.rejects(release.files.verifyAsync(folder, "0.0.2"), new ReleaseException(`The release's folder ${folder} does not exist.`));
    });

    test("a complete folder passes the check, and missing or extra files, a checksum or metadata that differs, or a release date that is gone fail it", async t => {
      const release = await ReleaseFileSetTests.createAsync(t);
      await release.files.verifyAsync(release.folder, "0.0.2");

      await assert.rejects(release.files.verifyAsync(release.folder, "0.0.3"),
        new ReleaseException("latest-windows-x64.yml does not describe version 0.0.3 with TeamRun-windows-x64.exe as they are."));
      await writeFile(release.locate("notes.txt"), "notes\n");
      await assert.rejects(release.files.verifyAsync(release.folder, "0.0.2"),
        new ReleaseException(`The release's files in ${release.folder} differ from the files a release has. Missing: none. Not part of a release: notes.txt.`));
      await rm(release.locate("notes.txt"));
      await rm(release.locate("latest-linux-arm64.yml"));
      await assert.rejects(release.files.verifyAsync(release.folder, "0.0.2"),
        new ReleaseException(`The release's files in ${release.folder} differ from the files a release has. Missing: latest-linux-arm64.yml. Not part of a release: none.`));
      await writeFile(release.locate("latest-linux-arm64.yml"), "version: 0.0.2\n");
      await assert.rejects(release.files.verifyAsync(release.folder, "0.0.2"), new ReleaseException("latest-linux-arm64.yml names no release date."));
      await writeFile(release.locate("TeamRun-macos-x64.dmg"), "changed\n");
      await assert.rejects(release.files.verifyAsync(release.folder, "0.0.2"), new ReleaseException("TeamRun-macos-x64.dmg.sha256 does not match TeamRun-macos-x64.dmg."));
    });
  }

  private static async createAsync(t: TestContext): Promise<ReleaseFolderFixture> {
    const release = await ReleaseFolderFixture.createAsync();
    t.after(() => release.disposeAsync());
    return release;
  }
}

ReleaseFileSetTests.register();
