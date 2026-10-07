/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Locator } from "@playwright/test";

import { expect, test } from "./fixtures/desktop-test.fixture.ts";
import TabDragFixture from "./fixtures/tab-drag.fixture.ts";

async function edgeAsync(sash: Locator): Promise<number> {
  return (await sash.boundingBox())?.x ?? 0;
}

test("a panel divider's drag ends when the button is released over the title bar or outside the window, when the pointer leaves the window or the window loses it while the button is held, and on a move with no button pressed, and later moves resize nothing", async ({ desktop }) => {
  const window = desktop.window;
  const sash = window.getByRole("separator", { name: "Resize the left dock" });
  await expect(sash).toBeVisible();
  const heading = await TabDragFixture.centerOfAsync(window.locator("tr-window-row .tr-window-row-heading"));
  const away = await TabDragFixture.centerOfAsync(window.locator("tr-tab-group[data-group='0']"));
  const viewport = await window.evaluate(() => innerHeight);
  const session = await window.context().newCDPSession(window);
  const endings: readonly (readonly [string, (x: number, y: number) => Promise<void>])[] = [
    ["released over the title bar", async x => {
      await window.mouse.move(x, heading.y, { steps: 4 });
      await window.mouse.up();
    }],
    ["released outside the window", async x => {
      await window.mouse.move(x, viewport + 40, { steps: 4 });
      await window.mouse.up();
    }],
    ["moved with no button pressed", async (x, y) => {
      await session.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x + 2, y, button: "none", buttons: 0 });
    }],
    ["held while the pointer leaves the window", async x => {
      await window.mouse.move(x, -10, { steps: 4 });
    }],
    ["held while the window loses the pointer", async (x, y) => {
      await desktop.application.evaluate(({ BrowserWindow }, point) => BrowserWindow.getAllWindows()[0]?.webContents.sendInputEvent({ type: "mouseLeave", x: point.x, y: point.y }), { x, y });
    }]
  ];
  const outcomes: string[] = [];

  for (const [name, endAsync] of endings) {
    const grip = await TabDragFixture.centerOfAsync(sash);
    const before = await edgeAsync(sash);
    await window.mouse.move(grip.x, grip.y);
    await window.mouse.down();
    await window.mouse.move(grip.x + 30, grip.y, { steps: 6 });
    await expect.poll(() => edgeAsync(sash)).toBeGreaterThan(before + 20);
    await endAsync(grip.x + 30, grip.y);
    const ended = await edgeAsync(sash);
    await window.mouse.move(away.x, away.y, { steps: 8 });
    await window.mouse.move(grip.x - 20, grip.y, { steps: 12 });
    await window.mouse.move(away.x, away.y, { steps: 12 });
    const isActive = await sash.evaluate(t => t.classList.contains("tr-sash-active"));
    await window.mouse.up();
    outcomes.push(`${name}: ${!isActive && Math.abs(await edgeAsync(sash) - ended) < 1}`);
  }
  await session.detach();
  await desktop.checkpointAsync("divider-drag-ended");

  expect(outcomes).toEqual(endings.map(([name]) => `${name}: true`));
});
