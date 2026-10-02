/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import "@noldova/teamrun-foundation-core";
import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { IdleMonitor } from "@noldova/teamrun-shell-runtime";

import { IdleParticipantFixture } from "../../fixtures/idle-participant.fixture.js";

@TestClass
export class IdleMonitorTests {
  private static readonly GRACE: number = 20;
  private static readonly SETTLE: number = 120;

  @TestMethod
  public reportsIdlenessOnceAfterTheGrace(): Promise<void> {
    return IdleMonitorTests.runAsync(async (participant, monitor) => {
      monitor.check();
      monitor.check();
      Assert.isTrue(monitor.isArmed);

      await delay(IdleMonitorTests.SETTLE);

      Assert.areEqual(1, participant.idleCount);
      Assert.isFalse(monitor.isArmed);
    });
  }

  @TestMethod
  public disarmsWhenTheParticipantBecomesBusy(): Promise<void> {
    return IdleMonitorTests.runAsync(async (participant, monitor) => {
      monitor.check();
      participant.isIdle = false;
      monitor.check();
      monitor.check();

      await delay(IdleMonitorTests.SETTLE);

      Assert.isFalse(monitor.isArmed);
      Assert.areEqual(0, participant.idleCount);
    });
  }

  @TestMethod
  public ignoresTheGraceEndingWhileTheParticipantIsBusy(): Promise<void> {
    return IdleMonitorTests.runAsync(async (participant, monitor) => {
      monitor.check();
      participant.isIdle = false;

      await delay(IdleMonitorTests.SETTLE);

      Assert.isFalse(monitor.isArmed);
      Assert.areEqual(0, participant.idleCount);
    });
  }

  @TestMethod
  public staysDisarmedOnceDisposed(): Promise<void> {
    return IdleMonitorTests.runAsync(async (participant, monitor) => {
      monitor.check();
      monitor[Symbol.dispose]();
      monitor.check();

      await delay(IdleMonitorTests.SETTLE);

      Assert.isFalse(monitor.isArmed);
      Assert.areEqual(0, participant.idleCount);
    });
  }

  @TestMethod
  public requiresAPositiveGrace(): void {
    const exception = Assert.throws(() => new IdleMonitor(0, new IdleParticipantFixture()), ArgumentOutOfRangeException);

    Assert.areEqual("idleGraceMilliseconds", exception.parameterName);
  }

  private static async runAsync(test: (participant: IdleParticipantFixture, monitor: IdleMonitor) => Promise<void>): Promise<void> {
    const participant = new IdleParticipantFixture();
    using monitor = new IdleMonitor(IdleMonitorTests.GRACE, participant);
    await test(participant, monitor);
  }
}
