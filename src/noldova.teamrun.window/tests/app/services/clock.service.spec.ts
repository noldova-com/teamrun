/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { TestBed } from "@angular/core/testing";

import { Wait } from "../../fixtures/wait.fixture";
import { ClockService } from "../../../src/app/services/clock.service";

describe("ClockService", () => {
  it("tells the time and ticks until stopped", async () => {
    const clock = TestBed.inject(ClockService);
    const before = Date.now();
    let ticks = 0;

    const stop = clock.every(5, () => ticks += 1);
    await Wait.until(() => expect(ticks).toBeGreaterThanOrEqual(2));
    stop();
    const stopped = ticks;
    let later = 0;
    const stopLater = clock.every(5, () => later += 1);
    await Wait.until(() => expect(later).toBeGreaterThanOrEqual(3));
    stopLater();

    expect(clock.now()).toBeGreaterThanOrEqual(before);
    expect(ticks).toBe(stopped);
  });

  it("calls back once after a time, and not at all when stopped first", async () => {
    const clock = TestBed.inject(ClockService);
    let done = 0;
    let stopped = 0;
    let later = 0;

    const stop = clock.after(5, () => stopped += 1);
    stop();
    clock.after(10, () => done += 1);
    clock.after(30, () => later += 1);
    await Wait.until(() => expect(later).toBe(1));

    expect([done, stopped]).toEqual([1, 0]);
  });
});
