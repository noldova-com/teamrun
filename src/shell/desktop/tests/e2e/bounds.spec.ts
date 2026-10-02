/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Rectangle } from "electron";

import type DesktopApplicationFixture from "./fixtures/desktop-application.fixture.ts";
import { expect, test } from "./fixtures/desktop-test.fixture.ts";

test.describe("window bounds", () => {
  const moved: Rectangle = { x: 40, y: 60, width: 900, height: 640 };
  const readBounds = (desktop: DesktopApplicationFixture): Promise<Rectangle | undefined> =>
    desktop.application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.getNormalBounds());
  const openings: readonly [string, (desktop: DesktopApplicationFixture) => Promise<void>][] = [
    ["reopened while its runtime still runs", t => t.reopenAsync()],
    ["restarted after its runtime stopped", t => t.restartAsync()]
  ];

  for (const [name, openAgainAsync] of openings)
    test(`TeamRun ${name} opens its window where the person left it`, async ({ desktop }) => {
      await desktop.application.evaluate(({ BrowserWindow }, bounds) => BrowserWindow.getAllWindows()[0]?.setBounds(bounds), moved);
      await expect.poll(() => readBounds(desktop)).toEqual(moved);

      await openAgainAsync(desktop);

      await expect.poll(() => desktop.isVisibleAsync()).toBe(true);
      expect(await readBounds(desktop)).toEqual(moved);
    });
});
