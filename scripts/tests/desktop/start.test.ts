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
import { copyFile, mkdir, readFile, symlink } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import SandboxHelper from "../../desktop/sandbox-helper.ts";
import Start from "../../desktop/start.ts";
import PreparedBinaryFixture from "../fixtures/prepared-binary.fixture.ts";
import ProcessRunnerFixture from "../fixtures/process-runner.fixture.ts";
import ProductIdentityFixture from "../fixtures/product-identity.fixture.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class StartTests {
  private static readonly RESTRICTION: string = "/proc/sys/kernel/apparmor_restrict_unprivileged_userns";

  public static register(): void {
    test("npm start launches the prepared binary with the desktop's main script, without Electron's Node mode", async () => {
      const root = path.resolve("repository");
      const runner = new ProcessRunnerFixture([3, null]);
      const report = new TextOutputFixture();
      const start = new Start(root, runner, new PreparedBinaryFixture(), StartTests.createSandbox("win32", 0o100755));

      const exitCode = await start.runAsync(["--data-dir=data"], { PATH: "bin", ELECTRON_RUN_AS_NODE: "1" }, report);
      const signalled = await start.runAsync([], {}, report);

      assert.equal(exitCode, 3);
      assert.equal(signalled, 1);
      assert.equal(report.text, "prepared\nprepared\n");
      assert.deepEqual(runner.runs[0], [PreparedBinaryFixture.EXECUTABLE, root, path.join(root, "node_modules", "@noldova", "teamrun-shell-desktop", "main.js"), "--data-dir=data"]);
      assert.deepEqual(runner.environments[0], { PATH: "bin" });
    });

    test("a sandbox helper that needs its one-time setup stops the start with the instruction instead of Chromium's abort", async () => {
      const runner = new ProcessRunnerFixture();
      const report = new TextOutputFixture();
      const start = new Start(path.resolve("repository"), runner, new PreparedBinaryFixture(), StartTests.createSandbox("linux", 0o100755));

      const exitCode = await start.runAsync([], {}, report);

      assert.equal(exitCode, 1);
      const helper = path.join(path.dirname(PreparedBinaryFixture.EXECUTABLE), "chrome-sandbox");
      assert.ok(report.text.startsWith("prepared\nThis system restricts unprivileged user namespaces"));
      assert.ok(report.text.includes(`sudo chown root:root '${helper}' && sudo chmod 4755 '${helper}'`));
      assert.equal(runner.runs.length, 0);
    });

    test("the command starts the prepared binary with the desktop's canonical main script, also from a link, and exits with its exit code", { timeout: 60_000 }, async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const platform = process.platform === "win32" ? "win32" : "linux";
      const link = path.join(path.dirname(repository.directory), "link");
      await symlink(repository.directory, link, "junction");
      const main = JSON.stringify(path.join(realpathSync(repository.directory), "node_modules", "@noldova", "teamrun-shell-desktop", "main.js"));
      await repository.writeAsync({
        "package.json": `${JSON.stringify({ ...ProductIdentityFixture.manifest(), version: "1.2.3" })}\n`,
        "node_modules/electron/package.json": "{ \"version\": \"44.5.1\" }\n",
        "node_modules/@noldova/teamrun-shell-desktop/main.js":
          `process.exit(process.argv[1] === ${main} && process.argv.at(-1) === "--data-dir=data" && process.env.ELECTRON_RUN_AS_NODE === undefined ? 5 : 6);\n`,
        "assets/fixture-icons/icon-dark.ico": await readFile(path.join(SourceTreeFixture.root, "assets", "icons", "icon-dark.ico")),
        "assets/fixture-icons/icon-dock-512.png": await readFile(path.join(SourceTreeFixture.root, "assets", "icons", "icon-dock-512.png"))
      });
      const program = path.join(repository.directory, "node_modules", "electron", "dist", platform === "win32" ? "electron.exe" : "electron");
      await mkdir(path.dirname(program), { recursive: true });
      await copyFile(process.execPath, program);

      const run = (directory: string): ReturnType<typeof spawnSync> => spawnSync(process.execPath, [
        "--import", `data:text/javascript,Object.defineProperty(process, "platform", { value: "${platform}" });`,
        SourceTreeFixture.locateScript(path.join("desktop", "start.ts")),
        "--data-dir=data"
      ], { cwd: directory, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 60_000 });

      const direct = run(repository.directory);
      const linked = run(link);

      assert.equal(direct.status, 5, String(direct.stderr));
      assert.equal(linked.status, 5, String(linked.stderr));
    });

    test("the command fails without starting anything outside a checkout with a product", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());

      const result = spawnSync(process.execPath, [SourceTreeFixture.locateScript(path.join("desktop", "start.ts"))], { cwd: repository.directory, encoding: "utf8", timeout: 30_000 });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /The root package\.json must declare a numbered version/);
    });
  }

  private static createSandbox(platform: string, mode: number): SandboxHelper {
    return new SandboxHelper(platform, async t => t === StartTests.RESTRICTION ? "1\n" : null, async () => ({ uid: 1000, mode }));
  }
}

StartTests.register();
