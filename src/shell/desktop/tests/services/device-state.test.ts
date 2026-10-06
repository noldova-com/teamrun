/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { DeviceState } from "@noldova/teamrun-shell-desktop";

import { FakeDeviceFileStore } from "../fixtures/fake-device-file-store.fixture.js";

@TestClass
export class DeviceStateTests {
  @TestMethod
  public async showsAHintOnceAndRecordsItBesideTheOtherHints(): Promise<void> {
    const store = new FakeDeviceFileStore();
    store.kept = { otherHintShown: true };
    let shown = 0;
    const show = (): boolean => ++shown > 0;

    await new DeviceState(store, () => undefined).showOnceAsync("trayCloseHintShown", show);
    const state = new DeviceState(store, () => undefined);
    await state.showOnceAsync("trayCloseHintShown", show);
    await state.showOnceAsync("otherHintShown", show);

    Assert.areEqual(1, shown);
    Assert.areEqual(JSON.stringify([{ otherHintShown: true, trayCloseHintShown: true }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async recordsNothingForAHintThatCouldNotShowAndTriesItOnlyOnceARun(): Promise<void> {
    const store = new FakeDeviceFileStore();
    const state = new DeviceState(store, () => undefined);
    let tries = 0;

    await state.showOnceAsync("trayCloseHintShown", () => ++tries < 0);
    await state.showOnceAsync("trayCloseHintShown", () => ++tries < 0);

    Assert.areEqual(1, tries);
    Assert.areEqual(0, store.writes.length);
  }

  @TestMethod
  public async readsTheFileOnceAndWritesEachChangeOverTheOnesBeforeIt(): Promise<void> {
    const store = new FakeDeviceFileStore();
    store.kept = { trayCloseHintShown: true };
    const state = new DeviceState(store, () => undefined);

    await Promise.all([state.rememberAsync("trayIcon", false), state.rememberAsync("trayIcon", true), state.showOnceAsync("otherHintShown", () => true)]);
    store.kept = {};

    Assert.areEqual(JSON.stringify([
      { trayCloseHintShown: true, trayIcon: false },
      { trayCloseHintShown: true, trayIcon: true },
      { trayCloseHintShown: true, trayIcon: true, otherHintShown: true }
    ]), JSON.stringify(store.writes));
    Assert.areEqual(JSON.stringify({ trayCloseHintShown: true, trayIcon: true, otherHintShown: true }), JSON.stringify(await state.readAsync()));
    Assert.areEqual(1, store.reads);
  }

  @TestMethod
  public async countsAFileThatCannotBeReadAsEmptyAndLogsWhatItCannotReadOrWrite(): Promise<void> {
    const store = new FakeDeviceFileStore();
    store.readFailure = new SyntaxError("Unexpected end of JSON input");
    store.writeFailure = new Error("The disk is full.");
    const lines: string[] = [];
    const state = new DeviceState(store, t => lines.push(t));
    let shown = 0;

    await state.showOnceAsync("trayCloseHintShown", () => ++shown > 0);
    await state.rememberAsync("trayIcon", false);

    Assert.areEqual(1, shown);
    Assert.areEqual(JSON.stringify([{ trayCloseHintShown: true }, { trayCloseHintShown: true, trayIcon: false }]), JSON.stringify(store.writes));
    Assert.areEqual(JSON.stringify([
      "The device's state could not be read, so its hints count as not shown and the tray icon follows its default until the runtime answers: SyntaxError: Unexpected end of JSON input",
      "The device could not record trayCloseHintShown in its state: Error: The disk is full.",
      "The device could not record trayIcon in its state: Error: The disk is full."
    ]), JSON.stringify(lines));
  }
}
