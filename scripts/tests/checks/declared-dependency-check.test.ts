/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import DeclaredDependencyCheck from "../../checks/declared-dependency-check.ts";
import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import SourceTree from "../../structure/source-tree.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class DeclaredDependencyCheckTests {
  public static register(): void {
    test("packages that import only what their manifests declare pass, and the Angular parts without manifests are not packages", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/package.json": "{ \"dependencies\": { \"rxjs\": \"7.8.2\" } }\n",
        "src/shell/runtime/package.json": JSON.stringify({
          name: "@noldova/teamrun-shell-runtime",
          dependencies: { "@noldova/teamrun-foundation-core": "__VERSION__" },
          peerDependencies: { "node-pty": "1.2.0" },
          optionalDependencies: { "fsevents": "2.3.3" }
        }),
        "src/shell/runtime/src/host.ts": [
          "import \"@noldova/teamrun-foundation-core\";",
          "import { spawn } from \"node:child_process\";",
          "import pty from \"node-pty\";",
          "import watch from \"fsevents/watch\";",
          "import Self from \"@noldova/teamrun-shell-runtime/internal\";",
          "import Local from \"./local.ts\";",
          ""
        ].join("\n"),
        "src/shell/runtime/tests/host.test.ts": "import \"vitest\";\n",
        "src/shell/ui/src/app/kit.ts": "import { Observable } from \"rxjs\";\n",
        "src/foundation/json/package.json": "{ \"name\": 7, \"dependencies\": null, \"peerDependencies\": \"none\" }\n",
        "src/foundation/json/src/reader.ts": "import \"./local.ts\";\n",
        "src/foundation/text/package.json": "[]\n",
        "src/foundation/text/src/span.ts": "import \"rxjs\";\n",
        "src/foundation/core/package.json": "\"core\"\n",
        "src/foundation/core/src/guid.ts": "import \"rxjs\";\n",
        "src/foundation/exceptions/package.json": "{\n",
        "src/foundation/exceptions/src/exception.ts": "import \"rxjs\";\n"
      });
      const output = new TextOutputFixture();

      const check = DeclaredDependencyCheckTests.createCheck(repository);

      assert.equal(await check.runAsync(output), true, output.text);
      assert.equal(output.text, "Checked the imports of 2 production script files of 2 packages.\n");
      assert.equal(check.title, "Declared dependencies");
    });

    test("a package importing what its manifest does not declare fails, such as an Angular-only package", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({
        "src/shell/runtime/package.json": "{ \"name\": \"@noldova/teamrun-shell-runtime\" }\n",
        "src/shell/runtime/src/host.ts": "import { Observable } from \"rxjs\";\nimport \"@angular/core/primitives\";\nimport fs from \"fs\";\n",
        "src/modules/notes/runtime/package.json": "{ \"name\": \"@noldova/teamrun-modules-notes-runtime\", \"dependencies\": {} }\n",
        "src/modules/notes/runtime/src/store.ts": "import \"@noldova/teamrun-foundation-data\";\n"
      });
      const output = new TextOutputFixture();

      const passed = await DeclaredDependencyCheckTests.createCheck(repository).runAsync(output);

      assert.equal(passed, false);
      const rule = "does not declare; a package imports only what its manifest declares.";
      assert.equal(output.text, [
        `src/modules/notes/runtime/src/store.ts:1: the import "@noldova/teamrun-foundation-data" uses "@noldova/teamrun-foundation-data", which src/modules/notes/runtime/package.json ${rule}`,
        `src/shell/runtime/src/host.ts:1: the import "rxjs" uses "rxjs", which src/shell/runtime/package.json ${rule}`,
        `src/shell/runtime/src/host.ts:2: the import "@angular/core/primitives" uses "@angular/core", which src/shell/runtime/package.json ${rule}`,
        `src/shell/runtime/src/host.ts:3: the import "fs" uses "fs", which src/shell/runtime/package.json ${rule}`,
        "Checked the imports of 2 production script files of 2 packages.",
        ""
      ].join("\n"));
    });
  }

  private static createCheck(repository: RepositoryFixture): DeclaredDependencyCheck {
    const directory = repository.directory;
    return new DeclaredDependencyCheck(new SourceTree(directory, new RepositoryFiles(directory, new Git(directory, new ProcessRunner()))));
  }
}

DeclaredDependencyCheckTests.register();
