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
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class GitTests {
  public static register(): void {
    test("reading returns Git's output in the repository, and a failed command throws with Git's message", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const revision = await repository.commitAsync({ "README.md": "# Fixture\n" });
      const git = new Git(repository.directory, new ProcessRunner());

      assert.equal((await git.readOutputAsync(["rev-parse", "HEAD"])).trim(), revision);
      await assert.rejects(
        git.readOutputAsync(["rev-parse", "--verify", "missing-branch"]),
        t => t instanceof ProcessException && /^"git rev-parse --verify missing-branch" failed with exit code 128: fatal: /.test(t.message));
    });

    test("a command succeeds only when Git exits with zero", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const revision = await repository.commitAsync({ "README.md": "# Fixture\n" });
      const git = new Git(repository.directory, new ProcessRunner());

      assert.equal(await git.succeedsAsync(["cat-file", "-e", `${revision}^{commit}`]), true);
      assert.equal(await git.succeedsAsync(["cat-file", "-e", `${"0".repeat(40)}^{commit}`]), false);
    });
  }
}

GitTests.register();
