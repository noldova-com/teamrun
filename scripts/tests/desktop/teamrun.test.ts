/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import TeamRunCommand from "../../desktop/teamrun.ts";
import PreparedBinaryFixture from "../fixtures/prepared-binary.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
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

    test("the command runs the command line on the prepared binary and exits with its exit code", { timeout: 60_000 }, async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const platform = process.platform === "win32" ? "win32" : "linux";
      const root = realpathSync(repository.directory);
      const entry = JSON.stringify(path.join(root, "node_modules", "@noldova", "teamrun-shell-cli", "services", "cli-entry.js"));
      await repository.writeAsync({
        "package.json": `${JSON.stringify({ ...ProductIdentityFixture.manifest(), version: "1.2.3" })}\n`,
        "node_modules/electron/package.json": "{ \"version\": \"44.5.1\" }\n",
        "node_modules/@noldova/teamrun-shell-cli/services/cli-entry.js":
          `process.exit(process.argv[1] === ${entry} && process.argv.at(-1) === "status" && process.env.ELECTRON_RUN_AS_NODE === "1" && process.env.TEAMRUN_CHECKOUT === ${JSON.stringify(root)} ? 4 : 6);\n`,
        "assets/fixture-icons/icon-dark.ico": await readFile(path.join(SourceTreeFixture.root, "assets", "icons", "icon-dark.ico")),
        "assets/fixture-icons/icon-dock-512.png": await readFile(path.join(SourceTreeFixture.root, "assets", "icons", "icon-dock-512.png"))
      });
      const program = path.join(repository.directory, "node_modules", "electron", "dist", platform === "win32" ? "electron.exe" : "electron");
      await mkdir(path.dirname(program), { recursive: true });
      await copyFile(process.execPath, program);
      const environment = { ...process.env };
      delete environment["INIT_CWD"];

      const result = spawnSync(process.execPath, [
        "--import", `data:text/javascript,Object.defineProperty(process, "platform", { value: "${platform}" });`,
        SourceTreeFixture.locateScript(path.join("desktop", "teamrun.ts")),
        "status"
      ], { cwd: repository.directory, env: environment, encoding: "utf8", timeout: 60_000 });

      assert.equal(result.status, 4, result.stderr);
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
