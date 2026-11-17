/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ManualTimer } from "@noldova/teamrun.core/testing";

@TestClass
export class ManualTimerTests {
  @TestMethod
  public tellsTheTimeTheTestAdvancedIt(): void {
    const timer = new ManualTimer();

    const start = timer.now();
    timer.advance(250);
    timer.advance(50);

    Assert.areEqual(0, start);
    Assert.areEqual(300, timer.now());
  }

  @TestMethod
  public jumpsItsClockWithoutEndingAWait(): void {
    const timer = new ManualTimer();
    void timer.delayAsync(100, new AbortController().signal);

    timer.jump(500);
    const jumped = [timer.now(), timer.pending];
    timer.advance(100);

    Assert.areEqual("500,1", jumped.join(","));
    Assert.areEqual("600,0", [timer.now(), timer.pending].join(","));
  }

  @TestMethod
  public countsThePendingWaitsAnAdvanceWouldEnd(): void {
    const timer = new ManualTimer();
    const ended = new AbortController();
    void timer.delayAsync(100, new AbortController().signal);
    void timer.delayAsync(300, new AbortController().signal);
    void timer.delayAsync(50, ended.signal).catch(() => undefined);
    ended.abort();

    timer.advance(40);
    const counts = [timer.pendingWithin(59), timer.pendingWithin(60), timer.pendingWithin(260)];

    Assert.areEqual("0,1,2", counts.join(","));
  }

  @TestMethod
  public async endsEachWaitOnceTheTimeReachesItsDeadline(): Promise<void> {
    const timer = new ManualTimer();
    const signal = new AbortController().signal;
    const first = timer.delayAsync(100, signal);
    const second = timer.delayAsync(200, signal);

    timer.advance(99);
    const beforeDeadline = timer.pending;
    timer.advance(1);
    await first;
    const afterFirst = timer.pending;
    timer.advance(100);
    await second;

    Assert.areEqual(2, timer.begun);
    Assert.areEqual(2, beforeDeadline);
    Assert.areEqual(1, afterFirst);
    Assert.areEqual(0, timer.pending);
  }

  @TestMethod
  public async rejectsAnAbortedWaitWithTheSignalsReasonAndForgetsIt(): Promise<void> {
    const timer = new ManualTimer();
    const controller = new AbortController();
    const wait = timer.delayAsync(100, controller.signal);

    controller.abort(new Error("stopped"));
    const rejected = await Assert.throwsAsync(() => wait, Error);
    timer.advance(100);

    Assert.areEqual("stopped", rejected.message);
    Assert.areEqual(0, timer.pending);
  }

  @TestMethod
  public async settlesDelayedEachTimeAWaitBegins(): Promise<void> {
    const timer = new ManualTimer();
    const signal = new AbortController().signal;

    const first = timer.delayed;
    void timer.delayAsync(100, signal);
    await first;
    const second = timer.delayed;
    void timer.delayAsync(100, signal);
    await second;

    Assert.areEqual(2, timer.begun);
    Assert.areEqual(2, timer.pending);
  }
}
