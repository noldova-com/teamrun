/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import TemporaryFolder from "../../processes/temporary-folder.ts";

class TemporaryFolderTests {
  public static register(): void {
    test("Windows keeps its own temporary folder, and every other system uses /tmp so a socket path inside stays short", () => {
      assert.deepEqual(["win32", "linux", "darwin"].map(t => TemporaryFolder.locateRoot(t)), [tmpdir(), "/tmp", "/tmp"]);
    });

    test("a new folder is made under the host's root with the prefix, and its real path is returned", async t => {
      const folder = await new TemporaryFolder().createAsync(process.platform, "tr-folder-");
      t.after(() => rm(folder, { recursive: true, force: true }));

      assert.equal(path.dirname(folder), realpathSync(TemporaryFolder.locateRoot(process.platform)));
      assert.ok(path.basename(folder).startsWith("tr-folder-"));
      assert.equal((await stat(folder)).isDirectory(), true);
    });
  }
}

TemporaryFolderTests.register();
