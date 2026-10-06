/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import type ICoverageCount from "../../totals/interfaces/coverage-count.ts";
import type IRunnerCounts from "../../totals/interfaces/runner-counts.ts";
import RunnerTotals from "../../totals/runner-totals.ts";
import TotalsCombiner from "../../totals/totals-combiner.ts";

class TotalsCombinerTests {
  private static readonly EXPECTED: readonly string[] = ["e2e/a.spec.ts", "e2e/b.spec.ts", "e2e/c.spec.ts"];
  private static readonly FIRST: IRunnerCounts = { discovered: 6, passed: 2, failed: 0, rerunPassed: 1, skipped: 1, unselected: 3, unreached: 0 };
  private static readonly SECOND: IRunnerCounts = { discovered: 6, passed: 1, failed: 1, rerunPassed: 0, skipped: 0, unselected: 3, unreached: 1 };

  public static register(): void {
    test("a runner's shards combine into one run that selects what any shard ran, with every skip, file and finding of its shards", () => {
      const first = TotalsCombinerTests.shard("1/2", TotalsCombinerTests.FIRST, ["e2e/a.spec.ts"], ["e2e/a.spec.ts › twice"]);
      const second = TotalsCombinerTests.shard("2/2", TotalsCombinerTests.SECOND, ["e2e/b.spec.ts", "e2e/a.spec.ts"], ["e2e/a.spec.ts › twice", "e2e/b.spec.ts › twice"]);

      const combined = TotalsCombiner.combineShards([first, second]);

      assert.deepEqual(combined.counts, { discovered: 6, passed: 3, failed: 1, rerunPassed: 1, skipped: 1, unselected: 0, unreached: 1 });
      assert.deepEqual([combined.runner, combined.title, combined.shard, combined.coverage], ["ui", "UI workflows", null, null]);
      assert.deepEqual(combined.skips, first.skips);
      assert.deepEqual(combined.files, ["e2e/a.spec.ts", "e2e/b.spec.ts"]);
      assert.deepEqual([combined.duplicates, combined.empty], [["e2e/a.spec.ts › twice", "e2e/b.spec.ts › twice"], ["e2e/empty.spec.ts"]]);
      assert.deepEqual([combined.expected, combined.missing], [TotalsCombinerTests.EXPECTED, ["e2e/c.spec.ts"]]);
    });

    test("shards that listed the same tests agree, and shards that listed a different number of tests or different files are named with what each listed", () => {
      const first = TotalsCombinerTests.shard("1/2", TotalsCombinerTests.FIRST, [], []);
      const same = TotalsCombinerTests.shard("2/2", TotalsCombinerTests.SECOND, [], []);
      const more = TotalsCombinerTests.shard("2/2", { ...TotalsCombinerTests.SECOND, discovered: 7 }, [], []);
      const fewer = new RunnerTotals("ui", "UI workflows", TotalsCombinerTests.SECOND, [], [], null, { duplicates: [], empty: [] }, { expected: ["e2e/a.spec.ts", "e2e/b.spec.ts", "e2e/d.spec.ts"], shard: "2/2" });

      assert.equal(TotalsCombiner.findDisagreement([first, same]), null);
      assert.equal(TotalsCombiner.findDisagreement([first]), null);
      assert.equal(TotalsCombiner.findDisagreement([first, more]), "The shards of UI workflows listed different tests: 6 tests in 3 files, 7 tests in 3 files.");
      assert.equal(TotalsCombiner.findDisagreement([first, fewer]), "The shards of UI workflows listed different tests: 6 tests in 3 files, 6 tests in 3 files.");
    });

    test("a runner's totals across targets add up their counts and files, and their coverage when every one measured it in the same unit", () => {
      const blocks = (covered: number, total: number): ICoverageCount => ({ unit: "blocks", covered, total });
      const linux = TotalsCombinerTests.script(TotalsCombinerTests.FIRST, blocks(3, 4), ["scripts/tests/a.test.ts"]);
      const windows = TotalsCombinerTests.script(TotalsCombinerTests.SECOND, blocks(2, 4), ["scripts/tests/b.test.ts", "scripts/tests/a.test.ts"]);

      const whole = TotalsCombiner.sum([linux, windows]);

      assert.deepEqual(whole.counts, { discovered: 12, passed: 3, failed: 1, rerunPassed: 1, skipped: 1, unselected: 6, unreached: 1 });
      assert.deepEqual([whole.runner, whole.title, whole.skips, whole.files], ["script", "Script tests", [], ["scripts/tests/a.test.ts", "scripts/tests/b.test.ts"]]);
      assert.deepEqual(whole.coverage, blocks(5, 8));
      assert.deepEqual([whole.duplicates, whole.empty, whole.expected, whole.shard], [[], [], [], null]);
      assert.equal(TotalsCombiner.sum([linux, TotalsCombinerTests.script(TotalsCombinerTests.FIRST, null, [])]).coverage, null);
      assert.equal(TotalsCombiner.sum([linux, TotalsCombinerTests.script(TotalsCombinerTests.FIRST, { unit: "files", covered: 1, total: 1 }, [])]).coverage, null);
      assert.equal(TotalsCombiner.sum([TotalsCombinerTests.script(TotalsCombinerTests.FIRST, null, [])]).coverage, null);
    });
  }

  private static shard(shard: string, counts: IRunnerCounts, files: readonly string[], duplicates: readonly string[]): RunnerTotals {
    const skips = counts.skipped === 0 ? [] : [{ test: "e2e/a.spec.ts › waits", reason: "Later." }];
    return new RunnerTotals("ui", "UI workflows", counts, skips, files, null, { duplicates, empty: ["e2e/empty.spec.ts"] }, { expected: TotalsCombinerTests.EXPECTED, shard });
  }

  private static script(counts: IRunnerCounts, coverage: ICoverageCount | null, files: readonly string[]): RunnerTotals {
    return new RunnerTotals("script", "Script tests", counts, [], files, coverage, { duplicates: [], empty: [] }, { expected: files, shard: null });
  }
}

TotalsCombinerTests.register();
