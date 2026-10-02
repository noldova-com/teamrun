/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import { JsonException, type JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type IWindowStateStore, WindowBoundsKeeper } from "@noldova/teamrun-shell-desktop";

import { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDisplayHost } from "../fixtures/fake-display-host.fixture.js";

class MemoryStore implements IWindowStateStore {
  public value: JsonObject | null;
  public readonly writes: JsonObject[] = [];
  public failure: Error | null = null;

  public constructor(value: JsonObject | null) {
    this.value = value;
  }

  public readAsync(): Promise<JsonObject | null> {
    return Promise.resolve(this.value);
  }

  public writeAsync(value: JsonObject): Promise<void> {
    if (this.failure !== null)
      return Promise.reject(this.failure);
    this.writes.push(value);
    return Promise.resolve();
  }
}

@TestClass
export class WindowBoundsKeeperTests {
  @TestMethod
  public async restoresSavedBoundsThatADisplayShows(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5);

    await keeper.restoreAsync(new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: true }));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async centersSavedBoundsThatNoDisplayShows(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5);

    await keeper.restoreAsync(new MemoryStore({ x: 5000, y: 100, width: 1000, height: 700, maximized: false }));

    Assert.areEqual(JSON.stringify(["setBounds {\"width\":1000,\"height\":700}", "center"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async keepsTheDefaultBoundsWhenNoneWereSavedOrTheyAreNotValid(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);

    await new WindowBoundsKeeper(window, new FakeDisplayHost(), 5).restoreAsync(new MemoryStore(null));
    await Assert.throwsAsync(() => new WindowBoundsKeeper(window, new FakeDisplayHost(), 5).restoreAsync(new MemoryStore({ width: 10 })), JsonException);

    Assert.areEqual("[]", JSON.stringify(window.calls));
  }

  @TestMethod
  public async savesOnceAfterAPauseInChanges(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5);

    window.change("move");
    await keeper.restoreAsync(store);
    window.change("resize");
    window.change("maximize");
    window.isMaximizedNow = true;
    window.change("unmaximize");
    await delay(40);

    Assert.areEqual(JSON.stringify([{ x: 100, y: 80, width: 1280, height: 800, maximized: true }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async savesAtOnceWhenAskedAndNotAfterTheWindowIsGone(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5);

    await keeper.saveAsync();
    await keeper.restoreAsync(store);
    window.change("move");
    await keeper.saveAsync();
    await delay(20);
    window.isGone = true;
    await keeper.saveAsync();

    Assert.areEqual(1, store.writes.length);
  }

  @TestMethod
  public async reportsAScheduledSaveThatFails(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    store.failure = new Error("The runtime is gone.");
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 1);
    const written: string[] = [];
    const write = process.stderr.write;
    process.stderr.write = ((text: string): boolean => written.push(text) > 0) as typeof process.stderr.write;
    try {
      await keeper.restoreAsync(store);
      window.change("resize");
      await delay(20);
    }
    finally {
      process.stderr.write = write;
    }

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: Error: The runtime is gone.\n"]), JSON.stringify(written));
  }
}
