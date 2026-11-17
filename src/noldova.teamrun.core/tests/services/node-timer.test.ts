/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { NodeTimer } from "@noldova/teamrun.core";

@TestClass
export class NodeTimerTests {
  @TestMethod
  public tellsTheTimeFromTheSystemClock(): void {
    const before = Date.now();
    const now = new NodeTimer().now();

    Assert.isTrue(now >= before && now <= Date.now());
  }

  @TestMethod
  public async waitsTheGivenTimeOrEndsEarlyWhenItsSignalAborts(): Promise<void> {
    const timer = new NodeTimer();
    const aborted = new AbortController();

    await timer.delayAsync(1, new AbortController().signal);
    const waiting = timer.delayAsync(60_000, aborted.signal);
    aborted.abort();

    await Assert.throwsAsync(() => waiting, Error);
  }
}
