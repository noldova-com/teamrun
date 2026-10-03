/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("the window controls", () => {
  test.skip(process.platform === "darwin", "macOS draws its traffic lights without a title bar overlay.");

  test("follow the window's appearance when the system switches between light and dark mode while the window is open", async ({ desktop }) => {
    const window = desktop.window;
    await window.emulateMedia({ colorScheme: "light" });
    await expect(window.locator("tr-window-row")).toBeVisible();
    await desktop.application.evaluate(({ BrowserWindow }) => {
      const overlays: unknown[] = [];
      const [target] = BrowserWindow.getAllWindows();
      const original = target?.setTitleBarOverlay.bind(target);
      Reflect.set(globalThis, "teamrunOverlays", overlays);
      if (target !== undefined && original !== undefined)
        target.setTitleBarOverlay = options => {
          overlays.push(options);
          original(options);
        };
    });
    const readRow = (): Promise<{ color: string; symbolColor: string }> => window.locator("tr-window-row").evaluate(t => {
      const style = getComputedStyle(t);
      return { color: style.backgroundColor, symbolColor: style.color };
    });
    const lastOverlay = (): Promise<unknown> => desktop.application.evaluate(() => (Reflect.get(globalThis, "teamrunOverlays") as unknown[]).at(-1));
    const light = await readRow();

    await window.emulateMedia({ colorScheme: "dark" });
    await expect.poll(readRow).not.toEqual(light);
    const dark = await readRow();

    await expect.poll(lastOverlay).toMatchObject(dark);
    await window.emulateMedia({ colorScheme: "light" });
    await expect.poll(lastOverlay).toMatchObject(light);
  });
});
