/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import { Assert, TestClass, TestMethod } from "@noldova/teamrun-foundation-testing";
import { OpenWindow } from "@noldova/teamrun-shell-desktop";

import { FakeDesktopLog } from "../fixtures/fake-desktop-log.fixture.js";
import { FakeDesktopWindow } from "../fixtures/fake-desktop-window.fixture.js";
import { FakeDisplayHost } from "../fixtures/fake-display-host.fixture.js";

@TestClass
export class OpenWindowTests {
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
      new OpenWindow(window, new FakeDisplayHost(), log).showUnpaintedWithin(20);
    const isShownEarly = windows.some(t => t.isShown);
    await delay(80);

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
    const open = new OpenWindow(window, new FakeDisplayHost(), log);
    open.settleWithin(10);
    open.showUnpaintedWithin(30);

    open.markPainted();
    const isShownBeforeSettling = window.isShown;
    await delay(80);

    Assert.isFalse(isShownBeforeSettling);
    Assert.areEqual(JSON.stringify(["show"]), JSON.stringify(window.calls));
    Assert.areEqual(0, log.lines.length);
  }

  @TestMethod
  public async showsNothingForAWindowClosedBeforeTheLimit(): Promise<void> {
    const window = new FakeDesktopWindow({}, 1);
    const log = new FakeDesktopLog();
    const open = new OpenWindow(window, new FakeDisplayHost(), log);
    open.settleWithin(10);
    open.showUnpaintedWithin(20);

    window.destroy();
    await delay(60);

    Assert.areEqual("[]", JSON.stringify(window.calls));
    Assert.areEqual(0, log.lines.length);
  }
}
