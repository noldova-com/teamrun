/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import TarArchive from "../../packaging/tar-archive.ts";
import TarballFixture from "../fixtures/tarball.fixture.ts";

class TarArchiveTests {
  public static register(): void {
    test("a gzipped tarball gives the regular files directly inside its top folder, whatever that folder is called, reading a name prefix only from a POSIX ustar header", () => {
      const archive = TarArchive.fromGzip(TarballFixture.pack([
        { name: "package/", content: "", type: TarballFixture.DIRECTORY },
        { name: "package/package.json", content: "{\"name\":\"fixture\"}" },
        { name: "package/LICENSE", content: "x".repeat(700) },
        { name: "package/lib/LICENSE", content: "nested" },
        { name: "package/docs", content: "", type: TarballFixture.DIRECTORY },
        { name: "LICENSE", content: "outside" },
        { name: "COPYING", content: "split", prefix: "other" },
        { name: "package/README", content: "gnu", prefix: "14771233650", isGnu: true },
        { name: "package/NOTICE", content: "plain", type: "\u0000" }
      ]));

      assert.deepEqual([...archive.topLevelFiles.keys()], ["package.json", "LICENSE", "COPYING", "README", "NOTICE"]);
      assert.equal(archive.topLevelFiles.get("package.json")?.toString(), "{\"name\":\"fixture\"}");
      assert.equal(archive.topLevelFiles.get("LICENSE")?.toString(), "x".repeat(700));
      assert.equal(archive.topLevelFiles.get("COPYING")?.toString(), "split");
      assert.equal(archive.topLevelFiles.get("README")?.toString(), "gnu");
      assert.equal(archive.topLevelFiles.get("NOTICE")?.toString(), "plain");
    });

    test("reading stops at the end blocks, at the end of the data, or at a header whose size is not a number", () => {
      const broken = Buffer.alloc(512);
      broken.write("package/lib/index.js", 0);
      broken.write("not octal", 124);
      const after = Buffer.alloc(512);
      after.write("package/LICENSE", 0);
      after.write("00000000000", 124);

      assert.equal(TarArchive.fromGzip(TarballFixture.pack([])).topLevelFiles.size, 0);
      assert.equal(TarArchive.fromGzip(gzipSync(Buffer.alloc(100, 1))).topLevelFiles.size, 0);
      assert.equal(TarArchive.fromGzip(gzipSync(Buffer.concat([broken, after]))).topLevelFiles.size, 0);
    });
  }
}

TarArchiveTests.register();
