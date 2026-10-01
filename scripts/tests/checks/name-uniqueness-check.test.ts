/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import NameUniquenessCheck from "../../checks/name-uniqueness-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTree from "../../structure/source-tree.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class NameUniquenessCheckTests {
  public static register(): void {
    test("prefixed, unique selectors, tokens and package names pass, and tests and fixtures are not counted", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/ui/package.json": "{ \"name\": \"@noldova/teamrun-shell-ui\" }\n",
        "src/shell/ui/src/button.component.ts": "@Component({ selector: \"tr-button\" })\n",
        "src/shell/ui/src/tooltip.directive.ts": "@Directive({ selector: \"[trTooltip], tr-tooltip\" })\n",
        "src/shell/ui/src/styles/theme.scss": ":root {\n  --tr-text: #3b3b3b;\n}\n.dark {\n  --tr-text: #cccccc;\n  color: var(--tr-text);\n}\n",
        "src/shell/ui/tests/button.component.spec.ts": "@Component({ selector: \"tr-button\" })\n",
        "src/modules/notes/window/package.json": "{ \"name\": \"@noldova/teamrun-modules-notes-window\" }\n",
        "src/modules/notes/window/src/list.component.ts": "@Component({ selector: \"tr-notes-list\" })\n",
        "src/modules/notes/window/src/styles.scss": ".list {\n  --tr-notes-accent: red;\n}\n",
        "src/modules/notes/e2e/fixtures/package.json": "{ \"name\": \"@noldova/teamrun-modules-notes-window\" }\n"
      });
      const output = new TextOutputFixture();

      const check = NameUniquenessCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true);
      assert.equal(output.text, "Checked the selectors, style tokens and package names of 7 production files.\n");
      assert.equal(check.title, "Unique names");
    });

    test("equal names, names without their owner's prefix and invalid manifests fail", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/ui/package.json": "{ \"name\": \"@noldova/teamrun-shell-ui\" }\n",
        "src/shell/ui/src/button.component.ts": "@Component({ selector: \"tr-button\" })\n",
        "src/shell/ui/src/copy.component.ts": "@Component({\n  selector: \"tr-button\"\n})\n",
        "src/shell/ui/src/panel.component.ts": "@Component({ selector: \"panel\" })\n",
        "src/shell/ui/src/styles/theme.scss": ":root {\n  --tr-text: #3b3b3b;\n}\n",
        "src/modules/notes/window/package.json": "{ \"name\": \"@noldova/teamrun-shell-ui\" }\n",
        "src/modules/notes/window/src/list.component.ts": "@Component({ selector: \"tr-list\" })\n",
        "src/modules/notes/window/src/styles.scss": ".list {\n  --tr-notes-accent: red; --tr-text: red;\n}\n",
        "src/modules/notes/runtime/package.json": "{\n",
        "src/modules/notes/cli/package.json": "\"notes\"\n",
        "src/modules/notes/protocol/package.json": "null\n",
        "src/modules/tasks/runtime/package.json": "{}\n",
        "src/modules/tasks/window/package.json": "{ \"name\": 1 }\n"
      });
      const output = new TextOutputFixture();

      const passed = await NameUniquenessCheckTests.createCheck(repository).runAsync(output);

      assert.equal(passed, false);
      assert.equal(output.text, [
        "src/modules/notes/window/src/list.component.ts:1: the selector \"tr-list\" does not start with \"tr-notes-\".",
        "src/shell/ui/src/panel.component.ts:1: the selector \"panel\" does not start with \"tr-\".",
        "The selector \"tr-button\" is declared more than once: src/shell/ui/src/button.component.ts:1, src/shell/ui/src/copy.component.ts:2.",
        "src/modules/notes/window/src/styles.scss:2: the style token \"--tr-text\" does not start with \"--tr-notes-\".",
        "The style token \"--tr-text\" is defined by more than one owner: module \"notes\" (src/modules/notes/window/src/styles.scss:2), the shell (src/shell/ui/src/styles/theme.scss:2).",
        "src/modules/notes/runtime/package.json: the manifest is not valid JSON.",
        "The package name \"@noldova/teamrun-shell-ui\" is used by more than one manifest: src/modules/notes/window/package.json, src/shell/ui/package.json.",
        "Checked the selectors, style tokens and package names of 13 production files.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): NameUniquenessCheck {
    const directory = repository.directory;
    return new NameUniquenessCheck(new SourceTree(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner()))));
  }
}

NameUniquenessCheckTests.register();
