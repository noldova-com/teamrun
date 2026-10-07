/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException, type JsonObject } from "@noldova/teamrun-foundation-json";
import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { type IWindowStateStore, WindowBoundsKeeper, WindowStateException, WindowStateUnavailableException } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDesktopLog } from "../fixtures/fake-desktop-log.fixture.js";
import { FakeDisplayHost } from "../fixtures/fake-display-host.fixture.js";

class MemoryStore implements IWindowStateStore {
  public value: JsonObject | null;
  public readonly writes: JsonObject[] = [];
  public failure: Error | null = null;
  public attempts: number = 0;

  public constructor(value: JsonObject | null) {
    this.value = value;
  }

  public readAsync(): Promise<JsonObject | null> {
    return Promise.resolve(this.value);
  }

  public writeAsync(value: JsonObject): Promise<void> {
    this.attempts++;
    if (this.failure !== null)
      return Promise.reject(this.failure);
    this.writes.push(value);
    return Promise.resolve();
  }
}

@TestClass
export class WindowBoundsKeeperTests {
  @TestMethod
  public async keepsBoundsItCouldNotSaveWhileTheRuntimeWasUnreachableAndSavesTheNewestOnce(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    const log = new FakeDesktopLog();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 1, log, true);
    await keeper.restoreAsync(store);
    store.failure = new WindowStateUnavailableException("TeamRun is not connected to its runtime.");

    window.bounds = { x: 10, y: 20, width: 800, height: 600 };
    window.change("move");
    await Condition.waitAsync(() => store.attempts === 1);
    window.bounds = { x: 30, y: 40, width: 900, height: 640 };
    window.change("resize");
    await Condition.waitAsync(() => store.attempts === 2);
    const writesWhileUnreachable = store.writes.length;
    store.failure = null;
    await keeper.saveUnsavedAsync();
    await keeper.saveUnsavedAsync();

    Assert.areEqual(0, writesWhileUnreachable);
    Assert.areEqual(0, log.lines.length);
    Assert.areEqual(JSON.stringify([{ x: 30, y: 40, width: 900, height: 640, maximized: false }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async savesNothingWhenNoBoundsAreUnsavedAndStillReportsARefusal(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    const log = new FakeDesktopLog();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 1, log, true);
    await keeper.restoreAsync(store);

    await keeper.saveUnsavedAsync();
    store.failure = new WindowStateException("The runtime refused shell.writeWindowBounds: The database is busy.");
    window.change("move");
    await Condition.waitAsync(() => log.lines.length === 1);
    store.failure = null;
    await keeper.saveUnsavedAsync();

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: WindowStateException: The runtime refused shell.writeWindowBounds: The database is busy."]), JSON.stringify(log.lines));
    Assert.areEqual(1, store.writes.length);
  }

  @TestMethod
  public async keepsWhereThePersonPlacedTheWindowBeforeTheStoreAndSavesItInsteadOfRestoring(): Promise<void> {
    for (const event of ["will-move", "will-resize"]) {
      const window = new FakeDesktopWindow({}, 1);
      const store = new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: false });
      const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

      window.bounds = { x: 40, y: 60, width: 900, height: 640 };
      window.change(event);
      await keeper.restoreAsync(store);

      Assert.areEqual("[]", JSON.stringify(window.calls));
      Assert.areEqual(JSON.stringify([{ x: 40, y: 60, width: 900, height: 640, maximized: false }]), JSON.stringify(store.writes));
    }
  }

  @TestMethod
  public async keepsBoundsMovedBeforeTheStoreUnsavedWhenTheFirstSaveFails(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    store.failure = new WindowStateUnavailableException("TeamRun is not connected to its runtime.");
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

    window.change("will-move");
    await Assert.throwsAsync(() => keeper.restoreAsync(store), WindowStateUnavailableException);
    store.failure = null;
    await keeper.saveUnsavedAsync();

    Assert.areEqual(1, store.writes.length);
  }

