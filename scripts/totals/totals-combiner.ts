/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type ICoverageCount from "./interfaces/i-coverage-count.ts";
import type IRunnerCounts from "./interfaces/i-runner-counts.ts";
import RunnerTotals from "./runner-totals.ts";

export default class TotalsCombiner {
  public static combineShards(shards: readonly [RunnerTotals, ...RunnerTotals[]]): RunnerTotals {
    const first = shards[0];
    const counts = TotalsCombiner.sumCounts(shards);
    const selected = counts.passed + counts.failed + counts.skipped + counts.unreached;
    return new RunnerTotals(
      first.runner,
      first.title,
      { ...counts, discovered: first.discovered, unselected: first.discovered - selected },
      shards.flatMap(t => t.skips),
      TotalsCombiner.union(shards.map(t => t.files)),
      null,
      { duplicates: TotalsCombiner.union(shards.map(t => t.duplicates)), empty: TotalsCombiner.union(shards.map(t => t.empty)) },
      { expected: first.expected, shard: null });
  }

  public static findDisagreement(shards: readonly [RunnerTotals, ...RunnerTotals[]]): string | null {
    const first = shards[0];
    const disagrees = shards.some(t => t.discovered !== first.discovered || t.expected.join("\n") !== first.expected.join("\n"));
    return disagrees ? `The shards of ${first.title} listed different tests: ${shards.map(t => `${t.discovered} tests in ${t.expected.length} files`).join(", ")}.` : null;
  }

  public static sum(totals: readonly [RunnerTotals, ...RunnerTotals[]]): RunnerTotals {
    const first = totals[0];
    return new RunnerTotals(
      first.runner,
      first.title,
      TotalsCombiner.sumCounts(totals),
      [],
      TotalsCombiner.union(totals.map(t => t.files)),
      TotalsCombiner.sumCoverage(totals.map(t => t.coverage)),
      { duplicates: [], empty: [] },
      { expected: [], shard: null });
  }

  private static sumCounts(totals: readonly RunnerTotals[]): IRunnerCounts {
    return totals.map(t => t.counts).reduce((t, u) => ({
      discovered: t.discovered + u.discovered,
      passed: t.passed + u.passed,
      failed: t.failed + u.failed,
      rerunPassed: t.rerunPassed + u.rerunPassed,
      skipped: t.skipped + u.skipped,
      unselected: t.unselected + u.unselected,
      unreached: t.unreached + u.unreached
    }));
  }

  private static sumCoverage(coverages: readonly (ICoverageCount | null)[]): ICoverageCount | null {
    const measured = coverages.filter(t => t !== null);
    const unit = measured[0]?.unit;
    if (unit === undefined || measured.length < coverages.length || measured.some(t => t.unit !== unit))
      return null;
    return { unit, covered: measured.reduce((t, u) => t + u.covered, 0), total: measured.reduce((t, u) => t + u.total, 0) };
  }

  private static union(lists: readonly (readonly string[])[]): readonly string[] {
    return [...new Set(lists.flat())].sort();
  }
}
