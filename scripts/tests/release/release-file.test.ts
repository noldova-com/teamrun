/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import ReleaseFile from "../../release/release-file.ts";

class ReleaseFileTests {
  public static register(): void {
    test("hashes payload bytes and rejects missing, empty and non-file assets", async t => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "teamrun-release-file-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const filename = path.join(directory, "payload.zip");
      await assert.rejects(ReleaseFile.read(filename), { code: "ENOENT" });
      await assert.rejects(ReleaseFile.read(directory), /regular file/);
      await writeFile(filename, "");
      await assert.rejects(ReleaseFile.read(filename), /non-empty/);
      await writeFile(filename, "payload");
      const file = await ReleaseFile.read(filename);
      assert.equal(file.path, filename);
      assert.equal(file.name, "payload.zip");
      assert.equal(file.size, 7);
      assert.equal(file.sha256, createHash("sha256").update("payload").digest("hex"));
      assert.equal(file.sha512, createHash("sha512").update("payload").digest("base64"));
    });
  }
}

ReleaseFileTests.register();
