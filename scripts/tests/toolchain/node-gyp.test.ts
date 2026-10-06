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

import ProcessResult from "../../processes/process-result.ts";
import ProcessException from "../../processes/process.exception.ts";
import NodeGyp from "../../toolchain/node-gyp.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";

class NodeGypTests {
  public static register(): void {
    test("node-gyp runs on this Node.js from the copy that the running npm bundles, and its result is returned", async () => {
      const result = new ProcessResult(0, "built", "");
      const runner = new ProcessRunnerFixture([], [result]);
      const npm = path.join("tools", "npm", "bin", "npm-cli.js");

      assert.equal(await new NodeGyp(runner, { npm_execpath: npm }).runAsync(["rebuild"], "work"), result);
      assert.deepEqual(runner.captured, [[process.execPath, "work", path.join("tools", "npm", "node_modules", "node-gyp", "bin", "node-gyp.js"), "rebuild"]]);
    });

    test("outside npm there is no npm path, and the command says how to run it", async () => {
      for (const environment of [{}, { npm_execpath: "" }])
        await assert.rejects(
          new NodeGyp(new ProcessRunnerFixture(), environment).runAsync(["rebuild"], "work"),
          new ProcessException("npm_execpath is not set; run this through npm, such as npm run build or npm test."));
    });
  }
}

NodeGypTests.register();
