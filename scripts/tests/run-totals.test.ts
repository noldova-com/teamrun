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
import { test, type TestContext } from "node:test";

import RunTotals from "../run-totals.ts";
import type ICoverageCount from "../totals/interfaces/i-coverage-count.ts";
import type IRunnerCounts from "../totals/interfaces/i-runner-counts.ts";
import RunnerTotals from "../totals/runner-totals.ts";
import RepositoryFixture from "./fixtures/repository.fixture.ts";
import SourceTreeFixture from "./fixtures/source-tree.fixture.ts";
import TextOutputFixture from "./fixtures/text-output.fixture.ts";

class RunTotalsTests {
  private static readonly HEADER: string = "| Tests | Discovered | Executed | Passed | Failed | Skipped | Unselected | Unreached | Coverage |\n|---|---|---|---|---|---|---|---|---|\n";
  private static readonly RERUN: string = "1 (1 passed when run again; see the flaky record)";
  private static readonly NONE: IRunnerCounts = { discovered: 0, passed: 0, failed: 0, rerunPassed: 0, skipped: 0, unselected: 0, unreached: 0 };
  private static readonly UI_FILES: readonly string[] = ["e2e/a.spec.ts", "e2e/b.spec.ts"];
  private static readonly TARGETS: string = JSON.stringify([
    { target: "Linux x64", runner: "ubuntu-24.04", architecture: "x64", jobs: [{ part: "" }], ui: { shards: [{ shard: 1 }, { shard: 2 }] } },
    { target: "macOS ARM64", runner: "macos-15", architecture: "arm64", jobs: [{ part: "" }], ui: null }
  ]);
  private static readonly SPLIT_TARGET: string = JSON.stringify([
    { target: "Windows x64", runner: "windows-2025", architecture: "x64", jobs: [{ part: "packages" }, { part: "scripts" }], ui: { shards: [{ shard: 1 }] } }
  ]);

