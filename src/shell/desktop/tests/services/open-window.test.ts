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
import { type IWindowStateStore, OpenWindow, QuitOutcome, QuitQuestion, WindowStateException, WindowStateUnavailableException } from "@noldova/teamrun-shell-desktop";

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
      const request = window.webContents.sent.find(t => t[0] === "teamrun:closeRequest");
      open.coordinator.answer(request?.[1], true);
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
  public async staysOpenWithoutAskingItsPageToSaveWhileTheGuardKeepsIt(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const guard = new FakeCloseGuard();
    guard.outcome = QuitOutcome.Stay;
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
  public async stopsTheWorkOnlyOnceItsPageHasSavedWhenThePersonChoseTo(): Promise<void> {
    const guard = new FakeCloseGuard();
    guard.outcome = QuitOutcome.StopWork;
    const refusing = new FakeDesktopWindow({}, 1);
    const saving = new FakeDesktopWindow({}, 2);
    const refused = new OpenWindow(refusing, new FakeDisplayHost(), new FakeDesktopLog(), guard, "win32");
    const saved = new OpenWindow(saving, new FakeDisplayHost(), new FakeDesktopLog(), guard, "win32");
    let isGoneWhenStopped: boolean | null = null;
    guard.onStop = () => isGoneWhenStopped = saving.isGone;

    refusing.close();
    await Condition.waitAsync(() => refusing.webContents.sent.some(t => t[0] === "teamrun:closeRequest"));
    refused.coordinator.answer(refusing.webContents.sent.find(t => t[0] === "teamrun:closeRequest")?.[1], false);
    saving.close();
    await Condition.waitAsync(() => saving.webContents.sent.some(t => t[0] === "teamrun:closeRequest"));
    const stopsBeforeSaving = guard.stops;
    saved.coordinator.answer(saving.webContents.sent.find(t => t[0] === "teamrun:closeRequest")?.[1], true);
    await Condition.waitAsync(() => saving.isGone);

    Assert.isFalse(refusing.isGone);
    Assert.areEqual(0, stopsBeforeSaving);
    Assert.areEqual(1, guard.stops);
    Assert.areEqual(false, isGoneWhenStopped);
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

  private static startFence(milliseconds: number): FakeDesktopWindow {
    const fence = new FakeDesktopWindow({}, 99);
    new OpenWindow(fence, new FakeDisplayHost(), new FakeDesktopLog(), new FakeCloseGuard(), "win32").showUnpaintedWithin(milliseconds);
    return fence;
  }
}
