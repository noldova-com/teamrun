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

import LicenseHeader from "../structure/license-header.ts";
import Test from "../test.ts";
import TestOptions from "../test-options.ts";
import AngularReportRunnerFixture from "./fixtures/angular-report-runner.fixture.ts";
import ProcessRunnerFixture from "./fixtures/process-runner.fixture.ts";
import ProductIdentityFixture from "./fixtures/product-identity.fixture.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class TestTests {
  private static readonly REPORT: string = JSON.stringify({ testResults: [] });
  private static readonly PASSING: string = "import { test } from \"node:test\";\n\ntest(\"passes\", () => undefined);\n";
  private static readonly PROJECT: Readonly<Record<string, unknown>> = {
    extends: path.join(SourceTreeFixture.root, "tsconfig.base.json"),
    compilerOptions: { types: [], module: "preserve", moduleResolution: "bundler", paths: { "@noldova/teamrun-shell-ui": ["./shell/ui/src/api/index.ts"], "@noldova/teamrun-shell-window": ["./shell/window/src/api/index.ts"] } }
  };

  public static register(): void {
    test("the complete gate runs every check in order and writes the step summary", async t => {
      const repository = await TestTests.createRepositoryAsync(t);
      const summaryPath = path.join(repository.directory, "summary.md");
      const runner = new AngularReportRunnerFixture(TestTests.REPORT, [0, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, { GITHUB_STEP_SUMMARY: summaryPath }).runAsync([]);

      assert.equal(exitCode, 0, output.text);
      const titles = [
        "Documents", "License headers", "Comments", "Test waits", "Field order", "GitHub configuration", "Module folders", "Shell names no module", "Product identity", "Module imports", "Window imports", "Test mirrors", "Coverage exclusions", "Unique names", "Declared dependencies", "Dependency pins", "Packages", "Package tests and coverage",
        "Script types", "API declarations", "API documentation", "API examples",
        "Script tests and coverage", "Angular tests and coverage", "Packaged build leaves out the Gallery"
      ];
      assert.deepEqual([...output.text.matchAll(/^(.+): (passed|failed)$/gm)].map(t => `${t[1]}: ${t[2]}`), titles.map(t => `${t}: passed`));
      assert.ok(output.text.endsWith("\n25 of 25 checks passed.\n"));
      for (const part of ["src/shell/ui", "src/shell/window"]) {
        assert.ok(output.text.includes(`\n${part}: matches its declarations\n`), output.text);
        assert.ok(output.text.includes(`\n${part}: documents every public member\n`), output.text);
        assert.ok(output.text.includes(`\n${part}: every example compiles\n`), output.text);
      }
      assert.equal(runner.runs.length, 5);
      const counts = "0 discovered, 0 executed, 0 passed, 0 failed, 0 skipped, 0 unselected, 0 unreached; coverage Not measured.";
      assert.ok(output.text.endsWith(`\nTest totals\nScript tests: ${counts}\nAngular tests: ${counts}\n\n22 of 22 checks passed.\n`), output.text);
      assert.equal(await readFile(summaryPath, "utf8"), `| Check | Result |\n|---|---|\n${titles.map(t => `| ${t} | Passed |\n`).join("")}\n` +
        "| Tests | Discovered | Executed | Passed | Failed | Skipped | Unselected | Unreached | Coverage |\n|---|---|---|---|---|---|---|---|---|\n" +
        `${["Script tests", "Angular tests"].map(t => `| ${t} | 0 | 0 | 0 | 0 | 0 | 0 | 0 | Not measured |\n`).join("")}`);
    });

    test("a selected run runs every check other than the tests and only the selected tests, and says it is not the complete gate", async t => {
      const repository = await TestTests.createRepositoryAsync(t);
      await repository.writeAsync({ ".gitignore": "_build/\n" });
      const runner = new AngularReportRunnerFixture(TestTests.REPORT, [0, 0]);
      const checksOnly = new TextOutputFixture();
      const selected = new TextOutputFixture();
      const results = (text: string): readonly string[] => [...text.matchAll(/^(.+): (passed|failed)$/gm)].map(t => `${t[1]}: ${t[2]}`);
      const before = ["Documents", "License headers", "Comments", "Test waits", "Field order", "GitHub configuration", "Module folders", "Shell names no module", "Product identity", "Module imports", "Window imports", "Test mirrors", "Coverage exclusions", "Unique names", "Declared dependencies", "Dependency pins", "Packages"]
        .map(t => `${t}: passed`);
      const after = ["Script types", "API declarations", "API documentation", "API examples"].map(t => `${t}: passed`);

      const checksOnlyExitCode = await new Test(repository.directory, runner, checksOnly, {}).runAsync(["--checks-only"]);
      const selectedExitCode = await new Test(repository.directory, runner, selected, {}).runAsync(["--package", "@noldova/teamrun-foundation-missing", "--script-tests"]);

      assert.equal(checksOnlyExitCode, 0, checksOnly.text);
      assert.ok(checksOnly.text.startsWith("Selected run: every check other than the tests, and no tests. A selected run is not the complete gate.\n"), checksOnly.text);
      assert.deepEqual(results(checksOnly.text), [...before, ...after, "Packaged build leaves out the Gallery: passed"]);
      assert.ok(checksOnly.text.endsWith("\n22 of 22 checks passed.\n"));
      assert.equal(selectedExitCode, 1);
      assert.ok(selected.text.startsWith("Selected run: every check other than the tests, and the package tests of @noldova/teamrun-foundation-missing and the script tests. A selected run is not the complete gate.\n"), selected.text);
      assert.ok(selected.text.includes("\nNo package is named @noldova/teamrun-foundation-missing. The packages are none.\n"), selected.text);
      assert.deepEqual(results(selected.text), [...before, "Package tests and coverage: failed", ...after, "Script tests and coverage: passed", "Packaged build leaves out the Gallery: passed"]);
      assert.ok(selected.text.endsWith("\n23 of 24 checks passed.\n"));
    });

    test("each part runs only its own checks, in the complete gate's order, and says that only all parts together are the complete gate", async t => {
      const repository = await TestTests.createRepositoryAsync(t);
      const parts = ["packages", "scripts", "angular-and-checks"];
      const outputs: TextOutputFixture[] = [];

      for (const part of parts) {
        const output = new TextOutputFixture();
        assert.equal(await new Test(repository.directory, new AngularReportRunnerFixture(TestTests.REPORT, [0, 0]), output, {}).runAsync(["--part", part]), 0, output.text);
        outputs.push(output);
      }

      const whole = new TextOutputFixture();
      assert.equal(await new Test((await TestTests.createRepositoryAsync(t)).directory, new AngularReportRunnerFixture(TestTests.REPORT, [0, 0]), whole, {}).runAsync([]), 0, whole.text);

      const order = [...whole.text.matchAll(/^(.+): passed$/gm)].map(u => String(u[1]));
      const titles = outputs.map(t => [...t.text.matchAll(/^(.+): passed$/gm)].map(u => u[1]));
      const separate = ["Package tests and coverage", "Script tests and coverage"];
      assert.deepEqual(titles, [[separate[0]], [separate[1]], order.filter(u => !separate.includes(u))]);
      assert.ok(order.length > separate.length + 1, whole.text);
      for (const [index, output] of outputs.entries())
        assert.ok(output.text.startsWith(`Part run: ${parts[index]}. Only all 3 parts together are the complete gate.\n`), output.text);
    });

    test("a part run with a selection runs the selected tests of that part and says both", async t => {
      const repository = await TestTests.createRepositoryAsync(t);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, new AngularReportRunnerFixture(TestTests.REPORT, [0, 0]), output, {}).runAsync(["--part", "angular-and-checks", "--checks-only"]);

      assert.equal(exitCode, 0, output.text);
      assert.ok(output.text.startsWith("Part run: angular-and-checks. Only all 3 parts together are the complete gate.\nSelected run: every check other than the tests, and no tests. A selected run is not the complete gate.\n"), output.text);
      assert.ok(!output.text.includes("Angular tests and coverage: "), output.text);
      assert.ok(output.text.endsWith("\n22 of 22 checks passed.\n"), output.text);
    });

    test("a failing check fails the gate after the remaining checks have run", async t => {
      const repository = await TestTests.createRepositoryAsync(t);
      const runner = new AngularReportRunnerFixture(TestTests.REPORT, [1, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, {}).runAsync([]);

      assert.equal(exitCode, 1);
      assert.ok(output.text.includes("\nScript types: failed\n"));
      assert.ok(output.text.includes("\nScript tests and coverage: passed\n"));
      assert.ok(output.text.endsWith("\n24 of 25 checks passed.\n"));
      assert.equal(runner.runs.length, 5);
    });

    test("a filtered run runs only the test checks on what the filters select and reports the counts in the console and the summary", async t => {
      const repository = await TestTests.createFilteredRepositoryAsync(t);
      const summaryPath = path.join(repository.directory, "summary.md");
      const runner = new AngularReportRunnerFixture(TestTests.specReport(repository), [0, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, { GITHUB_STEP_SUMMARY: summaryPath }).runAsync(["--filter", "alpha", "--filter", "a.spec"]);

      assert.equal(exitCode, 0, output.text);
      assert.equal(output.text, [
        "Filtered run: \"alpha\", \"a.spec\". A filtered run is not the complete gate.",
        "",
        "Package tests and coverage",
        "No package has tests.",
        "Package tests and coverage: none selected; 0 of 0 package tests selected, 0 not selected.",
        "",
        "Script tests and coverage",
        "Script tests and coverage: passed; 1 of 2 script test files selected, 1 not selected.",
        "",
        "Angular tests and coverage",
        "Angular tests and coverage: passed; 1 of 2 spec files selected, 1 not selected.",
        "",
        "3 of 3 checks passed.",
        ""
      ].join("\n"));
      assert.equal(await readFile(summaryPath, "utf8"), [
        "Filters: <code>alpha</code> <code>a.spec</code>",
        "",
        "| Check | Result | Unit | Discovered | Selected | Unselected |",
        "|---|---|---|---|---|---|",
        "| Package tests and coverage | None selected | package tests | 0 | 0 | 0 |",
        "| Script tests and coverage | Passed | script test files | 2 | 1 | 1 |",
        "| Angular tests and coverage | Passed | spec files | 2 | 1 | 1 |",
        ""
      ].join("\n"));
      assert.equal(runner.runs.length, 2);
    });

    test("a filtered run that selects no test fails and says so, in the console and the summary", async t => {
      const repository = await TestTests.createFilteredRepositoryAsync(t);
      const summaryPath = path.join(repository.directory, "summary.md");
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, new AngularReportRunnerFixture(TestTests.REPORT, [0]), output, { GITHUB_STEP_SUMMARY: summaryPath }).runAsync(["--filter", "no|<match>&"]);

      assert.equal(exitCode, 1);
      assert.ok(output.text.includes("Script tests and coverage: none selected; 0 of 2 script test files selected, 2 not selected.\n"));
      assert.ok(output.text.includes("Angular tests and coverage: none selected; 0 of 2 spec files selected, 2 not selected.\n"));
      assert.ok(output.text.endsWith("\nNo test matched the filters.\n\n2 of 3 checks passed.\n"));
      const summary = await readFile(summaryPath, "utf8");
      assert.ok(summary.startsWith("Filters: <code>no&#124;&lt;match&gt;&amp;</code>\n\n| Check |"), summary);
      assert.ok(summary.endsWith("\nNo test matched the filters.\n"));
    });

    test("a filtered run fails with a failing check, which does not stop the other checks", async t => {
      const repository = await TestTests.createFilteredRepositoryAsync(t);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, new AngularReportRunnerFixture(TestTests.specReport(repository), [1, 0]), output, {}).runAsync(["--filter", "alpha", "--filter", "a.spec"]);

      assert.equal(exitCode, 1);
      assert.ok(output.text.includes("Script tests and coverage: failed; 1 of 2 script test files selected, 1 not selected.\n"));
      assert.ok(output.text.includes("Angular tests and coverage: passed; 1 of 2 spec files selected, 1 not selected.\n"));
      assert.ok(output.text.endsWith("\n2 of 3 checks passed.\n"));
    });

    test("a repeat runs the selection again and stops at the run that fails, naming it", async t => {
      const repository = await TestTests.createFilteredRepositoryAsync(t);
      const runner = new AngularReportRunnerFixture(TestTests.REPORT, [0, 1, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, {}).runAsync(["--filter", "alpha", "--repeat", "3"]);

      assert.equal(exitCode, 1);
      assert.equal(runner.runs.length, 2);
      assert.deepEqual([...output.text.matchAll(/^Run \d of \d.*$/gm)].map(t => t[0]), ["Run 1 of 3", "Run 2 of 3", "Run 2 of 3 failed; the repeats stop there."]);
      assert.ok(!output.text.includes("All 3 runs passed."));
    });

    test("a repeat of passing runs says that all of them passed, and one run says nothing about repeating", async t => {
      const repository = await TestTests.createFilteredRepositoryAsync(t);
      const runner = new AngularReportRunnerFixture(TestTests.REPORT, [0, 0]);
      const repeated = new TextOutputFixture();
      const single = new TextOutputFixture();

      assert.equal(await new Test(repository.directory, runner, repeated, {}).runAsync(["--filter", "alpha", "--repeat", "2"]), 0);
      assert.equal(await new Test(repository.directory, runner, single, {}).runAsync(["--filter", "alpha", "--repeat", "1"]), 0);

      assert.equal(runner.runs.length, 3);
      assert.ok(repeated.text.endsWith("\nAll 2 runs passed.\n"));
      assert.ok(!single.text.includes("Run 1 of 1"));
      assert.ok(!single.text.includes("runs passed"));
    });

    test("a run that reruns failed tests starts with an empty flaky test record and lets the test checks retry", async t => {
      const repository = await TestTests.createFilteredRepositoryAsync(t);
      await repository.writeAsync({ "_build/flaky-tests.json": "[]\n" });
      const runner = new AngularReportRunnerFixture(TestTests.specReport(repository), [0, 0]);

      assert.equal(await new Test(repository.directory, runner, new TextOutputFixture(), {}).runAsync(["--filter", "alpha", "--filter", "a.spec", "--rerun-failed"]), 0);

      assert.equal(existsSync(path.join(repository.directory, "_build", "flaky-tests.json")), false);
      assert.equal(runner.environments.at(-1)?.["TEAMRUN_TEST_RETRY"], "1");
    });

    test("a repeat without filters repeats the complete gate", async t => {
      const repository = await TestTests.createRepositoryAsync(t);
      await repository.writeAsync({ ".gitignore": "_build/\n" });
      const runner = new AngularReportRunnerFixture(TestTests.REPORT, [0, 0, 0, 0, 0, 0, 0, 0]);
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, {}).runAsync(["--repeat", "2"]);

      assert.equal(exitCode, 0, output.text);
      assert.equal(runner.runs.length, 10);
      assert.ok(output.text.endsWith("\nAll 2 runs passed.\n"));
    });

    test("the documents selection runs only the document checks and says it is not the complete gate", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ ".gitattributes": "* text=auto eol=lf\n", "README.md": "# TeamRun\n" });
      const runner = new ProcessRunnerFixture();
      const output = new TextOutputFixture();

      const exitCode = await new Test(repository.directory, runner, output, {}).runAsync(["documents"]);

      assert.equal(exitCode, 0);
      assert.equal(output.text, [
        "Filtered run: documents. A filtered run is not the complete gate.",
        "",
        "Documents",
        "Checked 2 files and the links of 1 Markdown documents.",
        "Documents: passed",
        "",
        "1 of 1 checks passed.",
        ""
      ].join("\n"));
      assert.equal(runner.runs.length, 0);
    });

    test("an unknown selection is refused with the reason and the usage", async () => {
      const refused: readonly (readonly [readonly string[], string])[] = [
        [["coverage"], "\"coverage\" is not an option of npm test.\n"],
        [["--repeat", "0"], "--repeat takes a whole number from 1.\n"],
        [["--filter"], "--filter takes a text that is not blank and does not start with --.\n"]
      ];

      for (const [selection, reason] of refused) {
        const output = new TextOutputFixture();

        assert.equal(await new Test("unused", new ProcessRunnerFixture(), output, {}).runAsync(selection), 2);
        assert.equal(output.text, `${reason}Usage: npm test [-- documents | [--filter <text>]... [--repeat <count>] [--rerun-failed] | [--part <part>] [--package <name>]... [--angular-tests] [--script-tests] [--repeat <count>] [--rerun-failed] | [--part <part>] --checks-only [--repeat <count>]]\n`);
      }
    });

    test("a failure other than a refused option reaches the caller instead of the usage", async t => {
      const failure = new RangeError("The options could not be read.");
      t.mock.method(TestOptions, "parse", () => {
        throw failure;
      });
      const output = new TextOutputFixture();

      await assert.rejects(new Test("unused", new ProcessRunnerFixture(), output, {}).runAsync([]), failure);
      assert.equal(output.text, "");
    });

    test("the documents selection runs in a checkout without installed packages", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ ".gitattributes": "* text=auto eol=lf\n", "README.md": "# TeamRun\n", "package.json": await readFile(path.join(SourceTreeFixture.root, "package.json"), "utf8") });
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

    test("the command fails a filter that selects nothing and a repeat stops at the first run", async t => {
      const repository = await TestTests.createFilteredRepositoryAsync(t);
      const command = SourceTreeFixture.locateScript("test.ts");
      const environment = { ...process.env };
      delete environment["GITHUB_STEP_SUMMARY"];
      delete environment["NODE_TEST_CONTEXT"];
      const run = (...args: string[]): ReturnType<typeof spawnSync> =>
        spawnSync(process.execPath, [command, ...args], { cwd: repository.directory, env: environment, encoding: "utf8", timeout: 60_000 });

      const empty = run("--filter", "matches no test", "--repeat", "3");
      const refused = run("--repeat", "0");

      assert.equal(empty.status, 1, `${empty.stdout}${empty.stderr}`);
      assert.match(String(empty.stdout), /^Run 1 of 3$/m);
      assert.match(String(empty.stdout), /Script tests and coverage: none selected; 0 of 2 script test files selected, 2 not selected\./);
      assert.match(String(empty.stdout), /Angular tests and coverage: none selected; 0 of 2 spec files selected, 2 not selected\./);
      assert.match(String(empty.stdout), /^No test matched the filters\.$/m);
      assert.match(String(empty.stdout), /^Run 1 of 3 failed; the repeats stop there\.$/m);
      assert.doesNotMatch(String(empty.stdout), /^Run 2 of 3$/m);
      assert.equal(refused.status, 2);

      await repository.writeAsync({ "scripts/tests/broken.test.ts": "import \"./missing.ts\";\n" });
      const broken = run("--filter", "matches no test");

      assert.equal(broken.status, 1, `${broken.stdout}${broken.stderr}`);
      assert.match(String(broken.stdout), /Script tests and coverage: failed; 1 of 3 script test files selected, 2 not selected\./);
    });

    test("the command exits with the selected checks' result and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ ".gitattributes": "* text=auto eol=lf\n", "README.md": "# TeamRun\n" });
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

  private static async createFilteredRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await TestTests.createRepositoryAsync(t);
    await repository.writeAsync({
      "scripts/tests/alpha.test.ts": TestTests.PASSING, "scripts/tests/beta.test.ts": TestTests.PASSING,
      "src/shell/ui/tests/a.spec.ts": "", "src/shell/ui/tests/b.spec.ts": ""
    });
    return repository;
  }

  private static specReport(repository: RepositoryFixture): string {
    return JSON.stringify({ testResults: [{ name: path.join(repository.directory, "src", "shell", "ui", "tests", "a.spec.ts"), status: "passed", assertionResults: [] }] });
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync({
      ".gitattributes": "* text=auto eol=lf\n",
      "README.md": "# TeamRun\n",
      "docs/TESTING.md": "# Testing\n\n| Scope | Requirement |\n|---|---|\n| Every package | 100% of executable production code |\n",
      "package.json": `${JSON.stringify(ProductIdentityFixture.manifest(), null, 2)}\n`,
      "src/modules/checkpoints/README.md": "# Checkpoints\n",
      "src/angular.json": `${JSON.stringify({ projects: { teamrun: { architect: { test: { options: { include: ["shell/*/tests/**/*.spec.ts"] } } } } } })}\n`,
      "src/tsconfig.json": `${JSON.stringify(TestTests.PROJECT)}\n`,
      "src/shell/ui/src/api/index.ts": `${LicenseHeader.BLOCK}\nexport const gap: number = 1;\n`,
      "src/shell/ui/src/api/index.d.ts": `${LicenseHeader.BLOCK}\n/**\n * The gap.\n */\nexport declare const gap: number;\n`,
      "src/shell/window/src/api/index.ts": `${LicenseHeader.BLOCK}\nexport const size: number = 1;\n`,
      "src/shell/window/src/api/index.d.ts": `${LicenseHeader.BLOCK}\n/**\n * The size.\n */\nexport declare const size: number;\n`
    });
    return repository;
  }
}

TestTests.register();
