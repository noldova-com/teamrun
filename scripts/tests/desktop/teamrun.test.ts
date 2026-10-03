/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { test } from "node:test";

import TeamRunCommand from "../../desktop/teamrun.ts";
import PreparedBinaryFixture from "../fixtures/prepared-binary.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class TeamRunCommandTests {
  public static register(): void {
    test("npm run teamrun runs the command line on the prepared binary in Node mode, with the checkout's data, from where npm started", async () => {
      const root = path.resolve("repository");
      const runner = new ProcessRunnerFixture([4, null]);
      const report = new TextOutputFixture();
      const command = new TeamRunCommand(root, runner, new PreparedBinaryFixture());

      const exitCode = await command.runAsync(["status", "--json"], { PATH: "bin", INIT_CWD: path.resolve("work") }, report);
      const signalled = await command.runAsync([], { PATH: "bin" }, report);

      assert.equal(exitCode, 4);
      assert.equal(signalled, 1);
      assert.equal(report.text, "prepared\nprepared\n");
      assert.deepEqual(runner.runs[0], [PreparedBinaryFixture.EXECUTABLE, path.resolve("work"), path.join(root, "node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js"), "status", "--json"]);
      assert.deepEqual(runner.environments[0], { PATH: "bin", INIT_CWD: path.resolve("work"), ELECTRON_RUN_AS_NODE: "1", TEAMRUN_CHECKOUT: root });
      assert.equal(runner.runs[1]?.[1], root);
    });

    test("the command fails without starting anything outside a checkout with a product", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      const result = spawnSync(process.execPath, [SourceTreeFixture.locateScript(path.join("desktop", "teamrun.ts")), "status"], { cwd: repository.directory, encoding: "utf8", timeout: 30_000 });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /The root package\.json must declare a numbered version/);
    });
  }
}

TeamRunCommandTests.register();
