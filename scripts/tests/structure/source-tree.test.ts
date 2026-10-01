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
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTree from "../../structure/source-tree.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class SourceTreeTests {
  public static register(): void {
    test("the tree lists the shell's and the modules' source files with their owner, role and package", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "README.md": "# TeamRun\n",
        "src/other/file.ts": "",
        "src/modules/stray.ts": "",
        "src/modules/alpha/README.md": "# Alpha\n",
        "src/modules/beta/notes.txt": "",
        "src/modules/beta/window/package.json": "{}\n",
        "src/modules/beta/window/src/app/view.ts": "view",
        "src/modules/beta/e2e/fixtures/fixture.ts": "",
        "src/modules/beta/loose.ts": "",
        "src/shell/loose.ts": "",
        "src/shell/window/package.json": "{}\n",
        "src/shell/window/src/app/app.component.html": "<main></main>\n",
        "src/shell/window/tests/app/app.component.spec.ts": "",
        "src/foundation/core/src/guid.ts": ""
      });

      const inventory = await new SourceTree(repository.directory, new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner()))).readAsync();

      assert.deepEqual(inventory.moduleIds, ["alpha", "beta"]);
      assert.deepEqual(inventory.files.map(t => [t.path, t.owner, t.isProduction, t.packageRoot]), [
        ["src/foundation/core/src/guid.ts", "shell", true, "src/foundation"],
        ["src/modules/beta/e2e/fixtures/fixture.ts", "beta", false, "src/modules/beta"],
        ["src/modules/beta/loose.ts", "beta", true, "src/modules/beta"],
        ["src/modules/beta/window/package.json", "beta", true, "src/modules/beta/window"],
        ["src/modules/beta/window/src/app/view.ts", "beta", true, "src/modules/beta/window"],
        ["src/shell/loose.ts", "shell", true, "src/shell"],
        ["src/shell/window/package.json", "shell", true, "src/shell/window"],
        ["src/shell/window/src/app/app.component.html", "shell", true, "src/shell/window"],
        ["src/shell/window/tests/app/app.component.spec.ts", "shell", false, "src/shell/window"]
      ]);
      assert.equal(inventory.files[4]?.text, "view");
      assert.equal(SourceTree.SHELL_OWNER, "shell");
    });
  }
}

SourceTreeTests.register();
