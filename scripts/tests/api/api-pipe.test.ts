/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import ApiPipe from "../../api/api-pipe.ts";

class ApiPipeTests {
  public static register(): void {
    test("Windows uses a named pipe with a unique name", () => {
      const first = new ApiPipe("win32", "unused");
      const second = new ApiPipe("win32", "unused");

      assert.match(first.name, new RegExp(`^\\\\\\\\\\.\\\\pipe\\\\teamrun-api-${process.pid}-[0-9a-f]{12}$`));
      assert.notEqual(first.name, second.name);
    });

    test("Linux and macOS use a socket file in the given folder, removed after use", async t => {
      const directory = await mkdtemp(path.join(tmpdir(), "teamrun-pipe-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const pipe = new ApiPipe("linux", directory);
      await writeFile(pipe.name, "");

      assert.equal(path.dirname(pipe.name), directory);
      assert.match(path.basename(pipe.name), /^teamrun-api-\d+-[0-9a-f]{12}\.sock$/);
      await pipe.removeAsync();
      assert.equal(existsSync(pipe.name), false);
      await pipe.removeAsync();
    });

    test("a named pipe needs no removal", async t => {
      const directory = await mkdtemp(path.join(tmpdir(), "teamrun-pipe-"));
      t.after(() => rm(directory, { recursive: true, force: true }));
      const marker = path.join(directory, "kept");
      await writeFile(marker, "");

      await new ApiPipe("win32", directory).removeAsync();
      assert.equal(existsSync(marker), true);
    });
  }
}

ApiPipeTests.register();
