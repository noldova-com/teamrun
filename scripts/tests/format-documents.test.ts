/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import FormatDocuments from "../format-documents.ts";
import ProcessRunner from "../processes/process-runner.ts";
import Git from "../repository/git.ts";
import RepositoryFiles from "../repository/repository-files.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class FormatDocumentsTests {
  public static register(): void {
    test("every Markdown document gets one sentence per line, and only the changed ones are written and named", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "README.md": "# TeamRun\n\nOne. Two.\n",
        "docs/guide.md": "Already one sentence.\n",
        "src/modules/notes/README.md": "- An item. Its second sentence.\n",
        "notes.txt": "Not Markdown. Left alone.\n"
      });
      const output = new TextOutputFixture();

      const exitCode = await FormatDocumentsTests.create(repository, output).runAsync([]);

      assert.equal(exitCode, 0);
      assert.equal(output.text, "README.md\nsrc/modules/notes/README.md\nPut each sentence on its own line in 2 of 3 documents.\n");
      assert.deepEqual(await Promise.all(["README.md", "docs/guide.md", "src/modules/notes/README.md", "notes.txt"].map(t => readFile(path.join(repository.directory, t), "utf8"))), [
        "# TeamRun\n\nOne.\nTwo.\n",
        "Already one sentence.\n",
        "- An item.\n  Its second sentence.\n",
        "Not Markdown. Left alone.\n"
      ]);
    });

    test("any argument is refused with the usage, and the command exits with the result", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "README.md": "One. Two.\n" });
      const output = new TextOutputFixture();
      const environment = { ...process.env };
      delete environment["GITHUB_STEP_SUMMARY"];

      const refused = await FormatDocumentsTests.create(repository, output).runAsync(["docs"]);
      const run = spawnSync(process.execPath, [SourceTreeFixture.locateScript("format-documents.ts")], { cwd: repository.directory, env: environment, encoding: "utf8", timeout: 10_000 });

      assert.deepEqual([refused, output.text], [2, "Usage: npm run format:documents\n"]);
      assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
      assert.equal(run.stdout, "README.md\nPut each sentence on its own line in 1 of 1 documents.\n");
      assert.equal(await readFile(path.join(repository.directory, "README.md"), "utf8"), "One.\nTwo.\n");
    });
  }

  private static create(repository: RepositoryFixture, output: TextOutputFixture): FormatDocuments {
    const directory = repository.directory;
    return new FormatDocuments(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())), output);
  }
}

FormatDocumentsTests.register();
