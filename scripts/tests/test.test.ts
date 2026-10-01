/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import Test from "../test.ts";
import ProcessRunnerFixture from "./fixtures/process-runner.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class TestTests {
  public static register(): void {
    test("the complete gate runs every check in order and writes the step summary", async t => {
      const summary = await RepositoryFixture.createAsync();
      t.after(() => summary.disposeAsync());
      const summaryPath = path.join(summary.directory, "summary.md");
      const runner = new ProcessRunnerFixture([0, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(SourceTreeFixture.root, runner, output, { GITHUB_STEP_SUMMARY: summaryPath }).runAsync([]);

      assert.equal(exitCode, 0, output.text);
      const titles = [
        "Documents", "Module folders", "Shell names no module", "Module imports", "Unique names", "Packages", "Script types", "Script tests and coverage"
      ];
      assert.deepEqual([...output.text.matchAll(/^(.+): (passed|failed)$/gm)].map(t => `${t[1]}: ${t[2]}`), titles.map(t => `${t}: passed`));
      assert.ok(output.text.endsWith("\n8 of 8 checks passed.\n"));
      assert.equal(runner.runs.length, 2);
      assert.equal(await readFile(summaryPath, "utf8"), `| Check | Result |\n|---|---|\n${titles.map(t => `| ${t} | Passed |\n`).join("")}`);
    });

    test("a failing check fails the gate after the remaining checks have run", async () => {
      const runner = new ProcessRunnerFixture([1, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(SourceTreeFixture.root, runner, output, {}).runAsync([]);

      assert.equal(exitCode, 1);
      assert.ok(output.text.includes("\nScript types: failed\n"));
      assert.ok(output.text.includes("\nScript tests and coverage: passed\n"));
      assert.ok(output.text.endsWith("\n7 of 8 checks passed.\n"));
      assert.equal(runner.runs.length, 2);
    });

    test("the documents selection runs only the document checks and says it is not the complete gate", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "README.md": "# TeamRun\n" });
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, {}).runAsync(["documents"]);

      assert.equal(exitCode, 0);
      assert.equal(output.text, [
        "Filtered run: documents. A filtered run is not the complete gate.",
        "",
        "Documents",
        "Checked 1 files and the links of 1 Markdown documents.",
        "Documents: passed",
        "",
        "1 of 1 checks passed.",
        ""
      ].join("\n"));
      assert.equal(runner.runs.length, 0);
    });

    test("an unknown selection is refused with the usage", async () => {
      for (const selection of [["coverage"], ["documents", "documents"]]) {
        const output = new TextOutputFixture();

        assert.equal(await new Test("unused", new ProcessRunnerFixture(), output, {}).runAsync(selection), 2);
        assert.equal(output.text, "Usage: npm test [-- documents]\n");
      }
    });

    test("the command exits with the selected checks' result and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "README.md": "# TeamRun\n" });
      const command = SourceTreeFixture.locateScript("test.ts");
      const environment = { ...process.env };
      delete environment["GITHUB_STEP_SUMMARY"];
      const run = (selection: string): ReturnType<typeof spawnSync> =>
        spawnSync(process.execPath, [command, selection], { cwd: repository.directory, env: environment, encoding: "utf8", timeout: 10_000 });

      const passing = run("documents");
      await repository.writeAsync({ "README.md": "# TeamRun\n\n[Missing](missing.md)\n" });
      const failing = run("documents");
      const refused = run("everything");

      assert.equal(passing.status, 0);
      assert.equal(failing.status, 1);
      assert.match(String(failing.stdout), /README\.md:3: the link "missing\.md" points to a missing file\./);
      assert.equal(refused.status, 2);
    });
  }
}

TestTests.register();
