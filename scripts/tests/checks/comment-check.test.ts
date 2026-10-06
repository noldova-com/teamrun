/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import CommentCheck from "../../checks/comment-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import LicenseHeader from "../../structure/license-header.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class CommentCheckTests {
  public static register(): void {
    test("scripts, styles and markup with only the license header pass, and API declarations and other formats are not checked", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "scripts/build.ts": `${LicenseHeader.BLOCK}\nexport const url = "https://example.com/*";\n`,
        "src/shell/ui/src/styles/theme.scss": `${LicenseHeader.BLOCK}\n:root { background: url(//cdn.example/a.png); }\n`,
        "src/shell/ui/src/app/button.component.html": `${LicenseHeader.MARKUP}\n<button></button>\n`,
        "src/shell/ui/src/api/index.d.ts": `${LicenseHeader.BLOCK}\n/**\n * Declares the kit.\n */\nexport {};\n`,
        "README.md": "# TeamRun\n\n<!-- A note. -->\n",
        ".github/workflows/build.yml": `${LicenseHeader.YAML}\n# A note.\nname: Build\n`
      });
      const output = new TextOutputFixture();

      const check = CommentCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 3 files for comments other than the license header.\n");
      assert.equal(check.title, "Comments");
    });

    test("any other comment fails with its file and line, including documentation outside the API declarations and a header that is not first", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "scripts/note.ts": `${LicenseHeader.BLOCK}\n// A note.\nexport {};\n`,
        "scripts/late.mjs": `export {};\n${LicenseHeader.BLOCK}`,
        "src/shell/ui/src/styles/theme.scss": `${LicenseHeader.BLOCK}\n:root {}\n// A note.\n`,
        "src/shell/ui/src/styles/base.css": "/* A note. */\n:root {}\n",
        "src/shell/ui/src/app/button.component.html": `${LicenseHeader.MARKUP}\n<button></button> <!-- A note. -->\n`,
        "src/shell/ui/src/types.d.ts": `${LicenseHeader.BLOCK}\n/**\n * Declares a type.\n */\nexport {};\n`
      });
      const output = new TextOutputFixture();

      assert.equal(await CommentCheckTests.createCheck(repository).runAsync(output), false);
      const rule = ": holds a comment; CODING-STANDARDS.md section 9 allows only the license header in source, tests, scripts and styles.";
      assert.equal(output.text, [
        `scripts/late.mjs:2${rule}`,
        `scripts/note.ts:9${rule}`,
        `src/shell/ui/src/app/button.component.html:9${rule}`,
        `src/shell/ui/src/styles/base.css:1${rule}`,
        `src/shell/ui/src/styles/theme.scss:10${rule}`,
        `src/shell/ui/src/types.d.ts:9${rule}`,
        "Checked 6 files for comments other than the license header.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): CommentCheck {
    const directory = repository.directory;
    return new CommentCheck(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())));
  }
}

CommentCheckTests.register();
