/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ModuleImportCheck from "../../checks/module-import-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTree from "../../structure/source-tree.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ModuleImportCheckTests {
  public static register(): void {
    test("modules that import their own packages, foundation, the shell's APIs, built-ins and external packages pass", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/modules/notes/window/package.json": "{}\n",
        "src/modules/notes/window/src/view.ts": [
          "import \"@noldova/teamrun-foundation-core\";",
          "import { readFile } from \"node:fs/promises\";",
          "import { Component } from \"@angular/core\";",
          "import type { IHost } from \"@noldova/teamrun-shell-window\";",
          "import { Note } from \"@noldova/teamrun-modules-notes-protocol\";",
          "import { List } from \"@noldova/teamrun-modules-notes-window/list\";",
          "import Row from \"./row.ts\";",
          "import Same from \"../src/same.ts\";",
          ""
        ].join("\n"),
        "src/modules/notes/loose.ts": "import \"./other.ts\";\n",
        "src/modules/notes/window/tests/view.spec.ts": "import \"../../../other/window/src/internal.ts\";\n",
        "src/modules/notes/window/src/styles.scss": "@import \"../../../other/theme\";\n",
        "src/shell/window/src/app.ts": "import \"../../../modules/notes/window/src/view.ts\";\n"
      });
      const output = new TextOutputFixture();

      const check = ModuleImportCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked the imports of 2 production script files of modules.\n");
      assert.equal(check.title, "Module imports");
    });

    test("imports from outside the package, inside another package's API, of another module or of other TeamRun packages fail", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/modules/notes/window/package.json": "{}\n",
        "src/modules/notes/window/src/view.ts": [
          "import Data from \"../../runtime/src/data.ts\";",
          "import \"/src/modules/notes/window/src/view.ts\";",
          "import { Panel } from \"@noldova/teamrun-shell-window/src/panel.ts\";",
          "import \"@noldova/teamrun-foundation-core/core.extensions\";",
          "const tasks = await import(\"@noldova/teamrun-modules-tasks-protocol\");",
          "import \"@noldova/teamrun-modules-tasks\";",
          "import \"@noldova/teamrun-scripts\";",
          ""
        ].join("\n")
      });
      const output = new TextOutputFixture();

      const passed = await ModuleImportCheckTests.createCheck(repository).runAsync(output);

      assert.equal(passed, false);
      const file = "src/modules/notes/window/src/view.ts";
      const rule = "; a module uses only its own packages, foundation, the shell's published APIs and the published APIs of the modules it declares.";
      assert.equal(output.text, [
        `${file}:1: the import "../../runtime/src/data.ts" comes from outside its package src/modules/notes/window${rule}`,
        `${file}:2: the import "/src/modules/notes/window/src/view.ts" is an absolute path${rule}`,
        `${file}:3: the import "@noldova/teamrun-shell-window/src/panel.ts" is not the published API of @noldova/teamrun-shell-window; import the package itself${rule}`,
        `${file}:4: the import "@noldova/teamrun-foundation-core/core.extensions" is not the published API of @noldova/teamrun-foundation-core; import the package itself${rule}`,
        `${file}:5: the import "@noldova/teamrun-modules-tasks-protocol" belongs to module "tasks", but module "notes" declares no dependency on "tasks"${rule}`,
        `${file}:6: the import "@noldova/teamrun-modules-tasks" is not a TeamRun package a module may use${rule}`,
        `${file}:7: the import "@noldova/teamrun-scripts" is not a TeamRun package a module may use${rule}`,
        "Checked the imports of 1 production script files of modules.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): ModuleImportCheck {
    const directory = repository.directory;
    return new ModuleImportCheck(new SourceTree(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner()))));
  }
}

ModuleImportCheckTests.register();
