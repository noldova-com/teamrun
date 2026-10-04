/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import LicenseHeaderCheck from "../../checks/license-header-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import LicenseHeader from "../../structure/license-header.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class LicenseHeaderCheckTests {
  public static register(): void {
    test("every format that supports comments starts with its form of the header, and other formats are not checked", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "scripts/build.ts": `${LicenseHeader.BLOCK}\nexport {};\n`,
        "src/shell/ui/src/styles/theme.scss": `${LicenseHeader.BLOCK}\n:root {}\n`,
        "src/shell/ui/src/app/button.component.html": `${LicenseHeader.MARKUP}\n<button></button>\n`,
        ".github/workflows/build.yml": `${LicenseHeader.YAML}\nname: Build\n`,
        "README.md": "# TeamRun\n",
        "package.json": "{}\n"
      });
      const output = new TextOutputFixture();

      const check = LicenseHeaderCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked the license headers of 4 files.\n");
      assert.equal(check.title, "License headers");
    });

    test("a missing, altered or misplaced header, or another format's header, fails with the file", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "scripts/missing.mjs": "export {};\n",
        "scripts/altered.ts": LicenseHeader.BLOCK.replace("Noldova", "Someone"),
        "src/late.css": `:root {}\n${LicenseHeader.BLOCK}`,
        "src/template.html": `${LicenseHeader.BLOCK}<p></p>\n`,
        ".github/config.yaml": "name: Config\n"
      });
      const output = new TextOutputFixture();

      assert.equal(await LicenseHeaderCheckTests.createCheck(repository).runAsync(output), false);
      const rule = ": does not start with the license header that CODING-STANDARDS.md section 12 gives for its format.";
      assert.equal(output.text, [
        `.github/config.yaml${rule}`,
        `scripts/altered.ts${rule}`,
        `scripts/missing.mjs${rule}`,
        `src/late.css${rule}`,
        `src/template.html${rule}`,
        "Checked the license headers of 5 files.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): LicenseHeaderCheck {
    const directory = repository.directory;
    return new LicenseHeaderCheck(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner())));
  }
}

LicenseHeaderCheckTests.register();
