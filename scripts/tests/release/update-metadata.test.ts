/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import PackageTarget from "../../packaging/package-target.ts";
import PackageDigest from "../../release/package-digest.ts";
import ReleaseException from "../../release/release.exception.ts";
import ReleaseFile from "../../release/release-file.ts";
import UpdateMetadata from "../../release/update-metadata.ts";

class UpdateMetadataTests {
  public static register(): void {
    test("the metadata lists every file with its SHA-512 and size, the update file first and as the path, and quotes names and the date", () => {
      const files = [new ReleaseFile("Jo's App-macos-arm64.dmg", new PackageDigest("b", "dmg512==", 34)), new ReleaseFile("Jo's App-macos-arm64.zip", new PackageDigest("a", "zip512==", 12))];

      assert.equal(new UpdateMetadata("0.0.2", "Jo's App-macos-arm64.zip", files, "2026-10-05T23:00:00.000Z").format(), [
        "version: 0.0.2",
        "files:",
        "  - url: 'Jo''s App-macos-arm64.zip'",
        "    sha512: zip512==",
        "    size: 12",
        "  - url: 'Jo''s App-macos-arm64.dmg'",
        "    sha512: dmg512==",
        "    size: 34",
        "path: 'Jo''s App-macos-arm64.zip'",
        "sha512: zip512==",
        "releaseDate: '2026-10-05T23:00:00.000Z'",
        ""
      ].join("\n"));
    });

    test("metadata whose update file is not among its files is refused", () => {
      const files = [new ReleaseFile("TeamRun-macos-arm64.dmg", new PackageDigest("b", "dmg512==", 34))];

      assert.throws(() => new UpdateMetadata("0.0.2", "TeamRun-macos-arm64.zip", files, "2026-10-05T23:00:00.000Z"),
        new ReleaseException("The update metadata of 0.0.2 needs its update file TeamRun-macos-arm64.zip among its files."));
    });

    test("each target's metadata file is named after its platform and processor", () => {
      assert.equal(UpdateMetadata.formatFileName(new PackageTarget("linux", "arm64")), "latest-linux-arm64.yml");
    });

    test("the release date is read back from the metadata, and metadata without one is refused", () => {
      const text = new UpdateMetadata("0.0.2", "TeamRun-linux-x64.AppImage", [new ReleaseFile("TeamRun-linux-x64.AppImage", new PackageDigest("a", "b", 1))], "2026-10-05T23:00:00.000Z").format();

      assert.equal(UpdateMetadata.readReleaseDate(text, "latest-linux-x64.yml"), "2026-10-05T23:00:00.000Z");
      assert.throws(() => UpdateMetadata.readReleaseDate("version: 0.0.2\nreleaseDate: 2026-10-05\n", "latest-linux-x64.yml"),
        new ReleaseException("latest-linux-x64.yml names no release date."));
    });
  }
}

UpdateMetadataTests.register();
