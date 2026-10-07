/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import TabDragFixture from "./fixtures/tab-drag.fixture.ts";

function dock(window: Page): Locator {
  return window.locator("tr-dock[data-side=Left]");
}

async function widthAsync(window: Page): Promise<number> {
  return (await dock(window).boundingBox())?.width ?? 0;
}

test("a panel divider's drag ends when the button is released over the title bar, outside the window or where the window never sees it, and later moves resize nothing", async ({ desktop }) => {
  const window = desktop.window;
  const sash = window.getByRole("separator", { name: "Resize the left dock" });
  await expect(sash).toBeVisible();
  const heading = await TabDragFixture.centerOfAsync(window.locator("tr-window-row .tr-window-row-heading"));
  const away = await TabDragFixture.centerOfAsync(window.locator("tr-tab-group[data-group='0']"));
  const viewport = await window.evaluate(() => innerHeight);
  const session = await window.context().newCDPSession(window);
  const releases: readonly (readonly [string, (x: number, y: number) => Promise<void>])[] = [
    ["over the title bar", async x => {
      await window.mouse.move(x, heading.y, { steps: 4 });
      await window.mouse.up();
    }],
    ["outside the window", async x => {
      await window.mouse.move(x, viewport + 40, { steps: 4 });
      await window.mouse.up();
    }],
    ["where the window never sees it", async (x, y) => {
      await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + 2, y, button: "none", buttons: 0 });
    }]
  ];
  const outcomes: string[] = [];

  for (const [name, releaseAsync] of releases) {
    const grip = await TabDragFixture.centerOfAsync(sash);
    const before = await widthAsync(window);
    await window.mouse.move(grip.x, grip.y);
    await window.mouse.down();
    await window.mouse.move(grip.x + 30, grip.y, { steps: 6 });
    await expect.poll(() => widthAsync(window)).toBeGreaterThan(before + 20);
    await releaseAsync(grip.x + 30, grip.y);
    const released = await widthAsync(window);
    await window.mouse.move(away.x, away.y, { steps: 8 });
    await window.mouse.move(grip.x - 20, grip.y, { steps: 12 });
    await window.mouse.move(away.x, away.y, { steps: 12 });
    await expect(sash).not.toHaveClass(/tr-sash-active/);
    outcomes.push(`${name}: ${Math.abs(await widthAsync(window) - released) < 1}`);
  }
  await window.mouse.up();
  await session.detach();

  expect(outcomes).toEqual(["over the title bar: true", "outside the window: true", "where the window never sees it: true"]);
});
