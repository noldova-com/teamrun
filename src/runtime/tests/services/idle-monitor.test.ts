/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { IdleMonitor } from "@noldova/teamrun-runtime";

import { FakeIdleParticipant } from "../fixtures/fake-idle-participant.fixture.js";
import { Wait } from "../fixtures/wait.fixture.js";

@TestClass
export class IdleMonitorTests {
  @TestMethod
  public async firesAfterTheGraceWhileIdle(): Promise<void> {
    const participant = new FakeIdleParticipant();
    using monitor = new IdleMonitor(20, participant);

    monitor.check();
    const armedWhileBusy = monitor.isArmed;
    participant.isIdle = true;
    monitor.check();
    monitor.check();
    const armedWhileIdle = monitor.isArmed;
    await Wait.until(() => participant.idleCount === 1);

    Assert.isFalse(armedWhileBusy);
    Assert.isTrue(armedWhileIdle);
    Assert.isFalse(monitor.isArmed);
  }

  @TestMethod
  public async disarmsWhenBusyAgainOrDisposed(): Promise<void> {
    const participant = new FakeIdleParticipant();
    const monitor = new IdleMonitor(20, participant);
    participant.isIdle = true;
    monitor.check();
    participant.isIdle = false;
    monitor.check();
    const disarmed = !monitor.isArmed;
    participant.isIdle = true;
    monitor.check();
    monitor[Symbol.dispose]();
    monitor[Symbol.dispose]();
    await Wait.delay(40);

    Assert.isTrue(disarmed);
    Assert.areEqual(0, participant.idleCount);
    Assert.isFalse(monitor.isArmed);
  }

  @TestMethod
  public async ignoresAParticipantThatGotBusyBeforeTheTimerFired(): Promise<void> {
    const participant = new FakeIdleParticipant();
    const never = new IdleMonitor(null, participant);
    participant.isIdle = true;
    never.check();
    const neverArmed = never.isArmed;
    using monitor = new IdleMonitor(20, participant);
    monitor.check();
    participant.isIdle = false;
    await Wait.delay(40);

    Assert.isFalse(neverArmed);
    Assert.areEqual(0, participant.idleCount);
    Assert.throws(() => new IdleMonitor(0, participant), ArgumentOutOfRangeException);
  }
}
