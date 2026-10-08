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
import ModuleCatalog from "../../modules/module-catalog.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class ModuleFolderCheckTests {
  public static register(): void {
    test("a tree without modules and modules with valid ids and documents pass", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const empty = new TextOutputFixture();
      const valid = new TextOutputFixture();

      assert.equal(await ModuleFolderCheckTests.create(repository.directory).runAsync(empty), true);
      await repository.writeAsync({ "src/modules/checkpoints/README.md": "# Checkpoints\n", "src/modules/git-hub2/README.md": "# GitHub\n" });
      assert.equal(await ModuleFolderCheckTests.create(repository.directory).runAsync(valid), true);

      assert.equal(empty.text, "Checked 0 module folders.\n");
      assert.equal(valid.text, "Checked 2 module folders.\n");
      assert.equal(ModuleFolderCheckTests.create(repository.directory).title, "Module folders");
    });

    test("invalid or reserved ids, missing documents and stray files fail the check", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const reserved = "shell";
      await repository.writeAsync({
        [`src/modules/${reserved}/README.md`]: "# Reserved\n",
        "src/modules/Bad_Id/README.md": "# Bad\n",
        "src/modules/-dash/README.md": "# Dash\n",
        "src/modules/notes.md": "# Notes\n"
      });
      await mkdir(path.join(repository.directory, "src", "modules", "empty"));
      const output = new TextOutputFixture();

      const passed = await ModuleFolderCheckTests.create(repository.directory).runAsync(output);

      assert.equal(passed, false);
      assert.equal(output.text, [
        ...[
          `src/modules/-dash: "-dash" is not a module id; an id is lowercase kebab-case and not "${reserved}".`,
          `src/modules/Bad_Id: "Bad_Id" is not a module id; an id is lowercase kebab-case and not "${reserved}".`,
          "src/modules/empty has no README.md.",
          "src/modules/notes.md is not a module folder.",
          `src/modules/${reserved}: "${reserved}" is not a module id; an id is lowercase kebab-case and not "${reserved}".`
        ].sort(),
        "Checked 5 module folders.",
        ""
      ].join("\n"));
    });

    test("a module with parts needs a valid module.json, and fixture modules' declarations are checked too", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/modules/notes/README.md": "# Notes\n",
        "src/modules/notes/window/src/api/index.ts": "export {};\n",
        "src/modules/clock/README.md": "# Clock\n",
        "src/modules/clock/module.json": JSON.stringify({ id: "clock", version: "0.0.1", displayName: "Clock", description: "Used by the tests.", parts: [], dependencies: [], contributes: {} }),
        [`${ModuleCatalog.FIXTURE_FOLDER}/weather/module.json`]: JSON.stringify({ id: "weather", version: "0.0.1", displayName: " ", description: "Used by the tests.", parts: [], dependencies: [], contributes: {} })
      });
      const output = new TextOutputFixture();

      const passed = await ModuleFolderCheckTests.create(repository.directory).runAsync(output);

      assert.equal(passed, false);
      assert.equal(output.text, [
        "src/modules/notes has the parts window but no module.json.",
        `${ModuleCatalog.FIXTURE_FOLDER}/weather/module.json must have a display name.`,
        "Checked 2 module folders.",
        ""
      ].join("\n"));
    });
  }

  private static create(root: string): ModuleFolderCheck {
    return new ModuleFolderCheck(root, new ModuleCatalog(root));
  }
}

ModuleFolderCheckTests.register();
