/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { OneTimeHints } from "@noldova/teamrun-shell-desktop";

import { FakeDeviceFileStore } from "../fixtures/fake-device-file-store.fixture.js";

@TestClass
export class OneTimeHintsTests {
  @TestMethod
  public async showsAHintOnceAndRecordsItBesideTheOtherHints(): Promise<void> {
    const store = new FakeDeviceFileStore();
    store.kept = { otherHintShown: true };
    let shown = 0;
    const show = (): boolean => ++shown > 0;

    await new OneTimeHints(store, () => undefined).showOnceAsync("trayCloseHintShown", show);
    const hints = new OneTimeHints(store, () => undefined);
    await hints.showOnceAsync("trayCloseHintShown", show);
    await hints.showOnceAsync("otherHintShown", show);

    Assert.areEqual(1, shown);
    Assert.areEqual(JSON.stringify([{ otherHintShown: true, trayCloseHintShown: true }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async recordsNothingForAHintThatCouldNotShowAndTriesItOnlyOnceARun(): Promise<void> {
    const store = new FakeDeviceFileStore();
    const hints = new OneTimeHints(store, () => undefined);
    let tries = 0;

    await hints.showOnceAsync("trayCloseHintShown", () => ++tries < 0);
    await hints.showOnceAsync("trayCloseHintShown", () => ++tries < 0);

    Assert.areEqual(1, tries);
    Assert.areEqual(0, store.writes.length);
  }

  @TestMethod
  public async showsAHintWhoseRecordCannotBeReadAndLogsWhatItCannotReadOrWrite(): Promise<void> {
    const store = new FakeDeviceFileStore();
    store.readFailure = new SyntaxError("Unexpected end of JSON input");
    store.writeFailure = new Error("The disk is full.");
    const lines: string[] = [];
    let shown = 0;

    await new OneTimeHints(store, t => lines.push(t)).showOnceAsync("trayCloseHintShown", () => ++shown > 0);

    Assert.areEqual(1, shown);
    Assert.areEqual(JSON.stringify([{ trayCloseHintShown: true }]), JSON.stringify(store.writes));
    Assert.areEqual(JSON.stringify([
      "The device's one-time hints could not be read, so they count as not shown: SyntaxError: Unexpected end of JSON input",
      "The device could not record that the hint trayCloseHintShown has shown: Error: The disk is full."
    ]), JSON.stringify(lines));
  }
}
