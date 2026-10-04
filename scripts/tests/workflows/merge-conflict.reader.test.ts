/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProcessRunner from "../../processes/process-runner.ts";
import ProcessException from "../../processes/process.exception.ts";
import Git from "../../repository/git.ts";
import MergeConflictReader from "../../workflows/merge-conflict.reader.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class MergeConflictReaderTests {
  public static register(): void {
    test("the files a pull request's head conflicts in with the default branch are read from Git unquoted, none for a clean merge", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const base = await repository.commitAsync({ "a.txt": "one\n", "b.txt": "one\n", "café notes.txt": "one\n" });
      repository.git(["update-ref", "refs/pull/7/head", await repository.commitAsync({ "a.txt": "two\n", "café notes.txt": "two\n" })]);
      repository.git(["reset", "--quiet", "--hard", base]);
      repository.git(["update-ref", "refs/pull/8/head", await repository.commitAsync({ "b.txt": "two\n" })]);
      repository.git(["reset", "--quiet", "--hard", base]);
      await repository.commitAsync({ "a.txt": "three\n", "café notes.txt": "three\n" });
      repository.git(["remote", "add", "origin", repository.directory]);
      const reader = new MergeConflictReader(new Git(repository.directory, new ProcessRunner()));

      assert.deepEqual(await reader.readFilesAsync("main", 7), ["a.txt", "café notes.txt"]);
      assert.deepEqual(await reader.readFilesAsync("main", 8), []);
      await assert.rejects(reader.readFilesAsync("main", 9), ProcessException);
    });
  }
}

MergeConflictReaderTests.register();