  @TestMethod
  public async restoresTheSavedBoundsWhenOnlyTheWindowManagerChangedTheWindowBeforeTheStore(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: false });
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

    window.bounds = { x: 0, y: 0, width: 1280, height: 752 };
    window.change("resize");
    window.change("move");
    await keeper.restoreAsync(store);

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
    Assert.areEqual(0, store.writes.length);
  }

  @TestMethod
  public async restoresTheSavedBoundsWhereTheWindowDoesNotHoldThePersonsMoves(): Promise<void> {
    for (const event of ["will-move", "will-resize"]) {
      const window = new FakeDesktopWindow({}, 1);
      const store = new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: false });
      const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), false);

      window.bounds = { x: 0, y: 0, width: 1280, height: 752 };
      window.change(event);
      await keeper.restoreAsync(store);

      Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
      Assert.areEqual(0, store.writes.length);
    }
  }

  @TestMethod
  public async refusesToSaveAtCloseBoundsMovedBeforeAnyStoreSoTheyAreReportedLost(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

    window.change("will-resize");

    await Assert.throwsAsync(() => keeper.saveAsync(), WindowStateUnavailableException);
  }

  @TestMethod
  public async restoresSavedBoundsThatADisplayShowsAndMaximizesAShownWindowAtOnce(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    window.isShown = true;
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

    await keeper.restoreAsync(new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: true }));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async maximizesAHiddenWindowOnlyAsItShowsItAndSavesItAsMaximizedMeanwhile(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore({ x: 200, y: 100, width: 1000, height: 700, maximized: true });
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

    await keeper.restoreAsync(store);
    const whileHidden = [...window.calls];
    await keeper.saveAsync();
    keeper.show();
    keeper.show();

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}"]), JSON.stringify(whileHidden));
    Assert.areEqual(JSON.stringify([{ x: 200, y: 100, width: 1000, height: 700, maximized: true }]), JSON.stringify(store.writes));
    Assert.areEqual(JSON.stringify(["setBounds {\"x\":200,\"y\":100,\"width\":1000,\"height\":700}", "maximize", "show", "show"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async shrinksSavedBoundsLargerThanTheirDisplayAndKeepsThemMaximized(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const displays = new FakeDisplayHost();
    displays.workAreas = [{ x: 0, y: 25, width: 1024, height: 743 }];
    displays.primaryWorkArea = { x: 0, y: 25, width: 1024, height: 743 };
    const keeper = new WindowBoundsKeeper(window, displays, 5, new FakeDesktopLog(), false);
    window.isShown = true;

    await keeper.restoreAsync(new MemoryStore({ x: 0, y: 25, width: 1280, height: 800, maximized: true }));
    await keeper.restoreAsync(new MemoryStore({ x: null, y: null, width: 1280, height: 800, maximized: false }));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":51,\"y\":62,\"width\":921,\"height\":668}", "maximize", "setBounds {\"x\":51,\"y\":62,\"width\":921,\"height\":668}"]),
      JSON.stringify(window.calls));
  }

  @TestMethod
  public async centersSavedBoundsThatNoDisplayShows(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

    await keeper.restoreAsync(new MemoryStore({ x: 5000, y: 100, width: 1000, height: 700, maximized: false }));

    Assert.areEqual(JSON.stringify(["setBounds {\"x\":460,\"y\":170,\"width\":1000,\"height\":700}"]), JSON.stringify(window.calls));
  }

  @TestMethod
  public async keepsTheDefaultBoundsWhenNoneWereSavedOrTheyAreNotValid(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);

    await new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true).restoreAsync(new MemoryStore(null));
    await Assert.throwsAsync(() => new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true).restoreAsync(new MemoryStore({ width: 10 })), JsonException);

    Assert.areEqual("[]", JSON.stringify(window.calls));
  }

  @TestMethod
  public async savesOnceAfterAPauseInChanges(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

    window.change("move");
    await keeper.restoreAsync(store);
    window.change("resize");
    window.change("maximize");
    window.isMaximizedNow = true;
    window.change("unmaximize");
    await Condition.waitAsync(() => store.writes.length === 1);

    Assert.areEqual(JSON.stringify([{ x: 100, y: 80, width: 1280, height: 800, maximized: true }]), JSON.stringify(store.writes));
  }

  @TestMethod
  public async savesAtOnceWhenAskedAndNotAfterTheWindowIsGone(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 5, new FakeDesktopLog(), true);

    await keeper.saveAsync();
    await keeper.restoreAsync(store);
    window.change("move");
    await keeper.saveAsync();
    window.bounds = { x: 1, y: 2, width: 700, height: 500 };
    window.change("move");
    await Condition.waitAsync(() => store.writes.at(-1)?.["x"] === 1);
    window.isGone = true;
    await keeper.saveAsync();

    Assert.areEqual(2, store.writes.length);
  }

  @TestMethod
  public async reportsAScheduledSaveThatFails(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const store = new MemoryStore(null);
    store.failure = new Error("The runtime is gone.");
    const log = new FakeDesktopLog();
    const keeper = new WindowBoundsKeeper(window, new FakeDisplayHost(), 1, log, true);

    await keeper.restoreAsync(store);
    window.change("resize");
    await Condition.waitAsync(() => log.lines.length === 1);

    Assert.areEqual(JSON.stringify(["The window's bounds could not be saved: Error: The runtime is gone."]), JSON.stringify(log.lines));
  }
}
