/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setImmediate } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import type { JsonObject } from "@noldova/teamrun-foundation-json";
import { type IWindowStateStore, OpenWindow, QuitQuestion, WindowStateException, WindowStateUnavailableException } from "@noldova/teamrun-shell-desktop";

import { Condition } from "../fixtures/condition.fixture.js";
import { FakeCloseGuard } from "../fixtures/fake-close-guard.fixture.js";
import { FakeDesktopLog } from "../fixtures/fake-desktop-log.fixture.js";
import { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDisplayHost } from "../fixtures/fake-display-host.fixture.js";

class RefusingStore implements IWindowStateStore {
  private readonly failure: Error;

  public constructor(failure: Error) {
    this.failure = failure;
  }

  public readAsync(): Promise<JsonObject | null> {
    return Promise.resolve(null);
  }

  public writeAsync(): Promise<void> {
    return Promise.reject(this.failure);
  }
}

@TestClass
export class OpenWindowTests {
  @TestMethod
  public async closesAndRecordsTheLostBoundsWhenTheRuntimeIsUnreachableAtClose(): Promise<void> {
    const failures = [new WindowStateUnavailableException("TeamRun is not connected to its runtime."), new WindowStateException("The runtime refused shell.writeWindowBounds: The database is busy.")];
    const closed: FakeDesktopWindow[] = [];
    const log = new FakeDesktopLog();

    for (const [index, failure] of failures.entries()) {
      const window = new FakeDesktopWindow({}, index + 1);
      const open = new OpenWindow(window, new FakeDisplayHost(), log, new FakeCloseGuard(), "win32");
      await open.bounds.restoreAsync(new RefusingStore(failure));
      window.close();
      await Condition.waitAsync(() => OpenWindowTests.closeRequests(window).length === 1);
      open.coordinator.answer(OpenWindowTests.closeRequests(window)[0], true);
      await Condition.waitAsync(() => window.isGone);
      closed.push(window);
    }

    Assert.areEqual(JSON.stringify([true, true]), JSON.stringify(closed.map(t => t.isGone)));
    Assert.areEqual(JSON.stringify([
      "The window closed without saving its bounds, because the runtime could not be reached; the last position is lost: TeamRun is not connected to its runtime.",
      "The window's bounds could not be saved: WindowStateException: The runtime refused shell.writeWindowBounds: The database is busy."
    ]), JSON.stringify(log.lines));
  }

  @TestMethod
  public tellsItsPageEachTimeTheWindowEntersOrLeavesFullScreen(): void {
    const window = new FakeDesktopWindow({}, 1);
    new OpenWindow(window, new FakeDisplayHost(), new FakeDesktopLog(), new FakeCloseGuard(), "darwin");

    window.change("enter-full-screen");
    window.change("leave-full-screen");

    Assert.areEqual(JSON.stringify([["teamrun:fullScreen", true], ["teamrun:fullScreen", false]]), JSON.stringify(window.webContents.sent.filter(t => t[0] === "teamrun:fullScreen")));
  }

  @TestMethod
  public async staysOpenWithoutAskingItsPageToSaveWhileTheGuardKeepsIt(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const guard = new FakeCloseGuard();
    guard.canClose = false;
    const open = new OpenWindow(window, new FakeDisplayHost(), new FakeDesktopLog(), guard, "win32");

    window.close();
    await Condition.waitAsync(() => guard.prompts.length === 1);
    await setImmediate();
    window.close();
    await Condition.waitAsync(() => guard.prompts.length === 2);
    await setImmediate();

    Assert.isFalse(window.isGone);
    Assert.areEqual<unknown>(open, guard.prompts[0]);
    Assert.areEqual(0, window.webContents.sent.filter(t => t[0] === "teamrun:closeRequest").length);
  }

  @TestMethod
  public async savesForAQuitWithoutClosingAndClosesAtOnceWithoutTheGuardWhenTold(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const guard = new FakeCloseGuard();
    const open = new OpenWindow(window, new FakeDisplayHost(), new FakeDesktopLog(), guard, "win32");

    const refusing = open.saveAsync();
    await Condition.waitAsync(() => OpenWindowTests.closeRequests(window).length === 1);
    open.coordinator.answer(OpenWindowTests.closeRequests(window)[0], false);
    const saving = open.saveAsync();
    await Condition.waitAsync(() => OpenWindowTests.closeRequests(window).length === 2);
    open.coordinator.answer(OpenWindowTests.closeRequests(window)[1], true);
    const results = [await refusing, await saving];
    const isGoneAfterSaving = window.isGone;
    open.closeNow();
    open.closeNow();

    Assert.areEqual("false,true", results.join(","));
    Assert.isFalse(isGoneAfterSaving);
    Assert.isTrue(window.isGone);
    Assert.areEqual(0, guard.prompts.length);
  }