  public static register(): void {
    test("the run's totals show each target's runners, with its UI shards combined, and the whole run's runners added up", async t => {
      const repository = await RunTotalsTests.createRepositoryAsync(t, RunTotalsTests.completeRecords());
      const log = new TextOutputFixture();

      const exitCode = await new RunTotals(repository.directory, log).runAsync(RunTotalsTests.environment(repository, "success"));

      assert.equal(exitCode, 0);
      const summary = await readFile(path.join(repository.directory, "summary.md"), "utf8");
      assert.equal(summary, "### Test totals\n\n" +
        `#### Linux x64\n\n${RunTotalsTests.HEADER}` +
        "| Package tests | 2 | 2 | 2 | 0 | 0 | 0 | 0 | Not measured |\n" +
        "| Script tests | 4 | 3 | 3 | 0 | 0 | 1 | 0 | 75.0% of 4 blocks |\n" +
        `| UI workflows | 3 | 3 | 2 | ${RunTotalsTests.RERUN} | 0 | 0 | 0 | Not measured |\n\n` +
        `#### macOS ARM64\n\n${RunTotalsTests.HEADER}` +
        "| Script tests | 4 | 4 | 4 | 0 | 0 | 0 | 0 | 50.0% of 4 blocks |\n\n" +
        `#### Whole run\n\n${RunTotalsTests.HEADER}` +
        "| Package tests | 2 | 2 | 2 | 0 | 0 | 0 | 0 | Not measured |\n" +
        "| Script tests | 8 | 7 | 7 | 0 | 0 | 1 | 0 | 62.5% of 8 blocks |\n" +
        `| UI workflows | 3 | 3 | 2 | ${RunTotalsTests.RERUN} | 0 | 0 | 0 | Not measured |\n`);
      assert.equal(log.text, summary);
    });

    test("each test job of a split target and each UI shard is read from its own record", async t => {
      const repository = await RunTotalsTests.createRepositoryAsync(t, {
        "totals-windows-2025-x64-packages/package.json": RunTotalsTests.record("package", "Package tests", { ...RunTotalsTests.NONE, discovered: 1, passed: 1 }, [], null),
        "totals-windows-2025-x64-scripts/script.json": RunTotalsTests.record("script", "Script tests", { ...RunTotalsTests.NONE, discovered: 1, passed: 1 }, [], null),
        "totals-ui-windows-2025-x64-1/ui.json": RunTotalsTests.shard("1/1", { ...RunTotalsTests.NONE, discovered: 2, passed: 2 }, RunTotalsTests.UI_FILES, RunTotalsTests.UI_FILES, [])
      });
      const log = new TextOutputFixture();

      assert.equal(await new RunTotals(repository.directory, log).runAsync({ ...RunTotalsTests.environment(repository, "success"), TARGETS: RunTotalsTests.SPLIT_TARGET }), 0);

      assert.ok(log.text.startsWith(`### Test totals\n\n#### Windows x64\n\n${RunTotalsTests.HEADER}| Package tests | 1 |`), log.text);
      assert.equal(log.text.split("\n| UI workflows | 2 | 2 | 2 | 0 |").length, 3, log.text);
    });

    test("a complete run fails for a job without a record, shards that listed different tests, a file no shard ran and a file without tests", async t => {
      const repository = await RunTotalsTests.createRepositoryAsync(t, RunTotalsTests.faultyRecords());
      const log = new TextOutputFixture();

      const exitCode = await new RunTotals(repository.directory, log).runAsync(RunTotalsTests.environment(repository, "success"));

      assert.equal(exitCode, 1);
      assert.ok(log.text.includes("#### macOS ARM64\n\nNo totals were recorded.\n"), log.text);
      assert.ok(log.text.endsWith(`\nThe run's totals have these problems:\n\n${RunTotalsTests.problems()}`), log.text);
    });

    test("a run with a job that didn't pass lists the same problems without failing for them, and a run without UI workflows reads no shard", async t => {
      const repository = await RunTotalsTests.createRepositoryAsync(t, RunTotalsTests.faultyRecords());
      const unchecked = new TextOutputFixture();
      const withoutUi = new TextOutputFixture();

      assert.equal(await new RunTotals(repository.directory, unchecked).runAsync(RunTotalsTests.environment(repository, "failure")), 0);
      assert.equal(await new RunTotals(repository.directory, withoutUi).runAsync({ ...RunTotalsTests.environment(repository, "success"), RUN_UI: "false" }), 1);

      assert.ok(unchecked.text.endsWith(`\nA job of the run didn't pass, so these don't fail the totals:\n\n${RunTotalsTests.problems()}`), unchecked.text);
      assert.doesNotMatch(withoutUi.text, /UI workflows/);
      assert.ok(withoutUi.text.endsWith("\nThe run's totals have these problems:\n\n- Linux x64: totals-ubuntu-24.04-x64-all left no totals record.\n- macOS ARM64: totals-macos-15-arm64-all left no totals record.\n"), withoutUi.text);
    });

    test("a record the totals cannot read fails them with its path, and missing settings fail before reading any", async t => {
      const records = RunTotalsTests.completeRecords();
      const repository = await RunTotalsTests.createRepositoryAsync(t, { ...records, "totals-macos-15-arm64-all/script.json": JSON.stringify({ ...JSON.parse(records["totals-macos-15-arm64-all/script.json"] ?? ""), version: 2 }) });
      const log = new TextOutputFixture();

      assert.equal(await new RunTotals(repository.directory, log).runAsync(RunTotalsTests.environment(repository, "success")), 1);
      for (const environment of [{}, { GITHUB_STEP_SUMMARY: "summary.md" }, { GITHUB_STEP_SUMMARY: "", TARGETS: "[]" }, { GITHUB_STEP_SUMMARY: "summary.md", TARGETS: "" }]) {
        const unset = new TextOutputFixture();
        assert.equal(await new RunTotals("unused", unset).runAsync(environment), 1);
        assert.equal(unset.text, "GITHUB_STEP_SUMMARY and TARGETS must name the step summary file and the classification's targets.\n");
      }

      const message = "totals-macos-15-arm64-all/script.json is version 2 of the test totals, not 3.";
      assert.equal(await readFile(path.join(repository.directory, "summary.md"), "utf8"), `### Test totals\n\n${message}\n`);
      assert.equal(log.text, `${message}\n`);
    });

    test("an unwritable summary file is not hidden", async t => {
      const repository = await RunTotalsTests.createRepositoryAsync(t, RunTotalsTests.completeRecords());

      await assert.rejects(new RunTotals(repository.directory, new TextOutputFixture()).runAsync({ ...RunTotalsTests.environment(repository, "success"), GITHUB_STEP_SUMMARY: repository.directory }));
    });

    test("the command adds up the working directory's records and terminates", async t => {
      const repository = await RunTotalsTests.createRepositoryAsync(t, {});
      const summaryPath = path.join(repository.directory, "summary.md");

      const result = spawnSync(process.execPath, [SourceTreeFixture.locateScript("run-totals.ts")], {
        cwd: repository.directory,
        env: { ...process.env, GITHUB_STEP_SUMMARY: summaryPath, TARGETS: "[]", RUN_UI: "false", VALIDATION_RESULT: "success" },
        encoding: "utf8",
        timeout: 30_000
      });

      assert.equal(result.status, 0, result.stderr);
      assert.equal(await readFile(summaryPath, "utf8"), "### Test totals\n\n#### Whole run\n\nNo totals were recorded.\n");
    });
  }

