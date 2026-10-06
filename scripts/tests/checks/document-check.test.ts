/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import DocumentCheck from "../../checks/document-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class DocumentCheckTests {
  public static register(): void {
    test("well-formed files with working links pass", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ ".gitattributes": "* text=auto eol=lf\n", "README.md": "# TeamRun\n\nSee [the guide](docs/guide.md#usage).\n", "docs/guide.md": "## Usage\n", "logo.bin": Buffer.from([0, 1]) });
      const output = new TextOutputFixture();

      const passed = await DocumentCheckTests.createCheck(repository).runAsync(output);

      assert.equal(passed, true);
      assert.equal(output.text, "Checked 4 files and the links of 2 Markdown documents.\n");
      assert.equal(new DocumentCheck(repository.directory, new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()))).title,
        "Documents");
    });

    test("format problems in any text file, Markdown lines with more than one sentence, a missing line-ending rule and broken links fail the check", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "README.md": "# TeamRun\n\nSee [the guide](docs/missing.md). It is gone.\n", "notes.txt": "One. Two.\n", "scripts/tool.ts": "const value = 1; \n" });
      const output = new TextOutputFixture();

      const passed = await DocumentCheckTests.createCheck(repository).runAsync(output);

      assert.equal(passed, false);
      assert.equal(output.text, [
        "README.md:3: holds more than one sentence; put each sentence on its own line, as npm run format:documents does.",
        "scripts/tool.ts:1: ends with whitespace.",
        ".gitattributes: is missing; it holds \"* text=auto eol=lf\", which keeps every text file's line endings LF.",
        "README.md:3: the link \"docs/missing.md\" points to a missing file.",
        "Checked 3 files and the links of 1 Markdown documents.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): DocumentCheck {
    return new DocumentCheck(repository.directory, new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner())));
  }
}

DocumentCheckTests.register();
