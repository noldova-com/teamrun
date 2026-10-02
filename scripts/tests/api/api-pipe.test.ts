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
  private static readonly SOCKET_PATH_LIMIT: number = 100;

  public static register(): void {
    test("Windows uses a named pipe with a unique name and needs no removal", async () => {
      const first = await ApiPipe.createAsync("win32");
      const second = await ApiPipe.createAsync("win32");

      assert.match(first.name, new RegExp(`^\\\\\\\\\\.\\\\pipe\\\\teamrun-api-${process.pid}-[0-9a-f]{12}$`));
      assert.notEqual(first.name, second.name);
      await first.removeAsync();
    });

    test("Linux and macOS use a socket in a dedicated folder under the given root, removed with it", async t => {
      const root = await mkdtemp(path.join(tmpdir(), "teamrun-pipe-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      const pipe = await ApiPipe.createAsync("linux", root);
      const folder = path.dirname(pipe.name);
      await writeFile(pipe.name, "");

      assert.equal(path.dirname(folder), root);
      assert.match(path.basename(folder), /^tr-api-[A-Za-z0-9]{6}$/);
      assert.equal(path.basename(pipe.name), "api.sock");
      await pipe.removeAsync();
      assert.equal(existsSync(folder), false);
      await pipe.removeAsync();
    });

    test("by default the socket path stays short whatever the temporary folder is", { skip: process.platform === "win32" ? "Windows uses a named pipe." : false }, async t => {
      const original = process.env["TMPDIR"];
      process.env["TMPDIR"] = path.join(path.sep, "x".repeat(ApiPipeTests.SOCKET_PATH_LIMIT));
      t.after(() => {
        if (original === undefined)
          delete process.env["TMPDIR"];
        else
          process.env["TMPDIR"] = original;
      });
      const pipe = await ApiPipe.createAsync("linux");
      t.after(() => pipe.removeAsync());

      assert.ok(pipe.name.length < ApiPipeTests.SOCKET_PATH_LIMIT, pipe.name);
      assert.ok(existsSync(path.dirname(pipe.name)));
    });
  }
}

ApiPipeTests.register();
