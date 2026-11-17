/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PageStalls } from "./page-stalls.fixture";
import { Wait } from "./wait.fixture";

describe("PageStalls", () => {
  const block = (milliseconds: number): number => {
    const end = performance.now() + milliseconds;
    let spins = 0;
    while (performance.now() < end)
      spins += 1;
    return spins;
  };
  const tasks = (report: string): { start: number; length: number }[] => [...report.matchAll(/a long task at (-?\d+) ms for (\d+) ms/g)]
    .map(t => ({ start: Number(t[1]), length: Number(t[2]) }));
  const timers = (report: string): { late: number; held: number }[] => [...report.matchAll(/the timer late at -?\d+ ms for (\d+) ms, with long tasks over (\d+) of its \d+ ms/g)]
    .map(t => ({ late: Number(t[1]), held: Number(t[2]) }));

  it("names a long task that held the page while a test ran, with its start and length, and the timer it held late, with the long tasks' share of that", async () => {
    const stalls = PageStalls.shared;
    const from = stalls.elapsed();
    block(1_300);

    await Wait.until(() => {
      const report = stalls.during(from, stalls.elapsed());
      expect([tasks(report).some(t => t.length >= 1_300), timers(report).some(t => t.late >= 1_000 && t.held >= t.late * 0.9)],
        report).toEqual([true, true]);
    });
  });

  it("names neither when the page ran freely, and leaves out stalls before the test", async () => {
    const stalls = PageStalls.shared;
    block(300);
    const reported = await Wait.until(() => {
      const report = stalls.during(0, stalls.elapsed());
      expect(report).toContain("a long task");
      return report;
    });
    const cleared = Math.max(...tasks(reported).map(t => t.start + t.length)) + 1;
    await Wait.until(() => expect(stalls.elapsed()).toBeGreaterThan(cleared));
    const from = stalls.elapsed();

    expect(stalls.during(from, stalls.elapsed())).toBe("no long task over 50 ms and no timer late by 1000 ms");
  });

  it("is one recorder for the page", () => {
    expect(PageStalls.shared).toBe(PageStalls.shared);
  });
});
