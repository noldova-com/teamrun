/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import type { UpdateProcess } from "@noldova/teamrun-shell-protocol";
import { DesktopRecord } from "@noldova/teamrun-shell-desktop";

import { FakeProcessPresence } from "../fixtures/fake-process-presence.fixture.js";

@TestClass
export class DesktopRecordTests {
  private readonly recorded: UpdateProcess[] = [];

  @TestMethod
  public async recordsTheDesktopStampedWithItsStart(): Promise<void> {
    const isRecorded = await DesktopRecord.recordAsync({ recordDesktopAsync: t => this.recordAsync(t) }, new FakeProcessPresence(), 4120);

    Assert.isTrue(isRecorded);
    Assert.areEqual(JSON.stringify([{ processId: 4120, earliest: 1500, latest: 1501, role: "desktop" }]), JSON.stringify(this.recorded.map(t => t.toJson())));
  }

  @TestMethod
  public async recordsNothingWhenItsProcessIsNotInTheTable(): Promise<void> {
    const presence = new FakeProcessPresence();
    presence.isStamping = false;

    const isRecorded = await DesktopRecord.recordAsync({ recordDesktopAsync: t => this.recordAsync(t) }, presence, 4120);

    Assert.isFalse(isRecorded);
    Assert.areEqual(0, this.recorded.length);
  }

  private recordAsync(desktop: UpdateProcess): Promise<void> {
    this.recorded.push(desktop);
    return Promise.resolve();
  }
}
