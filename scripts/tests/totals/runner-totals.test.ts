/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";

import type IRunnerCounts from "../../totals/interfaces/runner-counts.ts";
import type IRunnerFindings from "../../totals/interfaces/runner-findings.ts";
import type IRunnerScope from "../../totals/interfaces/runner-scope.ts";
import RunnerTotals from "../../totals/runner-totals.ts";
import TotalsException from "../../totals/totals.exception.ts";
import RepositoryFixture from "../fixtures/repository.fixture.ts";
import TextOutputFixture from "../fixtures/text-output.fixture.ts";

class RunnerTotalsTests {
  private static readonly COUNTS: IRunnerCounts = { discovered: 10, passed: 5, failed: 1, rerunPassed: 0, skipped: 1, unselected: 2, unreached: 1 };
  private static readonly NONE: IRunnerCounts = { discovered: 0, passed: 0, failed: 0, rerunPassed: 0, skipped: 0, unselected: 0, unreached: 0 };
  private static readonly NO_FINDINGS: IRunnerFindings = { duplicates: [], empty: [] };
  private static readonly SCOPE: IRunnerScope = { expected: ["scripts/tests/a.test.ts"], shard: null };

  public static register(): void {
    test("a runner's totals count executed tests as passed and failed ones, and have no problem when every discovered test is accounted for", () => {
      const totals = RunnerTotalsTests.create(RunnerTotalsTests.COUNTS);

      assert.equal(totals.executed, 6);
      assert.deepEqual(totals.counts, RunnerTotalsTests.COUNTS);
      assert.deepEqual(totals.problems, []);
      assert.equal(RunnerTotals.VERSION, 3);
    });

    test("totals that select more than they discovered, do not add up, or name a different number of skipped tests have a problem", () => {
      const overSelected = RunnerTotalsTests.create({ ...RunnerTotalsTests.COUNTS, discovered: 3, unselected: -4 });
      const unbalanced = RunnerTotalsTests.create({ ...RunnerTotalsTests.COUNTS, discovered: 11 });
      const unnamed = new RunnerTotals("script", "Script tests", RunnerTotalsTests.COUNTS, [], [], null, RunnerTotalsTests.NO_FINDINGS, { expected: [], shard: null });

      assert.deepEqual(overSelected.problems, ["Script tests selected more tests than they discovered: 3 discovered, but 7 selected."]);
      assert.deepEqual(unbalanced.problems, ["Script tests don't add up: 11 discovered, but 6 executed, 1 skipped, 2 unselected and 1 unreached."]);
      assert.deepEqual(unnamed.problems, ["Script tests name 0 skipped tests but count 1."]);
    });

    test("totals that name a test more than once, ran a file without tests or have no result for an expected file have a problem for each, after any of their counts", () => {
      const findings = { duplicates: ["a.test.ts › d › same", "b.test.ts › other"], empty: ["empty.test.ts"] };
      const totals = RunnerTotalsTests.create({ ...RunnerTotalsTests.COUNTS, discovered: 11 }, findings, { expected: ["c.test.ts", "scripts/tests/a.test.ts", "d.test.ts"], shard: null });

      assert.deepEqual(totals.problems, [
        "Script tests don't add up: 11 discovered, but 6 executed, 1 skipped, 2 unselected and 1 unreached.",
        "Script tests name more than one test the same:\n  a.test.ts › d › same\n  b.test.ts › other",
        "Script tests found no tests in these files:\n  empty.test.ts",
        "Script tests have no result for these files:\n  c.test.ts\n  d.test.ts"
      ]);
      assert.deepEqual([totals.duplicates, totals.empty, totals.missing], [findings.duplicates, findings.empty, ["c.test.ts", "d.test.ts"]]);
    });

    test("a shard's totals leave the files it didn't run to the whole run, which checks them across its shards", () => {
      const shard = RunnerTotalsTests.create(RunnerTotalsTests.COUNTS, RunnerTotalsTests.NO_FINDINGS, { expected: ["c.test.ts", "scripts/tests/a.test.ts"], shard: "1/2" });

      assert.deepEqual([shard.missing, shard.problems, shard.expected], [[], [], ["c.test.ts", "scripts/tests/a.test.ts"]]);
    });

    test("totals are written as a versioned record per runner, read back in the runners' order, and cleared", async t => {
      const root = (await RunnerTotalsTests.createRepositoryAsync(t)).directory;
      const script = RunnerTotalsTests.create({ ...RunnerTotalsTests.COUNTS, rerunPassed: 1 }, { duplicates: ["scripts/tests/a.test.ts › twice"], empty: [] }, { expected: ["scripts/tests/a.test.ts", "scripts/tests/b.test.ts"], shard: null });
      const angular = new RunnerTotals("angular", "Angular tests", RunnerTotalsTests.NONE, [], [], { unit: "statements", covered: 0, total: 0 }, RunnerTotalsTests.NO_FINDINGS, { expected: [], shard: null });

      await script.writeAsync(root);
      await angular.writeAsync(root);
      const record = JSON.parse(await readFile(path.join(root, "_build", "totals", "script.json"), "utf8"));
      const read = await RunnerTotals.readAllAsync(root, ["angular", "package", "script"]);
      await RunnerTotals.clearAsync(root);

      assert.deepEqual(record, {
        version: 3,
        runner: "script",
        title: "Script tests",
        shard: null,
        discovered: 10,
        executed: 6,
        passed: 5,
        failed: 1,
        rerunPassed: 1,
        skipped: 1,
        unselected: 2,
        unreached: 1,
        skips: [{ test: "scripts/tests/a.test.ts › waits", reason: "Waits for <b> | c." }],
        files: ["scripts/tests/a.test.ts"],
        expected: ["scripts/tests/a.test.ts", "scripts/tests/b.test.ts"],
        coverage: { unit: "blocks", covered: 3, total: 4 },
        duplicates: ["scripts/tests/a.test.ts › twice"],
        empty: []
      });
      assert.deepEqual(read.map(t => t.toJson()), [angular.toJson(), script.toJson()]);
      assert.equal(existsSync(path.join(root, "_build", "totals")), false);
      await RunnerTotals.clearAsync(root);
    });

    test("a shard's record keeps its shard when read back", () => {
      const shard = RunnerTotalsTests.create(RunnerTotalsTests.COUNTS, RunnerTotalsTests.NO_FINDINGS, { expected: ["scripts/tests/a.test.ts"], shard: "2/3" });

      const read = RunnerTotals.parse(shard.toJson(), "ui.json");

      assert.deepEqual([read.shard, read.toJson()], ["2/3", shard.toJson()]);
    });

    test("a record of another version, or one that is not a record, is refused with its path", async t => {
      const repository = await RunnerTotalsTests.createRepositoryAsync(t);
      const record = JSON.parse(RunnerTotalsTests.create(RunnerTotalsTests.COUNTS).toJson());
      const { rerunPassed, expected, shard, ...secondVersion } = record;

      assert.deepEqual([rerunPassed, expected, shard], [0, ["scripts/tests/a.test.ts"], null]);
      assert.throws(() => RunnerTotals.parse(JSON.stringify({ ...secondVersion, missing: [], version: 2 }), "totals.json"), new TotalsException("totals.json is version 2 of the test totals, not 3."));
      assert.throws(() => RunnerTotals.parse(JSON.stringify({ ...record, version: 4 }), "totals.json"), new TotalsException("totals.json is version 4 of the test totals, not 3."));
      assert.throws(() => RunnerTotals.parse(JSON.stringify({ ...record, coverage: { unit: "blocks", covered: 1 } }), "totals.json"), new TotalsException("totals.json, coverage, has no count total."));
      await repository.writeAsync({ "_build/totals/script.json": "{" });
      await assert.rejects(RunnerTotals.readAllAsync(repository.directory, ["script"]), new TotalsException("_build/totals/script.json is not JSON."));
    });

    test("the table shows each runner's counts and coverage, escapes text that would break it, and lists the skipped tests with their reasons", () => {
      const script = RunnerTotalsTests.create(RunnerTotalsTests.COUNTS);
      const unmeasured = new RunnerTotals("package", "Package | tests", { ...RunnerTotalsTests.NONE, discovered: 1, passed: 1 }, [], [], null, RunnerTotalsTests.NO_FINDINGS, RunnerTotalsTests.SCOPE);
      const empty = new RunnerTotals("angular", "Angular tests", RunnerTotalsTests.NONE, [], [], { unit: "statements", covered: 0, total: 0 }, RunnerTotalsTests.NO_FINDINGS, RunnerTotalsTests.SCOPE);

      assert.equal(RunnerTotals.formatTable([unmeasured, script, empty]),
        "| Tests | Discovered | Executed | Passed | Failed | Skipped | Unselected | Unreached | Coverage |\n|---|---|---|---|---|---|---|---|---|\n" +
        "| Package &#124; tests | 1 | 1 | 1 | 0 | 0 | 0 | 0 | Not measured |\n" +
        "| Script tests | 10 | 6 | 5 | 1 | 1 | 2 | 1 | 75.0% of 4 blocks |\n" +
        "| Angular tests | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 100.0% of 0 statements |\n" +
        "\n<details><summary>Script tests skipped (1)</summary>\n\n- scripts/tests/a.test.ts › waits: Waits for &lt;b&gt; &#124; c.\n\n</details>\n");
    });

    test("the table says beside a runner's failed count how many of its tests passed when run again", () => {
      const script = RunnerTotalsTests.create(RunnerTotalsTests.COUNTS).withRerunPassed(1);
      const unmeasured = new RunnerTotals("package", "Package tests", { ...RunnerTotalsTests.NONE, discovered: 1, passed: 1 }, [], [], null, RunnerTotalsTests.NO_FINDINGS, RunnerTotalsTests.SCOPE);

      assert.ok(RunnerTotals.formatTable([unmeasured, script]).includes(
        "| Package tests | 1 | 1 | 1 | 0 | 0 | 0 | 0 | Not measured |\n| Script tests | 10 | 6 | 5 | 1 (1 passed when run again; see the flaky record) | 1 | 2 | 1 | 75.0% of 4 blocks |\n"));
    });

    test("setting the count of tests that passed when run again keeps everything else", () => {
      const shard = RunnerTotalsTests.create(RunnerTotalsTests.COUNTS, { duplicates: ["a.test.ts › twice"], empty: ["empty.test.ts"] }, { expected: ["b.test.ts"], shard: "1/2" });

      const rerun = shard.withRerunPassed(2);

      assert.deepEqual(JSON.parse(rerun.toJson()), { ...JSON.parse(shard.toJson()), rerunPassed: 2 });
    });

    test("a line sums up the runner for the console, with each skipped test and its reason after it, and any failed tests that passed when run again", () => {
      const script = RunnerTotalsTests.create(RunnerTotalsTests.COUNTS);

      assert.equal(script.formatLine(),
        "Script tests: 10 discovered, 6 executed, 5 passed, 1 failed, 1 skipped, 2 unselected, 1 unreached; coverage 75.0% of 4 blocks.\n" +
        "  Skipped scripts/tests/a.test.ts › waits: Waits for <b> | c.\n");
      assert.ok(script.withRerunPassed(1).formatLine().startsWith("Script tests: 10 discovered, 6 executed, 5 passed, 1 failed (1 passed when run again; see the flaky record), 1 skipped,"));
    });

    test("recording writes the totals and reports each of their problems, which fails the record, and reporting only prints them", async t => {
      const root = (await RunnerTotalsTests.createRepositoryAsync(t)).directory;
      const sound = new TextOutputFixture();
      const unsound = new TextOutputFixture();
      const reported = new TextOutputFixture();

      assert.equal(await RunnerTotalsTests.create(RunnerTotalsTests.COUNTS).recordAsync(root, sound), true);
      assert.equal(await RunnerTotalsTests.create({ ...RunnerTotalsTests.COUNTS, discovered: 11 }, { duplicates: [], empty: ["empty.test.ts"] }).recordAsync(root, unsound), false);
      assert.equal(RunnerTotalsTests.create(RunnerTotalsTests.COUNTS, RunnerTotalsTests.NO_FINDINGS, { expected: ["c.test.ts", "scripts/tests/a.test.ts"], shard: null }).report(reported), false);

      assert.equal(sound.text, "");
      assert.equal(unsound.text, "Script tests don't add up: 11 discovered, but 6 executed, 1 skipped, 2 unselected and 1 unreached.\nScript tests found no tests in these files:\n  empty.test.ts\n");
      assert.equal(reported.text, "Script tests have no result for these files:\n  c.test.ts\n");
      assert.equal(JSON.parse(await readFile(path.join(root, "_build", "totals", "script.json"), "utf8")).discovered, 11);
    });
  }

  private static create(counts: IRunnerCounts, findings: IRunnerFindings = RunnerTotalsTests.NO_FINDINGS, scope: IRunnerScope = RunnerTotalsTests.SCOPE): RunnerTotals {
    return new RunnerTotals("script", "Script tests", counts, [{ test: "scripts/tests/a.test.ts › waits", reason: "Waits for <b> | c." }], ["scripts/tests/a.test.ts"], { unit: "blocks", covered: 3, total: 4 }, findings, scope);
  }

  private static async createRepositoryAsync(t: TestContext): Promise<RepositoryFixture> {
    const repository = await RepositoryFixture.createAsync();
    t.after(() => repository.disposeAsync());
    return repository;
  }
}

RunnerTotalsTests.register();
