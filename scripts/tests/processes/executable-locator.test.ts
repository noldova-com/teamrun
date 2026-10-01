/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import ExecutableLocator from "../../processes/executable-locator.ts";

class ExecutableLocatorTests {
  public static register(): void {
    test("Windows starts a program by name, which it looks up without starting processes", () => {
      assert.equal(ExecutableLocator.locate("git", "win32", "C:\\Program Files\\Git\\cmd"), "git");
    });

    test("other platforms start the first executable file on the search path by its full path", async t => {
      const root = await mkdtemp(path.join(tmpdir(), "teamrun-locator-"));
      t.after(() => rm(root, { recursive: true, force: true }));
      const folderNamedGit = path.join(root, "folder");
      const executable = path.join(root, "bin");
      await mkdir(path.join(folderNamedGit, "git"), { recursive: true });
      await mkdir(executable);
      await writeFile(path.join(executable, "git"), "", { mode: 0o755 });
      const searchPath = ["relative", path.join(root, "missing"), folderNamedGit, executable].join(path.delimiter);

      assert.equal(ExecutableLocator.locate("git", "linux", searchPath), path.join(executable, "git"));
      assert.equal(ExecutableLocator.locate("git", "darwin", [path.join(root, "missing"), folderNamedGit].join(path.delimiter)), "git");
    });

    test("without a platform and path it searches this process's, which may have no path", t => {
      assert.match(ExecutableLocator.locate("git"), /git(\.exe)?$/);

      const searchPath = process.env["PATH"];
      t.after(() => {
        process.env["PATH"] = searchPath;
      });
      delete process.env["PATH"];
      assert.equal(ExecutableLocator.locate("git", "linux"), "git");
    });
  }
}

ExecutableLocatorTests.register();
