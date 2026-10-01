/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import ModuleFolderCheck from "../../checks/module-folder-check.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ModuleFolderCheckTests {
  public static register(): void {
    test("a tree without modules and modules with valid ids and documents pass", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const empty = new TextOutputFixture();
      const valid = new TextOutputFixture();

      assert.equal(await new ModuleFolderCheck(repository.directory).runAsync(empty), true);
      await repository.writeAsync({ "src/modules/checkpoints/README.md": "# Checkpoints\n", "src/modules/git-hub2/README.md": "# GitHub\n" });
      assert.equal(await new ModuleFolderCheck(repository.directory).runAsync(valid), true);

      assert.equal(empty.text, "Checked 0 module folders.\n");
      assert.equal(valid.text, "Checked 2 module folders.\n");
      assert.equal(new ModuleFolderCheck(repository.directory).title, "Module folders");
    });

    test("invalid or reserved ids, missing documents and stray files fail the check", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/modules/shell/README.md": "# Shell\n",
        "src/modules/Bad_Id/README.md": "# Bad\n",
        "src/modules/-dash/README.md": "# Dash\n",
        "src/modules/notes.md": "# Notes\n"
      });
      await mkdir(path.join(repository.directory, "src", "modules", "empty"));
      const output = new TextOutputFixture();

      const passed = await new ModuleFolderCheck(repository.directory).runAsync(output);

      assert.equal(passed, false);
      assert.equal(output.text, [
        "src/modules/-dash: \"-dash\" is not a module id; an id is lowercase kebab-case and not \"shell\".",
        "src/modules/Bad_Id: \"Bad_Id\" is not a module id; an id is lowercase kebab-case and not \"shell\".",
        "src/modules/empty has no README.md.",
        "src/modules/notes.md is not a module folder.",
        "src/modules/shell: \"shell\" is not a module id; an id is lowercase kebab-case and not \"shell\".",
        "Checked 5 module folders.",
        ""
      ].join("\n"));
    });
  }
}

ModuleFolderCheckTests.register();
