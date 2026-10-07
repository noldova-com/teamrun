/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Rectangle } from "electron";

import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import BuildVariantFixture from "./fixtures/build-variant.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.use({ desktopVariant: BuildVariantFixture.noModules });

test.describe("window state", () => {
  const moved: Rectangle = { x: 40, y: 60, width: 900, height: 640 };
  const layout = { version: 1, probe: "window-state" };
  const readBounds = (desktop: DesktopApplicationFixture): Promise<Rectangle | undefined> =>
    desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getNormalBounds());
  const readFocus = async (desktop: DesktopApplicationFixture): Promise<string> => {
    const window = await desktop.application.evaluate(({ BrowserWindow }) => {
      const shown = BrowserWindow.getAllWindows()[0];
      return `maximized ${shown?.isMaximized()}, focused ${shown?.isFocused()}`;
    });
    return `${window}, page focused ${await desktop.window.evaluate(() => document.hasFocus())}`;
  };
  const readLayout = (desktop: DesktopApplicationFixture): Promise<unknown> =>
    desktop.window.evaluate(() => (Reflect.get(globalThis, "teamrun") as { readLayout(): Promise<unknown> }).readLayout());
  const openings: readonly [string, (desktop: DesktopApplicationFixture) => Promise<void>][] = [
    ["quit and reopened", t => t.reopenAsync()],
    ["restarted after its runtime stopped", t => t.restartAsync()]
  ];

  test.describe("where the person left the window", () => {
    test.use({ desktopWindowPlacement: true });

    for (const [name, openAgainAsync] of openings)
      test(`TeamRun ${name} opens its window where the person left it @smoke`, async ({ desktop }) => {
        await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
        await desktop.application.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0]?.setBounds(bounds), moved);
        await expect.poll(() => readBounds(desktop)).toEqual(moved);

        await openAgainAsync(desktop);

        await expect.poll(() => desktop.isVisibleAsync()).toBe(true);
        await expect.poll(() => readBounds(desktop)).toEqual(moved);
      });

    test("TeamRun quit and reopened with its window maximized opens it maximized and focused, so it takes keys without a click @smoke", async ({ desktop }) => {
      test.skip(process.platform === "linux", "The Linux workflows' display has no window manager to maximize a window.");
      await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
      const first = await readFocus(desktop);
      await desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.maximize());
      await expect.poll(() => readFocus(desktop)).toMatch(/^maximized true,/);

      await desktop.reopenAsync();

      await expect.poll(() => desktop.isVisibleAsync()).toBe(true);
      await expect.poll(async () => [first, await readFocus(desktop)])
        .toEqual(["maximized false, focused true, page focused true", "maximized true, focused true, page focused true"]);
    });
  });

  test("the window's layout outlives a restart, kept through the bridge", async ({ desktop }) => {
    await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
    expect(await readLayout(desktop)).toEqual({ payload: null });
    expect(await desktop.window.evaluate(value => (Reflect.get(globalThis, "teamrun") as { writeLayout(layout: unknown): Promise<unknown> }).writeLayout(value), layout)).toEqual({ payload: null });

    await desktop.restartAsync();

    await expect(desktop.window.locator("tr-empty-window")).toBeVisible();
    expect(await readLayout(desktop)).toEqual({ payload: layout });
    await desktop.checkpointAsync("window-state-restarted");
  });
});
