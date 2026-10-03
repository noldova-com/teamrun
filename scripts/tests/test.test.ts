/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import Test from "../test.ts";
import AngularReportRunnerFixture from "./fixtures/angular-report-runner.fixture.ts";
import ProcessRunnerFixture from "./fixtures/process-runner.fixture.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class TestTests {
  private static readonly REPORT: string = JSON.stringify({ testResults: [] });

  public static register(): void {
    test("the complete gate runs every check in order and writes the step summary", async t => {
      const repository = await TestTests.createRepositoryAsync(t);
      const summaryPath = path.join(repository.directory, "summary.md");
      const runner = new AngularReportRunnerFixture(TestTests.REPORT, [0, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, { GITHUB_STEP_SUMMARY: summaryPath }).runAsync([]);

      assert.equal(exitCode, 0, output.text);
      const titles = [
        "Documents", "Module folders", "Shell names no module", "Product identity", "Module imports", "Unique names", "Declared dependencies", "Packages", "Package tests and coverage",
        "Script types", "API declarations", "API examples",
        "Script tests and coverage", "Angular tests and coverage"
      ];
      assert.deepEqual([...output.text.matchAll(/^(.+): (passed|failed)$/gm)].map(t => `${t[1]}: ${t[2]}`), titles.map(t => `${t}: passed`));
      assert.ok(output.text.endsWith("\n14 of 14 checks passed.\n"));
      assert.equal(runner.runs.length, 3);
      assert.equal(await readFile(summaryPath, "utf8"), `| Check | Result |\n|---|---|\n${titles.map(t => `| ${t} | Passed |\n`).join("")}`);
    });

    test("a failing check fails the gate after the remaining checks have run", async t => {
      const repository = await TestTests.createRepositoryAsync(t);
      const runner = new AngularReportRunnerFixture(TestTests.REPORT, [1, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, {}).runAsync([]);

      assert.equal(exitCode, 1);
      assert.ok(output.text.includes("\nScript types: failed\n"));
      assert.ok(output.text.includes("\nScript tests and coverage: passed\n"));
      assert.ok(output.text.endsWith("\n13 of 14 checks passed.\n"));
      assert.equal(runner.runs.length, 3);
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

    test("the documents selection runs in a checkout without installed packages", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "README.md": "# TeamRun\n", "package.json": await readFile(path.join(SourceTreeFixture.root, "package.json"), "utf8") });
      await cp(path.join(SourceTreeFixture.root, "scripts"), path.join(repository.directory, "scripts"), { recursive: true });
      const environment = { ...process.env };
      delete environment["GITHUB_STEP_SUMMARY"];

      const run = spawnSync(process.execPath, [path.join(repository.directory, "scripts", "test.ts"), "documents"], {
        cwd: repository.directory, env: environment, encoding: "utf8", timeout: 10_000
      });

      assert.equal(existsSync(path.join(repository.directory, "node_modules")), false);
      assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
      assert.match(run.stdout, /\n1 of 1 checks passed\.\n$/);
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

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      "README.md": "# TeamRun\n",
      "package.json": `${JSON.stringify(ProductIdentityFixture.manifest(), null, 2)}\n`,
      "src/modules/checkpoints/README.md": "# Checkpoints\n",
      "src/angular.json": `${JSON.stringify({ projects: { teamrun: { architect: { test: { options: { include: ["shell/*/tests/**/*.spec.ts"] } } } } } })}\n`
    });
    return repository;
  }
}

TestTests.register();