  @TestMethod
  public async reportsWhetherItsPageHasPaintedOrItClosedFirst(): Promise<void> {
    const windows = [new FakeDesktopWindow({}, 1), new FakeDesktopWindow({}, 2), new FakeDesktopWindow({}, 3)];
    const [painted, shown, closed] = windows.map(t => new OpenWindow(t, new FakeDisplayHost(), new FakeDesktopLog(), new FakeCloseGuard(), "win32"));

    painted?.markPainted();
    shown?.showNow();
    windows[2]?.destroy();

    Assert.areEqual("true,true,false", (await Promise.all([painted, shown, closed].map(t => t?.whenPaintedAsync()))).join(","));
  }

  @TestMethod
  public showsTheQuestionToItsPageUnlessTheWindowIsGoneOrItsPageHasCrashed(): void {
    const window = new FakeDesktopWindow({}, 1);
    const crashed = new FakeDesktopWindow({}, 2);
    crashed.webContents.crashed = true;
    const gone = new FakeDesktopWindow({}, 3);
    gone.destroy();
    const open = new OpenWindow(window, new FakeDisplayHost(), new FakeDesktopLog(), new FakeCloseGuard(), "win32");

    const shown = open.show(new QuitQuestion(["Indexing the project"], true, false));
    const cleared = open.show(null);
    const onCrashed = new OpenWindow(crashed, new FakeDisplayHost(), new FakeDesktopLog(), new FakeCloseGuard(), "win32").show(null);
    const onGone = new OpenWindow(gone, new FakeDisplayHost(), new FakeDesktopLog(), new FakeCloseGuard(), "win32").show(null);

    Assert.isTrue(shown && cleared);
    Assert.isFalse(onCrashed || onGone);
    Assert.areEqual(
      JSON.stringify([["teamrun:quitQuestion", { descriptions: ["Indexing the project"], isWaiting: true, isUpdate: false }], ["teamrun:quitQuestion", null]]),
      JSON.stringify(window.webContents.sent));
    Assert.areEqual(0, crashed.webContents.sent.length);
  }

  @TestMethod
  public async showsAWindowWhosePageNeverReportsItsPaintAfterTheLimitAndRecordsWhy(): Promise<void> {
    const pages = [{ loading: false, crashed: false }, { loading: true, crashed: false }, { loading: true, crashed: true }];
    const windows = pages.map((t, i) => {
      const window = new FakeDesktopWindow({}, i + 1);
      window.webContents.loading = t.loading;
      window.webContents.crashed = t.crashed;
      return window;
    });
    const log = new FakeDesktopLog();

    for (const window of windows)
      new OpenWindow(window, new FakeDisplayHost(), log, new FakeCloseGuard(), "win32").showUnpaintedWithin(20);
    const isShownEarly = windows.some(t => t.isShown);
    await Condition.waitAsync(() => windows.every(t => t.isShown) && log.lines.length === 3);

    Assert.isFalse(isShownEarly);
    Assert.areEqual(JSON.stringify([["show"], ["show"], ["show"]]), JSON.stringify(windows.map(t => t.calls)));
    Assert.areEqual(JSON.stringify([
      "The window was shown before it was painted, 0.02 s after it opened, because its page loaded but did not report its first paint.",
      "The window was shown before it was painted, 0.02 s after it opened, because its page is still loading.",
      "The window was shown before it was painted, 0.02 s after it opened, because its page has crashed."
    ]), JSON.stringify(log.lines));
  }

  @TestMethod
  public async showsAPaintedWindowOnceSettledAndNeverRecordsItAsUnpainted(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const log = new FakeDesktopLog();
    const open = new OpenWindow(window, new FakeDisplayHost(), log, new FakeCloseGuard(), "win32");
    open.settleWithin(10);
    open.showUnpaintedWithin(30);

    open.markPainted();
    const isShownBeforeSettling = window.isShown;
    const fence = OpenWindowTests.startFence(30);
    await Condition.waitAsync(() => window.isShown && fence.isShown);

    Assert.isFalse(isShownBeforeSettling);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(0, log.lines.length);
  }

  @TestMethod
  public async showsNothingForAWindowClosedBeforeTheLimit(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const log = new FakeDesktopLog();
    const open = new OpenWindow(window, new FakeDisplayHost(), log, new FakeCloseGuard(), "win32");
    open.settleWithin(10);
    open.showUnpaintedWithin(20);

    window.destroy();
    const fence = OpenWindowTests.startFence(20);
    await Condition.waitAsync(() => fence.isShown);

    Assert.areEqual("[]", JSON.stringify(window.calls));
    Assert.areEqual(0, log.lines.length);
  }

  private static closeRequests(window: FakeDesktopWindow): unknown[] {
    return window.webContents.sent.filter(t => t[0] === "teamrun:closeRequest").map(t => t[1]);
  }

  private static startFence(milliseconds: number): FakeDesktopWindow {
    const fence = new FakeDesktopWindow({}, 99);
    new OpenWindow(fence, new FakeDisplayHost(), new FakeDesktopLog(), new FakeCloseGuard(), "win32").showUnpaintedWithin(milliseconds);
    return fence;
  }
}
