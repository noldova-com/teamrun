/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import ProcessResult from "../../processes/process-result.ts";
import ProcessException from "../../processes/process.exception.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";

class NpmCommandTests {
  public static register(): void {
    test("npm runs on this Node.js from the path npm itself provides, and its result is returned", async () => {
      const result = new ProcessResult(0, "packed", "");
      const runner = new ProcessRunnerFixture([], [result]);

      assert.equal(await new NpmCommand(runner, { npm_execpath: "/tools/npm/bin/npm-cli.js" }).runAsync(["pack", "--json"], "work"), result);
      assert.deepEqual(runner.captured, [[process.execPath, "work", "/tools/npm/bin/npm-cli.js", "pack", "--json"]]);
    });

    test("outside npm there is no npm path, and the command says how to run it", async () => {
      for (const environment of [{}, { npm_execpath: "" }])
        await assert.rejects(
          new NpmCommand(new ProcessRunnerFixture(), environment).runAsync(["pack"], "work"),
          new ProcessException("npm_execpath is not set; run this through npm, such as npm run build or npm test."));
    });
  }
}

NpmCommandTests.register();
