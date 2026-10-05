/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import NightlyResult from "../nightly-result.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class NightlyResultTests {
  private static readonly TESTS_LOG: string = "_build/nightly/tests.log";
  private static readonly REPORT: string = "_build/ui/report.json";
  private static readonly FAILED_LOG: string = [
    "Run 1 of 5",
    "Documents: passed",
    "Package tests and coverage",
    "@noldova/teamrun-shell-runtime/services/log.test.js — LogTests",
    "  \u001b[31m✘\u001b[39m writesALine (5 ms)",
    "  \u001b[32m✓\u001b[39m readsALine (1 ms)",
    "\u001b[31mPackage tests and coverage: failed\u001b[39m",
    "Packages: failed",
    "Run 2 of 5",
    "Script tests and coverage",
    "✖ a script test fails (12.5ms)",
    "✖ failing tests:",
    "✖ a script test fails (12.5ms)",
    "Script tests and coverage: failed",
    "Angular tests and coverage",
    " × WindowComponent > closes 12ms",
    " FAIL  tests/app/window.spec.ts > WindowComponent > closes",
    "Angular tests and coverage: failed",
    "Run 3 of 5",
    "Package tests and coverage",
    "  ✘ writesALine (2 ms)",
    "  ✘ opensTheFile (1 ms)",
    "Package tests and coverage: failed",
    ""
  ].join("\r\n");
  private static readonly CHECK_FAILED: string = "The check failed without naming a failing test; the job's log has the details.";

  public static register(): void {
    test("a passing job records no failure, whatever its log holds", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ [NightlyResultTests.TESTS_LOG]: NightlyResultTests.FAILED_LOG });
      const log = new TextOutputFixture();

      assert.equal(await new NightlyResult(repository.directory, log).runAsync({ NIGHTLY_LABEL: "Linux x64, tests", NIGHTLY_PART: "tests", NIGHTLY_OUTCOME: "success" }), 0);

      assert.deepEqual(await NightlyResultTests.readAsync(repository, "linux-x64-tests.json"), { label: "Linux x64, tests", failures: [] });
      assert.equal(log.text, "Linux x64, tests: passed\n");
    });

    test("a failed tests job records each check that failed under npm test, with the runs it failed and the failing tests its section of the log names", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ [NightlyResultTests.TESTS_LOG]: NightlyResultTests.FAILED_LOG });
      const log = new TextOutputFixture();

      assert.equal(await new NightlyResult(repository.directory, log).runAsync({ NIGHTLY_LABEL: "Windows ARM64, tests", NIGHTLY_PART: "tests", NIGHTLY_OUTCOME: "failure" }), 0);

      assert.deepEqual(await NightlyResultTests.readAsync(repository, "windows-arm64-tests.json"), {
        label: "Windows ARM64, tests",
        failures: [
          { name: "npm test › Package tests and coverage", message: "The check's failing tests:\n✘ writesALine\n✘ opensTheFile", count: 2 },
          { name: "npm test › Packages", message: NightlyResultTests.CHECK_FAILED, count: 1 },
          { name: "npm test › Script tests and coverage", message: "The check's failing tests:\n✖ a script test fails", count: 1 },
          { name: "npm test › Angular tests and coverage", message: "The check's failing tests:\n× WindowComponent > closes\nFAIL  tests/app/window.spec.ts > WindowComponent > closes", count: 1 }
        ]
      });
      assert.equal(log.text, "Windows ARM64, tests: npm test › Package tests and coverage failed; npm test › Packages failed; npm test › Script tests and coverage failed; "
        + "npm test › Angular tests and coverage failed\n");
    });

    test("a check with more than twenty failing tests names the first twenty and how many more failed", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const tests = Array.from({ length: 23 }, (_, index) => `✘ test${index}`);
      await repository.writeAsync({ [NightlyResultTests.TESTS_LOG]: ["Package tests and coverage", ...tests, "Package tests and coverage: failed", ""].join("\n") });

      assert.equal(await new NightlyResult(repository.directory, new TextOutputFixture()).runAsync({ NIGHTLY_LABEL: "Linux x64, tests", NIGHTLY_PART: "tests", NIGHTLY_OUTCOME: "failure" }), 0);

      assert.deepEqual(await NightlyResultTests.readAsync(repository, "linux-x64-tests.json"), {
        label: "Linux x64, tests",
        failures: [{ name: "npm test › Package tests and coverage", message: ["The check's failing tests:", ...tests.slice(0, 20), "and 3 more"].join("\n"), count: 1 }]
      });
    });

    test("a failed UI workflows job records each failed workflow once without its tags, with its first error and how often it failed", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const failed = (message: string): object => ({ status: "unexpected", results: [{ errors: [{ message }], annotations: [] }] });
      const report = {
        stats: { expected: 1, unexpected: 3, flaky: 0, skipped: 0, duration: 1000 },
        suites: [
          { title: "docking.spec.ts", specs: [], suites: [{ title: "docking", specs: [{ title: "a tab joins a group @smoke", tests: [failed("\u001b[31mError: first\u001b[39m\nmore"), failed("Error: second"), { status: "expected", results: [] }] }] }] },
          { title: "quit.spec.ts", specs: [{ title: "asks before quitting", tests: [failed("Error: quit")] }] }
        ]
      };
      await repository.writeAsync({ [NightlyResultTests.REPORT]: JSON.stringify(report) });

      assert.equal(await new NightlyResult(repository.directory, new TextOutputFixture()).runAsync({ NIGHTLY_LABEL: "macOS x64, UI workflows", NIGHTLY_PART: "workflows", NIGHTLY_OUTCOME: "failure" }), 0);

      assert.deepEqual(await NightlyResultTests.readAsync(repository, "macos-x64-ui-workflows.json"), {
        label: "macOS x64, UI workflows",
        failures: [
          { name: "docking.spec.ts › docking › a tab joins a group", message: "Error: first", count: 2 },
          { name: "quit.spec.ts › asks before quitting", message: "Error: quit", count: 1 }
        ]
      });
    });

    test("a job that fails without naming a check or workflow records the run itself, and one that was cancelled says it timed out", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const cases: readonly (readonly [string, string, Readonly<Record<string, string>>, string])[] = [
        ["Linux x64, tests", "tests", {}, "failure"],
        ["Linux x64, UI workflows", "workflows", {}, "failure"],
        ["Linux ARM64, UI workflows", "workflows", { [NightlyResultTests.REPORT]: "{" }, "skipped"],
        ["macOS ARM64, UI workflows", "workflows", {}, "cancelled"]
      ];
      const recorded: unknown[] = [];
      for (const [label, part, files, outcome] of cases) {
        await repository.writeAsync(files);
        await new NightlyResult(repository.directory, new TextOutputFixture()).runAsync({ NIGHTLY_LABEL: label, NIGHTLY_PART: part, NIGHTLY_OUTCOME: outcome });
        recorded.push(...(await NightlyResultTests.readAsync(repository, NightlyResult.fileNameOf(label)) as { failures: unknown[] }).failures);
      }

      assert.deepEqual(recorded, [
        { name: "Linux x64, tests › the run itself", message: "It failed without naming a failing check or workflow.", count: 1 },
        { name: "Linux x64, UI workflows › the run itself", message: "It failed without naming a failing check or workflow.", count: 1 },
        { name: "Linux ARM64, UI workflows › the run itself", message: "It failed without naming a failing check or workflow.", count: 1 },
        { name: "macOS ARM64, UI workflows › the run itself", message: "It timed out or was cancelled.", count: 1 }
      ]);
    });

    test("a failed or cancelled packaging job records the packaging of its target, and a passing one records nothing", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const recorded: unknown[] = [];
      for (const [label, outcome] of [["packaging Linux x64", "failure"], ["packaging Windows x64", "cancelled"], ["packaging Windows x64", "success"]] as const) {
        await new NightlyResult(repository.directory, new TextOutputFixture()).runAsync({ NIGHTLY_LABEL: label, NIGHTLY_PART: "packaging", NIGHTLY_OUTCOME: outcome });
        recorded.push((await NightlyResultTests.readAsync(repository, NightlyResult.fileNameOf(label)) as { failures: unknown[] }).failures);
      }

      assert.deepEqual(recorded, [
        [{ name: "packaging Linux x64", message: "Making the package or its smoke check failed; the job's log has the details.", count: 1 }],
        [{ name: "packaging Windows x64", message: "It timed out or was cancelled.", count: 1 }],
        []
      ]);
    });

    test("a report that can't be read is not hidden", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await mkdir(path.join(repository.directory, NightlyResultTests.REPORT), { recursive: true });

      await assert.rejects(new NightlyResult(repository.directory, new TextOutputFixture()).runAsync({ NIGHTLY_LABEL: "Linux x64, UI workflows", NIGHTLY_PART: "workflows", NIGHTLY_OUTCOME: "failure" }));
    });

    test("a missing label or outcome, or a part other than tests, workflows or packaging, fails without recording anything", async () => {
      const cases: readonly Readonly<Record<string, string>>[] = [
        {},
        { NIGHTLY_LABEL: "", NIGHTLY_PART: "tests", NIGHTLY_OUTCOME: "success" },
        { NIGHTLY_LABEL: "Linux x64, tests", NIGHTLY_PART: "all", NIGHTLY_OUTCOME: "success" },
        { NIGHTLY_LABEL: "Linux x64, tests", NIGHTLY_PART: "tests", NIGHTLY_OUTCOME: "" }
      ];
      for (const environment of cases) {
        const log = new TextOutputFixture();

        assert.equal(await new NightlyResult("unused", log).runAsync(environment), 1);
        assert.equal(log.text, "NIGHTLY_LABEL, NIGHTLY_PART (tests, workflows or packaging) and NIGHTLY_OUTCOME must describe the job.\n");
      }
    });

    test("the command records the job in the working directory and terminates", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      const result = spawnSync(process.execPath, [SourceTreeFixture.locateScript("nightly-result.ts")], {
        cwd: repository.directory,
        env: { ...process.env, NIGHTLY_LABEL: "Windows x64, UI workflows", NIGHTLY_PART: "workflows", NIGHTLY_OUTCOME: "success" },
        encoding: "utf8",
        timeout: 30_000
      });

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "Windows x64, UI workflows: passed\n");
      assert.deepEqual(await NightlyResultTests.readAsync(repository, "windows-x64-ui-workflows.json"), { label: "Windows x64, UI workflows", failures: [] });
    });
  }

  private static async readAsync(repository: RepositoryFixture, name: string): Promise<unknown> {
    return JSON.parse(await readFile(path.join(repository.directory, ...NightlyResult.RESULT_SEGMENTS, name), "utf8"));
  }
}

NightlyResultTests.register();
