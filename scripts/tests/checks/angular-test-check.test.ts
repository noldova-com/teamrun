/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import AngularProject from "../../angular/angular-project.ts";
import AngularTestCheck from "../../checks/angular-test-check.ts";
import NpmCommand from "../../toolchain/npm-command.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";

class AngularTestCheckTests {
  public static register(): void {
    test("the check passes when the Angular tests and their coverage gate pass", async () => {
      const runner = new ProcessRunnerFixture([0, 1]);
      const check = new AngularTestCheck(new AngularProject("root", runner, new NpmCommand(runner, {})));

      assert.equal(check.title, "Angular tests and coverage");
      assert.equal(await check.runAsync(), true);
      assert.equal(await check.runAsync(), false);
      assert.equal(runner.runs.length, 2);
    });
  }
}

AngularTestCheckTests.register();
