/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { AbortTimer } from "@noldova/teamrun-providers";

@TestClass
export class AbortTimerTests {
  @TestMethod
  public async elapsesAfterTheDelayOnceAborted(): Promise<void> {
    const controller = new AbortController();
    using timer = new AbortTimer(controller.signal, 10);

    Assert.isFalse(timer.elapsed);
    controller.abort();
    await timer.wait();

    Assert.isTrue(timer.elapsed);
  }

  @TestMethod
  public async armsImmediatelyForAnAbortedSignal(): Promise<void> {
    using timer = new AbortTimer(AbortSignal.abort(), 10);

    await timer.wait();

    Assert.isTrue(timer.elapsed);
  }

  @TestMethod
  public async stopsListeningWhenDisposed(): Promise<void> {
    const controller = new AbortController();
    const armed = new AbortTimer(controller.signal, 10);
    const timer = new AbortTimer(controller.signal, 10);
    controller.abort();

    armed[Symbol.dispose]();
    timer[Symbol.dispose]();
    await new Promise(resolve => setTimeout(resolve, 30));

    Assert.isFalse(armed.elapsed);
    Assert.isFalse(timer.elapsed);
    Assert.throws(() => new AbortTimer(controller.signal, 0), ArgumentOutOfRangeException);
  }
}
