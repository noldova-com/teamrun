/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ManualTimer } from "@noldova/teamrun.core/testing";
import { Deadline } from "@noldova/teamrun.providers";

import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class DeadlineTests {
  @TestMethod
  public async callsBackOnceTheLimitPassesSinceItsLastStartAndNotBefore(): Promise<void> {
    const timer = new ManualTimer();
    let elapsed = 0;
    const deadline = new Deadline(timer, 100, () => { elapsed += 1; });

    deadline.start();
    timer.advance(60);
    deadline.start();
    timer.advance(60);
    const early = [elapsed, deadline.isRunning, timer.pending];
    timer.advance(40);
    await Wait.until(() => elapsed === 1, "The deadline did not call back.");

    Assert.areEqual(JSON.stringify([0, true, 1]), JSON.stringify(early));
    Assert.isFalse(deadline.isRunning);
    Assert.areEqual(0, timer.pending);
  }

  @TestMethod
  public async extendsOnlyARunningDeadline(): Promise<void> {
    const timer = new ManualTimer();
    let elapsed = 0;
    const deadline = new Deadline(timer, 100, () => { elapsed += 1; });

    deadline.extend();
    const idle = [deadline.isRunning, timer.begun];
    deadline.start();
    timer.advance(90);
    deadline.extend();
    timer.advance(90);
    const extended = [elapsed, timer.pending];
    timer.advance(10);
    await Wait.until(() => elapsed === 1, "The extended deadline did not call back.");

    Assert.areEqual(JSON.stringify([false, 0]), JSON.stringify(idle));
    Assert.areEqual(JSON.stringify([0, 1]), JSON.stringify(extended));
  }

  @TestMethod
  public async neverCallsBackOnceStoppedEvenWhenItsWaitEndedJustBefore(): Promise<void> {
    const timer = new ManualTimer();
    let elapsed = 0;
    const deadline = new Deadline(timer, 100, () => { elapsed += 1; });

    deadline.start();
    timer.advance(100);
    deadline.stop();
    deadline.start();
    deadline.stop();
    deadline.start();
    await Wait.until(() => timer.pending === 1, "The last start did not wait.");
    deadline.stop();
    timer.advance(100);
    await Wait.until(() => timer.pending === 0, "The stopped wait did not end.");

    Assert.areEqual(0, elapsed);
    Assert.isFalse(deadline.isRunning);
  }
}
