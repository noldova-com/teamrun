/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import TestMirror from "../../structure/test-mirror.ts";

class TestMirrorTests {
  public static register(): void {
    test("a package file's mirror is its test, an Angular file's and style's is its spec, and a script's is under scripts/tests", () => {
      const files = [
        "src/foundation/core/src/text/words.ts",
        "src/shell/runtime/src/host.mts",
        "src/shell/window/src/app/bar.component.ts",
        "src/shell/window/src/app/bar.component.scss",
        "src/modules/notes/window/src/app/list.ts",
        "scripts/desktop/electron-binary.ts",
        "scripts/test.ts"
      ];

      assert.deepEqual(files.map(t => TestMirror.locate(t)), [
        ["src/foundation/core/tests/text/words.test.ts"],
        ["src/shell/runtime/tests/host.test.ts"],
        ["src/shell/window/tests/app/bar.component.spec.ts"],
        ["src/shell/window/tests/app/bar.component.spec.ts"],
        ["src/modules/notes/window/tests/app/list.spec.ts"],
        ["scripts/tests/desktop/electron-binary.test.ts"],
        ["scripts/tests/test.test.ts"]
      ]);
    });

    test("tests, declarations, styles outside Angular packages and files outside a package's source have no mirror", () => {
      const files = [
        "scripts/tests/fixtures/runner.fixture.ts",
        "scripts/README.md",
        "src/foundation/core/src/api/index.d.ts",
        "src/foundation/core/src/theme.scss",
        "src/foundation/core/tests/text/words.test.ts",
        "src/shell/desktop/tests/e2e/menus.spec.ts",
        "docs/TESTING.md",
        "package.json"
      ];

      assert.deepEqual(files.map(t => TestMirror.locate(t)), files.map(() => []));
    });

    test("UI workflow files are the desktop's and each module's e2e files", () => {
      const files = ["src/shell/desktop/tests/e2e/menus.spec.ts", "src/modules/notes/e2e/fixtures/notes.fixture.ts", "src/shell/desktop/tests/main.test.ts", "src/modules/notes/window/tests/app/list.spec.ts"];

      assert.deepEqual(files.map(t => TestMirror.isWorkflow(t)), [true, true, false, false]);
    });
  }
}

TestMirrorTests.register();
