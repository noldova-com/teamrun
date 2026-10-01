/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";

import TypeCheck from "../../checks/type-check.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

class TypeCheckTests {
  public static register(): void {
    test("the installed TypeScript compiler checks the scripts' project, and only exit code zero passes", async () => {
      const runner = new ProcessRunnerFixture([0, 2, null]);
      const check = new TypeCheck(SourceTreeFixture.root, runner);

      assert.equal(await check.runAsync(), true);
      assert.equal(await check.runAsync(), false);
      assert.equal(await check.runAsync(), false);

      assert.deepEqual(runner.runs[0], [
        process.execPath,
        SourceTreeFixture.root,
        path.join(SourceTreeFixture.root, "node_modules", "typescript", "bin", "tsc"),
        "--project",
        "scripts/tsconfig.json"
      ]);
      assert.equal(check.title, "Script types");
    });
  }
}

TypeCheckTests.register();
