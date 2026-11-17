/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FrameStatistics {
  private static readonly FRAME_BUDGET: number = 16.7;
  private static readonly MEDIAN: number = 0.5;
  private static readonly P95: number = 0.95;

  public static format(values: readonly number[]): string {
    if (values.length === 0)
      return "n=0";
    const sorted = [...values].sort((a, b) => a - b);
    const at = (quantile: number): number => sorted[Math.min(sorted.length - 1, Math.floor(quantile * sorted.length))]!;
    return `n=${sorted.length} median=${at(FrameStatistics.MEDIAN).toFixed(1)} p95=${at(FrameStatistics.P95).toFixed(1)} max=${sorted.at(-1)!.toFixed(1)} `
      + `over16=${sorted.filter(t => t > FrameStatistics.FRAME_BUDGET).length}`;
  }
}
