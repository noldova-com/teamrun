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
import { text } from "node:stream/consumers";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import ScriptTestReporter from "../../totals/script-test-reporter.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import SourceTreeFixture from "../fixtures/source-tree.fixture.ts";

class ScriptTestReporterTests {
  private static readonly TESTS: string = [
    "import { suite, test } from \"node:test\";",
    "suite(\"outer\", () => {",
    "  test(\"passes\", () => {});",
    "  test(\"waits\", { skip: \"Needs the shell.\" }, () => {});",
    "  test.skip(\"unexplained\", () => {});",
    "  test(\"later\", { todo: \"Waits for the API.\" }, () => { throw new Error(\"not yet\"); });",
    "  test.todo(\"someday\");",
    "  test(\"fails\", () => { throw new Error(\"broken\"); });",
    "});",
    "test(\"parent\", async t => {",
    "  await t.test(\"child\", () => {});",
    "});",
    ""
  ].join("\n");

  public static register(): void {
    test("a run's tests are counted by outcome, with each skipped one named by its file and nesting, and a file that fails to load counts as a failed test", async t => {
      const repository = await RepositoryFixture.createAsync();
      t.after(() => repository.disposeAsync());
      await repository.writeAsync({ "tests/a.test.mjs": ScriptTestReporterTests.TESTS, "tests/empty.test.mjs": "", "tests/broken.test.mjs": "throw new Error(\"cannot load\");\n" });
      const reporter = pathToFileURL(SourceTreeFixture.locateScript(path.join("totals", "script-test-reporter.ts"))).href;
      const environment = { ...process.env };
      delete environment["NODE_TEST_CONTEXT"];

      const run = spawnSync(process.execPath, ["--test", `--test-reporter=${reporter}`, "--test-reporter-destination=result.json", "tests/a.test.mjs", "tests/empty.test.mjs", "tests/broken.test.mjs"], {
        cwd: repository.directory,
        env: environment,
        encoding: "utf8",
        timeout: 10_000
      });

      assert.equal(run.status, 1, run.stderr);
      assert.deepEqual(JSON.parse(await readFile(path.join(repository.directory, "result.json"), "utf8")), {
        passed: 3,
        failed: 2,
        skipped: 4,
        unreached: 0,
        skips: [
          { file: "tests/a.test.mjs", names: ["outer", "waits"], reason: "Needs the shell." },
          { file: "tests/a.test.mjs", names: ["outer", "unexplained"], reason: "No reason given." },
          { file: "tests/a.test.mjs", names: ["outer", "later"], reason: "To do: Waits for the API." },
          { file: "tests/a.test.mjs", names: ["outer", "someday"], reason: "To do." }
        ],
        files: ["tests/a.test.mjs", "tests/broken.test.mjs", "tests/empty.test.mjs"]
      });
    });

    test("the runner's events count each test by its outcome, leave suites and a file's own passing wrapper out, named by its path in either form, and count a wrapper that fails", async () => {
      const reporter = new ScriptTestReporter(path.resolve("root"));
      const file = path.resolve("root", "a.test.ts");
      const run = (type: string, name: string, nesting: number, options: object = {}, at: string = file): void => {
        reporter.write({ type: "test:start", data: { name, nesting, file: at } });
        reporter.write({ type, data: { name, nesting, file: at, details: { type: "test", error: new Error("broken") }, ...options } });
      };

      reporter.write({ type: "test:start", data: { name: "outer", nesting: 0, file } });
      run("test:pass", "passes", 1);
      run("test:pass", "waits", 1, { skip: "Needs the shell." });
      run("test:pass", "unexplained", 1, { skip: true });
      run("test:fail", "later", 1, { todo: "Waits for the API." });
      run("test:pass", "someday", 1, { todo: true });
      run("test:fail", "fails", 1);
      reporter.write({ type: "test:pass", data: { name: "outer", nesting: 0, file, details: { type: "suite" } } });
      run("test:pass", "empty.test.ts", 0, {}, path.resolve("root", "empty.test.ts"));
      run("test:pass", path.join("deep", "empty.test.ts"), 0, {}, path.resolve("root", "deep", "empty.test.ts"));
      run("test:pass", path.resolve("root", "other.test.ts"), 0, {}, path.resolve("root", "other.test.ts"));
      run("test:fail", "broken.test.ts", 0, {}, path.resolve("root", "broken.test.ts"));
      reporter.end();

      assert.deepEqual(JSON.parse(await text(reporter)), {
        passed: 1,
        failed: 2,
        skipped: 4,
        unreached: 0,
        skips: [
          { file: "a.test.ts", names: ["outer", "waits"], reason: "Needs the shell." },
          { file: "a.test.ts", names: ["outer", "unexplained"], reason: "No reason given." },
          { file: "a.test.ts", names: ["outer", "later"], reason: "To do: Waits for the API." },
          { file: "a.test.ts", names: ["outer", "someday"], reason: "To do." }
        ],
        files: ["a.test.ts", "broken.test.ts", "deep/empty.test.ts", "empty.test.ts", "other.test.ts"]
      });
    });

    test("each test is named by its parents and its own name, even when a sibling started after it and before it finished", async () => {
      const reporter = new ScriptTestReporter(path.resolve("root"));
      const file = path.resolve("root", "a.test.ts");
      const finish = (name: string, nesting: number, skip: string): void => {
        reporter.write({ type: "test:pass", data: { name, nesting, file, skip, details: { type: "test" } } });
      };

      for (const [name, nesting] of [["outer", 0], ["first", 1], ["second", 1], ["inner", 2]] as const)
        reporter.write({ type: "test:start", data: { name, nesting, file } });
      finish("inner", 2, "c");
      finish("first", 1, "a");
      finish("second", 1, "b");
      reporter.end();

      assert.deepEqual(JSON.parse(await text(reporter)).skips, [
        { file: "a.test.ts", names: ["outer", "second", "inner"], reason: "c" },
        { file: "a.test.ts", names: ["outer", "first"], reason: "a" },
        { file: "a.test.ts", names: ["outer", "second"], reason: "b" }
      ]);
    });

    test("a test its parent cancelled counts as unreached, events without a file are ignored, and a test that never started is named without its parents", async () => {
      const reporter = new ScriptTestReporter(path.resolve("root"));
      const file = path.resolve("root", "a.test.ts");

      reporter.write({ type: "test:start", data: { name: "loose", nesting: 0 } });
      reporter.write({ type: "test:pass", data: { name: "loose", nesting: 0, details: { type: "test" } } });
      reporter.write({ type: "test:diagnostic", data: { message: "tests 1", nesting: 0, file } });
      reporter.write({ type: "test:pass", data: { name: "unstarted", nesting: 1, file, skip: true, details: { type: "test" } } });
      reporter.write({ type: "test:fail", data: { name: "cut short", nesting: 1, file, details: { type: "test", error: Object.assign(new Error("cancelled"), { failureType: "cancelledByParent" }) } } });
      reporter.end();

      assert.deepEqual(JSON.parse(await text(reporter)), { passed: 0, failed: 0, skipped: 1, unreached: 1, skips: [{ file: "a.test.ts", names: ["unstarted"], reason: "No reason given." }], files: [] });
    });

    test("without a root, files are named relative to the working directory", async () => {
      const reporter = new ScriptTestReporter();

      reporter.write({ type: "test:start", data: { name: "works", nesting: 0, file: path.resolve("scripts", "a.test.ts") } });
      reporter.end();

      assert.deepEqual(JSON.parse(await text(reporter)).files, ["scripts/a.test.ts"]);
    });
  }
}

ScriptTestReporterTests.register();
