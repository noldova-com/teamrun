/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class RepositoryFilesTests {
  public static register(): void {
    test("the list holds tracked and new files that exist, sorted, without ignored ones", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.commitAsync({ ".gitignore": "ignored/\n", "z.md": "z\n", "docs/deleted.md": "gone\n", "a b.txt": "a\n" });
      await repository.writeAsync({ "new.md": "new\n", "ignored/file.txt": "ignored\n" });
      await rm(path.join(repository.directory, "docs", "deleted.md"));

      const files = await new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner())).listAsync();

      assert.deepEqual(files, [".gitignore", "a b.txt", "new.md", "z.md"]);
    });
  }
}

RepositoryFilesTests.register();
