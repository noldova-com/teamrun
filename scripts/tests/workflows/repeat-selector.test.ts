/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";

import ProcessRunner from "../../processes/process-runner.ts";
import Git from "../../repository/git.ts";
import RepositoryFiles from "../../repository/repository-files.ts";
import RepeatSelector from "../../workflows/repeat-selector.ts";
import RepeatException from "../../workflows/repeat.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";

class RepeatSelectorTests {
  private static readonly FILES: Readonly<Record<string, string>> = {
    "scripts/desktop/electron-binary.ts": "export default class ElectronBinary {}\n",
    "scripts/desktop/start.ts": "export {};\n",
    "scripts/tests/desktop/electron-binary.test.ts": "import RunnerFixture from \"../fixtures/runner.fixture.ts\";\n",
    "scripts/tests/fixtures/runner.fixture.ts": "import BaseFixture from \"./base.fixture.ts\";\n",
    "scripts/tests/fixtures/base.fixture.ts": "import \"./runner.fixture.ts\";\n",
    "scripts/tests/other.test.ts": "const fixture = await import(\"./fixtures/base.fixture.ts\");\n",
    "scripts/tests/unrelated.test.ts": "import assert from \"node:assert/strict\";\nimport Missing from \"./fixtures/missing.fixture.ts\";\n",
    "src/foundation/core/src/words.ts": "export {};\n",
    "src/foundation/core/tests/words.test.ts": "export {};\n",
    "src/shell/window/src/app/bar.component.ts": "export {};\n",
    "src/shell/window/src/app/bar.component.scss": ":host {}\n",
    "src/shell/window/tests/app/bar.component.spec.ts": "export {};\n",
    "src/shell/desktop/src/main.ts": "export {};\n",
    "src/shell/desktop/tests/e2e/menus.spec.ts": "import { test } from \"./fixtures/desktop.fixture\";\n",
    "src/shell/desktop/tests/e2e/settings.spec.ts": "import { test } from './fixtures/desktop.fixture.ts';\n",
    "src/shell/desktop/tests/e2e/quit.spec.ts": "export {};\n",
    "src/shell/desktop/tests/e2e/fixtures/desktop.fixture.ts": "export { park } from \"./pointer\";\n",
    "src/shell/desktop/tests/e2e/fixtures/pointer/index.ts": "export const park = 1;\n",
    "src/shell/desktop/tests/e2e/fixtures/unused.fixture.ts": "export {};\n",
    "docs/guide.md": "# Guide\n"
  };

  public static register(): void {
    test("a changed source file selects its mirrored test, a style its component's spec, and a file without a mirror or no longer present selects nothing", async t => {
      const selector = await RepeatSelectorTests.createAsync(t);

      const selection = await selector.selectAsync([
        "scripts/desktop/electron-binary.ts", "scripts/desktop/start.ts", "src/shell/window/src/app/bar.component.scss",
        "src/shell/desktop/src/main.ts", "docs/guide.md", "scripts/desktop/removed.ts"
      ], []);

      assert.deepEqual([selection.tests, selection.workflows], [["scripts/tests/desktop/electron-binary.test.ts", "src/shell/window/tests/app/bar.component.spec.ts"], []]);
    });

    test("a changed test selects itself, and a changed support file selects every test that imports it, directly or through other support files, and a support file nothing imports selects nothing", async t => {
      const selector = await RepeatSelectorTests.createAsync(t);

      const scripts = await selector.selectAsync(["scripts/tests/fixtures/base.fixture.ts", "src/foundation/core/tests/words.test.ts"], []);
      const workflows = await selector.selectAsync(["src/shell/desktop/tests/e2e/fixtures/pointer/index.ts", "src/shell/desktop/tests/e2e/fixtures/unused.fixture.ts"], []);

      assert.deepEqual([scripts.tests, scripts.workflows], [["scripts/tests/desktop/electron-binary.test.ts", "scripts/tests/other.test.ts", "src/foundation/core/tests/words.test.ts"], []]);
      assert.deepEqual([workflows.tests, workflows.workflows], [[], ["src/shell/desktop/tests/e2e/menus.spec.ts", "src/shell/desktop/tests/e2e/settings.spec.ts"]]);
    });

    test("files the Repeat line names are selected too, once each", async t => {
      const selector = await RepeatSelectorTests.createAsync(t);

      const selection = await selector.selectAsync(["src/shell/desktop/src/main.ts", "src/shell/desktop/tests/e2e/quit.spec.ts"], ["src/shell/desktop/tests/e2e/quit.spec.ts", "scripts/tests/other.test.ts"]);

      assert.deepEqual([selection.tests, selection.workflows], [["scripts/tests/other.test.ts"], ["src/shell/desktop/tests/e2e/quit.spec.ts"]]);
    });

    test("a Repeat line that names a file which isn't a test of this revision is refused, with every such name", async t => {
      const selector = await RepeatSelectorTests.createAsync(t);

      await assert.rejects(selector.selectAsync([], ["quit.spec.ts", "src/shell/desktop/src/main.ts", "scripts/tests/fixtures/base.fixture.ts", "scripts/tests/other.test.ts"]), new RepeatException(
        "The Repeat line names files that are not test or UI workflow files of this revision: quit.spec.ts, src/shell/desktop/src/main.ts, scripts/tests/fixtures/base.fixture.ts. " +
        "It names files by their path from the repository's root."));
    });
  }

  private static async createAsync(t: TestContext): Promise<RepeatSelector> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync(RepeatSelectorTests.FILES);
    return new RepeatSelector(repository.directory, new RepositoryFiles(repository.directory, new Git(repository.directory, new ProcessRunner())));
  }
}

RepeatSelectorTests.register();
