/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import { ArgumentOutOfRangeException } from "@noldova/teamrun-foundation-exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/teamrun-foundation-testing";
import { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { UpdateBarrierState } from "@noldova/teamrun-shell-runtime";
import { UpdateBarrierWatch } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeUpdateHost } from "../fixtures/fake-update-host.fixture.js";

@TestClass
export class UpdateBarrierWatchTests {
  private readonly updates: FakeUpdateHost = new FakeUpdateHost();
  private isConnected: boolean = false;

  @TestMethod
  @TestData(0)
  @TestData(1.5)
  public needsAPositiveWholeInterval(interval: number): void {
    Assert.throws(() => new UpdateBarrierWatch(this.updates, () => false, interval), ArgumentOutOfRangeException);
  }

  @TestMethod
  public async quitsADesktopWithoutAConnectionOnceAnotherDesktopsUpdateIsClosing(): Promise<void> {
    const watch = this.create();
    this.updates.barriers.push(
      new Error("The barrier is being replaced."),
      null,
      FakeUpdateHost.barrier(UpdateBarrierState.Preparing),
      FakeUpdateHost.barrier(UpdateBarrierState.Closing, new UpdateProcess(4121, 1500, 1501, "desktop")),
      FakeUpdateHost.barrier(UpdateBarrierState.Closing),
      FakeUpdateHost.barrier(UpdateBarrierState.Closing),
      FakeUpdateHost.barrier(UpdateBarrierState.Closing));
    this.updates.ended.push(true, new Error("ps exited with code 1."), false);

    const results = [];
    for (let check = 0; check < 7; check++)
      results.push(await watch.checkAsync());

    Assert.areEqual("false false false false false false true", results.join(" "));
    Assert.areEqual(1, this.updates.quitCount);
  }

  @TestMethod
  public async leavesAConnectedDesktopToItsRuntimeAndChecksOnceAtATime(): Promise<void> {
    const watch = this.create();
    let read: (barrier: null) => void = () => undefined;
    this.updates.reading = new Promise(resolve => {
      read = resolve;
    });
    this.isConnected = true;
    const connected = await watch.checkAsync();
    this.isConnected = false;

    const first = watch.checkAsync();
    const second = await watch.checkAsync();
    read(null);

    Assert.isFalse(connected);
    Assert.isFalse(second);
    Assert.isFalse(await first);
    Assert.areEqual(0, this.updates.quitCount);
  }

  @TestMethod
  public async checksEveryIntervalOnceStartedUntilItQuitsOrStops(): Promise<void> {
    const watch = this.create(1);
    this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Closing));

    watch.start();
    watch.start();
    await Condition.waitAsync(() => this.updates.quitCount > 0);
    await delay(20);
    const quits = this.updates.quitCount;
    watch.start();
    watch.stop();
    watch.stop();
    this.updates.barriers.push(FakeUpdateHost.barrier(UpdateBarrierState.Closing));
    await delay(20);

    Assert.areEqual(1, quits);
    Assert.areEqual(1, this.updates.quitCount);
  }

  private create(interval: number = 1000): UpdateBarrierWatch {
    return new UpdateBarrierWatch(this.updates, () => this.isConnected, interval);
  }
}