  private static completeRecords(): Readonly<Record<string, string>> {
    return {
      "totals-ubuntu-24.04-x64-all/package.json": RunTotalsTests.record("package", "Package tests", { ...RunTotalsTests.NONE, discovered: 2, passed: 2 }, [], null),
      "totals-ubuntu-24.04-x64-all/script.json": RunTotalsTests.record("script", "Script tests", { ...RunTotalsTests.NONE, discovered: 4, passed: 3, unselected: 1 }, ["scripts/tests/a.test.ts"], { unit: "blocks", covered: 3, total: 4 }),
      "totals-ui-ubuntu-24.04-x64-1/ui.json": RunTotalsTests.shard("1/2", { ...RunTotalsTests.NONE, discovered: 3, failed: 1, rerunPassed: 1, unselected: 2 }, ["e2e/a.spec.ts"], RunTotalsTests.UI_FILES, []),
      "totals-ui-ubuntu-24.04-x64-2/ui.json": RunTotalsTests.shard("2/2", { ...RunTotalsTests.NONE, discovered: 3, passed: 2, unselected: 1 }, ["e2e/b.spec.ts"], RunTotalsTests.UI_FILES, []),
      "totals-macos-15-arm64-all/script.json": RunTotalsTests.record("script", "Script tests", { ...RunTotalsTests.NONE, discovered: 4, passed: 4 }, ["scripts/tests/a.test.ts"], { unit: "blocks", covered: 2, total: 4 })
    };
  }

  private static faultyRecords(): Readonly<Record<string, string>> {
    const expected = [...RunTotalsTests.UI_FILES, "e2e/c.spec.ts"];
    return {
      "totals-ui-ubuntu-24.04-x64-1/ui.json": RunTotalsTests.shard("1/2", { ...RunTotalsTests.NONE, discovered: 3, passed: 1, unselected: 2 }, ["e2e/a.spec.ts"], expected, []),
      "totals-ui-ubuntu-24.04-x64-2/ui.json": RunTotalsTests.shard("2/2", { ...RunTotalsTests.NONE, discovered: 4, passed: 1, unselected: 3 }, ["e2e/b.spec.ts"], expected, ["e2e/empty.spec.ts"])
    };
  }

  private static problems(): string {
    return "- Linux x64: totals-ubuntu-24.04-x64-all left no totals record.\n" +
      "- Linux x64: The shards of UI workflows listed different tests: 3 tests in 3 files, 4 tests in 3 files.\n" +
      "- Linux x64: The shards of UI workflows ran no test in these files:\n  e2e/c.spec.ts\n" +
      "- Linux x64: UI workflows found no tests in these files:\n  e2e/empty.spec.ts\n" +
      "- macOS ARM64: totals-macos-15-arm64-all left no totals record.\n";
  }

  private static record(runner: string, title: string, counts: IRunnerCounts, files: readonly string[], coverage: ICoverageCount | null): string {
    return new RunnerTotals(runner, title, counts, [], files, coverage, { duplicates: [], empty: [] }, { expected: files, shard: null }).toJson();
  }

  private static shard(shard: string, counts: IRunnerCounts, files: readonly string[], expected: readonly string[], empty: readonly string[]): string {
    return new RunnerTotals("ui", "UI workflows", counts, [], files, null, { duplicates: [], empty }, { expected, shard }).toJson();
  }

  private static environment(repository: RepositoryFixture, validation: string): NodeJS.ProcessEnv {
    return { GITHUB_STEP_SUMMARY: path.join(repository.directory, "summary.md"), TARGETS: RunTotalsTests.TARGETS, RUN_UI: "true", VALIDATION_RESULT: validation };
  }

  private static async createRepositoryAsync(t: TestContext, records: Readonly<Record<string, string>>): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    await repository.writeAsync(Object.fromEntries(Object.entries(records).map(([file, text]) => [`_build/run-totals/${file}`, text])));
    return repository;
  }
}

RunTotalsTests.register();
