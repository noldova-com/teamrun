/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ShellIndependenceCheck from "../../checks/shell-independence-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTree from "../../structure/source-tree.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ShellIndependenceCheckTests {
  public static register(): void {
    test("shell source that names no module passes, and tests and fixtures may name modules", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/modules/notes/README.md": "# Notes\n",
        "src/modules/notes/window/src/view.ts": "export const id = \"notes\";\n",
        "src/shell/window/src/app/panel.ts": "const text = \"Take notes\";\nconst folder = \"modules\";\n",
        "src/shell/window/src/app/panel.component.html": "<p>Take notes</p>\n",
        "src/shell/desktop/tests/e2e/fixtures/notes.fixture.ts": "export const id = \"notes\";\n",
        "src/foundation/core/tests/core.test.ts": "import \"@noldova/teamrun-modules-notes-window\";\n"
      });
      const output = new TextOutputFixture();

      const check = ShellIndependenceCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked 2 production files of the shell against 1 modules.\n");
      assert.equal(check.title, "Shell names no module");
    });

    test("each way production shell source can name a module fails with its file, line and rule", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/modules/notes/README.md": "# Notes\n",
        "src/shell/runtime/src/host.ts": [
          "import view from \"@noldova/teamrun-modules-notes-window\";",
          "if (id === \"notes\")",
          "  run(\"notes.open\");",
          "const source = \"../../modules/notes/window\";",
          "const label = `Open ${\"tr-notes-list\"}`;",
          "const plain = \"notebook\";",
          ""
        ].join("\n"),
        "src/shell/window/src/app/app.component.html": "<main>\n  <tr-notes-list></tr-notes-list>\n</main>\n",
        "src/shell/ui/src/styles/theme.scss": ":root {\n  --tr-notes-accent: red;\n}\n",
        "src/shell/window/package.json": "{\n  \"dependencies\": {\n    \"@noldova/teamrun-modules-notes-window\": \"0.0.1\"\n  },\n  \"id\": \"notes\"\n}\n"
      });
      const output = new TextOutputFixture();

      const passed = await ShellIndependenceCheckTests.createCheck(repository).runAsync(output);

      assert.equal(passed, false);
      const rule = "; the shell's production source names no module.";
      assert.equal(output.text, [
        `src/shell/runtime/src/host.ts:1: names the module package "@noldova/teamrun-modules-notes-window"${rule}`,
        `src/shell/runtime/src/host.ts:2: names module "notes"${rule}`,
        `src/shell/runtime/src/host.ts:3: names module "notes"${rule}`,
        `src/shell/runtime/src/host.ts:4: names module "notes"${rule}`,
        `src/shell/runtime/src/host.ts:5: names module "notes"${rule}`,
        `src/shell/ui/src/styles/theme.scss:2: names module "notes"${rule}`,
        `src/shell/window/package.json:3: names the module package "@noldova/teamrun-modules-notes-window"${rule}`,
        `src/shell/window/package.json:5: names module "notes"${rule}`,
        `src/shell/window/src/app/app.component.html:2: names module "notes"${rule}`,
        "Checked 4 production files of the shell against 1 modules.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): ShellIndependenceCheck {
    const directory = repository.directory;
    return new ShellIndependenceCheck(new SourceTree(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner()))));
  }
}

ShellIndependenceCheckTests.register();
